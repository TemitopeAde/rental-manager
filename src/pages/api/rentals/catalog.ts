import type { APIRoute } from 'astro';
import { listCategories, listItemPage, syncLinkedStoreImages } from '../../../rental/merchant';
import { loadSettings } from '../../../rental/availability';
import { json, str } from '../../../rental/http';
import { bookableItemIds, readPlan } from '../../../rental/plans';
import { getCurrentAppInstance } from '../../../rental/app-instance';

// Items over the plan's limit stay in the dashboard but are left out here, so renters can't start a booking.
export const GET: APIRoute = async ({ request }) => {
  const startedAt = Date.now();
  const timings: Record<string, number> = {};
  const counts: Record<string, number> = {};
  let failure: string | undefined;
  const timed = async <T>(name: string, operation: () => Promise<T>): Promise<T> => {
    const stageStartedAt = Date.now();
    try {
      return await operation();
    } finally {
      timings[name] = Date.now() - stageStartedAt;
    }
  };

  const url = new URL(request.url);
  try {
    const category = str(url.searchParams.get('category')) || undefined;
    const offset = Math.max(0, Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0);
    const requestedLimit = Number.parseInt(url.searchParams.get('limit') || '200', 10) || 200;
    const limit = Math.min(200, Math.max(1, requestedLimit));
    const [rawItems, appInstance] = await Promise.all([
      timed('listItemsMs', () => listItemPage(category, 'active', offset, limit)),
      timed('getAppInstanceMs', async () => {
        try {
          return await getCurrentAppInstance();
        } catch (error) {
          console.error('Unable to read the app instance for catalog settings and plan.', error);
          return null;
        }
      }),
    ]);
    const [settings, plan] = await Promise.all([
      timed('loadSettingsMs', () => loadSettings({ elevate: true }, appInstance)),
      timed('readPlanMs', () => readPlan({ elevate: true }, appInstance)),
    ]);
    counts.rentalItems = rawItems.items.length;
    counts.linkedRentals = rawItems.items.filter((item) => item.storeProductId).length;

    const items = await timed('syncStoreImagesMs', () => syncLinkedStoreImages(rawItems.items));
    const allowed = await timed('bookableItemIdsMs', () => bookableItemIds({ elevate: true }, plan));
    const categories = offset === 0
      ? await timed('listCategoriesMs', () => listCategories(allowed))
      : [];
    const visibleItems = allowed ? items.filter((item) => allowed.has(item._id)) : items;
    counts.visibleItems = visibleItems.length;
    counts.categories = categories.length;
    return json({ items: visibleItems, categories, hasMore: rawItems.hasMore, currency: settings.currency, language: settings.language });
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    console.info('[RentalManager catalog timing]', JSON.stringify({
      event: 'rental_catalog_timing',
      durationMs: Date.now() - startedAt,
      timings,
      counts,
      failed: Boolean(failure),
      ...(failure ? { error: failure } : {}),
    }));
  }
};
