import { siteCurrency, type CurrentAppInstance } from './app-instance';
import { collections, ALL_ITEMS } from './constants';
import { addDays, isDateString, todayInTimezone } from './dates';
import type { Quote, RentalItem, Settings } from './models';
import { asStoreCategoryRefs, bool, images, num, text } from './models';
import { quotePrice } from './pricing';
import { occupiedDates } from './calendar-rules';
import { asDepositMode, itemDepositAmount } from './deposit-rules';
import { asLateFeeMode } from './late-rules';
import type { PlanLimits } from './plan-rules';
import { getRow, queryRows, type Access, type Row } from './store';

export function asItem(row: Row): RentalItem {
  const status = text(row.status, 'active');
  const name = text(row.name);
  return {
    _id: row._id,
    name,
    description: text(row.description),
    slug: text(row.slug),
    images: images(row.images, name),
    category: text(row.category),
    unitCount: Math.max(1, num(row.unitCount, 1)),
    dailyRate: num(row.dailyRate),
    weeklyRate: num(row.weeklyRate),
    depositAmount: num(row.depositAmount),
    minDays: Math.max(1, num(row.minDays, 1)),
    maxDays: Math.max(1, num(row.maxDays, 30)),
    bufferDays: Math.max(0, num(row.bufferDays)),
    leadDays: Math.max(0, num(row.leadDays, 1)),
    status: status === 'hidden' || status === 'archived' ? status : 'active',
    storeProductId: text(row.storeProductId) || undefined,
    storeRentalOverride:
      text(row.storeRentalOverride) === 'enabled' || text(row.storeRentalOverride) === 'disabled'
        ? (text(row.storeRentalOverride) as 'enabled' | 'disabled')
        : 'inherit',
  };
}

export function asSettings(row: Row): Settings {
  const mode = text(row.approvalMode, 'auto');
  return {
    _id: row._id,
    timezone: text(row.timezone, 'UTC'),
    pickupHour: text(row.pickupHour, '09:00'),
    returnHour: text(row.returnHour, '17:00'),
    approvalMode: mode === 'manual' ? 'manual' : 'auto',
    depositMode: asDepositMode(row.depositMode),
    orderDepositAmount: Math.max(0, num(row.orderDepositAmount)),
    defaultBufferDays: Math.max(0, num(row.defaultBufferDays)),
    defaultMinDays: Math.max(1, num(row.defaultMinDays, 1)),
    defaultMaxDays: Math.max(1, num(row.defaultMaxDays, 30)),
    defaultLeadDays: Math.max(0, num(row.defaultLeadDays, 1)),
    countReturnDay: bool(row.countReturnDay),
    emailSenderName: text(row.emailSenderName, 'Rentals'),
    emailOwnerNewBookings: bool(row.emailOwnerNewBookings, true),
    ownerNotificationEmail: text(row.ownerNotificationEmail).trim(),
    emailOwnerRenterRequests: bool(row.emailOwnerRenterRequests, true),
    emailOwnerRefundAlerts: bool(row.emailOwnerRefundAlerts, true),
    emailRentersRequestUpdates: bool(row.emailRentersRequestUpdates, true),
    emailRentersBookingUpdates: bool(row.emailRentersBookingUpdates, true),
    emailRentersDepositUpdates: bool(row.emailRentersDepositUpdates, true),
    emailRentersReturnReminders: bool(row.emailRentersReturnReminders, true),
    emailOwnerOverdueAlerts: bool(row.emailOwnerOverdueAlerts, true),
    lateGraceMinutes: Math.max(0, num(row.lateGraceMinutes, 60)),
    lateFeeMode: asLateFeeMode(row.lateFeeMode),
    lateFeeAmount: Math.max(0, num(row.lateFeeAmount)),
    lateFeeMax: Math.max(0, num(row.lateFeeMax)),
    lostAfterDays: Math.max(0, num(row.lostAfterDays)),
    reviewLateRenters: bool(row.reviewLateRenters),
    lastReturnSweepAt: text(row.lastReturnSweepAt),
    setupDone: Array.isArray(row.setupDone) ? row.setupDone.filter((step): step is string => typeof step === 'string') : [],
    setupHidden: bool(row.setupHidden),
    language: text(row.language, 'en'),
    membersAreaInstalled: bool(row.membersAreaInstalled),
    currency: text(row.currency, 'USD'),
    storeCategories: asStoreCategoryRefs(row.storeCategories, row.storeCategoryId, row.storeCategoryName),
    storeCategoryVersion:
      text(row.storeCategoryVersion) === 'V1_CATALOG' || text(row.storeCategoryVersion) === 'V3_CATALOG'
        ? (text(row.storeCategoryVersion) as 'V1_CATALOG' | 'V3_CATALOG')
        : undefined,
  };
}

