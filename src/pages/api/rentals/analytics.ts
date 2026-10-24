import type { APIRoute } from 'astro';
import { RANGES, rentalAnalytics, type RangeKey } from '../../../rental/analytics';
import { merchantOnly } from '../../../rental/guard';
import { json, str } from '../../../rental/http';

// ?range=7d|30d|90d|12m, ending today in the business timezone. Defaults to the last 30 days.
export const GET: APIRoute = async ({ request }) => {
  const denied = await merchantOnly();
  if (denied) return denied;
  const requested = str(new URL(request.url).searchParams.get('range'));
  const range: RangeKey = requested in RANGES ? (requested as RangeKey) : '30d';
  return json(await rentalAnalytics(range));
};
