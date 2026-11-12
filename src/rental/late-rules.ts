// Pure late-return rules: no SDK imports, so they can be unit tested without a Wix site.
//
// Lateness is measured in the business's local time: minutes past the return time on the booked return
// date. A grace period forgives the first few minutes; once it passes the rental is overdue and every
// late day (or hour) counts from the original return time, not from the end of the grace period.

export type LateFeeMode = 'off' | 'day' | 'hour' | 'rate';

export const LATE_FEE_MODES: readonly LateFeeMode[] = ['off', 'day', 'hour', 'rate'];

export function asLateFeeMode(value: unknown): LateFeeMode {
  return LATE_FEE_MODES.includes(value as LateFeeMode) ? (value as LateFeeMode) : 'off';
}

export interface LatePolicy {
  graceMinutes: number;
  feeMode: LateFeeMode;
  /** Per late day or hour, in money; a percentage of the item's daily rate in 'rate' mode. */
  feeAmount: number;
  /** Most a single booking can be charged; 0 means no limit. */
  feeMax: number;
  /** Flag a rental as probably lost this many days after its return time; 0 turns it off. */
  lostAfterDays: number;
}

/** Days after the return time on which the renter gets an overdue email: the day it goes overdue, then follow-ups. */
export const OVERDUE_NOTICE_DAYS = [0, 1, 3] as const;

/** How far ahead the Today board looks for upcoming rentals an overdue item could hold up. */
export const AT_RISK_WINDOW_DAYS = 3;

