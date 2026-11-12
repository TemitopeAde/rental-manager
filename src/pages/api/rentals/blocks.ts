import type { APIRoute } from 'astro';
import { merchantOnly } from '../../../rental/guard';
import { json, readJson, str } from '../../../rental/http';
import { blockDates, listBlockedDates, removeBlocks, unblockDates } from '../../../rental/merchant';
import { datesBetween, MAX_BLOCK_DAYS } from '../../../rental/blocked-rules';

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

export const GET: APIRoute = async () => {
  const denied = await merchantOnly();
  if (denied) return denied;
  return json({ blocks: await listBlockedDates() });
};

// Body: { action: 'block', itemId?, start, end, reason? } or { action: 'block', itemId?, dates, reason? }
//       { action: 'remove', ids } or { action: 'unblock', itemId?, dates }
export const POST: APIRoute = async ({ request }) => {
  const denied = await merchantOnly();
  if (denied) return denied;
  const body = await readJson(request);
  const action = str(body.action) || 'block';
  const itemId = str(body.itemId) || undefined;

  if (action === 'remove') return json(await removeBlocks(strings(body.ids)));
  if (action === 'unblock') return json(await unblockDates(itemId, strings(body.dates)));

  const start = str(body.start);
  const dates = start ? datesBetween(start, str(body.end) || start) : strings(body.dates);
  if (dates.length === 0) {
    return json({ ok: false, message: `Choose valid dates, at most ${MAX_BLOCK_DAYS} days at a time.` }, 400);
  }
  return json(await blockDates(itemId, dates, str(body.reason)));
};
