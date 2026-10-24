import { collections } from './constants';
import { loadItem, loadSettings } from './availability';
import { asBooking, catalogAvailable, claimedDates, expireHolds, releaseUnits } from './holds';
import { checkRange } from './availability';
import { addDays, todayInTimezone } from './dates';
import type { Booking, BookingStatus } from './models';
import { text } from './models';
import { readPlan } from './plans';
import { getRow, insertRow, queryRows, updateRow, type Row } from './store';
import { claimUnitsForBooking } from './claim';
import { emailRequestResolved } from './emails';

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
      await audit('refund-needed', `Order ${orderId} paid after the hold expired.`, bookingId, 'order');
      return { ok: false as const, booking: asBooking(updated), message: 'Hold expired and the units are gone. Refund this order.' };
    }
  } else if (booking.status !== 'hold' || !catalogAvailable(booking)) {
    return { ok: false as const, message: `Booking is ${booking.status}.` };
  }
  const plan = await readPlan(merchant);
  const settings = await loadSettings(merchant);
  const next: BookingStatus = plan.manualApproval && settings.approvalMode === 'manual' ? 'pending' : 'confirmed';
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
  await audit(next, `${booking.reference} is ${next} from order ${orderId}.`, bookingId, 'order');
  return { ok: true as const, booking: asBooking(updated) };
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
    plan.perItemRules,
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
    return { ok: true as const, booking: asBooking(updated), refundOrderId: booking.ecomOrderId };
  }
  const next: BookingStatus = action === 'approve' ? 'confirmed' : action === 'pickup' ? 'active' : 'returned';
  if (next === 'returned') await releaseAfterReturn(booking);
  const updated = await saveStatus(row, next);
  await audit(action, `${booking.reference} marked ${next}.`, booking._id, source);
  return { ok: true as const, booking: asBooking(updated), refundOrderId: '' };
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
  if (decision === 'decline') {
    const updated = asBooking(await updateRow(collections.bookings, { ...row, changeRequest: { ...request, status: 'declined' } }, merchant));
    await audit(
      isCancel ? 'cancel-decline' : 'change-decline',
      isCancel ? 'Declined cancellation request.' : `Declined move to ${request.startDate} – ${request.endDate}.`,
      booking._id,
      source,
    );
    await emailRequestResolved(booking, updated, false);
    return { ok: true as const, booking: updated, message: isCancel ? 'Cancellation declined.' : 'Date change declined.' };
  }
  if (isCancel) {
    const result = await transition(booking._id, 'cancel', source, 'Cancelled at renter\'s request');
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
    plan.perItemRules,
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
  const updated = asBooking(await updateRow(
    collections.bookings,
    { ...row, startDate: request.startDate, endDate: request.endDate, quote: availability.quote, changeRequest: null },
    merchant,
  ));
  const difference = availability.quote.total - booking.quote.total;
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

export async function settleDeposit(referenceOrId: string, amountKept: number, note: string, source: string) {
  const booking = await findBooking(referenceOrId);
  if (!booking) return { ok: false as const, message: 'Booking not found.' };
  if (booking.status !== 'returned' && booking.status !== 'overdue' && booking.status !== 'active') {
    return { ok: false as const, message: 'Settle the deposit after the item is returned.' };
  }
  const row = await getRow(collections.bookings, booking._id, merchant);
  if (!row) return { ok: false as const, message: 'Booking not found.' };
  const outcome = amountKept > 0 ? 'kept' : 'released';
  await releaseAfterReturn(booking);
  const updated = await updateRow(
    collections.bookings,
    {
      ...row,
      status: 'returned',
      depositOutcome: { outcome, amountKept, note },
    },
    merchant,
  );
  await audit('settle-deposit', `${outcome} ${amountKept}. ${note}`, booking._id, source);
  return {
    ok: true as const,
    booking: asBooking(updated),
    message: booking.ecomOrderId
      ? `Recorded. Refund the deposit on Wix order ${booking.ecomOrderId}. This app does not move the money.`
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

export async function listBookings(status?: string, from?: string, to?: string) {
  let query = queryRows(collections.bookings, merchant);
  if (status) query = query.eq('status', status);
  if (from) query = query.ge('startDate', from);
  if (to) query = query.le('startDate', to);
  const result = await query.descending('_createdDate').limit(200).find();
  return result.items.map((row) => asBooking(row as Row));
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
