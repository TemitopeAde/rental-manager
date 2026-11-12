import type { APIRoute } from 'astro';
import { itemAvailability } from '../../../rental/holds';
import { json, str } from '../../../rental/http';

// Public: the booking calendar reads it to grey out dates. It exposes per-day unit counts, never who booked.
export const GET: APIRoute = async ({ request }) => {
  const itemId = str(new URL(request.url).searchParams.get('itemId'));
  if (!itemId) return json({ message: 'itemId is required.' }, 400);
  const availability = await itemAvailability(itemId);
  if (!availability) return json({ message: 'Item not found.' }, 404);
  return json({ availability });
};
