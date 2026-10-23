import type { APIRoute } from 'astro';
import { json, readJson, str } from '../../../rental/http';
import { extendHold, holdRental } from '../../../rental/holds';
import { holdSchema } from '../../../rental/schemas';

export const POST: APIRoute = async ({ request }) => {
  const body = await readJson(request);
  if (str(body.action) === 'extend') {
    const result = await extendHold(str(body.bookingId));
    return json(result, result.ok ? 200 : 400);
  }
  const parsed = holdSchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid hold.' }, 400);
  const result = await holdRental(parsed.data);
  return json(result, result.ok ? 200 : 409);
};
