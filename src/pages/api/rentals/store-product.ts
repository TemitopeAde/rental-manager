import type { APIRoute } from 'astro';
import { resolveStoreRentalItem } from '../../../rental/merchant';
import { json, str } from '../../../rental/http';

export const GET: APIRoute = async ({ request }) => {
  const productId = str(new URL(request.url).searchParams.get('productId'));
  const { item, settings } = await resolveStoreRentalItem(productId);
  if (!item) {
    // Not an error: most store products simply aren't rentals. Return 200 so the
    // embed can quietly render nothing instead of surfacing a failure.
    return json({ eligible: false, message: 'This product is not configured as a rental.' });
  }
  return json({ eligible: true, item, currency: settings.currency, language: settings.language });
};
