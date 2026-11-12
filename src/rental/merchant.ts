import { collections, ALL_ITEMS } from './constants';
import { asItem, loadItem, loadSettings } from './availability';
import { listBookings } from './actions';
import { asBooking, newReference } from './holds';
import { claimUnitsForBooking } from './claim';
import { checkRange } from './availability';
import { todayInTimezone } from './dates';
import { findAtRisk, liveBookings, sweepReturns } from './returns';
import type { RentalItem, Settings } from './models';
import { asStoreCategoryRefs, text } from './models';
import { canBookItem, liveItemCount, readPlan } from './plans';
import { getCurrentAppInstance } from './app-instance';
import { defaultSettings } from './availability';
import { insertRow, queryRows, removeRow, removeRows, updateRow, getRow, type Row } from './store';
import { newBlockDates, type BlockRow } from './blocked-rules';
import { getCatalogState, getStoreProduct, getStoreProductImageGalleries, listStoreCategories, matchingCategory } from './stores';
import { emailBookingUpdate } from './emails';

const merchant = { elevate: true };

function storeGallery(images: Array<{ src: string; alt: string }>, fallbackAlt: string) {
  return images.map((image) => ({ type: 'image', src: image.src, title: image.alt || fallbackAlt, alt: image.alt || fallbackAlt }));
}

export async function listItemPage(category?: string, status?: string, offset = 0, limit = 200) {
  let query = queryRows(collections.items, merchant);
  if (category) query = query.eq('category', category);
  if (status) query = query.eq('status', status);
  const result = await query.ascending('name').skip(offset).limit(limit).find();
  return { items: result.items.map((row) => asItem(row as Row)), hasMore: result.hasNext() };
}

