import type { APIRoute } from 'astro';
import { kickReturnSweep } from '../../../rental/returns';
import { json, readJson } from '../../../rental/http';
import { quoteRental } from '../../../rental/holds';
import { quoteSchema } from '../../../rental/schemas';

export const POST: APIRoute = async ({ request }) => {
  const parsed = quoteSchema.safeParse(await readJson(request));
  if (!parsed.success) return json({ ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid quote.' }, 400);
  kickReturnSweep();
  const startedAt = Date.now();
  const result = await quoteRental(parsed.data, '', true);
  console.info('[RentalManager quote timing]', JSON.stringify({ durationMs: Date.now() - startedAt, ok: result.ok }));
  return json(result, result.ok ? 200 : 400);
};
