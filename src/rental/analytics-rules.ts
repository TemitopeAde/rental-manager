// Pure analytics math: no SDK imports, so it can be unit tested without a Wix site.

export type Bucket = 'day' | 'week' | 'month';

// The booking fields analytics reads. Every count and sum is by pickup date.
export interface AnalyticsBooking {
  itemId: string;
  status: string;
  startDate: string;
  quantity: number;
  ecomOrderId: string;
  idempotencyKey: string;
  quote: { days: number; rental: number };
  depositOutcome?: { outcome: 'released' | 'kept'; amountKept: number };
}

export interface AnalyticsItem {
  _id: string;
  name: string;
  unitCount: number;
}

export interface Totals {
  revenue: number;
  bookings: number;
  averageValue: number;
  averageDays: number;
  depositsKept: number;
  cancelled: number;
}

export interface SeriesPoint {
  key: string;
  revenue: number;
  bookings: number;
}

export interface ItemStat {
  itemId: string;
  name: string;
  revenue: number;
  bookings: number;
  utilization: number;
}

// Booked and paid for (or added by hand). Holds, expired holds and cancellations aren't revenue.
const PAID = new Set(['pending', 'confirmed', 'active', 'overdue', 'returned']);

export function isPaid(booking: Pick<AnalyticsBooking, 'status'>): boolean {
  return PAID.has(booking.status);
}

// A cancellation only counts when there was a real booking to cancel, not an abandoned cart hold.
function wasBooked(booking: AnalyticsBooking): boolean {
  return Boolean(booking.ecomOrderId) || booking.idempotencyKey.startsWith('manual-');
}

const DAY_MS = 86_400_000;

function toTime(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function addDays(date: string, days: number): string {
  return new Date(toTime(date) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toTime(to) - toTime(from)) / DAY_MS) + 1;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function bucketFor(from: string, to: string): Bucket {
  const span = daysBetween(from, to);
  if (span <= 31) return 'day';
  if (span <= 92) return 'week';
  return 'month';
}

// Weeks start on Monday; months on the 1st. Keys are the bucket's first day, so they sort as text.
export function bucketKey(date: string, bucket: Bucket): string {
  if (bucket === 'day') return date;
  if (bucket === 'month') return `${date.slice(0, 7)}-01`;
  const weekday = new Date(toTime(date)).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

export function totals(bookings: AnalyticsBooking[]): Totals {
  const paid = bookings.filter(isPaid);
  const revenue = paid.reduce((sum, booking) => sum + booking.quote.rental, 0);
  const days = paid.reduce((sum, booking) => sum + booking.quote.days, 0);
  return {
    revenue: round(revenue),
    bookings: paid.length,
    averageValue: paid.length ? round(revenue / paid.length) : 0,
    averageDays: paid.length ? round(days / paid.length) : 0,
    depositsKept: round(paid.reduce((sum, booking) => sum + (booking.depositOutcome?.outcome === 'kept' ? booking.depositOutcome.amountKept : 0), 0)),
    cancelled: bookings.filter((booking) => booking.status === 'cancelled' && wasBooked(booking)).length,
  };
}

// Every bucket in the range, empty ones included, so the chart's time axis has no gaps.
export function series(bookings: AnalyticsBooking[], from: string, to: string, bucket: Bucket): SeriesPoint[] {
  const points = new Map<string, SeriesPoint>();
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const key = bucketKey(date, bucket);
    if (!points.has(key)) points.set(key, { key, revenue: 0, bookings: 0 });
  }
  for (const booking of bookings) {
    if (!isPaid(booking) || booking.startDate < from || booking.startDate > to) continue;
    const point = points.get(bucketKey(booking.startDate, bucket));
    if (!point) continue;
    point.revenue = round(point.revenue + booking.quote.rental);
    point.bookings += 1;
  }
  return [...points.values()];
}

// Unit-days rented inside [from, to]. `active` are bookings overlapping the range, whatever their pickup date.
export function rentedUnitDays(booking: AnalyticsBooking, from: string, to: string): number {
  const end = addDays(booking.startDate, Math.max(1, booking.quote.days) - 1);
  const start = booking.startDate > from ? booking.startDate : from;
  const last = end < to ? end : to;
  return start > last ? 0 : daysBetween(start, last) * booking.quantity;
}

export function utilization(active: AnalyticsBooking[], units: number, from: string, to: string): number {
  const capacity = units * daysBetween(from, to);
  if (capacity <= 0) return 0;
  const rented = active.filter(isPaid).reduce((sum, booking) => sum + rentedUnitDays(booking, from, to), 0);
  return Math.min(1, rented / capacity);
}

export function itemStats(
  bookings: AnalyticsBooking[],
  active: AnalyticsBooking[],
  items: AnalyticsItem[],
  from: string,
  to: string,
): ItemStat[] {
  return items
    .map((item) => {
      const own = bookings.filter((booking) => booking.itemId === item._id && isPaid(booking));
      return {
        itemId: item._id,
        name: item.name,
        revenue: round(own.reduce((sum, booking) => sum + booking.quote.rental, 0)),
        bookings: own.length,
        utilization: utilization(active.filter((booking) => booking.itemId === item._id), item.unitCount, from, to),
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.bookings - a.bookings || a.name.localeCompare(b.name));
}

export function statusCounts(bookings: AnalyticsBooking[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const booking of bookings) {
    if (booking.status === 'hold' || booking.status === 'expired') continue;
    if (booking.status === 'cancelled' && !wasBooked(booking)) continue;
    counts[booking.status] = (counts[booking.status] ?? 0) + 1;
  }
  return counts;
}
