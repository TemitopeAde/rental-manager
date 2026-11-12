import { orderBilling, orders } from '@wix/ecom';
import { auth } from '@wix/essentials';
import { collections } from './constants';
import { asBooking } from './holds';
import { findBooking } from './actions';
import type { Booking } from './models';
import { ORDER_DEPOSIT_FEE_CODE } from './deposit-rules';
import {
  allocateRefund,
  depositRefundAmount,
  hasRefund,
  isPermissionError,
  readPayments,
  refundableStatuses,
  type PaymentRefundPlan,
  type RefundKind,
  type RefundRecord,
} from './refund-rules';
import { getRow, insertRow, queryRows, updateRow } from './store';
import { readableError } from '../lib/error-text';

// Refunds go through the eCommerce Order Billing API: Get Order Refundability → Calculate Refund → Refund Payments.
// The app needs the "Manage Orders" permission (SCOPE.DC-STORES.MANAGE-ORDERS) for all three.

const merchant = { elevate: true };
const getRefundability = auth.elevate(orderBilling.getOrderRefundability);
const calculateRefund = auth.elevate(orderBilling.calculateRefund);
const refundPayments = auth.elevate(orderBilling.refundPayments);
const getOrder = auth.elevate(orders.getOrder);

const PERMISSION_MESSAGE =
  'Refunds need the Manage Orders permission. Ask the app developer to enable it, or approve the app update on this site, then try again.';

interface LineRefund {
  bookingId: string;
  lineItemId: string;
  quantity: number;
  amount: number;
}

interface DepositRefund {
  bookingId: string;
  amount: number;
  /** Set when the deposit is this app's per-order checkout fee; absent for a deposit inside an item's price. */
  feeId?: string;
}

export interface RefundPlan {
  kind: RefundKind;
  orderId: string;
  amount: number;
  lines: LineRefund[];
  deposit?: DepositRefund;
  payments: PaymentRefundPlan[];
  /** Part of the amount has to be paid back outside Wix (cash, or a provider Wix can't refund through). */
  external: boolean;
  providerLink: string;
  references: string[];
}

type PlanResult = { ok: true; plan: RefundPlan } | { ok: false; message: string };

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function failure(error: unknown, fallback: string): { ok: false; message: string } {
  if (isPermissionError(error)) return { ok: false, message: PERMISSION_MESSAGE };
  // Wix SDK errors carry a JSON dump in `message`; keep the full error in the logs, show only its message.
  console.error(fallback, error);
  return { ok: false, message: readableError(error instanceof Error ? error.message : String(error), fallback) };
}

async function orderBookings(orderId: string): Promise<Booking[]> {
  const result = await queryRows(collections.bookings, merchant).eq('ecomOrderId', orderId).limit(100).find();
  return result.items.map(asBooking);
}

async function depositFeeId(orderId: string): Promise<string> {
  const order = await getOrder(orderId);
  const fee = (order.additionalFees ?? []).find((entry) => entry.code === ORDER_DEPOSIT_FEE_CODE);
  return fee?._id ?? '';
}

