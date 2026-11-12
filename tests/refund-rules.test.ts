import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allocateRefund,
  asRefundRecords,
  depositRefundAmount,
  hasRefund,
  isPermissionError,
  readPayments,
  type PaymentState,
} from '../src/rental/refund-rules.ts';

describe('readPayments', () => {
  it('reads automatic, manual and blocked payments from a refundability response', () => {
    const payments = readPayments({
      payments: [
        { refundable: true, payment: { paymentId: 'card', monetary: { maxRefund: { amount: '120.00' } } } },
        {
          manuallyRefundable: { reason: 'OFFLINE' },
          providerLink: 'https://provider.example/refunds',
          payment: { paymentId: 'cash', monetary: { maxRefund: { amount: '30' } } },
        },
        { nonRefundable: { reason: 'ALREADY_REFUNDED' }, payment: { paymentId: 'old', monetary: { maxRefund: { amount: '0' } } } },
        // Membership payments have no monetary amount and are skipped.
        { refundable: true, payment: { paymentId: 'plan', membership: {} } },
      ],
    });
    assert.deepEqual(payments, [
      { paymentId: 'card', mode: 'automatic', maxRefund: 120, providerLink: '', reason: '' },
      { paymentId: 'cash', mode: 'manual', maxRefund: 30, providerLink: 'https://provider.example/refunds', reason: 'OFFLINE' },
      { paymentId: 'old', mode: 'none', maxRefund: 0, providerLink: '', reason: 'ALREADY_REFUNDED' },
    ]);
  });

  it('copes with an empty or malformed response', () => {
    assert.deepEqual(readPayments(undefined), []);
    assert.deepEqual(readPayments({ payments: 'nope' }), []);
  });
});

describe('allocateRefund', () => {
  const card: PaymentState = { paymentId: 'card', mode: 'automatic', maxRefund: 100, providerLink: '', reason: '' };
  const cash: PaymentState = { paymentId: 'cash', mode: 'manual', maxRefund: 50, providerLink: '', reason: 'OFFLINE' };
  const blocked: PaymentState = { paymentId: 'x', mode: 'none', maxRefund: 500, providerLink: '', reason: 'FORBIDDEN' };

  it('uses payments Wix can refund before ones that need an external refund', () => {
    assert.deepEqual(allocateRefund([cash, card], 80), { refunds: [{ paymentId: 'card', amount: 80, external: false }], shortfall: 0 });
    assert.deepEqual(allocateRefund([cash, card], 130), {
      refunds: [
        { paymentId: 'card', amount: 100, external: false },
        { paymentId: 'cash', amount: 30, external: true },
      ],
      shortfall: 0,
    });
  });

  it('never uses blocked payments and reports what is left over', () => {
    assert.deepEqual(allocateRefund([blocked, card], 120), { refunds: [{ paymentId: 'card', amount: 100, external: false }], shortfall: 20 });
    assert.deepEqual(allocateRefund([], 10), { refunds: [], shortfall: 10 });
  });

  it('keeps cents exact', () => {
    const result = allocateRefund([{ ...card, maxRefund: 0.3 }, { ...cash, maxRefund: 0.3 }], 0.6);
    assert.deepEqual(result.refunds.map((refund) => refund.amount), [0.3, 0.3]);
    assert.equal(result.shortfall, 0);
  });
});

describe('depositRefundAmount', () => {
  it('returns what is left after the kept amount, clamped to the deposit', () => {
    assert.equal(depositRefundAmount(150, 20), 130);
    assert.equal(depositRefundAmount(150, 0), 150);
    assert.equal(depositRefundAmount(150, 200), 0);
    assert.equal(depositRefundAmount(150, -5), 150);
    assert.equal(depositRefundAmount(99.99, 33.33), 66.66);
  });
});

describe('refund records', () => {
  it('reads stored records and drops malformed ones', () => {
    const records = asRefundRecords([
      { kind: 'item', amount: '45.5', external: false, refundId: 'r1', at: '2026-11-11T10:00:00Z' },
      { kind: 'deposit', amount: 100, external: true },
      { kind: 'bogus', amount: 1 },
      'nope',
    ]);
    assert.equal(records.length, 2);
    assert.equal(records[0].amount, 45.5);
    assert.equal(records[1].external, true);
    assert.equal(hasRefund(records, 'item'), true);
    assert.equal(hasRefund(records, 'deposit'), true);
    assert.equal(hasRefund([], 'item'), false);
    assert.deepEqual(asRefundRecords(undefined), []);
  });
});

describe('isPermissionError', () => {
  it('spots missing-permission failures', () => {
    assert.equal(isPermissionError(new Error('PERMISSION_DENIED: missing scope')), true);
    assert.equal(isPermissionError(new Error('Request failed with status 403')), true);
    assert.equal(isPermissionError(new Error('Payment amount exceeds the available refund amount')), false);
  });
});