export const defaultSettings = (): Record<string, unknown> => ({
  _id: 'default',
  timezone: 'UTC',
  pickupHour: '09:00',
  returnHour: '17:00',
  approvalMode: 'auto',
  depositMode: 'item',
  orderDepositAmount: 0,
  defaultBufferDays: 0,
  defaultMinDays: 1,
  defaultMaxDays: 30,
  defaultLeadDays: 1,
  countReturnDay: false,
  emailSenderName: 'Rentals',
  emailOwnerNewBookings: true,
  ownerNotificationEmail: '',
  emailOwnerRenterRequests: true,
  emailOwnerRefundAlerts: true,
  emailRentersRequestUpdates: true,
  emailRentersBookingUpdates: true,
  emailRentersDepositUpdates: true,
  emailRentersReturnReminders: true,
  emailOwnerOverdueAlerts: true,
  lateGraceMinutes: 60,
  lateFeeMode: 'off',
  lateFeeAmount: 0,
  lateFeeMax: 0,
  lostAfterDays: 0,
  reviewLateRenters: false,
  lastReturnSweepAt: '',
  setupDone: [],
  setupHidden: false,
  language: 'en',
  membersAreaInstalled: false,
  currency: 'USD',
  storeCategories: [],
  storeCategoryId: '',
  storeCategoryName: '',
  storeCategoryVersion: undefined,
});

// Checkout charges the catalog price in the site's currency, so every displayed price uses it too.
// The stored value is only a fallback for when the site can't be read.
export async function withSiteCurrency(
  settings: Settings,
  appInstance?: CurrentAppInstance | null,
): Promise<Settings> {
  const currency = appInstance === undefined
    ? await siteCurrency()
    : appInstance?.site?.paymentCurrency ?? '';
  return currency ? { ...settings, currency } : settings;
}

export async function loadSettings(access: Access, appInstance?: CurrentAppInstance | null): Promise<Settings> {
  const row = await getRow(collections.settings, 'default', access);
  return withSiteCurrency(
    row ? asSettings(row) : asSettings({ _id: 'default', ...defaultSettings() }),
    appInstance,
  );
}

export async function loadItem(itemId: string, access: Access): Promise<RentalItem | null> {
  const row = await getRow(collections.items, itemId, access);
  return row ? asItem(row) : null;
}

export interface ResolvedRules {
  minDays: number;
  maxDays: number;
  bufferDays: number;
  leadDays: number;
  billedDays: number;
  occupied: string[];
}

export function resolveRules(
  item: RentalItem,
  settings: Settings,
  start: string,
  end: string,
  perItemRules: boolean,
): ResolvedRules {
  const minDays = perItemRules ? item.minDays : settings.defaultMinDays;
  const maxDays = perItemRules ? item.maxDays : settings.defaultMaxDays;
  const bufferDays = perItemRules ? item.bufferDays : settings.defaultBufferDays;
  const leadDays = perItemRules ? item.leadDays : settings.defaultLeadDays;
  // Shared with the site calendar (calendar-rules), so the dates it greys out match what's checked here.
  const { billedDays, occupied } = occupiedDates(start, end, settings.countReturnDay, bufferDays);
  return { minDays, maxDays, bufferDays, leadDays, billedDays, occupied };
}

// Only the dates being checked are read, so old blocks piling up can't push relevant ones past the query limit.
export async function blockedSet(itemId: string, dates: string[], access: Access): Promise<Set<string>> {
  if (dates.length === 0) return new Set();
  const result = await queryRows(collections.blockedDates, access)
    .hasSome('date', dates)
    .hasSome('itemId', [itemId, ALL_ITEMS])
    .limit(1000)
    .find();
  const closed = new Set<string>();
  for (const row of result.items) {
    const owner = text(row.itemId);
    const date = text(row.date);
    if (date && (owner === ALL_ITEMS || owner === itemId)) closed.add(date);
  }
  return closed;
}

