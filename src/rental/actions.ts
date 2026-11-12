import { collections } from './constants';
import { loadItem, loadSettings } from './availability';
import { asBooking, catalogAvailable, claimedDates, expireHolds, releaseUnits } from './holds';
import { checkRange } from './availability';
import { addDays, todayInTimezone } from './dates';
import type { Booking, BookingStatus } from './models';
import { BOOKING_STATUSES, OPEN_BOOKING_STATUSES, text } from './models';
import { readPlan } from './plans';
import { getRow, insertRow, queryRows, updateRow, type Row } from './store';
import { claimUnitsForBooking } from './claim';
import { unfinishedInOrder } from './deposit-rules';
import { emailBookingUpdate, emailDepositSettled, emailRefundNeeded, emailRequestResolved } from './emails';
import { checkExtension, finalLateReturn, renterLateCount } from './late-returns';
import { clearReturnNotices } from './late-rules';

const merchant = { elevate: true };

async function audit(action: string, summary: string, bookingId: string, source: string) {
  await insertRow(collections.audit, { action, summary, bookingId, source, actor: source }, merchant);
}

async function saveStatus(row: Row, status: BookingStatus, extra: Record<string, unknown> = {}) {
  return updateRow(collections.bookings, { ...row, ...extra, status }, merchant);
}

export async function confirmPaid(
  bookingId: string,
  orderId: string,
  lineItemId: string,
  renter: Booking['renter'],
  memberId = '',
) {
  await expireHolds();
  const row = await getRow(collections.bookings, bookingId, merchant);
  if (!row) return { ok: false as const, message: 'Booking not found.' };
  const booking = asBooking(row);
  if (booking.status === 'confirmed' || booking.status === 'pending' || booking.status === 'active') {
    return { ok: true as const, booking };
  }
  if (booking.status === 'expired') {
    const reclaimed = await reclaim(booking);
    if (!reclaimed) {
      const updated = await updateRow(collections.bookings, { ...row, refundNeeded: true, ecomOrderId: orderId }, merchant);
      const refundBooking = asBooking(updated);
      await audit('refund-needed', `Order ${orderId} paid after the hold expired.`, bookingId, 'order');
      await emailRefundNeeded(refundBooking, orderId);
      return { ok: false as const, booking: refundBooking, message: 'Hold expired and the units are gone. Refund this order.' };
    }
  } else if (booking.status !== 'hold' || !catalogAvailable(booking)) {
    return { ok: false as const, message: `Booking is ${booking.status}.` };
  }
  const plan = await readPlan(merchant);
  const settings = await loadSettings(merchant);
  const email = renter.email || booking.renter.email;
  // Renters with an earlier late or lost rental wait for approval when the owner asked for that.
  const flagged = plan.manualApproval && settings.reviewLateRenters && (await renterLateCount(email, bookingId)) > 0;
  const next: BookingStatus = plan.manualApproval && (settings.approvalMode === 'manual' || flagged) ? 'pending' : 'confirmed';
  const updated = await saveStatus(row, next, {
    ecomOrderId: orderId,
    cartLineItemId: lineItemId,
    memberId: memberId || booking.memberId,
    renter: {
      name: renter.name || booking.renter.name,
      email: renter.email || booking.renter.email,
      phone: renter.phone || booking.renter.phone,
    },
  });
  await audit(
    next,
    `${booking.reference} is ${next} from order ${orderId}.${flagged && settings.approvalMode !== 'manual' ? ' Held for approval: this renter returned a rental late before.' : ''}`,
    bookingId,
    'order',
  );
  // The owner gets one email per order, sent by the order handler once every line is confirmed.
  return { ok: true as const, booking: asBooking(updated) };
}

/**
 * Records the per-order deposit Wix actually charged on an order against the booking that holds it.
 * Runs after the order's bookings are confirmed; safe to repeat, and leaves a settled deposit alone.
 */
