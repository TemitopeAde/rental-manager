import type { APIRoute } from 'astro';
import { merchantOnly } from '../../../rental/guard';
import { json, readJson, str } from '../../../rental/http';
import { issueRefund, planRefund } from '../../../rental/refunds';
import type { RefundKind } from '../../../rental/refund-rules';

function kindOf(value: string): RefundKind | null {
  return value === 'item' || value === 'order' || value === 'deposit' ? value : null;
}

// Body: { action: 'preview' | 'issue', reference, kind: 'item' | 'order' | 'deposit', amount?, note? }
// 'preview' only reads from Wix. 'issue' re-plans from live data and refuses if the amount moved from `amount`.
export const POST: APIRoute = async ({ request }) => {
  const denied = await merchantOnly();
  if (denied) return denied;
  const body = await readJson(request);
  const kind = kindOf(str(body.kind));
  const reference = str(body.reference);
  if (!kind || !reference) return json({ ok: false, message: 'Choose a booking and what to refund.' }, 400);

  if (str(body.action) === 'issue') {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return json({ ok: false, message: 'Confirm the refund amount first.' }, 400);
    const result = await issueRefund(reference, kind, amount, str(body.note), 'dashboard');
    return json(result, result.ok ? 200 : 400);
  }

  const result = await planRefund(reference, kind);
  if (!result.ok) return json(result, 400);
  const { plan } = result;
  return json({
    ok: true,
    amount: plan.amount,
    external: plan.external,
    providerLink: plan.providerLink,
    references: plan.references,
    lines: plan.lines.map((line) => ({ bookingId: line.bookingId, amount: line.amount })),
    deposit: plan.deposit ? { amount: plan.deposit.amount } : null,
  });
};
