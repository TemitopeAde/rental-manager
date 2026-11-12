// Late returns: the overdue sweep and the owner's follow-up actions.
//
// Wix CLI apps have no scheduler, so the sweep runs from ordinary traffic: the dashboard's Today board
// runs it every time it loads, and busy routes (catalog, quotes, My rentals, new orders) start it in the
// background at most once every few minutes. Every email it sends has an idempotency key and is recorded
// in the booking's `notices`, so overlapping sweeps can't email anyone twice.
import { paymentLinks } from '@wix/get-paid';
import { auth } from '@wix/essentials';
import { runInBackground } from '../backend/run-in-background';
import { audit, findBooking } from './actions';
import { loadItem, loadSettings } from './availability';
import { APP_ID, SETTINGS_ID, collections } from './constants';
import { todayInTimezone } from './dates';
import {
  emailBookingUpdate,
  emailNextRenterDelay,
  emailOverdueNotice,
  emailOwnerAtRisk,
  emailOwnerLostFlag,
  emailOwnerOverdue,
  emailPaymentRequest,
  emailReturnReminder,
  type AtRiskSummary,
} from './emails';
import { asBooking, releaseUnits } from './holds';
import {
  atRiskBookings,
  buildLateReturn,
  dueTodayReminderDue,
  DUE_TODAY_NOTICE,
  lateFeeSettlement,
  mergeNotices,
  overdueNoticesDue,
  shouldFlagLost,
  type AtRisk,
} from './late-rules';
import { feeRate, finalLateReturn, holdUnitsWhileOut, lateMinutesNow, latePolicy, renterLateCount } from './late-returns';
import type { Booking, PaymentRequest, RentalItem, Settings } from './models';
import { defaultSettings } from './availability';
import { isPermissionError } from './refund-rules';
import { getRow, insertRow, queryRows, updateRow, type Row } from './store';

const merchant = { elevate: true };
const SWEEP_EVERY_MS = 10 * 60 * 1000;
const AT_RISK_NOTICE = 'at-risk';
const DELAY_WARNED_NOTICE = 'delay-warned';
const OWNER_OVERDUE_NOTICE = 'owner-overdue';

const createPaymentLink = auth.elevate(paymentLinks.createPaymentLink);
const getPaymentLink = auth.elevate(paymentLinks.getPaymentLink);

const PAYMENT_LINK_PERMISSION_MESSAGE =
  'Payment links need the Manage Paylinks permission. Ask the app developer to enable it, or approve the app update on this site, then try again.';

async function stampSweep(settings: Settings) {
  const row = await getRow(collections.settings, SETTINGS_ID, merchant);
  const lastReturnSweepAt = new Date().toISOString();
  if (row) await updateRow(collections.settings, { ...row, lastReturnSweepAt }, merchant);
  else await insertRow(collections.settings, { ...defaultSettings(), _id: SETTINGS_ID, lastReturnSweepAt }, merchant);
  return { ...settings, lastReturnSweepAt };
}

/** Every booking still to hand out or bring back. */
export async function liveBookings(): Promise<Booking[]> {
  const result = await queryRows(collections.bookings, merchant)
    .hasSome('status', ['pending', 'confirmed', 'active', 'overdue'])
    .limit(1000)
    .find();
  return result.items.map((row) => asBooking(row as Row));
}

async function itemLoader() {
  const cache = new Map<string, Promise<RentalItem | null>>();
  return (itemId: string) => {
    if (!cache.has(itemId)) cache.set(itemId, loadItem(itemId, merchant));
    return cache.get(itemId)!;
  };
}

/** Upcoming rentals an overdue item may hold up, with the bookings involved. */
export async function findAtRisk(bookings?: Booking[]): Promise<Array<AtRisk & { booking: Booking; blockers: Booking[] }>> {
  const settings = await loadSettings(merchant);
  const live = bookings ?? await liveBookings();
  const load = await itemLoader();
  const itemIds = [...new Set(live.filter((booking) => booking.status === 'overdue').map((booking) => booking.itemId))];
  const items = await Promise.all(itemIds.map(load));
  const unitCounts = Object.fromEntries(items.flatMap((item) => (item ? [[item._id, item.unitCount]] : [])));
  const byId = new Map(live.map((booking) => [booking._id, booking]));
  return atRiskBookings(live, unitCounts, todayInTimezone(settings.timezone)).flatMap((risk) => {
    const booking = byId.get(risk.bookingId);
    if (!booking) return [];
    return [{ ...risk, booking, blockers: risk.blockedBy.flatMap((id) => byId.get(id) ?? []) }];
  });
}