export async function listItems(category?: string, status?: string) {
  return (await listItemPage(category, status)).items;
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
  const storeProduct = input.storeProductId ? await getStoreProduct(input.storeProductId) : null;
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
      images: storeProduct
        ? storeGallery(storeProduct.images, input.name)
        : input.storeProductId
          ? []
          : (input.images ?? []).map((image) => ({ type: 'image', src: image.src, title: image.alt, alt: image.alt })),
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
  const linkedProductChanged = patch.storeProductId !== undefined && patch.storeProductId !== text(row.storeProductId);
  if (linkedProductChanged) {
    // The linked product owns the rental's gallery. Clear stale images if the new
    // product cannot be resolved, then populate it when its Stores record is available.
    const productId = text(patch.storeProductId);
    next.images = [];
    if (productId) {
      const product = await getStoreProduct(productId);
      if (product) next.images = storeGallery(product.images, text(next.name));
    } else {
      next.images = (patch.images ?? []).map((image) => ({ type: 'image', src: image.src, title: image.alt, alt: image.alt }));
    }
  } else if (!text(next.storeProductId) && patch.images !== undefined) {
    next.images = patch.images.map((image) => ({ type: 'image', src: image.src, title: image.alt, alt: image.alt }));
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

/** Refreshes existing linked rental galleries from their Wix Stores product records. */
export async function syncLinkedStoreImages(items: RentalItem[]): Promise<RentalItem[]> {
  const linked = items.filter((item) => item.storeProductId);
  if (linked.length === 0) return items;
  const syncStartedAt = Date.now();
  const catalogVersion = await getCatalogState();
  if (catalogVersion === 'STORES_NOT_INSTALLED') return items;
  const galleries = await getStoreProductImageGalleries(
    linked.map((item) => item.storeProductId!),
    catalogVersion,
  );
  const refreshed = new Map<string, RentalItem>();
  let matchedProducts = 0;
  let changedGalleries = 0;
  let persistedGalleries = 0;
  let syncFailures = 0;
  let persistenceTimeSumMs = 0;
  let lastSyncError: string | undefined;
  await Promise.all(linked.map(async (item) => {
    let persistenceStartedAt: number | undefined;
    try {
      const productImages = galleries.get(item.storeProductId!);
      if (!productImages) return;
      matchedProducts += 1;
      const images = storeGallery(productImages, item.name);
      const normalized = productImages.map((image) => ({ src: image.src, alt: image.alt || item.name }));
      if (JSON.stringify(item.images) === JSON.stringify(normalized)) {
        refreshed.set(item._id, item);
        return;
      }
      changedGalleries += 1;
      persistenceStartedAt = Date.now();
      const row = await getRow(collections.items, item._id, merchant);
      if (!row) return;
      const saved = await updateRow(collections.items, { ...row, images }, merchant);
      refreshed.set(item._id, asItem(saved));
      persistedGalleries += 1;
    } catch (error) {
      // A temporary Stores read/write failure should not take the rental catalog offline.
      syncFailures += 1;
      lastSyncError = error instanceof Error ? error.message : String(error);
    } finally {
      if (persistenceStartedAt !== undefined) persistenceTimeSumMs += Date.now() - persistenceStartedAt;
    }
  }));
  console.info('[RentalManager catalog timing]', JSON.stringify({
    event: 'rental_catalog_store_gallery_sync',
    catalogVersion,
    linkedRentals: linked.length,
    matchedProducts,
    changedGalleries,
    persistedGalleries,
    syncFailures,
    persistenceTimeSumMs,
    durationMs: Date.now() - syncStartedAt,
    ...(lastSyncError ? { lastSyncError } : {}),
  }));
  return items.map((item) => refreshed.get(item._id) ?? item);
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
  if (patch.depositMode) next.depositMode = plan.orderDeposit ? patch.depositMode : 'item';
  if (patch.orderDepositAmount !== undefined) next.orderDepositAmount = Math.max(0, Math.round(patch.orderDepositAmount * 100) / 100);
  if (patch.defaultBufferDays !== undefined) next.defaultBufferDays = patch.defaultBufferDays;
  if (patch.defaultMinDays !== undefined) next.defaultMinDays = patch.defaultMinDays;
  if (patch.defaultMaxDays !== undefined) next.defaultMaxDays = patch.defaultMaxDays;
  if (patch.defaultLeadDays !== undefined) next.defaultLeadDays = patch.defaultLeadDays;
  if (patch.countReturnDay !== undefined) next.countReturnDay = patch.countReturnDay;
  if (patch.emailSenderName) next.emailSenderName = patch.emailSenderName;
  if (patch.emailOwnerNewBookings !== undefined) next.emailOwnerNewBookings = patch.emailOwnerNewBookings;
  if (patch.ownerNotificationEmail !== undefined) next.ownerNotificationEmail = patch.ownerNotificationEmail.trim();
  if (patch.emailOwnerRenterRequests !== undefined) next.emailOwnerRenterRequests = patch.emailOwnerRenterRequests;
  if (patch.emailOwnerRefundAlerts !== undefined) next.emailOwnerRefundAlerts = patch.emailOwnerRefundAlerts;
  if (patch.emailRentersRequestUpdates !== undefined) next.emailRentersRequestUpdates = patch.emailRentersRequestUpdates;
  if (patch.emailRentersBookingUpdates !== undefined) next.emailRentersBookingUpdates = patch.emailRentersBookingUpdates;
  if (patch.emailRentersDepositUpdates !== undefined) next.emailRentersDepositUpdates = patch.emailRentersDepositUpdates;
  if (patch.emailRentersReturnReminders !== undefined) next.emailRentersReturnReminders = patch.emailRentersReturnReminders;
  if (patch.emailOwnerOverdueAlerts !== undefined) next.emailOwnerOverdueAlerts = patch.emailOwnerOverdueAlerts;
  if (patch.lateGraceMinutes !== undefined) next.lateGraceMinutes = Math.min(24 * 60, Math.max(0, Math.round(patch.lateGraceMinutes)));
  if (patch.lateFeeMode) next.lateFeeMode = patch.lateFeeMode;
  if (patch.lateFeeAmount !== undefined) next.lateFeeAmount = Math.max(0, Math.round(patch.lateFeeAmount * 100) / 100);
  if (patch.lateFeeMax !== undefined) next.lateFeeMax = Math.max(0, Math.round(patch.lateFeeMax * 100) / 100);
  if (patch.lostAfterDays !== undefined) next.lostAfterDays = Math.max(0, Math.round(patch.lostAfterDays));
  if (patch.reviewLateRenters !== undefined) next.reviewLateRenters = plan.manualApproval ? patch.reviewLateRenters : false;
  if (patch.language) next.language = patch.language;
  if (patch.membersAreaInstalled !== undefined) next.membersAreaInstalled = patch.membersAreaInstalled;
  if (patch.storeCategories !== undefined) {
    const selected = asStoreCategoryRefs(patch.storeCategories);
    next.storeCategories = selected;
    // Legacy single-category fields stay filled so the CMS row reads clearly.
    next.storeCategoryId = selected[0]?.id ?? '';
    next.storeCategoryName = selected.map((category) => category.name).join(', ');
  }
  if ('storeCategoryVersion' in patch) next.storeCategoryVersion = patch.storeCategoryVersion;
  const saved = current
    ? await updateRow(collections.settings, next, merchant)
    : await insertRow(collections.settings, next, merchant);
  return loadSettingsFrom(saved);
}

export async function storeCategories() {
  return listStoreCategories();
}

/** The store-synced fields; the item is only written when one of these differs. */
const STORE_SYNCED_FIELDS = ['name', 'description', 'dailyRate', 'category', 'storeProductId', 'storeRentalOverride', 'images', 'status'] as const;

function storeFieldsChanged(existing: Row, next: Row): boolean {
  return STORE_SYNCED_FIELDS.some((field) => JSON.stringify(existing[field] ?? null) !== JSON.stringify(next[field] ?? null));
}

/**
 * Resolves a Store product into a Rental Item only when the category/override
 * rules make it rentable. Store product fields are refreshed from the product,
 * but the item is only written when they changed; rental-specific fields remain
 * merchant-owned values in Rental Items. Returns the settings it loaded so the
 * caller doesn't read them again.
 */
export async function resolveStoreRentalItem(productId: string): Promise<{ item: RentalItem | null; settings: Settings }> {
  // The catalog version and the app instance are each fetched once and shared.
  const versionPromise = getCatalogState();
  const appInstancePromise = getCurrentAppInstance().catch(() => undefined);
  const [settings, version, product, plan] = await Promise.all([
    appInstancePromise.then((appInstance) => loadSettings(merchant, appInstance)),
    versionPromise,
    versionPromise.then((catalogVersion) => getStoreProduct(productId, catalogVersion)),
    appInstancePromise.then((appInstance) => readPlan(merchant, appInstance)),
  ]);
  const none = { item: null, settings };
  if (!product || !product.physical || !product.visible || product.dailyRate <= 0) return none;

  const found = await queryRows(collections.items, merchant).eq('storeProductId', productId).limit(1).find();
  const existing = found.items[0] as Row | undefined;
  if (existing) {
    if (!(await canBookItem(existing._id, merchant, plan))) return none;
  } else if (plan.maxItems !== null) {
    const allItems = await queryRows(collections.items, merchant).limit(1000).find();
    if (liveItemCount(allItems.items) >= plan.maxItems) return none;
  }
  const override = text(existing?.storeRentalOverride, 'inherit');
  const explicit = override === 'enabled' || override === 'disabled' ? override : 'inherit';
  const matched = settings.storeCategoryVersion === version ? matchingCategory(product, settings.storeCategories) : undefined;
  const inCategory = Boolean(matched);
  // Items auto-created from the store category use the `store-<productId>` slug and
  // should keep following the category. Any other item was linked to this product
  // by the merchant, which is an explicit opt-in even when the override is "inherit".
  const manuallyLinked = Boolean(existing) && text(existing?.slug) !== `store-${productId}`;
  const enabled = explicit === 'enabled' || (explicit === 'inherit' && (inCategory || manuallyLinked));
  if (!enabled) return none;

  const base = existing ?? {
    _id: '',
    name: product.name,
    description: product.description,
    slug: `store-${product.id}`,
    category: matched?.name ?? '',
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
    category: existing ? text(existing.category) : matched?.name ?? '',
    storeProductId: product.id,
    storeRentalOverride: explicit,
    images: storeGallery(product.images, product.name || text(base.name)),
    status: text(base.status, 'active'),
  };
  if (existing && !storeFieldsChanged(existing, next)) return { item: asItem(existing), settings };
  const saved = existing ? await updateRow(collections.items, next, merchant) : await insertRow(collections.items, next, merchant);
  return { item: asItem(saved), settings };
}

function loadSettingsFrom(row: Row) {
  return import('./availability').then(({ asSettings, withSiteCurrency }) => withSiteCurrency(asSettings(row)));
}

export async function blockDates(itemId: string | undefined, dates: string[], reason: string) {
  const owner = itemId || ALL_ITEMS;
  const requested = newBlockDates(dates, []);
  if (requested.length === 0) return { ok: true as const, count: 0 };
  const existing = await queryRows(collections.blockedDates, merchant)
    .eq('itemId', owner)
    .hasSome('date', requested)
    .limit(1000)
    .find();
  const fresh = newBlockDates(requested, existing.items.map((row) => text(row.date)));
  for (const date of fresh) {
    await insertRow(collections.blockedDates, { itemId: owner, date, reason: reason.trim() }, merchant);
  }
  return { ok: true as const, count: fresh.length };
}

// Closed dates from today on, oldest first. Past dates no longer affect bookings, so they are left out.
export async function listBlockedDates(): Promise<BlockRow[]> {
  const settings = await loadSettings(merchant);
  const today = todayInTimezone(settings.timezone);
  const result = await queryRows(collections.blockedDates, merchant)
    .ge('date', today)
    .ascending('date')
    .limit(1000)
    .find();
  return result.items
    .filter((row): row is Row => typeof row._id === 'string')
    .map((row) => ({ _id: row._id, itemId: text(row.itemId, ALL_ITEMS), date: text(row.date), reason: text(row.reason) }));
}

export async function removeBlocks(ids: string[]) {
  const unique = [...new Set(ids.filter((id) => typeof id === 'string' && id))];
  await removeRows(collections.blockedDates, unique, merchant);
  return { ok: true as const, count: unique.length };
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
  // The board is where the owner looks for late rentals, so it brings them up to date first.
  await sweepReturns({ minIntervalMs: 60_000 }).catch((error) =>
    console.error('[Rental Manager] overdue sweep failed', error instanceof Error ? error.message : error));
  const settings = await loadSettings(merchant);
  const today = todayInTimezone(settings.timezone);
  const live = await liveBookings();
  const risks = await findAtRisk(live);
  return {
    date: today,
    pickups: live.filter((booking) => booking.startDate === today && booking.status === 'confirmed'),
    returns: live.filter((booking) => booking.endDate === today && (booking.status === 'active' || booking.status === 'overdue')),
    overdue: live.filter((booking) => booking.status === 'overdue').sort((a, b) => a.endDate.localeCompare(b.endDate)),
    atRisk: risks.map((risk) => ({ booking: risk.booking, blockedBy: risk.blockers.map((late) => late.reference) })),
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
  const availability = await checkRange(item, settings, input.startDate, input.endDate, input.quantity, plan, merchant);
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
  const booking = asBooking(created);
  await emailBookingUpdate(booking, 'manual');
  return { ok: true as const, booking };
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
