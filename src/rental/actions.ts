import { collections } from './constants';
import { loadItem, loadSettings } from './availability';
import { asBooking, catalogAvailable, expireHolds, releaseUnits } from './holds';
import { checkRange } from './availability';
import type { Booking, BookingStatus } from './models';
import { text } from './models';
import { readPlan } from './plans';
import { getRow, insertRow, queryRows, updateRow, type Row } from './store';
import { claimUnitsForBooking } from './claim';

const merchant = { elevate: true };

async function audit(action: string, summary: string, bookingId: string, source: string) {
  await insertRow(collections.audit, { action, summary, bookingId, source, actor: source }, merchant);
}

async function saveStatus(row: Row, status: BookingStatus, extra: Record<string, unknown> = {}) {
  return updateRow(collections.bookings, { ...row, ...extra, status }, merchant);
}

export async function confirmPaid(bookingId: string, orderId: string, lineItemId: string, renter: Booking['renter']) {
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
  const updated = await saveStatus(row, next);
  await audit(action, `${booking.reference} marked ${next}.`, booking._id, source);
  return { ok: true as const, booking: asBooking(updated), refundOrderId: '' };
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
