import type { APIRoute } from 'astro';
import { loadSettings } from '../../../rental/availability';
import { resolveStoreRentalItem } from '../../../rental/merchant';
import { json, str } from '../../../rental/http';

export const GET: APIRoute = async ({ request }) => {
  const productId = str(new URL(request.url).searchParams.get('productId'));
  const item = await resolveStoreRentalItem(productId);
  if (!item) {
    return json({ eligible: false, message: 'This product is not configured as a rental.' }, 404);
  }
  const settings = await loadSettings({ elevate: true });
  return json({ eligible: true, item, currency: settings.currency });
};
