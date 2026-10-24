import type { APIRoute } from 'astro';
import { loadSettings } from '../../../rental/availability';
import { resolveStoreRentalItem } from '../../../rental/merchant';
import { json, str } from '../../../rental/http';

export const GET: APIRoute = async ({ request }) => {
  const productId = str(new URL(request.url).searchParams.get('productId'));
  console.info('[store-product] lookup started', { productId });
  const item = await resolveStoreRentalItem(productId);
  if (!item) {
    console.warn('[store-product] product is not eligible for rental', { productId });
    return json({ eligible: false, message: 'This product is not configured as a rental.' }, 404);
  }
  console.info('[store-product] rental item resolved', {
    productId,
    itemId: item._id,
    itemName: item.name,
    storeProductId: item.storeProductId,
    status: item.status,
    storeRentalOverride: item.storeRentalOverride,
  });
  const settings = await loadSettings({ elevate: true });
  return json({ eligible: true, item, currency: settings.currency });
};
