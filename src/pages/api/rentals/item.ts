import type { APIRoute } from 'astro';
import { findActiveItem } from '../../../rental/merchant';
import { loadSettings } from '../../../rental/availability';
import { json, str } from '../../../rental/http';

export const GET: APIRoute = async ({ request }) => {
  const slug = str(new URL(request.url).searchParams.get('slug')).trim();
  if (!slug) return json({ message: 'A slug is required.' }, 400);
  const [item, settings] = await Promise.all([findActiveItem(slug), loadSettings({ elevate: true })]);
  if (!item) return json({ message: 'This rental is no longer available.' }, 404);
  return json({ item, currency: settings.currency });
};