/**
 * Marks late rentals overdue, keeps their fees and unit claims current, and sends the due-today
 * reminder, overdue notices, and owner alerts. Runs at most once per `minIntervalMs` unless forced.
 */
export async function sweepReturns(options: { force?: boolean; minIntervalMs?: number } = {}): Promise<{ ran: boolean }> {
  let settings = await loadSettings(merchant);
  const last = Date.parse(settings.lastReturnSweepAt);
  const interval = options.minIntervalMs ?? SWEEP_EVERY_MS;
  if (!options.force && Number.isFinite(last) && Date.now() - last < interval) return { ran: false };
  // Stamp first so requests arriving while this runs don't start another sweep.
  settings = await stampSweep(settings);

  const policy = latePolicy(settings);
  const today = todayInTimezone(settings.timezone);
  const nowIso = new Date().toISOString();
  const load = await itemLoader();
  const result = await queryRows(collections.bookings, merchant).hasSome('status', ['active', 'overdue']).limit(1000).find();
  const newlyOverdue: Booking[] = [];

  for (const row of result.items as Row[]) {
    try {
      const booking = asBooking(row);
      const late = lateMinutesNow(booking, settings);
      let notices = booking.notices;
      const patch: Record<string, unknown> = {};

      if (booking.status === 'active' && dueTodayReminderDue(booking.endDate, today, late, notices)) {
        await emailReturnReminder(booking);
        notices = mergeNotices(notices, [DUE_TODAY_NOTICE]);
      }

      const item = await load(booking.itemId);
      const lateReturn = buildLateReturn(policy, late, feeRate(booking, item), booking.quantity, booking.lateReturn, nowIso);
      let current = booking;
      if (lateReturn) {
        patch.status = 'overdue';
        patch.lateReturn = lateReturn;
        current = { ...booking, status: 'overdue', lateReturn };
        if (booking.status === 'active') {
          newlyOverdue.push(current);
          await audit('overdue', `${booking.reference} was due back ${booking.endDate} by ${settings.returnHour}.`, booking._id, 'system');
        }
        await holdUnitsWhileOut(booking, item, today);

        const due = overdueNoticesDue(late, policy.graceMinutes, notices);
        const newest = due[due.length - 1];
        if (newest) {
          await emailOverdueNotice(current, Number(newest.split('-')[1]));
          notices = mergeNotices(notices, due);
        }
        if (!lateReturn.lostFlaggedAt && shouldFlagLost(late, policy.graceMinutes, policy.lostAfterDays)) {
          lateReturn.lostFlaggedAt = nowIso;
          await emailOwnerLostFlag(current);
          await audit('lost-flag', `${booking.reference} is ${lateReturn.lateDays} days late and may not come back.`, booking._id, 'system');
        }
      }

      if (notices !== booking.notices) patch.notices = notices;
      if (Object.keys(patch).length > 0) {
        const fresh = await getRow(collections.bookings, booking._id, merchant);
        // Skip a booking the owner changed while this ran, such as one just marked returned.
        if (fresh && fresh.status === booking.status) await updateRow(collections.bookings, { ...fresh, ...patch }, merchant);
      }
    } catch (error) {
      console.error('[Rental Manager] overdue sweep skipped a booking', error instanceof Error ? error.message : error);
    }
  }

  await alertOwner(newlyOverdue);
  return { ran: true };
}

// One owner email per newly overdue rental, naming the upcoming rentals it holds up; then a separate
// alert for any rental that becomes at risk later.
async function alertOwner(newlyOverdue: Booking[]) {
  const risks = await findAtRisk();
  for (const late of newlyOverdue) {
    const held = risks
      .filter((risk) => risk.blockedBy.includes(late._id))
      .map((risk): AtRiskSummary => ({ reference: risk.booking.reference, renterName: risk.booking.renter.name, startDate: risk.startDate }));
    await emailOwnerOverdue(late, held);
    await addNotices(late._id, [OWNER_OVERDUE_NOTICE]);
  }
  const announced = new Set(newlyOverdue.map((late) => late._id));
  for (const risk of risks) {
    if (risk.booking.notices.includes(AT_RISK_NOTICE)) continue;
    if (!risk.blockedBy.every((id) => announced.has(id))) {
      await emailOwnerAtRisk(risk.booking, risk.blockers.map((late) => late.reference));
    }
    await addNotices(risk.bookingId, [AT_RISK_NOTICE]);
  }
}

