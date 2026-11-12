// Pure refund rules: no SDK imports, so they can be unit tested without a Wix site.

export type RefundKind = 'item' | 'order' | 'deposit';

/** How a payment can be refunded, as reported by Get Order Refundability. */
export type PaymentMode = 'automatic' | 'manual' | 'none';

export interface PaymentState {
  paymentId: string;
  mode: PaymentMode;
  /** What's still refundable on this payment: paid − refunded − pending. */
  maxRefund: number;
  providerLink: string;
  reason: string;
}

export interface PaymentRefundPlan {
  paymentId: string;
  amount: number;
  external: boolean;
}

export interface RefundRecord {
  kind: RefundKind;
  amount: number;
  /** True when Wix only recorded the refund; the money has to be returned outside Wix. */
  external: boolean;
  refundId: string;
  at: string;
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/** Reads the payments of a Get Order Refundability response. Membership and gift card payments are skipped. */
export function readPayments(response: unknown): PaymentState[] {
  const payments = Array.isArray(obj(response).payments) ? (obj(response).payments as unknown[]) : [];
  const result: PaymentState[] = [];
  for (const raw of payments) {
    const entry = obj(raw);
    const payment = obj(entry.payment);
    const monetary = obj(payment.monetary);
    const paymentId = typeof payment.paymentId === 'string' ? payment.paymentId : '';
    if (!paymentId || !payment.monetary) continue;
    const manual = entry.manuallyRefundable ? obj(entry.manuallyRefundable) : null;
    const blocked = entry.nonRefundable ? obj(entry.nonRefundable) : null;
    const mode: PaymentMode = entry.refundable === true ? 'automatic' : manual ? 'manual' : 'none';
    result.push({
      paymentId,
      mode,
      maxRefund: money(num(obj(monetary.maxRefund).amount)),
      providerLink: typeof entry.providerLink === 'string' ? entry.providerLink : '',
      reason: String((manual ?? blocked)?.reason ?? ''),
    });
  }
  return result;
}

/**
 * Splits a refund across the order's payments: providers Wix can refund first, then payments that have to be
 * refunded outside Wix (recorded as external). Returns what couldn't be placed as `shortfall`.
 */
export function allocateRefund(payments: PaymentState[], amount: number): { refunds: PaymentRefundPlan[]; shortfall: number } {
  let remaining = money(amount);
  const refunds: PaymentRefundPlan[] = [];
  const ordered = [
    ...payments.filter((payment) => payment.mode === 'automatic'),
    ...payments.filter((payment) => payment.mode === 'manual'),
  ];
  for (const payment of ordered) {
    if (remaining <= 0) break;
    const share = money(Math.min(remaining, payment.maxRefund));
    if (share <= 0) continue;
    refunds.push({ paymentId: payment.paymentId, amount: share, external: payment.mode === 'manual' });
    remaining = money(remaining - share);
  }
  return { refunds, shortfall: Math.max(0, remaining) };
}

/** The deposit to give back after keeping part of it, never below zero or above the deposit. */
export function depositRefundAmount(deposit: number, amountKept: number): number {
  return money(Math.max(0, deposit - Math.min(Math.max(0, amountKept), deposit)));
}

/** Statuses whose rental line can be refunded: nothing was or will be rented out. */
export const refundableStatuses = new Set(['cancelled', 'expired']);

export function hasRefund(records: RefundRecord[] | undefined, kind: 'item' | 'deposit'): boolean {
  return (records ?? []).some((record) => record.kind === kind);
}

/** Reads stored refund records, dropping anything malformed. */
export function asRefundRecords(value: unknown): RefundRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(obj)
    .filter((record) => record.kind === 'item' || record.kind === 'order' || record.kind === 'deposit')
    .map((record) => ({
      kind: record.kind as RefundKind,
      amount: money(num(record.amount)),
      external: record.external === true,
      refundId: typeof record.refundId === 'string' ? record.refundId : '',
      at: typeof record.at === 'string' ? record.at : '',
    }));
}

/** A readable reason a refund isn't possible right now, or '' when it's a permissions problem we should explain. */
export function isPermissionError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return /permission|forbidden|unauthori[sz]ed|PERMISSION_DENIED|\b403\b/i.test(text);
}