export async function recordOrderDeposit(bookingId: string, orderId: string, amount: number) {
  const row = await getRow(collections.bookings, bookingId, merchant);
  if (!row) return { ok: false as const, message: 'Booking not found.' };
  const booking = asBooking(row);
  if (booking.depositOutcome) return { ok: true as const, booking };
  if (booking.orderDeposit && booking.quote.deposit === amount) return { ok: true as const, booking };
  const quote = {
    ...booking.quote,
    deposit: amount,
    total: Math.round((booking.quote.rental + amount) * 100) / 100,
  };
  const updated = asBooking(await updateRow(collections.bookings, { ...row, quote, orderDeposit: true }, merchant));
  await audit('order-deposit', `${amount.toFixed(2)} order deposit from order ${orderId} recorded on ${booking.reference}.`, bookingId, 'order');
  return { ok: true as const, booking: updated };
}

async function reclaim(booking: Booking): Promise<boolean> {
  const plan = await readPlan(merchant);
  const settings = await loadSettings(merchant);
  const item = await loadItem(booking.itemId, merchant);
  if (!item) return false;
  const availability = await checkRange(
    item,
    settings,
    booking.startDate,
    booking.endDate,
    booking.quantity,
    plan,
    merchant,
  );
  if (!availability.ok) return false;
  return claimUnitsForBooking(booking.itemId, booking._id, booking.quantity, availability.occupied, item.unitCount);
}

// Once an item is back, its remaining days are free again. The buffer still applies, counted from
// today rather than the booked return date, so an early return keeps its turnaround time.
async function releaseAfterReturn(booking: Booking) {
  const plan = await readPlan(merchant);
  const settings = await loadSettings(merchant);
  const item = await loadItem(booking.itemId, merchant);
  const bufferDays = plan.perItemRules && item ? item.bufferDays : settings.defaultBufferDays;
  await releaseUnits(booking._id, addDays(todayInTimezone(settings.timezone), bufferDays));
}

const transitions: Record<string, BookingStatus[]> = {
  approve: ['pending'],
  decline: ['pending'],
  pickup: ['confirmed'],
  returned: ['active', 'overdue'],
  cancel: ['pending', 'confirmed', 'hold'],
};

export async function transition(
  referenceOrId: string,
  action: 'approve' | 'decline' | 'pickup' | 'returned' | 'cancel',
  source: string,
  reason = '',
  notifyRenter = true,
) {
  const booking = await findBooking(referenceOrId);
  if (!booking) return { ok: false as const, message: 'Booking not found.' };
  const allowed = transitions[action] ?? [];
  if (!allowed.includes(booking.status)) {
    return { ok: false as const, message: `${booking.reference} is ${booking.status} and cannot be ${action}.` };
  }
  const row = await getRow(collections.bookings, booking._id, merchant);
  if (!row) return { ok: false as const, message: 'Booking not found.' };
  if (action === 'decline' || action === 'cancel') {
    await releaseUnits(booking._id);
    const updated = await saveStatus(row, 'cancelled');
    const refund = booking.ecomOrderId
      ? ` Refund the payment on Wix order ${booking.ecomOrderId}.`
      : '';
    await audit(action, `${reason || action}.${refund}`, booking._id, source);
    const cancelled = asBooking(updated);
    if (notifyRenter) await emailBookingUpdate(cancelled, action, reason);
    return { ok: true as const, booking: cancelled, refundOrderId: booking.ecomOrderId };
  }
  const next: BookingStatus = action === 'approve' ? 'confirmed' : action === 'pickup' ? 'active' : 'returned';
  const extra: Record<string, unknown> = {};
  if (next === 'returned') {
    await releaseAfterReturn(booking);
    // Freeze the late fee at the moment the rental came back.
    const lateReturn = await finalLateReturn(booking);
    if (lateReturn) extra.lateReturn = lateReturn;
  }
  const updated = await saveStatus(row, next, extra);
  const lateNote = extra.lateReturn
    ? ` ${(extra.lateReturn as { lateDays: number }).lateDays} day(s) late, late fee ${(extra.lateReturn as { fee: number }).fee.toFixed(2)}.`
    : '';
  await audit(action, `${booking.reference} marked ${next}.${lateNote}`, booking._id, source);
  const changed = asBooking(updated);
  if (notifyRenter) await emailBookingUpdate(changed, action);
  return { ok: true as const, booking: changed, refundOrderId: '' };
}

