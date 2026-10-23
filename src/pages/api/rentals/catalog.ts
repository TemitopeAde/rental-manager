import type { APIRoute } from 'astro';
import { listItems } from '../../../rental/merchant';
import { json, str } from '../../../rental/http';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const items = await listItems(str(url.searchParams.get('category')) || undefined, 'active');
  return json({ items });
};