/** Works out what a refund would send to Wix, without sending it. */
export async function planRefund(reference: string, kind: RefundKind, amountKept = 0): Promise<PlanResult> {
  const booking = await findBooking(reference);
  if (!booking) return { ok: false, message: 'Booking not found.' };
  const orderId = booking.ecomOrderId;
  if (!orderId) return { ok: false, message: `${booking.reference} has no Wix order to refund.` };

  try {
    const refundability = await getRefundability(orderId);
    const available = new Map(
      (refundability.lineItems ?? []).map((line) => [line.lineItemId ?? '', line.availableRefundQuantity ?? 0]),
    );
    const lines: Array<Omit<LineRefund, 'amount'>> = [];
    let deposit: DepositRefund | undefined;
    let references = [booking.reference];

    if (kind === 'item') {
      if (!refundableStatuses.has(booking.status)) {
        return { ok: false, message: `Cancel or decline ${booking.reference} before refunding it.` };
      }
      if (hasRefund(booking.refunds, 'item')) return { ok: false, message: `${booking.reference} was already refunded.` };
      const quantity = available.get(booking.cartLineItemId) ?? 0;
      if (!booking.cartLineItemId || quantity <= 0) return { ok: false, message: `Nothing is left to refund for ${booking.reference}.` };
      lines.push({ bookingId: booking._id, lineItemId: booking.cartLineItemId, quantity });
    } else if (kind === 'order') {
      const all = await orderBookings(orderId);
      const live = all.filter((entry) => !refundableStatuses.has(entry.status));
      if (live.length > 0) {
        return {
          ok: false,
          message: `Cancel ${live.map((entry) => entry.reference).join(', ')} first. A whole-order refund covers only cancelled rentals.`,
        };
      }
      references = all.map((entry) => entry.reference);
      for (const entry of all) {
        const quantity = available.get(entry.cartLineItemId) ?? 0;
        if (entry.cartLineItemId && quantity > 0 && !hasRefund(entry.refunds, 'item')) {
          lines.push({ bookingId: entry._id, lineItemId: entry.cartLineItemId, quantity });
        }
      }
      const holder = all.find((entry) => entry.orderDeposit && !hasRefund(entry.refunds, 'deposit'));
      if (holder) {
        const feeId = await depositFeeId(orderId);
        const fee = (refundability.additionalFees ?? []).find((entry) => entry.additionalFeeId === feeId);
        const amount = money(Number(fee?.availableRefundAmount?.amount ?? 0));
        if (feeId && amount > 0) deposit = { bookingId: holder._id, amount, feeId };
      }
      if (lines.length === 0 && !deposit) return { ok: false, message: 'Nothing is left to refund on this order.' };
    } else {
      if (!booking.depositOutcome) return { ok: false, message: `Settle the deposit on ${booking.reference} first.` };
      if (hasRefund(booking.refunds, 'deposit')) return { ok: false, message: `The deposit on ${booking.reference} was already refunded.` };
      const amount = depositRefundAmount(booking.quote.deposit, amountKept || booking.depositOutcome.amountKept);
      if (amount <= 0) return { ok: false, message: 'The whole deposit was kept, so there is nothing to refund.' };
      if (booking.orderDeposit) {
        const feeId = await depositFeeId(orderId);
        const fee = (refundability.additionalFees ?? []).find((entry) => entry.additionalFeeId === feeId);
        const left = money(Number(fee?.availableRefundAmount?.amount ?? 0));
        if (!feeId || left <= 0) return { ok: false, message: 'The deposit on this order was already refunded in Wix.' };
        deposit = { bookingId: booking._id, amount: Math.min(amount, left), feeId };
      } else {
        // A per-item deposit is part of the item's price, so it goes back as an amount, not a line.
        deposit = { bookingId: booking._id, amount };
      }
    }

    // Wix works out each line's amount, including tax and discounts.
    let priced: LineRefund[] = [];
    let amount = deposit?.amount ?? 0;
    if (lines.length > 0) {
      const calculated = await calculateRefund(orderId, {
        refundItems: {
          lineItems: lines.map((line) => ({ lineItemId: line.lineItemId, quantity: line.quantity })),
        },
      });
      const totals = new Map(
        (calculated.calculatedRefundItems?.lineItems ?? []).map((entry) => [
          entry.item?.lineItemId ?? '',
          money(Number(entry.summary?.total?.amount ?? 0)),
        ]),
      );
      priced = lines.map((line) => ({ ...line, amount: totals.get(line.lineItemId) ?? 0 }));
      amount = money(amount + Number(calculated.summary?.total?.amount ?? 0));
    }
    if (amount <= 0) return { ok: false, message: 'Nothing is left to refund.' };

    const states = readPayments(refundability);
    const { refunds, shortfall } = allocateRefund(states, amount);
    if (shortfall > 0) {
      const blocked = states.find((state) => state.mode === 'none');
      return {
        ok: false,
        message: blocked?.reason
          ? `Wix can't refund this order (${blocked.reason.toLowerCase().replace(/_/g, ' ')}).`
          : `Only ${money(amount - shortfall).toFixed(2)} of ${amount.toFixed(2)} can be refunded on this order.`,
      };
    }
    const external = refunds.some((refund) => refund.external);
    const usedIds = new Set(refunds.filter((refund) => refund.external).map((refund) => refund.paymentId));
    const providerLink = states.find((state) => usedIds.has(state.paymentId) && state.providerLink)?.providerLink ?? '';
    return { ok: true, plan: { kind, orderId, amount, lines: priced, deposit, payments: refunds, external, providerLink, references } };
  } catch (error) {
    return failure(error, 'Could not check this order in Wix.');
  }
}