// Applies or turns down a renter's request. A cancellation runs the normal cancel transition. A date change
// re-checks the new dates, moves the unit claims, and reprices; any price difference is left for the merchant
// to settle on the order. Either way the renter is emailed the outcome.
export async function resolveChangeRequest(referenceOrId: string, decision: 'approve' | 'decline', source: string) {
  const booking = await findBooking(referenceOrId);
  if (!booking) return { ok: false as const, message: 'Booking not found.' };
  const request = booking.changeRequest;
  if (!request || request.status !== 'pending') {
    return { ok: false as const, message: `${booking.reference} has no pending request.` };
  }
  const row = await getRow(collections.bookings, booking._id, merchant);
  if (!row) return { ok: false as const, message: 'Booking not found.' };
  const isCancel = request.type === 'cancel';
  const isExtend = request.type === 'extend';
  if (decision === 'decline') {
    const updated = asBooking(await updateRow(collections.bookings, { ...row, changeRequest: { ...request, status: 'declined' } }, merchant));
    await audit(
      isCancel ? 'cancel-decline' : isExtend ? 'extend-decline' : 'change-decline',
      isCancel
        ? 'Declined cancellation request.'
        : isExtend
          ? `Declined extension to ${request.endDate}.`
          : `Declined move to ${request.startDate} – ${request.endDate}.`,
      booking._id,
      source,
    );
    await emailRequestResolved(booking, updated, false);
    return { ok: true as const, booking: updated, message: isCancel ? 'Cancellation declined.' : isExtend ? 'Extension declined.' : 'Date change declined.' };
  }
  if (isExtend) return approveExtension(booking, row, request, source);
  if (isCancel) {
    const result = await transition(booking._id, 'cancel', source, 'Cancelled at renter\'s request', false);
    if (!result.ok) return result;
    const cleared = await getRow(collections.bookings, booking._id, merchant);
    const updated = cleared ? asBooking(await updateRow(collections.bookings, { ...cleared, changeRequest: null }, merchant)) : result.booking;
    await emailRequestResolved(booking, updated, true);
    return {
      ok: true as const,
      booking: updated,
      message: booking.ecomOrderId
        ? `${booking.reference} cancelled. Refund Wix order ${booking.ecomOrderId} from the Orders page.`
        : `${booking.reference} cancelled.`,
    };
  }
  if (booking.status !== 'pending' && booking.status !== 'confirmed') {
    return { ok: false as const, message: `${booking.reference} is ${booking.status} and its dates can't change.` };
  }
  const plan = await readPlan(merchant);
  const settings = await loadSettings(merchant);
  const item = await loadItem(booking.itemId, merchant);
  if (!item) return { ok: false as const, message: 'Item not found.' };
  const availability = await checkRange(
    item,
    settings,
    request.startDate,
    request.endDate,
    booking.quantity,
    plan,
    merchant,
    booking._id,
  );
  if (!availability.ok || !availability.quote) return { ok: false as const, message: availability.message };
  // Put back exactly the days the booking held. Re-running checkRange here would refuse a pickup inside
  // the lead window and leave a confirmed booking holding no units.
  const previousDates = await claimedDates(booking._id);
  await releaseUnits(booking._id);
  const claimed = await claimUnitsForBooking(booking.itemId, booking._id, booking.quantity, availability.occupied, item.unitCount);
  if (!claimed) {
    const restored = await claimUnitsForBooking(booking.itemId, booking._id, booking.quantity, previousDates, item.unitCount);
    if (!restored) {
      await audit('units-lost', `Could not restore ${booking.startDate} – ${booking.endDate} after a failed date change.`, booking._id, source);
      return {
        ok: false as const,
        message: `Those dates are no longer free, and ${booking.reference} lost its original dates to another booking. Check the calendar.`,
      };
    }
    return { ok: false as const, message: 'Those dates are no longer free.' };
  }
  // The deposit was paid with the original order, so moving dates only reprices the rental. This also keeps an
  // order-level deposit on the booking that holds it, which a fresh quote would otherwise reset to zero.
  const quote = {
    ...availability.quote,
    deposit: booking.quote.deposit,
    total: Math.round((availability.quote.rental + booking.quote.deposit) * 100) / 100,
  };
  const updated = asBooking(await updateRow(
    collections.bookings,
    { ...row, startDate: request.startDate, endDate: request.endDate, quote, changeRequest: null },
    merchant,
  ));
  const difference = quote.total - booking.quote.total;
  const settle = difference === 0
    ? 'Price unchanged.'
    : difference > 0
      ? `Collect ${difference.toFixed(2)} more from the renter.`
      : `Refund ${(-difference).toFixed(2)} on Wix order ${booking.ecomOrderId || '(none)'}.`;
  await audit(
    'change-approve',
    `Moved from ${booking.startDate} – ${booking.endDate} to ${request.startDate} – ${request.endDate}. ${settle}`,
    booking._id,
    source,
  );
  const renterNote = difference > 0
    ? `Your new total is ${difference.toFixed(2)} higher; the shop will be in touch about the difference.`
    : difference < 0
      ? `Your new total is ${(-difference).toFixed(2)} lower; the shop will refund the difference.`
      : '';
  await emailRequestResolved(booking, updated, true, renterNote);
  return { ok: true as const, booking: updated, message: `Dates updated. ${settle}` };
}

