import type { APIRoute } from 'astro';
import { findActiveItem } from '../../../rental/merchant';
import { loadSettings } from '../../../rental/availability';
import { json, str } from '../../../rental/http';
import { canBookItem, readPlan } from '../../../rental/plans';

export const GET: APIRoute = async ({ request }) => {
  const slug = str(new URL(request.url).searchParams.get('slug')).trim();
  if (!slug) return json({ message: 'A slug is required.' }, 400);
  const [item, settings, plan] = await Promise.all([
    findActiveItem(slug),
    loadSettings({ elevate: true }),
    readPlan({ elevate: true }),
  ]);
  if (!item) return json({ message: 'This rental is no longer available.' }, 404);
  if (!(await canBookItem(item._id, { elevate: true }, plan))) return json({ message: 'This rental is not currently available for new bookings.' }, 404);
  return json({ item, currency: settings.currency });
};
