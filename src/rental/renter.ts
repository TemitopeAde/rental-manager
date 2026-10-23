import { collections } from './constants';
import { findBooking, audit } from './actions';
import { loadItem, loadSettings } from './availability';
import { emailRequestReceived } from './emails';
import { asBooking, quoteRental } from './holds';
import type { Booking, DateChangeRequest } from './models';
import type { SiteMember } from './guard';
import { getRow, queryRows, updateRow, type Row } from './store';

const merchant = { elevate: true };

// Bookings a renter can change: paid for, and not yet picked up.
const changeable = ['pending', 'confirmed'];

export function ownsBooking(booking: Booking, member: SiteMember): boolean {
  if (booking.memberId) return booking.memberId === member.memberId;
  return Boolean(member.email) && booking.renter.email.trim().toLowerCase() === member.email;
}

export interface RenterBooking extends Booking {
  itemName: string;
}

export async function listMemberBookings(member: SiteMember) {
  const [byMember, byEmail] = await Promise.all([
    queryRows(collections.bookings, merchant).eq('memberId', member.memberId).limit(200).find(),
    member.email
      ? queryRows(collections.bookings, merchant).eq('renter.email', member.email).limit(200).find()
      : Promise.resolve({ items: [] }),
  ]);
  const seen = new Set<string>();
  const bookings: Booking[] = [];
  for (const row of [...byMember.items, ...byEmail.items]) {
    const booking = asBooking(row as Row);
    if (seen.has(booking._id) || booking.status === 'hold' || booking.status === 'expired') continue;
    if (!ownsBooking(booking, member)) continue;
    seen.add(booking._id);
    bookings.push(booking);
  }
  bookings.sort((a, b) => b.startDate.localeCompare(a.startDate));
  const names = new Map<string, string>();
  for (const id of new Set(bookings.map((booking) => booking.itemId))) {
    const item = await loadItem(id, merchant);
    names.set(id, item?.name ?? 'Rental');
  }
  const settings = await loadSettings(merchant);
  return {
    currency: settings.currency,
    bookings: bookings.map((booking): RenterBooking => ({ ...booking, itemName: names.get(booking.itemId) ?? 'Rental' })),
  };
}

async function ownedBooking(reference: string, member: SiteMember) {
  const booking = reference ? await findBooking(reference) : null;
  return booking && ownsBooking(booking, member) ? booking : null;
}

// Saves a pending request on the booking, then emails the owner and the renter. Nothing else changes yet.
async function fileRequest(booking: Booking, request: Omit<DateChangeRequest, 'requestedAt' | 'status'>) {
  if (booking.changeRequest?.status === 'pending') {
    return { ok: false as const, status: 400, message: 'You already have a request waiting for the shop.' };
  }
  const row = await getRow(collections.bookings, booking._id, merchant);
  if (!row) return { ok: false as const, status: 404, message: 'Booking not found.' };
  const changeRequest: DateChangeRequest = { ...request, requestedAt: new Date().toISOString(), status: 'pending' };
  const updated = asBooking(await updateRow(collections.bookings, { ...row, changeRequest }, merchant));
  await audit(
    request.type === 'cancel' ? 'cancel-request' : 'change-request',
    request.type === 'cancel'
      ? 'Renter asked to cancel.'
      : `Renter asked to move to ${request.startDate} – ${request.endDate}.`,
    booking._id,
    'renter',
  );
  await emailRequestReceived(updated);
  return { ok: true as const, status: 200 };
}

export async function renterCancel(reference: string, member: SiteMember) {
  const booking = await ownedBooking(reference, member);
  if (!booking) return { ok: false as const, status: 404, message: 'Booking not found.' };
  if (!changeable.includes(booking.status)) {
    return { ok: false as const, status: 400, message: 'This booking can no longer be cancelled online.' };
  }
  const result = await fileRequest(booking, {
    type: 'cancel',
    startDate: booking.startDate,
    endDate: booking.endDate,
    quote: booking.quote,
  });
  return result.ok
    ? { ...result, message: 'Cancellation requested. The shop will confirm by email.' }
    : result;
}

// Prices new dates for an existing booking without counting the units it already holds.
export async function quoteDateChange(reference: string, startDate: string, endDate: string, member: SiteMember) {
  const booking = await ownedBooking(reference, member);
  if (!booking) return { ok: false as const, status: 404, message: 'Booking not found.' };
  if (!changeable.includes(booking.status)) {
    return { ok: false as const, status: 400, message: 'The dates of this booking can no longer be changed.' };
  }
  if (startDate === booking.startDate && endDate === booking.endDate) {
    return { ok: false as const, status: 400, message: 'Pick dates that differ from your current booking.' };
  }
  const quoted = await quoteRental({ itemId: booking.itemId, startDate, endDate, quantity: booking.quantity }, booking._id);
  if (!quoted.ok || !quoted.quote) return { ok: false as const, status: 400, message: quoted.message };
  return { ok: true as const, status: 200, booking, quote: quoted.quote, difference: quoted.quote.total - booking.quote.total };
}

export async function requestDateChange(reference: string, startDate: string, endDate: string, member: SiteMember) {
  const quoted = await quoteDateChange(reference, startDate, endDate, member);
  if (!quoted.ok) return quoted;
  const result = await fileRequest(quoted.booking, { type: 'dates', startDate, endDate, quote: quoted.quote });
  return result.ok
    ? { ...result, message: 'Request sent. The shop will confirm your new dates by email.' }
    : result;
}