// Keeps a rental that is out until the requested return date: claims the extra days, reprices the rental,
// and starts a fresh return cycle (no late fee, reminders sent again for the new date).
async function approveExtension(booking: Booking, row: Row, request: NonNullable<Booking['changeRequest']>, source: string) {
  if (booking.status !== 'active' && booking.status !== 'overdue') {
    return { ok: false as const, message: `${booking.reference} is ${booking.status} and can't be extended.` };
  }
  const check = await checkExtension(booking, request.endDate);
  if (!check.ok || !check.quote || !check.item) return { ok: false as const, message: check.message };
  if (check.extraDates.length > 0) {
    const claimed = await claimUnitsForBooking(booking.itemId, booking._id, booking.quantity, check.extraDates, check.item.unitCount);
    if (!claimed) return { ok: false as const, message: 'Those dates are no longer free.' };
  }
  const quote = check.quote;
  const updated = asBooking(await updateRow(
    collections.bookings,
    {
      ...row,
      endDate: request.endDate,
      quote,
      status: 'active',
      changeRequest: null,
      lateReturn: null,
      notices: clearReturnNotices(booking.notices),
    },
    merchant,
  ));
  const difference = Math.round((quote.total - booking.quote.total) * 100) / 100;
  const settle = difference > 0
    ? `Collect ${difference.toFixed(2)} more from the renter: send a payment link from the booking.`
    : 'No extra charge.';
  await audit('extend-approve', `Extended from ${booking.endDate} to ${request.endDate}. ${settle}`, booking._id, source);
  const renterNote = difference > 0
    ? `The extra days cost ${difference.toFixed(2)}; the shop will send you a way to pay.`
    : '';
  await emailRequestResolved(booking, updated, true, renterNote);
  return { ok: true as const, booking: updated, message: `Extended to ${request.endDate}. ${settle}`, collect: Math.max(0, difference) };
}