async function addRecord(bookingId: string, record: RefundRecord, clearRefundNeeded: boolean) {
  const row = await getRow(collections.bookings, bookingId, merchant);
  if (!row) return;
  const current = asBooking(row).refunds;
  await updateRow(
    collections.bookings,
    { ...row, refunds: [...current, record], ...(clearRefundNeeded ? { refundNeeded: false } : {}) },
    merchant,
  );
}

/** Plans the refund again from live Wix data, sends it, and records it on the bookings it covers. */
export async function issueRefund(reference: string, kind: RefundKind, expectedAmount: number, note: string, source: string) {
  const planned = await planRefund(reference, kind);
  if (!planned.ok) return planned;
  const { plan } = planned;
  // The owner confirmed a specific amount; refuse if Wix now says something different.
  if (Math.abs(plan.amount - expectedAmount) > 0.009) {
    return { ok: false as const, message: `The refundable amount changed to ${plan.amount.toFixed(2)}. Check it and try again.` };
  }

  let refundId = '';
  try {
    const response = await refundPayments(plan.orderId, {
      paymentRefunds: plan.payments.map((payment) => ({
        paymentId: payment.paymentId,
        amount: { amount: payment.amount.toFixed(2) },
        externalRefund: payment.external,
      })),
      refundItems: {
        lineItems: plan.lines.map((line) => ({ lineItemId: line.lineItemId, quantity: line.quantity })),
        additionalFees: plan.deposit?.feeId
          ? [{ additionalFeeId: plan.deposit.feeId, amount: { amount: plan.deposit.amount.toFixed(2) } }]
          : [],
      },
      sideEffects: {
        notifications: {
          // Wix emails the customer only for money it actually sends back.
          sendCustomerEmail: !plan.external,
          ...(note.trim() ? { customMessage: note.trim().slice(0, 1000) } : {}),
        },
      },
      ...(note.trim() ? { customerReason: note.trim().slice(0, 200) } : {}),
    });
    refundId = response.refund?._id ?? '';
  } catch (error) {
    return failure(error, 'Wix did not accept the refund.');
  }

  const at = new Date().toISOString();
  for (const line of plan.lines) {
    await addRecord(line.bookingId, { kind: 'item', amount: line.amount, external: plan.external, refundId, at }, true);
  }
  if (plan.deposit) {
    await addRecord(plan.deposit.bookingId, { kind: 'deposit', amount: plan.deposit.amount, external: plan.external, refundId, at }, false);
    // Refunding a whole cancelled order gives the deposit back too, which settles it.
    if (kind === 'order') {
      const row = await getRow(collections.bookings, plan.deposit.bookingId, merchant);
      if (row && !asBooking(row).depositOutcome) {
        await updateRow(collections.bookings, { ...row, depositOutcome: { outcome: 'released', amountKept: 0, note: 'Refunded with the order.' } }, merchant);
      }
    }
  }
  const summary = `${kind} refund of ${plan.amount.toFixed(2)} on Wix order ${plan.orderId}${plan.external ? ' (recorded; pay back outside Wix)' : ''}.`;
  const holder = await findBooking(reference);
  await insertRow(collections.audit, { action: `refund-${kind}`, summary, bookingId: holder?._id ?? '', source, actor: source }, merchant);

  return {
    ok: true as const,
    amount: plan.amount,
    external: plan.external,
    providerLink: plan.providerLink,
    message: plan.external
      ? `Recorded a ${plan.amount.toFixed(2)} refund in Wix. Pay it back to the customer outside Wix.`
      : `Refunded ${plan.amount.toFixed(2)} to the customer.`,
  };
}
