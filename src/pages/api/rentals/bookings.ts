import type { APIRoute } from 'astro';
import { countBookingsByStatus, findBooking, listBookingPage, resolveChangeRequest, settleDeposit, transition } from '../../../rental/actions';
import { merchantOnly } from '../../../rental/guard';
import { json, readJson, str, int } from '../../../rental/http';
import { createManualBooking } from '../../../rental/merchant';
import { kickReturnSweep, markLost, refreshPaymentLinks, renterHistory, sendPaymentLink, warnNextRenter } from '../../../rental/returns';

export const GET: APIRoute = async ({ request }) => {
  const denied = await merchantOnly();
  if (denied) return denied;
  const url = new URL(request.url);
  const reference = str(url.searchParams.get('reference'));
  if (reference) {
    const booking = await findBooking(reference);
    return json(booking ? { booking } : { message: 'Not found' }, booking ? 200 : 404);
  }
  if (url.searchParams.get('counts')) {
    return json(await countBookingsByStatus());
  }
  const history = str(url.searchParams.get('history'));
  if (history) {
    const result = await renterHistory(history);
    return json(result, result.ok ? 200 : 404);
  }
  kickReturnSweep();
  const { bookings, hasMore } = await listBookingPage(
    str(url.searchParams.get('status')) || undefined,
    str(url.searchParams.get('from')) || undefined,
    str(url.searchParams.get('to')) || undefined,
    Math.max(0, int(url.searchParams.get('offset'), 0)),
  );
  return json({ bookings, hasMore });
};

export const POST: APIRoute = async ({ request }) => {
  const denied = await merchantOnly();
  if (denied) return denied;
  const body = await readJson(request);
  const action = str(body.action);
  if (action === 'manual') {
    const result = await createManualBooking({
      itemId: str(body.itemId),
      startDate: str(body.startDate),
      endDate: str(body.endDate),
      quantity: int(body.quantity, 1),
      renterName: str(body.renterName),
      renterEmail: str(body.renterEmail),
    });
    return json(result, result.ok ? 201 : 400);
  }
  if (action === 'settle') {
    const result = await settleDeposit(str(body.reference), Number(body.amountKept ?? 0), str(body.note), 'dashboard');
    return json(result, result.ok ? 200 : 400);
  }
  if (action === 'change-approve' || action === 'change-decline') {
    const result = await resolveChangeRequest(str(body.reference), action === 'change-approve' ? 'approve' : 'decline', 'dashboard');
    return json(result, result.ok ? 200 : 400);
  }
  if (action === 'lost') {
    const result = await markLost(str(body.reference), str(body.note), body.removeFromStock !== false, 'dashboard');
    return json(result, result.ok ? 200 : 400);
  }
  if (action === 'warn-delay') {
    const result = await warnNextRenter(str(body.reference), 'dashboard');
    return json(result, result.ok ? 200 : 400);
  }
  if (action === 'payment-link') {
    const kind = str(body.kind) === 'extension' ? 'extension' : 'late-fee';
    const result = await sendPaymentLink(str(body.reference), kind, Number(body.amount), 'dashboard');
    return json(result, result.ok ? 200 : 400);
  }
  if (action === 'payment-status') {
    const result = await refreshPaymentLinks(str(body.reference));
    return json(result, result.ok ? 200 : 400);
  }
  if (action === 'approve' || action === 'decline' || action === 'pickup' || action === 'returned' || action === 'cancel') {
    const result = await transition(str(body.reference), action, 'dashboard', str(body.reason));
    return json(result, result.ok ? 200 : 400);
  }
  return json({ ok: false, message: 'Unknown action.' }, 400);
};