// Units claimed per date; `excludeBookingId` leaves out one booking's own claims (for date changes).
export async function usageByDate(
  itemId: string,
  dates: string[],
  access: Access,
  excludeBookingId = '',
): Promise<Map<string, number>> {
  const usage = new Map<string, number>();
  if (dates.length === 0) return usage;
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (!first || !last) return usage;
  const result = await queryRows(collections.unitDays, access)
    .eq('itemId', itemId)
    // `between` excludes its upper bound, so go one day past the last date to count it.
    .between('date', first, addDays(last, 1))
    .limit(1000)
    .find();
  for (const row of result.items) {
    if (excludeBookingId && text(row.bookingId) === excludeBookingId) continue;
    const date = text(row.date);
    usage.set(date, (usage.get(date) ?? 0) + 1);
  }
  return usage;
}

/** Claimed units per date across a window, paged so a busy item can't be cut off at the query limit. */
export async function usageInWindow(itemId: string, from: string, to: string, access: Access): Promise<Record<string, number>> {
  const used: Record<string, number> = {};
  let page = await queryRows(collections.unitDays, access).eq('itemId', itemId).between('date', from, addDays(to, 1)).limit(1000).find();
  for (;;) {
    for (const row of page.items) {
      const date = text(row.date);
      if (date) used[date] = (used[date] ?? 0) + 1;
    }
    if (!page.hasNext()) break;
    page = await page.next();
  }
  return used;
}

/** Closed days for this item (its own and shop-wide) across a window. */
export async function closedInWindow(itemId: string, from: string, to: string, access: Access): Promise<string[]> {
  const closed = new Set<string>();
  let page = await queryRows(collections.blockedDates, access)
    .hasSome('itemId', [itemId, ALL_ITEMS])
    .between('date', from, addDays(to, 1))
    .limit(1000)
    .find();
  for (;;) {
    for (const row of page.items) {
      const date = text(row.date);
      if (date) closed.add(date);
    }
    if (!page.hasNext()) break;
    page = await page.next();
  }
  return [...closed].sort();
}

export interface Availability {
  ok: boolean;
  message: string;
  quote?: Quote;
  occupied: string[];
  freeUnits: number;
}

export async function checkRange(
  item: RentalItem,
  settings: Settings,
  start: string,
  end: string,
  quantity: number,
  plan: Pick<PlanLimits, 'perItemRules' | 'orderDeposit'>,
  access: Access,
  excludeBookingId = '',
): Promise<Availability> {
  if (!isDateString(start) || !isDateString(end) || end < start) {
    return { ok: false, message: 'Choose a return date on or after pickup.', occupied: [], freeUnits: 0 };
  }
  if (item.status !== 'active') {
    return { ok: false, message: 'This item is not available to rent.', occupied: [], freeUnits: 0 };
  }
  const rules = resolveRules(item, settings, start, end, plan.perItemRules);
  if (rules.billedDays < rules.minDays || rules.billedDays > rules.maxDays) {
    return {
      ok: false,
      message: `Rentals must be between ${rules.minDays} and ${rules.maxDays} days.`,
      occupied: rules.occupied,
      freeUnits: 0,
    };
  }
  const today = todayInTimezone(settings.timezone);
  const earliest = addDays(today, rules.leadDays);
  const latest = addDays(today, 180);
  if (start < earliest) {
    return { ok: false, message: `The earliest pickup is ${earliest}.`, occupied: rules.occupied, freeUnits: 0 };
  }
  if (start > latest) {
    return { ok: false, message: 'Pickups can be booked up to 180 days ahead.', occupied: rules.occupied, freeUnits: 0 };
  }
  const [closed, usage] = await Promise.all([
    blockedSet(item._id, [start, end], access),
    usageByDate(item._id, rules.occupied, access, excludeBookingId),
  ]);
  if (closed.has(start) || closed.has(end)) {
    return { ok: false, message: 'Pickup and return cannot fall on a closed day.', occupied: rules.occupied, freeUnits: 0 };
  }
  let freeUnits = item.unitCount;
  for (const date of rules.occupied) {
    const free = item.unitCount - (usage.get(date) ?? 0);
    freeUnits = Math.min(freeUnits, free);
    if ((usage.get(date) ?? 0) + quantity > item.unitCount) {
      return { ok: false, message: 'Those dates were just taken.', occupied: rules.occupied, freeUnits };
    }
  }
  const quote = quotePrice({
    billedDays: rules.billedDays,
    dailyRate: item.dailyRate,
    weeklyRate: item.weeklyRate,
    // With a per-order deposit, items carry none; the deposit is one checkout fee for the whole order.
    depositAmount: itemDepositAmount(item.depositAmount, settings, plan.orderDeposit),
    quantity,
  });
  return { ok: true, message: 'Available', quote, occupied: rules.occupied, freeUnits };
}