const DAY_MINUTES = 1440;

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function dayNumber(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

/** Minutes past the return time. Negative while the rental is not yet due. */
export function minutesLate(endDate: string, returnMinutes: number, today: string, nowMinutes: number): number {
  return (dayNumber(today) - dayNumber(endDate)) * DAY_MINUTES + nowMinutes - returnMinutes;
}

export function isOverdue(late: number, graceMinutes: number): boolean {
  return late > Math.max(0, graceMinutes);
}

/** Whole late days and hours, each started one counted in full. Zero while not late. */
export function lateUnits(late: number): { days: number; hours: number } {
  if (late <= 0) return { days: 0, hours: 0 };
  return { days: Math.ceil(late / DAY_MINUTES), hours: Math.ceil(late / 60) };
}

/** The late fee owed so far for one booking. Charged per unit rented; zero inside the grace period. */
export function lateFee(policy: LatePolicy, late: number, dailyRate: number, quantity: number): number {
  if (policy.feeMode === 'off' || !isOverdue(late, policy.graceMinutes)) return 0;
  const amount = Math.max(0, Number(policy.feeAmount) || 0);
  const units = Math.max(1, quantity);
  const { days, hours } = lateUnits(late);
  let fee = 0;
  if (policy.feeMode === 'day') fee = days * amount * units;
  else if (policy.feeMode === 'hour') fee = hours * amount * units;
  else fee = days * Math.max(0, dailyRate) * (amount / 100) * units;
  const max = Math.max(0, Number(policy.feeMax) || 0);
  return money(max > 0 ? Math.min(fee, max) : fee);
}

/** Whole days since the rental went overdue: 0 on the day the grace period ends. */
export function overdueDay(late: number, graceMinutes: number): number {
  return Math.floor((late - Math.max(0, graceMinutes)) / DAY_MINUTES);
}

export function overdueNoticeKey(day: number): string {
  return `overdue-${day}`;
}

/**
 * Overdue emails now due and not yet sent, oldest first. A sweep that runs late sends only the
 * newest of them (the last entry) and records the rest as sent, so a renter never gets a burst.
 */
export function overdueNoticesDue(late: number, graceMinutes: number, sent: readonly string[]): string[] {
  if (!isOverdue(late, graceMinutes)) return [];
  const day = overdueDay(late, graceMinutes);
  return OVERDUE_NOTICE_DAYS.filter((step) => day >= step)
    .map(overdueNoticeKey)
    .filter((key) => !sent.includes(key));
}

export const DUE_TODAY_NOTICE = 'due-today';

/** The "due back today" reminder goes out once, on the return date, before the return time. */
export function dueTodayReminderDue(endDate: string, today: string, late: number, sent: readonly string[]): boolean {
  return endDate === today && late <= 0 && !sent.includes(DUE_TODAY_NOTICE);
}

export function shouldFlagLost(late: number, graceMinutes: number, lostAfterDays: number): boolean {
  return lostAfterDays > 0 && isOverdue(late, graceMinutes) && overdueDay(late, graceMinutes) >= lostAfterDays;
}

export function mergeNotices(sent: readonly string[], keys: readonly string[]): string[] {
  return [...new Set([...sent, ...keys])];
}

/** Notices about one return cycle, cleared when an extension moves the return date. */
export function clearReturnNotices(sent: readonly string[]): string[] {
  return sent.filter((key) => key !== DUE_TODAY_NOTICE && !key.startsWith('overdue-'));
}

/** How a late fee splits between what the deposit covers and what is left to collect. */
export function lateFeeSettlement(fee: number, deposit: number, alreadyKept = 0): { fromDeposit: number; balance: number } {
  const available = Math.max(0, deposit - Math.max(0, alreadyKept));
  const fromDeposit = money(Math.min(Math.max(0, fee), available));
  return { fromDeposit, balance: money(Math.max(0, fee - fromDeposit)) };
}

export interface RiskBooking {
  _id: string;
  itemId: string;
  quantity: number;
  startDate: string;
  endDate: string;
  status: string;
}

export interface AtRisk {
  bookingId: string;
  itemId: string;
  startDate: string;
  /** References or ids of the overdue bookings holding the item. */
  blockedBy: string[];
}

/**
 * Upcoming rentals (pending or confirmed, picking up within the window) that can't be handed out if the
 * overdue units stay out. A rental is at risk when, on its pickup day, the units still out plus every
 * other rental of that item on that day need more units than the item has.
 */
export function atRiskBookings(
  bookings: readonly RiskBooking[],
  unitCounts: Readonly<Record<string, number>>,
  today: string,
  windowDays = AT_RISK_WINDOW_DAYS,
): AtRisk[] {
  const overdue = bookings.filter((booking) => booking.status === 'overdue');
  if (overdue.length === 0) return [];
  const last = dayNumber(today) + windowDays;
  const result: AtRisk[] = [];
  for (const booking of bookings) {
    if (booking.status !== 'pending' && booking.status !== 'confirmed') continue;
    const start = dayNumber(booking.startDate);
    if (start < dayNumber(today) || start > last) continue;
    const holders = overdue.filter((late) => late.itemId === booking.itemId);
    if (holders.length === 0) continue;
    const out = holders.reduce((sum, late) => sum + late.quantity, 0);
    // Other rentals of the item out or starting on this pickup day, this one included.
    const sameDay = bookings
      .filter((other) =>
        other.itemId === booking.itemId &&
        ['pending', 'confirmed', 'active'].includes(other.status) &&
        other.startDate <= booking.startDate &&
        other.endDate >= booking.startDate,
      )
      .reduce((sum, other) => sum + other.quantity, 0);
    const units = Math.max(1, unitCounts[booking.itemId] ?? 1);
    if (out + sameDay > units) {
      result.push({ bookingId: booking._id, itemId: booking.itemId, startDate: booking.startDate, blockedBy: holders.map((late) => late._id) });
    }
  }
  return result.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export interface LateHistoryEntry {
  status: string;
  lateReturn?: { lateDays: number; final?: boolean };
}

/** How many past rentals this renter returned late or never returned. */
export function lateReturnCount(history: readonly LateHistoryEntry[]): number {
  return history.filter((entry) =>
    entry.status === 'lost' || (entry.lateReturn?.final === true && entry.lateReturn.lateDays > 0),
  ).length;
}

export interface LateSnapshot {
  overdueSince: string;
  lateDays: number;
  lateHours: number;
  fee: number;
  final: boolean;
  returnedAt?: string;
  lostFlaggedAt?: string;
}

/**
 * The late-return record for a rental `late` minutes past its return time, or null while it is on time.
 * Keeps when it first went overdue and any lost flag from the previous record.
 */
export function buildLateReturn(
  policy: LatePolicy,
  late: number,
  dailyRate: number,
  quantity: number,
  previous: LateSnapshot | undefined,
  nowIso: string,
  final = false,
): LateSnapshot | null {
  if (!isOverdue(late, policy.graceMinutes)) return null;
  const { days, hours } = lateUnits(late);
  return {
    overdueSince: previous?.overdueSince || nowIso,
    lateDays: days,
    lateHours: hours,
    fee: lateFee(policy, late, dailyRate, quantity),
    final,
    ...(final ? { returnedAt: nowIso } : {}),
    ...(previous?.lostFlaggedAt ? { lostFlaggedAt: previous.lostFlaggedAt } : {}),
  };
}
