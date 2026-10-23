import type { APIRoute } from 'astro';
import { cancelByKey } from '../../../rental/actions';
import { json, readJson, str } from '../../../rental/http';

export const POST: APIRoute = async ({ request }) => {
  const body = await readJson(request);
  const result = await cancelByKey(str(body.idempotencyKey));
  return json(result, result.ok ? 200 : 400);
};
