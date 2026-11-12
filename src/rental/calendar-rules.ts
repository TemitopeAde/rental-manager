import { addDays, eachDate } from './dates.ts';
import { rentalLength } from './pricing.ts';

/**
 * What the booking calendar needs to know about one item, so it can grey out dates the
 * server would reject. Pure data: the server builds it, the site widget reads it, and both
 * judge a range with the functions below, so the calendar and the hold check can't disagree.
 */
export interface ItemAvailability {
  itemId: string;
  /** False when the item can't take bookings at all (inactive, or not on the current plan). */
  bookable: boolean;
  unitCount: number;
  /** Units already claimed per date (paid bookings and unexpired holds). Dates not listed are fully free. */
  used: Record<string, number>;
  /** Days the shop or this item is closed. Pickup and return can't fall on them; a rental may span them. */
  closed: string[];
  /** First and last allowed pickup dates, in the site's time zone. */
  earliestStart: string;
  latestStart: string;
  minDays: number;
  maxDays: number;
  bufferDays: number;
  countReturnDay: boolean;
}

export type RangeProblem = 'unbookable' | 'too_early' | 'too_late' | 'closed' | 'too_short' | 'too_long' | 'taken';

/** The dates a rental holds units on: the billed days plus the turnaround buffer. Mirrors resolveRules on the server. */
export function occupiedDates(start: string, end: string, countReturnDay: boolean, bufferDays: number) {
  const billedDays = rentalLength(start, end, countReturnDay);
  return { billedDays, occupied: eachDate(start, billedDays + bufferDays) };
}

export function freeUnits(availability: ItemAvailability, date: string): number {
  return availability.unitCount - (availability.used[date] ?? 0);
}

/** Why `start` can't begin a rental of `quantity` units, or null if it can. */
export function startProblem(availability: ItemAvailability, start: string, quantity: number): RangeProblem | null {
  if (!availability.bookable) return 'unbookable';
  if (start < availability.earliestStart) return 'too_early';
  if (start > availability.latestStart) return 'too_late';
  if (availability.closed.includes(start)) return 'closed';
  if (freeUnits(availability, start) < quantity) return 'taken';
  return null;
}

/** Why `start`–`end` can't be booked for `quantity` units, or null if the server would accept it. */
export function rangeProblem(availability: ItemAvailability, start: string, end: string, quantity: number): RangeProblem | null {
  const atStart = startProblem(availability, start, quantity);
  if (atStart) return atStart;
  if (end < start) return 'too_short';
  if (availability.closed.includes(end)) return 'closed';
  const { billedDays, occupied } = occupiedDates(start, end, availability.countReturnDay, availability.bufferDays);
  if (billedDays < availability.minDays) return 'too_short';
  if (billedDays > availability.maxDays) return 'too_long';
  if (occupied.some((date) => freeUnits(availability, date) < quantity)) return 'taken';
  return null;
}

/** Whether a day has no unit left for `quantity`, for showing it as booked rather than just unavailable. */
export function isFullyBooked(availability: ItemAvailability, date: string, quantity: number): boolean {
  return freeUnits(availability, date) < quantity;
}

/** The last date whose claims can affect a pickup on or before `latestStart`. */
export function availabilityWindowEnd(latestStart: string, maxDays: number, bufferDays: number): string {
  return addDays(latestStart, maxDays + bufferDays + 1);
}
