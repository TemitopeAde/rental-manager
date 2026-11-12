// Pure rules for deleting a rental item: no SDK imports, so they can be unit tested without a Wix site.
//
// Deleting is permanent, so it's only allowed when nothing depends on the item:
// - no live bookings (they'd lose their item mid-rental),
// - no real booking history (past bookings and analytics would show "Unknown item"),
// - no Wix Store link (the store sync would just recreate it).
// In those cases the owner archives the item instead, which hides it everywhere and keeps the records.
// Seeded sample bookings don't count; they're deleted with the item.

export type DeleteBlock = 'live' | 'store' | 'history';

const LIVE = new Set(['hold', 'pending', 'confirmed', 'active', 'overdue']);

export interface BookingLike {
  _id: string;
  status: string;
  idempotencyKey: string;
}

export interface DeleteCheck {
  allowed: boolean;
  /** Why it can't be deleted, most urgent first; null when allowed. */
  reason: DeleteBlock | null;
  liveCount: number;
  historyCount: number;
  /** Sample bookings removed along with the item. */
  sampleBookingIds: string[];
}

export function isSampleBooking(booking: { idempotencyKey: string }): boolean {
  return booking.idempotencyKey.startsWith('sample-');
}

export function itemDeleteCheck(bookings: BookingLike[], storeLinked: boolean): DeleteCheck {
  const samples = bookings.filter(isSampleBooking);
  const real = bookings.filter((booking) => !isSampleBooking(booking));
  const liveCount = real.filter((booking) => LIVE.has(booking.status)).length;
  const historyCount = real.length - liveCount;
  const reason: DeleteBlock | null = liveCount > 0 ? 'live' : storeLinked ? 'store' : historyCount > 0 ? 'history' : null;
  return { allowed: reason === null, reason, liveCount, historyCount, sampleBookingIds: samples.map((booking) => booking._id) };
}
