import type { APIRoute } from 'astro';
import { json, readJson } from '../../../rental/http';
import { quoteRental } from '../../../rental/holds';
import { quoteSchema } from '../../../rental/schemas';

export const POST: APIRoute = async ({ request }) => {
  const parsed = quoteSchema.safeParse(await readJson(request));
  if (!parsed.success) return json({ ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid quote.' }, 400);
  const result = await quoteRental(parsed.data);
  return json(result, result.ok ? 200 : 400);
};
