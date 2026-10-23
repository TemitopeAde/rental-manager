import type { APIRoute } from 'astro';
import { merchantOnly } from '../../../rental/guard';
import { json, readJson, str } from '../../../rental/http';
import { blockDates, unblockDates } from '../../../rental/merchant';

export const POST: APIRoute = async ({ request }) => {
  const denied = await merchantOnly();
  if (denied) return denied;
  const body = await readJson(request);
  const dates = Array.isArray(body.dates) ? body.dates.filter((date): date is string => typeof date === 'string') : [];
  const itemId = str(body.itemId) || undefined;
  const result = str(body.action) === 'unblock'
    ? await unblockDates(itemId, dates)
    : await blockDates(itemId, dates, str(body.reason));
  return json(result);
};
