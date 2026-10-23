import { collections, ALL_ITEMS } from './constants';
import { asItem, loadItem, loadSettings } from './availability';
import { listBookings } from './actions';
import { asBooking } from './holds';
import { claimUnitsForBooking } from './claim';
import { checkRange } from './availability';
import { minutesNow, parseHour, todayInTimezone } from './dates';
import type { RentalItem, Settings } from './models';
import { text } from './models';
import { readPlan } from './plans';
import { defaultSettings } from './availability';
import { insertRow, queryRows, removeRow, updateRow, getRow, type Row } from './store';

const merchant = { elevate: true };

export async function listItems(category?: string, status?: string) {
  let query = queryRows(collections.items, merchant);
  if (category) query = query.eq('category', category);
  if (status) query = query.eq('status', status);
  const result = await query.ascending('name').limit(200).find();
  return result.items.map((row) => asItem(row as Row));
}

export async function createItem(input: Partial<RentalItem>) {
  const plan = await readPlan(merchant);
  const existing = await queryRows(collections.items, merchant).limit(1000).find();
  const live = existing.items.filter((row) => text(row.status) !== 'archived').length;
  if (plan.maxItems !== null && live >= plan.maxItems) {
    return { ok: false as const, message: `The ${plan.tier} plan allows ${plan.maxItems} rental items. Upgrade to add more.` };
  }
  if (!input.name || !input.dailyRate || input.dailyRate <= 0) {
    return { ok: false as const, message: 'A name and a daily rate are required.' };
  }
  const slug = (input.slug || input.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const created = await insertRow(
    collections.items,
    {
      name: input.name,
      description: input.description ?? '',
      slug,
      category: input.category ?? '',
      unitCount: input.unitCount ?? 1,
      dailyRate: input.dailyRate,
      weeklyRate: input.weeklyRate ?? 0,
      depositAmount: input.depositAmount ?? 0,
      minDays: input.minDays ?? 1,
      maxDays: input.maxDays ?? 30,
      bufferDays: input.bufferDays ?? 0,
      leadDays: input.leadDays ?? 1,
      status: input.status ?? 'active',
    },
    merchant,
  );
  return { ok: true as const, item: asItem(created) };
}

export async function updateItem(itemId: string, patch: Partial<RentalItem>) {
  const row = await getRow(collections.items, itemId, merchant);
  if (!row) return { ok: false as const, message: 'Item not found.' };
  const plan = await readPlan(merchant);
  const next: Row = { ...row };
  const fields: Array<keyof RentalItem> = [
    'name', 'description', 'slug', 'category', 'unitCount', 'dailyRate', 'weeklyRate',
    'depositAmount', 'minDays', 'maxDays', 'bufferDays', 'leadDays', 'status',
  ];
  for (const field of fields) {
    if (patch[field] !== undefined) (next as Record<string, unknown>)[field] = patch[field];
  }
  if (!plan.perItemRules) {
    next.bufferDays = row.bufferDays;
    next.leadDays = row.leadDays;
  }
  const updated = await updateRow(collections.items, next, merchant);
  return { ok: true as const, item: asItem(updated) };
}

export async function saveSettings(patch: Partial<Settings>) {
  const plan = await readPlan(merchant);
  const current = await getRow(collections.settings, 'default', merchant);
  const base = current ?? ({ _id: 'default', ...defaultSettings() } as Row);
  const next: Row = { ...base, _id: 'default' };
  if (patch.timezone) next.timezone = patch.timezone;
  if (patch.pickupHour) next.pickupHour = patch.pickupHour;
  if (patch.returnHour) next.returnHour = patch.returnHour;
  if (patch.approvalMode) next.approvalMode = plan.manualApproval ? patch.approvalMode : 'auto';
  if (patch.defaultBufferDays !== undefined) next.defaultBufferDays = patch.defaultBufferDays;
  if (patch.defaultMinDays !== undefined) next.defaultMinDays = patch.defaultMinDays;
  if (patch.defaultMaxDays !== undefined) next.defaultMaxDays = patch.defaultMaxDays;
  if (patch.defaultLeadDays !== undefined) next.defaultLeadDays = patch.defaultLeadDays;
  if (patch.countReturnDay !== undefined) next.countReturnDay = patch.countReturnDay;
  if (patch.emailSenderName) next.emailSenderName = patch.emailSenderName;
  if (patch.currency) next.currency = patch.currency;
  const saved = current
    ? await updateRow(collections.settings, next, merchant)
    : await insertRow(collections.settings, next, merchant);
  return loadSettingsFrom(saved);
}

function loadSettingsFrom(row: Row) {
  return import('./availability').then(({ asSettings }) => asSettings(row));
}

export async function blockDates(itemId: string | undefined, dates: string[], reason: string) {
  const owner = itemId || ALL_ITEMS;
  const created = [];
  for (const date of dates) {
    const row = await insertRow(collections.blockedDates, { itemId: owner, date, reason }, merchant);
    created.push(row._id);
  }
  return { ok: true as const, count: created.length };
}

export async function unblockDates(itemId: string | undefined, dates: string[]) {
  const owner = itemId || ALL_ITEMS;
  const result = await queryRows(collections.blockedDates, merchant).eq('itemId', owner).limit(1000).find();
  const ids = result.items
    .filter((row) => dates.includes(text(row.date)))
    .map((row) => row._id)
    .filter((id): id is string => typeof id === 'string');
  for (const id of ids) await removeRow(collections.blockedDates, id, merchant);
  return { ok: true as const, count: ids.length };
}

export async function todayBoard() {
  const settings = await loadSettings(merchant);
  const today = todayInTimezone(settings.timezone);
  const bookings = await listBookings();
  const returnMinutes = parseHour(settings.returnHour);
  const now = minutesNow(settings.timezone);
  const overdue = bookings.filter(
    (booking) =>
      (booking.status === 'active' || booking.status === 'overdue') &&
      (booking.endDate < today || (booking.endDate === today && now > returnMinutes)),
  );
  for (const booking of overdue) {
    if (booking.status === 'overdue') continue;
    const row = await getRow(collections.bookings, booking._id, merchant);
    if (row) await updateRow(collections.bookings, { ...row, status: 'overdue' }, merchant);
  }
  return {
    date: today,
    pickups: bookings.filter((booking) => booking.startDate === today && booking.status === 'confirmed'),
    returns: bookings.filter((booking) => booking.endDate === today && (booking.status === 'active' || booking.status === 'overdue')),
    overdue,
    settings,
  };
}

export async function createManualBooking(input: {
  itemId: string;
  startDate: string;
  endDate: string;
  quantity: number;
  renterName: string;
  renterEmail: string;
}) {
  const plan = await readPlan(merchant);
  const settings = await loadSettings(merchant);
  const item = await loadItem(input.itemId, merchant);
  if (!item) return { ok: false as const, message: 'Item not found.' };
  const availability = await checkRange(item, settings, input.startDate, input.endDate, input.quantity, plan.perItemRules, merchant);
  if (!availability.ok || !availability.quote) return { ok: false as const, message: availability.message };
  const reference = `RB-${Math.floor(10000 + Math.random() * 89999)}`;
  const created = await insertRow(
    collections.bookings,
    {
      reference,
      itemId: input.itemId,
      quantity: input.quantity,
      startDate: input.startDate,
      endDate: input.endDate,
      status: 'confirmed',
      holdExtended: false,
      quote: availability.quote,
      renter: { name: input.renterName, email: input.renterEmail, phone: '' },
      idempotencyKey: `manual-${reference}`,
      refundNeeded: false,
      cartLineItemId: '',
      ecomOrderId: '',
    },
    merchant,
  );
  const claimed = await claimUnitsForBooking(input.itemId, created._id, input.quantity, availability.occupied, item.unitCount);
  if (!claimed) {
    await updateRow(collections.bookings, { ...created, status: 'expired' }, merchant);
    return { ok: false as const, message: 'Those dates were just taken.' };
  }
  return { ok: true as const, booking: asBooking(created) };
}

export async function rentalSummary(from: string, to: string) {
  const bookings = await listBookings(undefined, from, to);
  const paid = bookings.filter((booking) => !['hold', 'expired', 'cancelled'].includes(booking.status));
  const revenue = paid.reduce((sum, booking) => sum + booking.quote.rental, 0);
  const byItem = new Map<string, number>();
  for (const booking of paid) byItem.set(booking.itemId, (byItem.get(booking.itemId) ?? 0) + booking.quote.rental);
  const top = [...byItem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { from, to, bookings: paid.length, revenue, top };
}