export async function settleDeposit(referenceOrId: string, amountKept: number, note: string, source: string) {
  const booking = await findBooking(referenceOrId);
  if (!booking) return { ok: false as const, message: 'Booking not found.' };
  // An order deposit can sit on a booking that was later cancelled while the rest of the order went ahead.
  const cancelledHolder = booking.orderDeposit && booking.status === 'cancelled';
  if (!cancelledHolder && booking.status !== 'returned' && booking.status !== 'overdue' && booking.status !== 'active') {
    return { ok: false as const, message: 'Settle the deposit after the item is returned.' };
  }
  if (booking.orderDeposit && booking.ecomOrderId) {
    const siblings = await queryRows(collections.bookings, merchant).eq('ecomOrderId', booking.ecomOrderId).limit(100).find();
    const waiting = unfinishedInOrder(siblings.items.map(asBooking), booking._id);
    if (waiting.length > 0) {
      return {
        ok: false as const,
        message: `This deposit covers the whole order. Settle it after ${waiting.join(', ')} ${waiting.length === 1 ? 'is' : 'are'} returned.`,
      };
    }
  }
  const row = await getRow(collections.bookings, booking._id, merchant);
  if (!row) return { ok: false as const, message: 'Booking not found.' };
  const outcome = amountKept > 0 ? 'kept' : 'released';
  // A cancelled booking already gave its dates back and stays cancelled.
  if (!cancelledHolder && booking.status !== 'returned') await releaseAfterReturn(booking);
  // Settling the deposit of a rental that is still out also records it as back, so the late fee stops here.
  const lateReturn = !cancelledHolder && booking.status !== 'returned' ? await finalLateReturn(booking) : booking.lateReturn;
  const updated = await updateRow(
    collections.bookings,
    {
      ...row,
      status: cancelledHolder ? 'cancelled' : 'returned',
      depositOutcome: { outcome, amountKept, note },
      ...(lateReturn ? { lateReturn } : {}),
    },
    merchant,
  );
  await audit('settle-deposit', `${outcome} ${amountKept}. ${note}`, booking._id, source);
  await emailDepositSettled(asBooking(updated));
  return {
    ok: true as const,
    booking: asBooking(updated),
    message: booking.ecomOrderId
      ? `Recorded. Refund what's left of the deposit from the booking's Refunds section in Rentals, or on Wix order ${booking.ecomOrderId}.`
      : 'Recorded. There is no Wix order to refund.',
  };
}

export async function findBooking(referenceOrId: string): Promise<Booking | null> {
  const direct = await getRow(collections.bookings, referenceOrId, merchant);
  if (direct) return asBooking(direct);
  const result = await queryRows(collections.bookings, merchant).eq('reference', referenceOrId).limit(1).find();
  const row = result.items[0];
  return row ? asBooking(row as Row) : null;
}

/** Resolves a status filter: a single status, `open` (the statuses still to act on), or `all`/empty for no filter. */
function statusFilter(status?: string): readonly BookingStatus[] | null {
  if (!status || status === 'all') return null;
  if (status === 'open') return OPEN_BOOKING_STATUSES;
  return BOOKING_STATUSES.includes(status as BookingStatus) ? [status as BookingStatus] : [];
}

export async function listBookingPage(status?: string, from?: string, to?: string, offset = 0, limit = 200) {
  const statuses = statusFilter(status);
  if (statuses && statuses.length === 0) return { bookings: [], hasMore: false };
  let query = queryRows(collections.bookings, merchant);
  if (statuses) query = statuses.length === 1 ? query.eq('status', statuses[0]) : query.hasSome('status', [...statuses]);
  if (from) query = query.ge('startDate', from);
  if (to) query = query.le('startDate', to);
  const result = await query.descending('_createdDate').skip(offset).limit(limit).find();
  return { bookings: result.items.map((row) => asBooking(row as Row)), hasMore: result.hasNext() };
}

export async function listBookings(status?: string, from?: string, to?: string) {
  return (await listBookingPage(status, from, to)).bookings;
}

/** Booking counts per status, counted in the database rather than from a loaded page. */
export async function countBookingsByStatus(): Promise<{ counts: Record<BookingStatus, number>; open: number; all: number }> {
  const totals = await Promise.all(
    BOOKING_STATUSES.map((status) => queryRows(collections.bookings, merchant).eq('status', status).count()),
  );
  const counts = Object.fromEntries(BOOKING_STATUSES.map((status, index) => [status, totals[index] ?? 0])) as Record<BookingStatus, number>;
  return {
    counts,
    open: OPEN_BOOKING_STATUSES.reduce((sum, status) => sum + counts[status], 0),
    all: totals.reduce((sum, count) => sum + count, 0),
  };
}

export async function cancelByKey(idempotencyKey: string) {
  const result = await queryRows(collections.bookings, merchant).eq('idempotencyKey', idempotencyKey).limit(1).find();
  const row = result.items[0] as Row | undefined;
  if (!row) return { ok: false as const, message: 'Booking not found.' };
  const booking = asBooking(row);
  if (booking.status !== 'hold') return { ok: false as const, message: 'Only an unpaid hold can be cancelled here.' };
  await releaseUnits(booking._id);
  const updated = await saveStatus(row, 'cancelled');
  return { ok: true as const, booking: asBooking(updated) };
}

export { audit };
