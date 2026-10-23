import { collections } from './constants';
import { checkRange, loadItem, loadSettings } from './availability';
import type { Booking, BookingStatus, DateChangeRequest, Quote, Renter } from './models';
import { bool, num, text } from './models';
import { readPlan } from './plans';
import { claimUnitsForBooking } from './claim';
import { getRow, insertRow, queryRows, removeRows, updateRow, type Access, type Row } from './store';

const merchant = { elevate: true } satisfies Access;

function asQuote(value: unknown): Quote {
  const quote = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    days: num(quote.days),
    rental: num(quote.rental),
    deposit: num(quote.deposit),
    total: num(quote.total),
    dailyRate: num(quote.dailyRate),
    weeklyRate: num(quote.weeklyRate),
    quantity: num(quote.quantity, 1),
  };
}

function asRenter(value: unknown): Renter {
  const renter = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return { name: text(renter.name), email: text(renter.email), phone: text(renter.phone) };
}

function asChangeRequest(value: unknown): DateChangeRequest | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const request = value as Record<string, unknown>;
  if (!text(request.startDate) || !text(request.endDate)) return undefined;
  return {
    type: text(request.type) === 'cancel' ? 'cancel' : 'dates',
    startDate: text(request.startDate),
    endDate: text(request.endDate),
    quote: asQuote(request.quote),
    requestedAt: text(request.requestedAt),
    status: text(request.status) === 'declined' ? 'declined' : 'pending',
  };
}

export function asBooking(row: Row): Booking {
  const status = text(row.status, 'hold') as BookingStatus;
  const outcome = row.depositOutcome;
  return {
    _id: row._id,
    reference: text(row.reference),
    itemId: text(row.itemId),
    quantity: num(row.quantity, 1),
    startDate: text(row.startDate),
    endDate: text(row.endDate),
    status,
    holdExpiresAt: text(row.holdExpiresAt) || undefined,
    holdExtended: bool(row.holdExtended),
    quote: asQuote(row.quote),
    cartLineItemId: text(row.cartLineItemId),
    ecomOrderId: text(row.ecomOrderId),
    renter: asRenter(row.renter),
    memberId: text(row.memberId),
    changeRequest: asChangeRequest(row.changeRequest),
    depositOutcome:
      outcome && typeof outcome === 'object'
        ? {
            outcome: text((outcome as Record<string, unknown>).outcome) === 'kept' ? 'kept' : 'released',
            amountKept: num((outcome as Record<string, unknown>).amountKept),
            note: text((outcome as Record<string, unknown>).note),
          }
        : undefined,
    idempotencyKey: text(row.idempotencyKey),
    refundNeeded: bool(row.refundNeeded),
  };
}

async function audit(action: string, summary: string, bookingId: string, source: string): Promise<void> {
  await insertRow(
    collections.audit,
    { action, summary, bookingId, source, actor: source },
    merchant,
  );
}

export async function expireHolds(): Promise<number> {
  const result = await queryRows(collections.bookings, merchant).eq('status', 'hold').limit(200).find();
  const now = Date.now();
  let expired = 0;
  for (const row of result.items) {
    const booking = asBooking(row as Row);
    const expiry = booking.holdExpiresAt ? Date.parse(booking.holdExpiresAt) : 0;
    if (expiry && expiry > now) continue;
    await releaseUnits(booking._id);
    await updateRow(collections.bookings, { ...row, status: 'expired' } as Row, merchant);
    expired += 1;
  }
  return expired;
}

export async function releaseUnits(bookingId: string): Promise<void> {
  const result = await queryRows(collections.unitDays, merchant).eq('bookingId', bookingId).limit(1000).find();
  await removeRows(
    collections.unitDays,
    result.items.map((row) => row._id).filter((id): id is string => typeof id === 'string'),
    merchant,
  );
}

export interface HoldRequest {
  itemId: string;
  startDate: string;
  endDate: string;
  quantity: number;
  idempotencyKey: string;
}

export async function quoteRental(input: Omit<HoldRequest, 'idempotencyKey'>, excludeBookingId = '') {
  await expireHolds();
  const plan = await readPlan(merchant);
  const settings = await loadSettings(merchant);
  const item = await loadItem(input.itemId, merchant);
  if (!item) return { ok: false as const, message: 'Item not found.' };
  const availability = await checkRange(
    item,
    settings,
    input.startDate,
    input.endDate,
    input.quantity,
    plan.perItemRules,
    merchant,
    excludeBookingId,
  );
  return { ...availability, currency: settings.currency, item };
}

export async function holdRental(input: HoldRequest) {
  const existing = await queryRows(collections.bookings, merchant)
    .eq('idempotencyKey', input.idempotencyKey)
    .limit(1)
    .find();
  const prior = existing.items[0];
  if (prior) return { ok: true as const, booking: asBooking(prior as Row), replayed: true };

  const plan = await readPlan(merchant);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  const monthCount = await queryRows(collections.bookings, merchant)
    .ge('_createdDate', monthStart)
    .limit(1000)
    .find();
  // Sample bookings seeded on install are created this month too, but aren't real rentals.
  const billable = monthCount.items.filter(
    (row) => !['expired', 'cancelled'].includes(text(row.status)) && !text(row.idempotencyKey).startsWith('sample-'),
  ).length;
  if (plan.maxBookingsPerMonth !== null && billable >= plan.maxBookingsPerMonth) {
    return { ok: false as const, message: 'This site has reached its monthly booking limit. Ask the merchant to upgrade.' };
  }

  const quoted = await quoteRental(input);
  if (!quoted.ok || !quoted.quote || !quoted.item) return { ok: false as const, message: quoted.message };

  const reference = `RB-${Math.floor(10000 + Math.random() * 89999)}`;
  const holdExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const created = await insertRow(
    collections.bookings,
    {
      reference,
      itemId: input.itemId,
      quantity: input.quantity,
      startDate: input.startDate,
      endDate: input.endDate,
      status: 'hold',
      holdExpiresAt,
      holdExtended: false,
      quote: quoted.quote,
      cartLineItemId: '',
      ecomOrderId: '',
      renter: { name: '', email: '', phone: '' },
      idempotencyKey: input.idempotencyKey,
      refundNeeded: false,
    },
    merchant,
  );
  const claimed = await claimUnitsForBooking(
    input.itemId,
    created._id,
    input.quantity,
    quoted.occupied,
    quoted.item.unitCount,
  );
  if (!claimed) {
    await updateRow(collections.bookings, { ...created, status: 'expired' }, merchant);
    return { ok: false as const, message: 'Those dates were just taken.' };
  }
  await audit('hold', `Hold ${reference} until ${holdExpiresAt}`, created._id, 'checkout');
  return { ok: true as const, booking: asBooking(created), replayed: false, currency: quoted.currency };
}

export async function extendHold(bookingId: string) {
  const row = await getRow(collections.bookings, bookingId, merchant);
  if (!row) return { ok: false as const, message: 'Booking not found.' };
  const booking = asBooking(row);
  if (booking.status !== 'hold') return { ok: true as const, booking };
  if (booking.holdExtended) return { ok: true as const, booking };
  const holdExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const updated = await updateRow(
    collections.bookings,
    { ...row, holdExpiresAt, holdExtended: true },
    merchant,
  );
  return { ok: true as const, booking: asBooking(updated) };
}

export function catalogAvailable(booking: Booking): boolean {
  if (booking.status === 'expired' || booking.status === 'cancelled' || booking.status === 'returned') return false;
  if (booking.status === 'hold' && booking.holdExpiresAt && Date.parse(booking.holdExpiresAt) < Date.now()) {
    return false;
  }
  return true;
}
