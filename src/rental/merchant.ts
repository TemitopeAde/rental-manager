import { collections, ALL_ITEMS } from './constants';
import { asItem, loadItem, loadSettings } from './availability';
import { listBookings } from './actions';
import { asBooking, newReference } from './holds';
import { claimUnitsForBooking } from './claim';
import { checkRange } from './availability';
import { minutesNow, parseHour, todayInTimezone } from './dates';
import type { RentalItem, Settings } from './models';
import { text } from './models';
import { canBookItem, liveItemCount, readPlan } from './plans';
import { defaultSettings } from './availability';
import { insertRow, queryRows, removeRow, updateRow, getRow, type Row } from './store';
import { getCatalogState, getStoreProduct, listStoreCategories, productMatchesCategory } from './stores';

const merchant = { elevate: true };

export async function listItems(category?: string, status?: string) {
  let query = queryRows(collections.items, merchant);
  if (category) query = query.eq('category', category);
  if (status) query = query.eq('status', status);
  const result = await query.ascending('name').limit(200).find();
  return result.items.map((row) => asItem(row as Row));
}

// Category tabs come from every active item, not the filtered page, so they stay put while filtering.
// `allowed` limits the tabs to items that can take bookings, so a downgraded site shows no empty tabs.
export async function listCategories(allowed?: Set<string> | null) {
  const values = allowed
    ? (await listItems(undefined, 'active')).filter((item) => allowed.has(item._id)).map((item) => item.category)
    : ((await queryRows(collections.items, merchant).eq('status', 'active').distinct('category')).items as unknown[]);
  return [...new Set(values)]
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    .sort((a, b) => a.localeCompare(b));
}

// Visitor-facing lookup for the details widget. Items added straight in the CMS may have no
// slug, so the catalog links those by ID and this accepts either.
export async function findActiveItem(slugOrId: string) {
  const bySlug = await queryRows(collections.items, merchant).eq('slug', slugOrId).limit(1).find();
  const row = (bySlug.items[0] as Row | undefined) ?? (await getRow(collections.items, slugOrId, merchant).catch(() => null));
  if (!row) return null;
  const item = asItem(row);
  return item.status === 'active' ? item : null;
}

export async function createItem(input: Partial<RentalItem>) {
  const plan = await readPlan(merchant);
  const existing = await queryRows(collections.items, merchant).limit(1000).find();
  const live = liveItemCount(existing.items);
  if (plan.maxItems !== null && live >= plan.maxItems) {
    return { ok: false as const, message: `The ${plan.label} plan allows ${plan.maxItems} rental items. Upgrade to add more.` };
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
      storeProductId: input.storeProductId ?? '',
      storeRentalOverride: input.storeRentalOverride ?? 'inherit',
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
    'storeProductId', 'storeRentalOverride',
  ];
  for (const field of fields) {
    if (patch[field] !== undefined) (next as Record<string, unknown>)[field] = patch[field];
  }
  // Restoring an archived item adds one back toward the limit, the same as creating one.
  if (text(row.status) === 'archived' && text(next.status) !== 'archived' && plan.maxItems !== null) {
    const existing = await queryRows(collections.items, merchant).limit(1000).find();
    if (liveItemCount(existing.items) >= plan.maxItems) {
      return { ok: false as const, message: `The ${plan.label} plan allows ${plan.maxItems} rental items. Upgrade or archive another item first.` };
    }
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
  if (patch.membersAreaInstalled !== undefined) next.membersAreaInstalled = patch.membersAreaInstalled;
  if (patch.storeCategoryId !== undefined) next.storeCategoryId = patch.storeCategoryId;
  if (patch.storeCategoryName !== undefined) next.storeCategoryName = patch.storeCategoryName;
  if ('storeCategoryVersion' in patch) next.storeCategoryVersion = patch.storeCategoryVersion;
  const saved = current
    ? await updateRow(collections.settings, next, merchant)
    : await insertRow(collections.settings, next, merchant);
  return loadSettingsFrom(saved);
}

export async function storeCategories() {
  return listStoreCategories();
}

/**
 * Resolves a Store product into a Rental Item only when the category/override
 * rules make it rentable. Store product fields are refreshed on each request;
 * rental-specific fields remain merchant-owned values in Rental Items.
 */
export async function resolveStoreRentalItem(productId: string) {
  const [settings, version, product, plan] = await Promise.all([
    loadSettings(merchant),
    getCatalogState(),
    getStoreProduct(productId),
    readPlan(merchant),
  ]);
  if (!product || !product.physical || !product.visible || product.dailyRate <= 0) {
    return null;
  }

  const found = await queryRows(collections.items, merchant).eq('storeProductId', productId).limit(1).find();
  const existing = found.items[0] as Row | undefined;
  if (existing) {
    if (!(await canBookItem(existing._id, merchant, plan))) return null;
  } else if (plan.maxItems !== null) {
    const allItems = await queryRows(collections.items, merchant).limit(1000).find();
    if (liveItemCount(allItems.items) >= plan.maxItems) return null;
  }
  const override = text(existing?.storeRentalOverride, 'inherit');
  const explicit = override === 'enabled' || override === 'disabled' ? override : 'inherit';
  const inCategory = settings.storeCategoryVersion === version && productMatchesCategory(product, settings.storeCategoryId);
  const enabled = explicit === 'enabled' || (explicit === 'inherit' && inCategory);
  if (!enabled) return null;

  const base = existing ?? {
    _id: '',
    name: product.name,
    description: product.description,
    slug: `store-${product.id}`,
    category: settings.storeCategoryName,
    unitCount: 1,
    dailyRate: product.dailyRate,
    weeklyRate: 0,
    depositAmount: 0,
    minDays: settings.defaultMinDays,
    maxDays: settings.defaultMaxDays,
    bufferDays: settings.defaultBufferDays,
    leadDays: settings.defaultLeadDays,
    status: 'active',
    storeProductId: product.id,
    storeRentalOverride: explicit,
  } satisfies Row;
  const next: Row = {
    ...base,
    name: product.name || base.name,
    description: product.description || base.description,
    dailyRate: product.dailyRate,
    category: existing ? text(existing.category) : settings.storeCategoryName,
    storeProductId: product.id,
    storeRentalOverride: explicit,
    status: text(base.status, 'active'),
  };
  const saved = existing ? await updateRow(collections.items, next, merchant) : await insertRow(collections.items, next, merchant);
  return asItem(saved);
}

function loadSettingsFrom(row: Row) {
  return import('./availability').then(({ asSettings, withSiteCurrency }) => withSiteCurrency(asSettings(row)));
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
  if (!(await canBookItem(input.itemId, merchant, plan))) {
    return { ok: false as const, message: `New bookings for this item require an upgrade from the ${plan.label} plan.` };
  }
  const availability = await checkRange(item, settings, input.startDate, input.endDate, input.quantity, plan.perItemRules, merchant);
  if (!availability.ok || !availability.quote) return { ok: false as const, message: availability.message };
  const reference = newReference();
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