async function addNotices(bookingId: string, keys: string[]) {
  const row = await getRow(collections.bookings, bookingId, merchant);
  if (!row) return;
  const notices = mergeNotices(asBooking(row).notices, keys);
  await updateRow(collections.bookings, { ...row, notices }, merchant);
}

/** Starts a sweep after the response is sent, if one is due. Never throws. */
export function kickReturnSweep(): void {
  runInBackground('overdue sweep', () => sweepReturns());
}

// ---------- Owner actions ----------

/**
 * Writes off a rental that won't come back: keeps the whole deposit, freezes the late fee, frees the
 * days it still holds, and (optionally) takes its units out of stock so they can't be booked.
 */
export async function markLost(referenceOrId: string, note: string, removeFromStock: boolean, source: string) {
  const booking = await findBooking(referenceOrId);
  if (!booking) return { ok: false as const, message: 'Booking not found.' };
  if (booking.status !== 'active' && booking.status !== 'overdue') {
    return { ok: false as const, message: `${booking.reference} is ${booking.status}; only a rental that is out can be marked as not returned.` };
  }
  const row = await getRow(collections.bookings, booking._id, merchant);
  if (!row) return { ok: false as const, message: 'Booking not found.' };
  const settings = await loadSettings(merchant);
  const lateReturn = await finalLateReturn(booking, settings);
  await releaseUnits(booking._id, todayInTimezone(settings.timezone));

  let stock = '';
  if (removeFromStock) {
    const itemRow = await getRow(collections.items, booking.itemId, merchant);
    if (itemRow) {
      const units = Math.max(1, Number(itemRow.unitCount) || 1);
      const left = units - booking.quantity;
      if (left >= 1) {
        await updateRow(collections.items, { ...itemRow, unitCount: left }, merchant);
        stock = ` Stock lowered to ${left}.`;
      } else {
        await updateRow(collections.items, { ...itemRow, status: 'hidden' }, merchant);
        stock = ' Item hidden: no units left.';
      }
    }
  }

  const reason = note.trim() || 'Not returned.';
  const keepDeposit = booking.quote.deposit > 0 && !booking.depositOutcome;
  const updated = asBooking(await updateRow(
    collections.bookings,
    {
      ...row,
      status: 'lost',
      ...(lateReturn ? { lateReturn } : {}),
      ...(keepDeposit ? { depositOutcome: { outcome: 'kept', amountKept: booking.quote.deposit, note: reason } } : {}),
    },
    merchant,
  ));
  await audit('lost', `${reason}${keepDeposit ? ` Kept the ${booking.quote.deposit.toFixed(2)} deposit.` : ''}${stock}`, booking._id, source);
  await emailBookingUpdate(updated, 'lost', note.trim());
  return { ok: true as const, booking: updated, message: `${booking.reference} recorded as not returned.${stock}` };
}

/** Emails an upcoming renter that their item hasn't come back yet. */
export async function warnNextRenter(referenceOrId: string, source: string) {
  const booking = await findBooking(referenceOrId);
  if (!booking) return { ok: false as const, message: 'Booking not found.' };
  if (booking.status !== 'pending' && booking.status !== 'confirmed') {
    return { ok: false as const, message: `${booking.reference} is ${booking.status}.` };
  }
  if (!booking.renter.email) return { ok: false as const, message: 'This booking has no renter email.' };
  await emailNextRenterDelay(booking);
  await addNotices(booking._id, [DELAY_WARNED_NOTICE]);
  await audit('delay-warned', 'Renter warned that the item may be late.', booking._id, source);
  return { ok: true as const, message: `${booking.renter.name || booking.renter.email} was emailed.` };
}

/** The late fee still to collect after what the deposit covers. */
export function lateFeeBalance(booking: Booking): number {
  const fee = booking.lateReturn?.fee ?? 0;
  const kept = booking.depositOutcome?.amountKept ?? 0;
  if (booking.depositOutcome) {
    // Whatever the owner kept from the deposit went toward the fee first.
    return Math.max(0, Math.round((fee - kept) * 100) / 100);
  }
  return lateFeeSettlement(fee, booking.quote.deposit).balance;
}

/**
 * Creates a one-time Wix payment link for money owed after checkout (a late fee or an extension) and
 * emails it to the renter. The link isn't tied to the original order, so it works when that order is
 * already paid in full.
 */
