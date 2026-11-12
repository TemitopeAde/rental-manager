import type { APIRoute } from 'astro';
import { currentMember } from '../../../rental/guard';
import { json, readJson, str } from '../../../rental/http';
import { listMemberBookings, quoteDateChange, quoteExtension, renterCancel, requestDateChange, requestExtension } from '../../../rental/renter';
import { kickReturnSweep } from '../../../rental/returns';

const signedOut = () => json({ ok: false, message: 'Log in to see your rentals.' }, 401);

export const GET: APIRoute = async () => {
  const member = await currentMember();
  if (!member) return signedOut();
  kickReturnSweep();
  return json(await listMemberBookings(member));
};

export const POST: APIRoute = async ({ request }) => {
  const member = await currentMember();
  if (!member) return signedOut();
  const body = await readJson(request);
  const action = str(body.action);
  const reference = str(body.reference);
  if (action === 'cancel') {
    const { status, ...result } = await renterCancel(reference, member);
    return json(result, status);
  }
  if (action === 'quote-change') {
    const result = await quoteDateChange(reference, str(body.startDate), str(body.endDate), member);
    if (!result.ok) return json({ ok: false, message: result.message }, result.status);
    return json({ ok: true, quote: result.quote, difference: result.difference });
  }
  if (action === 'change') {
    const { status, ...result } = await requestDateChange(reference, str(body.startDate), str(body.endDate), member);
    return json(result, status);
  }
  if (action === 'quote-extend') {
    const result = await quoteExtension(reference, str(body.endDate), member);
    if (!result.ok) return json({ ok: false, message: result.message }, result.status);
    return json({ ok: true, quote: result.quote, difference: result.difference });
  }
  if (action === 'extend') {
    const { status, ...result } = await requestExtension(reference, str(body.endDate), member);
    return json(result, status);
  }
  return json({ ok: false, message: 'Unknown action.' }, 400);
};
