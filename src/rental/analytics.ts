import { collections } from './constants';
import { loadSettings } from './availability';
import { todayInTimezone } from './dates';
import { asBooking } from './holds';
import { listItems } from './merchant';
import { queryRows, type Row } from './store';
import {
  addDays,
  bucketFor,
  daysBetween,
  itemStats,
  series,
  statusCounts,
  totals,
  utilization,
  type AnalyticsBooking,
} from './analytics-rules';

const merchant = { elevate: true };
// Wix Data returns at most 1000 rows per query; past that the report says it is partial.
const PAGE = 1000;

export const RANGES = { '7d': 7, '30d': 30, '90d': 90, '12m': 365 } as const;
export type RangeKey = keyof typeof RANGES;

function toAnalytics(row: Row): AnalyticsBooking {
  const booking = asBooking(row);
  return {
    itemId: booking.itemId,
    status: booking.status,
    startDate: booking.startDate,
    quantity: booking.quantity,
    ecomOrderId: booking.ecomOrderId,
    idempotencyKey: booking.idempotencyKey,
    quote: { days: booking.quote.days, rental: booking.quote.rental },
    depositOutcome: booking.depositOutcome,
  };
}

export async function rentalAnalytics(range: RangeKey) {
  const settings = await loadSettings(merchant);
  const to = todayInTimezone(settings.timezone);
  const from = addDays(to, -(RANGES[range] - 1));
  // The period just before, the same length, for the change figures.
  const previousFrom = addDays(from, -daysBetween(from, to));
  const previousTo = addDays(from, -1);

  const [byPickup, overlapping, items] = await Promise.all([
    queryRows(collections.bookings, merchant).ge('startDate', previousFrom).le('startDate', to).limit(PAGE).find(),
    // Utilization also counts rentals picked up before the range that are still out during it.
    queryRows(collections.bookings, merchant).le('startDate', to).ge('endDate', from).limit(PAGE).find(),
    listItems(),
  ]);
  const bookings = byPickup.items.map((row) => toAnalytics(row as Row));
  const current = bookings.filter((booking) => booking.startDate >= from);
  const previous = bookings.filter((booking) => booking.startDate <= previousTo);
  const active = overlapping.items.map((row) => toAnalytics(row as Row));
  const fleet = items.filter((item) => item.status !== 'archived');
  const bucket = bucketFor(from, to);

  return {
    range,
    from,
    to,
    bucket,
    currency: settings.currency,
    current: { ...totals(current), utilization: utilization(active, fleet.reduce((sum, item) => sum + item.unitCount, 0), from, to) },
    previous: totals(previous),
    series: series(current, from, to, bucket),
    items: itemStats(current, active, fleet, from, to),
    statuses: statusCounts(current),
    partial: byPickup.items.length >= PAGE || overlapping.items.length >= PAGE,
  };
}

export type RentalAnalytics = Awaited<ReturnType<typeof rentalAnalytics>>;
