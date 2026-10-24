import { categories } from '@wix/categories';
import { catalogVersioning, collections, products, productsV3 } from '@wix/stores';
import { auth } from '@wix/essentials';
import { mediaUrl, type StoreCatalogVersion } from './models';

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

export async function listStoreCategories(): Promise<{ version: CatalogState; categories: StoreCategory[] }> {
  const version = await getCatalogState();
  if (version === 'STORES_NOT_INSTALLED') return { version, categories: [] };

  try {
    if (version === 'V1_CATALOG') {
      const result = await auth.elevate(collections.queryCollections)().limit(1000).find();
      return {
        version,
        categories: result.items.flatMap((item) => {
          const row = record(item);
          const id = stringValue(row._id);
          const name = stringValue(row.name);
          return id && name ? [{ id, name, version }] : [];
        }),
      };
    }

    const queryCategories = categories.queryCategories as unknown as (options: unknown) => Promise<unknown>;
    const result = record(await auth.elevate(queryCategories)({
      treeReference: { appNamespace: '@wix/stores', treeKey: null },
      query: { paging: { limit: 1000 } },
      returnNonVisibleCategories: true,
    }));
    const rows = Array.isArray(result.categories) ? result.categories : [];
    return {
      version,
      categories: rows.flatMap((item) => {
        const row = record(item);
        const id = stringValue(row.id) || stringValue(row._id);
        const name = stringValue(row.name);
        return id && name ? [{ id, name, version }] : [];
      }),
    };
  } catch (error) {
    return { version, categories: [] };
  }
}

export async function getStoreProduct(productId: string): Promise<StoreProduct | null> {
  const version = await getCatalogState();
  if (version === 'STORES_NOT_INSTALLED' || !productId) return null;

  try {
    const product = version === 'V1_CATALOG'
      ? (await auth.elevate(products.getProduct)(productId)).product
      : await auth.elevate(productsV3.getProduct)(productId);
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
      : ids(record(row.directCategoriesInfo).categories);
    return {
      id: stringValue(row._id) || stringValue(row.id) || productId,
      name: stringValue(row.name),
      description: stringValue(row.description),
      dailyRate,
      currency: stringValue(price.currency) || stringValue(row.currency),
      visible: row.visible !== false,
      physical: productType === 'physical',
      categoryIds,
    };
  } catch (error) {
    return null;
  }
}

export function productMatchesCategory(product: StoreProduct, categoryId: string): boolean {
  return Boolean(categoryId) && product.categoryIds.includes(categoryId);
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
  const image = mediaUrl(version === 'V1_CATALOG'
    ? stringValue(record(record(media.mainMedia).image).url)
    : stringValue(record(media.main).image) || stringValue(record(media.main).url));
  const price = version === 'V1_CATALOG'
    ? firstNumber(record(row.priceData).discountedPrice, record(row.priceData).price, record(row.price).discountedPrice, record(row.price).price)
    : firstNumber(record(record(row.actualPriceRange).minValue).amount);
  return { id, name: stringValue(row.name) || 'Untitled product', price, image, visible: row.visible !== false };
}

// Backs the product picker in the item form. V3 has fuzzy name search; V1 only supports a
// name prefix, so typing "Cam" finds "Camera kit" but not "Pro camera".
export async function searchStoreProducts(term: string, limit = 20): Promise<{ version: CatalogState; products: StoreProductOption[]; error?: string }> {
  const { version, error: detectError } = await detectCatalog();
  if (version === 'STORES_NOT_INSTALLED') return { version, products: [], error: detectError };
  const search = term.trim();
  const toOptions = (rows: unknown[]) => rows.flatMap((row) => productOption(row, version) ?? []);

  try {
    if (version === 'V3_CATALOG') {
      if (!search) {
        const result = await auth.elevate(productsV3.queryProducts)().limit(limit).find();
        return { version, products: toOptions(result.items) };
      }
      const result = await auth.elevate(productsV3.searchProducts)({
        cursorPaging: { limit },
        search: { expression: search, fields: ['name'], fuzzy: true },
      });
      return { version, products: toOptions(result.products ?? []) };
    }

    let query = auth.elevate(products.queryProducts)();
    if (search) query = query.startsWith('name', search);
    const result = await query.limit(limit).find();
    return { version, products: toOptions(result.items) };
  } catch (error) {
    return { version, products: [], error: `Couldn't search products: ${message(error)}` };
  }
}

// Resolves the product an item is already linked to, so the picker can show its name.
export async function getStoreProductOption(productId: string): Promise<StoreProductOption | null> {
  const version = await getCatalogState();
  if (version === 'STORES_NOT_INSTALLED' || !productId) return null;
  try {
    const product = version === 'V1_CATALOG'
      ? (await auth.elevate(products.getProduct)(productId)).product
      : await auth.elevate(productsV3.getProduct)(productId);
    return productOption(product, version);
  } catch {
    return null;
  }
}
