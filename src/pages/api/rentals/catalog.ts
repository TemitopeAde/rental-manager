import type { APIRoute } from 'astro';
import { listCategories, listItems } from '../../../rental/merchant';
import { loadSettings } from '../../../rental/availability';
import { json, str } from '../../../rental/http';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const [items, categories, settings] = await Promise.all([
    listItems(str(url.searchParams.get('category')) || undefined, 'active'),
    listCategories(),
    loadSettings({ elevate: true }),
  ]);
  return json({ items, categories, currency: settings.currency });
};
