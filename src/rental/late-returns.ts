// Late-return helpers that need the site's data. Kept apart from returns.ts so actions.ts can use them
// without an import cycle.
import { collections } from './constants';
import { blockedSet, loadItem, loadSettings, resolveRules, usageByDate } from './availability';
import { claimUnitsForBooking } from './claim';
import { addDays, isDateString, minutesNow, parseHour, todayInTimezone } from './dates';
import { claimedDates, asBooking } from './holds';
import { buildLateReturn, lateReturnCount, type LatePolicy } from './late-rules';
import type { Booking, LateReturn, Quote, RentalItem, Settings } from './models';
import { readPlan } from './plans';
import { quotePrice } from './pricing';
import { queryRows, type Row } from './store';

const merchant = { elevate: true };

export function latePolicy(settings: Settings): LatePolicy {
  return {
    graceMinutes: settings.lateGraceMinutes,
    feeMode: settings.lateFeeMode,
    feeAmount: settings.lateFeeAmount,
    feeMax: settings.lateFeeMax,
    lostAfterDays: settings.lostAfterDays,
  };
}

/** Minutes the booking is past its return time right now, in the business's time zone. */
export function lateMinutesNow(booking: Pick<Booking, 'endDate'>, settings: Settings): number {
  const today = todayInTimezone(settings.timezone);
  const late = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${booking.endDate}T00:00:00Z`)) / 60_000;
  return Math.round(late) + minutesNow(settings.timezone) - parseHour(settings.returnHour);
}

/** The daily rate a late fee is based on: the item's current rate, else the rate the booking was quoted at. */
export function feeRate(booking: Booking, item: RentalItem | null): number {
  return item?.dailyRate || booking.quote.dailyRate || 0;
}

/**
 * The final late-return record when a rental comes back (or is written off) now, or the booking's
 * existing record when it was on time. Undefined when it was never late.
 */
export async function finalLateReturn(booking: Booking, settings?: Settings): Promise<LateReturn | undefined> {
  const current = settings ?? await loadSettings(merchant);
  const item = await loadItem(booking.itemId, merchant);
  const record = buildLateReturn(
    latePolicy(current),
    lateMinutesNow(booking, current),
    feeRate(booking, item),
    booking.quantity,
    booking.lateReturn,
    new Date().toISOString(),
    true,
  );
  return record ?? booking.lateReturn;
}

/**
 * Keeps an overdue rental's units claimed for today and tomorrow, so nobody can book a unit that
 * hasn't come back. A day another booking already holds is skipped; the Today board flags that one.
 */
export async function holdUnitsWhileOut(booking: Booking, item: RentalItem | null, today: string): Promise<void> {
  if (!item) return;
  const held = new Set(await claimedDates(booking._id));
  for (const date of [today, addDays(today, 1)]) {
    if (held.has(date)) continue;
    await claimUnitsForBooking(booking.itemId, booking._id, booking.quantity, [date], item.unitCount).catch(() => false);
  }
}

/** How many earlier rentals this renter brought back late or never returned. */
export async function renterLateCount(email: string, excludeBookingId = ''): Promise<number> {
  const address = email.trim().toLowerCase();
  if (!address) return 0;
  const spellings = [...new Set([email.trim(), address])];
  const result = await queryRows(collections.bookings, merchant).hasSome('renter.email', spellings).limit(200).find();
  const history = result.items
    .map((row) => asBooking(row as Row))
    .filter((booking) => booking._id !== excludeBookingId);
  return lateReturnCount(history);
}

export interface ExtensionCheck {
  ok: boolean;
  message: string;
  quote?: Quote;
  /** Dates the booking doesn't hold yet and has to claim for the longer rental. */
  extraDates: string[];
  item?: RentalItem;
}

/**
 * Checks whether a rental that is out can stay out until `endDate`, and prices the longer rental.
 * Only the days it doesn't hold yet are checked, so it works for overdue rentals too.
 */
export async function checkExtension(booking: Booking, endDate: string): Promise<ExtensionCheck> {
  const fail = (message: string): ExtensionCheck => ({ ok: false, message, extraDates: [] });
  if (!isDateString(endDate)) return fail('Choose a new return date.');
  const [plan, settings, item] = await Promise.all([readPlan(merchant), loadSettings(merchant), loadItem(booking.itemId, merchant)]);
  if (!item) return fail('This item is no longer available.');
  const today = todayInTimezone(settings.timezone);
  const earliest = booking.endDate >= today ? addDays(booking.endDate, 1) : today;
  if (endDate < earliest) return fail(`Choose a return date on or after ${earliest}.`);
  const rules = resolveRules(item, settings, booking.startDate, endDate, plan.perItemRules);
  if (rules.billedDays > rules.maxDays) return fail(`Rentals can last at most ${rules.maxDays} days.`);
  const closed = await blockedSet(item._id, [endDate], merchant);
  if (closed.has(endDate)) return fail('The return date cannot fall on a closed day.');
  const held = new Set(await claimedDates(booking._id));
  const extraDates = rules.occupied.filter((date) => date >= today && !held.has(date)).sort();
  const usage = await usageByDate(item._id, extraDates, merchant, booking._id);
  const taken = extraDates.find((date) => (usage.get(date) ?? 0) + booking.quantity > item.unitCount);
  if (taken) return fail(`This item is booked by someone else from ${taken}. Choose an earlier return date.`);
  const priced = quotePrice({
    billedDays: rules.billedDays,
    dailyRate: item.dailyRate,
    weeklyRate: item.weeklyRate,
    depositAmount: 0,
    quantity: booking.quantity,
  });
  // The deposit was paid with the original order, so only the rental is repriced.
  const quote: Quote = {
    ...priced,
    deposit: booking.quote.deposit,
    total: Math.round((priced.rental + booking.quote.deposit) * 100) / 100,
  };
  return { ok: true, message: 'Available', quote, extraDates, item };
}