export async function sendPaymentLink(referenceOrId: string, kind: PaymentRequest['kind'], amount: number, source: string) {
  const booking = await findBooking(referenceOrId);
  if (!booking) return { ok: false as const, message: 'Booking not found.' };
  const value = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(value) || value <= 0) return { ok: false as const, message: 'Enter an amount above zero.' };
  if (!booking.renter.email) return { ok: false as const, message: 'This booking has no renter email to send the link to.' };
  if (booking.paymentRequests.some((request) => request.kind === kind && request.status === 'unpaid')) {
    return { ok: false as const, message: 'An unpaid link of this kind was already sent. Check its status first.' };
  }
  const [settings, item] = await Promise.all([loadSettings(merchant), loadItem(booking.itemId, merchant)]);
  const label = kind === 'late-fee' ? 'Late return fee' : 'Rental extension';
  const itemName = item?.name ?? 'Rental';
  let created: { _id?: string | null; links?: { url?: string | { url?: string | null } | null } | null };
  try {
    created = await createPaymentLink({
      title: `${label} · ${booking.reference}`,
      description: `${label} for ${itemName} (${booking.reference}).`,
      currency: settings.currency,
      type: 'ECOM',
      paymentsLimit: 1,
      source: { appId: APP_ID, entityId: booking._id },
      ecomPaymentLink: {
        lineItems: [{
          type: 'CUSTOM',
          customItem: { name: `${label} · ${itemName}`, quantity: 1, price: value.toFixed(2), description: booking.reference },
        }],
      },
    } as never) as typeof created;
  } catch (error) {
    console.error('[Rental Manager] could not create a payment link', error);
    return { ok: false as const, message: isPermissionError(error) ? PAYMENT_LINK_PERMISSION_MESSAGE : 'Wix could not create the payment link. Check that the site is published and accepts payments.' };
  }
  const url = created.links?.url;
  const linkUrl = typeof url === 'string' ? url : url?.url ?? '';
  if (!created._id || !linkUrl) return { ok: false as const, message: 'Wix created the payment link but returned no address for it.' };
  const request: PaymentRequest = { kind, amount: value, linkId: created._id, url: linkUrl, status: 'unpaid', at: new Date().toISOString() };
  const row = await getRow(collections.bookings, booking._id, merchant);
  if (!row) return { ok: false as const, message: 'Booking not found.' };
  const updated = asBooking(await updateRow(collections.bookings, { ...row, paymentRequests: [...booking.paymentRequests, request] }, merchant));
  await emailPaymentRequest(updated, request);
  await audit('payment-link', `${label}: ${value.toFixed(2)} payment link sent.`, booking._id, source);
  return { ok: true as const, booking: updated, message: `Payment link for ${value.toFixed(2)} emailed to ${booking.renter.email}.` };
}

/** Updates the status of the booking's unpaid payment links from Wix. */
export async function refreshPaymentLinks(referenceOrId: string) {
  const booking = await findBooking(referenceOrId);
  if (!booking) return { ok: false as const, message: 'Booking not found.' };
  if (!booking.paymentRequests.some((request) => request.status === 'unpaid')) return { ok: true as const, booking, changed: false };
  let changed = false;
  const requests = await Promise.all(booking.paymentRequests.map(async (request) => {
    if (request.status !== 'unpaid') return request;
    try {
      const link = await getPaymentLink(request.linkId);
      const status = String(link.status ?? '');
      const next: PaymentRequest['status'] = status === 'PAID' ? 'paid' : status === 'INACTIVE' || status === 'EXPIRED' ? 'inactive' : 'unpaid';
      if (next !== request.status) changed = true;
      return { ...request, status: next };
    } catch {
      return request;
    }
  }));
  if (!changed) return { ok: true as const, booking, changed };
  const row = await getRow(collections.bookings, booking._id, merchant);
  if (!row) return { ok: false as const, message: 'Booking not found.' };
  const updated = asBooking(await updateRow(collections.bookings, { ...row, paymentRequests: requests }, merchant));
  for (const request of requests) {
    if (request.status === 'paid' && booking.paymentRequests.find((before) => before.linkId === request.linkId)?.status !== 'paid') {
      await audit('payment-received', `${request.amount.toFixed(2)} paid through the payment link.`, booking._id, 'system');
    }
  }
  return { ok: true as const, booking: updated, changed };
}

/** Earlier late or lost rentals from this booking's renter. */
export async function renterHistory(referenceOrId: string) {
  const booking = await findBooking(referenceOrId);
  if (!booking) return { ok: false as const, message: 'Booking not found.' };
  return { ok: true as const, lateReturns: await renterLateCount(booking.renter.email, booking._id) };
}
