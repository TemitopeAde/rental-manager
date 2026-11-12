import { categories } from '@wix/categories';
import { catalogVersioning, collections, products, productsV3 } from '@wix/stores';
import { auth } from '@wix/essentials';
import { mediaUrl, type StoreCatalogVersion } from './models';
import { extractStoreProductImages } from './store-images';

export type CatalogState = StoreCatalogVersion | 'STORES_NOT_INSTALLED';

export interface StoreCategory {
  id: string;
  name: string;
  version: StoreCatalogVersion;
}

export interface StoreProduct {
  id: string;
  name: string;
  description: string;
  dailyRate: number;
  currency: string;
  visible: boolean;
  physical: boolean;
  categoryIds: string[];
  images: Array<{ src: string; alt: string }>;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function numberValue(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstNumber(...values: unknown[]): number {
  for (const value of values) {
    const parsed = numberValue(value);
    if (parsed > 0) return parsed;
  }
  return 0;
}

function ids(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const row = record(entry);
    const id = stringValue(row.id) || stringValue(row._id) || stringValue(row.categoryId);
    return id ? [id] : [];
  });
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Not cached: this module serves every site the app is installed on, and a site can install
// Stores (or grant a permission) at any time.
export async function detectCatalog(): Promise<{ version: CatalogState; error?: string }> {
  let versionError: string | undefined;
  try {
    // Needs the "Read v3 catalog (PII)" scope (SCOPE.STORES.CATALOG_READ_LIMITED).
    const response = await auth.elevate(catalogVersioning.getCatalogVersion)();
    const version = stringValue(record(response).catalogVersion);
    if (version === 'V1_CATALOG' || version === 'V3_CATALOG' || version === 'STORES_NOT_INSTALLED') return { version };
    versionError = `Unexpected catalog version "${version}".`;
  } catch (error) {
    versionError = message(error);
  }

  // Without the versioning scope, the product APIs still tell us which catalog answers.
  try {
    await auth.elevate(productsV3.queryProducts)().limit(1).find();
    return { version: 'V3_CATALOG' };
  } catch {
    // Not a V3 site, or no V3 read permission; try V1.
  }
  try {
    await auth.elevate(products.queryProducts)().limit(1).find();
    return { version: 'V1_CATALOG' };
  } catch (error) {
  }
  return {
    version: 'STORES_NOT_INSTALLED',
    error: `Couldn't reach Wix Stores: ${versionError ?? 'unknown error'}. If Stores is installed, check the app's Stores permissions.`,
  };
}

export async function getCatalogState(): Promise<CatalogState> {
  return (await detectCatalog()).version;
}

/** Reads every page of a Wix query, so a store with many categories isn't cut off at one page. */
async function allPages<T>(first: { items: T[]; hasNext: () => boolean; next: () => Promise<unknown> }): Promise<T[]> {
  const rows = [...first.items];
  let page = first;
  while (page.hasNext()) {
    page = (await page.next()) as typeof first;
    rows.push(...page.items);
  }
  return rows;
}

export async function listStoreCategories(): Promise<{ version: CatalogState; categories: StoreCategory[] }> {
  const version = await getCatalogState();
  if (version === 'STORES_NOT_INSTALLED') return { version, categories: [] };

  try {
    // V1 calls them collections. Their IDs are what V1 products list in `collectionIds`.
    if (version === 'V1_CATALOG') {
      const rows = await allPages(await auth.elevate(collections.queryCollections)().limit(100).find());
      return {
        version,
        categories: rows.flatMap((item) => {
          const row = record(item);
          const id = stringValue(row._id);
          const name = stringValue(row.name);
          return id && name ? [{ id, name, version }] : [];
        }),
      };
    }

    // V3 uses the Categories API. Call it with an explicit query object: the query-builder form
    // (queryCategories(options).find()) sends a filter Wix rejects with INVALID_FILTER "empty condition".
    // Pages hold up to 1,000; any further pages are read with the returned cursor.
    const query = auth.elevate(categories.queryCategories);
    const options = { treeReference: { appNamespace: '@wix/stores', treeKey: null }, returnNonVisibleCategories: true };
    const rows: unknown[] = [];
    let cursor: string | null | undefined;
    do {
      const page = await query(cursor ? { cursorPaging: { limit: 1000, cursor } } : { cursorPaging: { limit: 1000 } }, options);
      rows.push(...(page.categories ?? []));
      cursor = page.pagingMetadata?.hasNext ? page.pagingMetadata.cursors?.next : null;
    } while (cursor);
    return {
      version,
      categories: rows.flatMap((item) => {
        const row = record(item);
        const id = stringValue(row._id) || stringValue(row.id);
        const name = stringValue(row.name);
        return id && name ? [{ id, name, version }] : [];
      }),
    };
  } catch (error) {
    // An empty list in Settings looks like "no categories"; log the real reason (usually a missing permission).
    console.error(`Could not list Wix Stores ${version === 'V1_CATALOG' ? 'collections' : 'categories'}.`, error);
    return { version, categories: [] };
  }
}

export async function getStoreProduct(productId: string, catalogVersion?: CatalogState): Promise<StoreProduct | null> {
  const version = catalogVersion ?? await getCatalogState();
  if (version === 'STORES_NOT_INSTALLED' || !productId) return null;

  try {
    const product = version === 'V1_CATALOG'
      ? (await auth.elevate(products.getProduct)(productId)).product
      // V3 returns a product's categories only when asked. ALL_CATEGORIES_INFO includes parent categories,
      // so a product in a subcategory still counts when the merchant picks the parent as the rental category.
      : await auth.elevate(productsV3.getProduct)(productId, { fields: ['MEDIA_ITEMS_INFO', 'ALL_CATEGORIES_INFO'] });
    const row = record(product);
    const price = record(row.price);
    const actualPrice = record(row.actualPrice);
    const range = record(row.actualPriceRange);
    const minValue = record(range.minValue);
    const variantsInfo = record(row.variantsInfo);
    const variants = Array.isArray(variantsInfo.variants) ? variantsInfo.variants : [];
    const firstVariant = record(variants[0]);
    const variantPrice = record(firstVariant.price);
    const variantActualPrice = record(variantPrice.actualPrice);
    const dailyRate = version === 'V1_CATALOG'
      ? firstNumber(price.discountedPrice, price.price)
      : firstNumber(variantActualPrice.amount, actualPrice.amount, minValue.amount);
    const productType = stringValue(row.productType).toLowerCase();
    const categoryIds = version === 'V1_CATALOG'
      ? (Array.isArray(row.collectionIds) ? row.collectionIds.filter((id): id is string => typeof id === 'string') : [])
      : ids(record(row.allCategoriesInfo).categories);
    return {
      id: stringValue(row._id) || stringValue(row.id) || productId,
      name: stringValue(row.name),
      description: stringValue(row.description),
      dailyRate,
      currency: stringValue(price.currency) || stringValue(row.currency),
      visible: row.visible !== false,
      physical: productType === 'physical',
      categoryIds,
      images: extractStoreProductImages(row, version),
    };
  } catch (error) {
    return null;
  }
}

/** Loads linked-product galleries in batches instead of issuing one Get Product call per rental. */
export async function getStoreProductImageGalleries(
  productIds: string[],
  version: StoreCatalogVersion,
): Promise<Map<string, Array<{ src: string; alt: string }>>> {
  const galleries = new Map<string, Array<{ src: string; alt: string }>>();
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  for (let offset = 0; offset < uniqueIds.length; offset += 100) {
    const batch = uniqueIds.slice(offset, offset + 100);
    const batchStartedAt = Date.now();
    try {
      let rows: unknown[];
      if (version === 'V1_CATALOG') {
        const result = await auth.elevate(products.queryProducts)().in('_id', batch).limit(batch.length).find();
        rows = result.items;
      } else {
        const result = await auth.elevate(productsV3.queryProducts)(
            { filter: { _id: { $in: batch } }, cursorPaging: { limit: batch.length } },
            { fields: ['MEDIA_ITEMS_INFO'] },
          );
        rows = result.products ?? [];
      }
      for (const product of rows) {
        const row = record(product);
        const id = stringValue(row._id) || stringValue(row.id);
        if (id) galleries.set(id, extractStoreProductImages(row, version));
      }
      console.info('[RentalManager catalog timing]', JSON.stringify({
        event: 'rental_catalog_store_gallery_query',
        catalogVersion: version,
        batchIndex: Math.floor(offset / 100) + 1,
        requestedProducts: batch.length,
        returnedProducts: rows.length,
        durationMs: Date.now() - batchStartedAt,
      }));
    } catch (error) {
      // A failed batch is omitted so callers can keep using the rental's saved gallery.
      console.error('[RentalManager catalog timing]', JSON.stringify({
        event: 'rental_catalog_store_gallery_query',
        catalogVersion: version,
        batchIndex: Math.floor(offset / 100) + 1,
        requestedProducts: batch.length,
        durationMs: Date.now() - batchStartedAt,
        failed: true,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }
  return galleries;
}

export function productMatchesCategory(product: StoreProduct, categoryId: string): boolean {
  return Boolean(categoryId) && product.categoryIds.includes(categoryId);
}

/** The first selected rental category the product belongs to, if any. */
export function matchingCategory<T extends { id: string }>(product: StoreProduct, selected: T[]): T | undefined {
  return selected.find((category) => productMatchesCategory(product, category.id));
}

export interface StoreProductOption {
  id: string;
  name: string;
  price: number;
  image: string;
  visible: boolean;
}

function productOption(product: unknown, version: StoreCatalogVersion): StoreProductOption | null {
  const row = record(product);
  const id = stringValue(row._id) || stringValue(row.id);
  if (!id) return null;
  const media = record(row.media);
  // V3 returns `wix:image://` URIs (not the URL its docs describe), so normalise both versions.
  const gallery = extractStoreProductImages(row, version);
  const image = gallery[0]?.src || mediaUrl(version === 'V1_CATALOG'
    ? stringValue(record(record(media.mainMedia).image).url)
    : stringValue(record(media.main).image) || stringValue(record(media.main).url));
  const price = version === 'V1_CATALOG'
    ? firstNumber(record(row.priceData).discountedPrice, record(row.priceData).price, record(row.price).discountedPrice, record(row.price).price)
    : firstNumber(record(record(row.actualPriceRange).minValue).amount);
  return { id, name: stringValue(row.name) || 'Untitled product', price, image, visible: row.visible !== false };
}

export interface StoreProductPage {
  version: CatalogState;
  products: StoreProductOption[];
  /** Pass back as `cursor` for the next page; empty when this is the last page. */
  nextCursor: string;
  /** Total matching products, when Wix reports it (first page only). */
  total?: number;
  error?: string;
}

// Backs the product pickers. V3 has fuzzy name search; V1 only supports a name prefix, so typing
// "Cam" finds "Camera kit" but not "Pro camera". Results are paged so a store with thousands of
// products can be walked page by page: V3 pages by cursor, V1 by offset (sent as the cursor string).
export async function searchStoreProducts(term: string, limit = 20, cursor = ''): Promise<StoreProductPage> {
  const { version, error: detectError } = await detectCatalog();
  if (version === 'STORES_NOT_INSTALLED') return { version, products: [], nextCursor: '', error: detectError };
  const search = term.trim();
  const size = Math.min(100, Math.max(1, limit));
  const toOptions = (rows: unknown[]) => rows.flatMap((row) => productOption(row, version) ?? []);

  try {
    if (version === 'V3_CATALOG') {
      const searchDetails = search ? { expression: search, fields: ['name' as const], fuzzy: true } : undefined;
      // Counting is a separate call; only the first page needs it, and a failure just hides the total.
      const total = cursor
        ? Promise.resolve(undefined)
        : auth.elevate(productsV3.countProducts)(searchDetails ? { search: searchDetails } : {})
          .then((result) => result.count)
          .catch(() => undefined);
      if (!search) {
        const query = auth.elevate(productsV3.queryProducts)();
        const result = await (cursor ? query.skipTo(cursor) : query).limit(size).find();
        return {
          version,
          products: toOptions(result.items),
          nextCursor: result.hasNext() ? result.cursors.next ?? '' : '',
          total: await total,
        };
      }
      // A follow-up page sends only the cursor; Wix keeps the original search with it.
      const result = await auth.elevate(productsV3.searchProducts)(
        cursor ? { cursorPaging: { limit: size, cursor } } : { cursorPaging: { limit: size }, search: searchDetails },
        {},
      );
      return {
        version,
        products: toOptions(result.products ?? []),
        nextCursor: result.pagingMetadata?.cursors?.next ?? '',
        total: await total,
      };
    }

    const offset = Math.max(0, Number.parseInt(cursor, 10) || 0);
    let query = auth.elevate(products.queryProducts)();
    if (search) query = query.startsWith('name', search);
    const result = await query.skip(offset).limit(size).find();
    return {
      version,
      products: toOptions(result.items),
      nextCursor: result.hasNext() ? String(offset + result.items.length) : '',
      total: result.totalCount ?? undefined,
    };
  } catch (error) {
    return { version, products: [], nextCursor: '', error: `Couldn't search products: ${message(error)}` };
  }
}

// Resolves the product an item is already linked to, so the picker can show its name.
export async function getStoreProductOption(productId: string): Promise<StoreProductOption | null> {
  const version = await getCatalogState();
  if (version === 'STORES_NOT_INSTALLED' || !productId) return null;
  try {
    const product = version === 'V1_CATALOG'
      ? (await auth.elevate(products.getProduct)(productId)).product
      // V3 returns a product's categories only when asked. ALL_CATEGORIES_INFO includes parent categories,
      // so a product in a subcategory still counts when the merchant picks the parent as the rental category.
      : await auth.elevate(productsV3.getProduct)(productId, { fields: ['MEDIA_ITEMS_INFO', 'ALL_CATEGORIES_INFO'] });
    return productOption(product, version);
  } catch {
    return null;
  }
}
