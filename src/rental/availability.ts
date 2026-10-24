import { siteCurrency } from './app-instance';
import { collections, ALL_ITEMS } from './constants';
import { addDays, eachDate, isDateString, todayInTimezone } from './dates';
import type { Quote, RentalItem, Settings } from './models';
import { bool, images, num, text } from './models';
import { quotePrice, rentalLength } from './pricing';
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
    defaultBufferDays: Math.max(0, num(row.defaultBufferDays)),
    defaultMinDays: Math.max(1, num(row.defaultMinDays, 1)),
    defaultMaxDays: Math.max(1, num(row.defaultMaxDays, 30)),
    defaultLeadDays: Math.max(0, num(row.defaultLeadDays, 1)),
    countReturnDay: bool(row.countReturnDay),
    emailSenderName: text(row.emailSenderName, 'Rentals'),
    membersAreaInstalled: bool(row.membersAreaInstalled),
    currency: text(row.currency, 'USD'),
    storeCategoryId: text(row.storeCategoryId),
    storeCategoryName: text(row.storeCategoryName),
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
  defaultBufferDays: 0,
  defaultMinDays: 1,
  defaultMaxDays: 30,
  defaultLeadDays: 1,
  countReturnDay: false,
  emailSenderName: 'Rentals',
  membersAreaInstalled: false,
  currency: 'USD',
  storeCategoryId: '',
  storeCategoryName: '',
  storeCategoryVersion: undefined,
});

// Checkout charges the catalog price in the site's currency, so every displayed price uses it too.
// The stored value is only a fallback for when the site can't be read.
export async function withSiteCurrency(settings: Settings): Promise<Settings> {
  const currency = await siteCurrency();
  return currency ? { ...settings, currency } : settings;
}

export async function loadSettings(access: Access): Promise<Settings> {
  const row = await getRow(collections.settings, 'default', access);
  return withSiteCurrency(row ? asSettings(row) : asSettings({ _id: 'default', ...defaultSettings() }));
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
  const days = rentalLength(start, end, settings.countReturnDay);
  const occupied = eachDate(start, days + bufferDays);
  return { minDays, maxDays, bufferDays, leadDays, billedDays: days, occupied };
}

export async function blockedSet(itemId: string, access: Access): Promise<Set<string>> {
  const result = await queryRows(collections.blockedDates, access).limit(1000).find();
  const dates = new Set<string>();
  for (const row of result.items) {
    const owner = text(row.itemId);
    const date = text(row.date);
    if (date && (owner === ALL_ITEMS || owner === itemId)) dates.add(date);
  }
  return dates;
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
    .between('date', first, last)
    .limit(1000)
    .find();
  for (const row of result.items) {
    if (excludeBookingId && text(row.bookingId) === excludeBookingId) continue;
    const date = text(row.date);
    usage.set(date, (usage.get(date) ?? 0) + 1);
  }
  return usage;
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
  perItemRules: boolean,
  access: Access,
  excludeBookingId = '',
): Promise<Availability> {
  if (!isDateString(start) || !isDateString(end) || end < start) {
    return { ok: false, message: 'Choose a return date on or after pickup.', occupied: [], freeUnits: 0 };
  }
  if (item.status !== 'active') {
    return { ok: false, message: 'This item is not available to rent.', occupied: [], freeUnits: 0 };
  }
  const rules = resolveRules(item, settings, start, end, perItemRules);
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
  const closed = await blockedSet(item._id, access);
  if (closed.has(start) || closed.has(end)) {
    return { ok: false, message: 'Pickup and return cannot fall on a closed day.', occupied: rules.occupied, freeUnits: 0 };
  }
  const usage = await usageByDate(item._id, rules.occupied, access, excludeBookingId);
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
    depositAmount: item.depositAmount,
    quantity,
  });
  return { ok: true, message: 'Available', quote, occupied: rules.occupied, freeUnits };
}
