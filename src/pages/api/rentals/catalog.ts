import type { APIRoute } from 'astro';
import { listCategories, listItems } from '../../../rental/merchant';
import { loadSettings } from '../../../rental/availability';
import { json, str } from '../../../rental/http';
import { bookableItemIds, readPlan } from '../../../rental/plans';

// Items over the plan's limit stay in the dashboard but are left out here, so renters can't start a booking.
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const [items, settings, plan] = await Promise.all([
    listItems(str(url.searchParams.get('category')) || undefined, 'active'),
    loadSettings({ elevate: true }),
    readPlan({ elevate: true }),
  ]);
  const allowed = await bookableItemIds({ elevate: true }, plan);
  const categories = await listCategories(allowed);
  return json({ items: allowed ? items.filter((item) => allowed.has(item._id)) : items, categories, currency: settings.currency });
};
