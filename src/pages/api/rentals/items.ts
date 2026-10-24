import type { APIRoute } from 'astro';
import { merchantOnly } from '../../../rental/guard';
import { createItem, listItems, updateItem } from '../../../rental/merchant';
import { json, readJson, str } from '../../../rental/http';
import type { RentalItem } from '../../../rental/models';
import { bookableItemIds, readPlan } from '../../../rental/plans';
import { itemSchema } from '../../../rental/schemas';

const merchant = { elevate: true };

export const GET: APIRoute = async ({ request }) => {
  const denied = await merchantOnly();
  if (denied) return denied;
  const url = new URL(request.url);
  const [items, plan] = await Promise.all([
    listItems(str(url.searchParams.get('category')) || undefined, str(url.searchParams.get('status')) || undefined),
    readPlan(merchant),
  ]);
  // `null` when every item can take bookings; otherwise the dashboard flags the rest as over the limit.
  const allowed = await bookableItemIds(merchant, plan);
  return json({ items, bookableIds: allowed ? [...allowed] : null });
};

export const POST: APIRoute = async ({ request }) => {
  const denied = await merchantOnly();
  if (denied) return denied;
  const body = await readJson(request);
  if (str(body.itemId)) {
    const result = await updateItem(str(body.itemId), body as Partial<RentalItem>);
    return json(result, result.ok ? 200 : 400);
  }
  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid item.' }, 400);
  const result = await createItem(parsed.data);
  return json(result, result.ok ? 201 : 400);
};
