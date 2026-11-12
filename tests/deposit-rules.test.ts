import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkoutUnitPrice,
  depositFeeName,
  itemDepositAmount,
  ORDER_DEPOSIT_FEE_CODE,
  orderDepositAmount,
  orderDepositOnOrder,
  unfinishedInOrder,
} from '../src/rental/deposit-rules.ts';

const perOrder = { depositMode: 'order' as const, orderDepositAmount: 150 };
const perItem = { depositMode: 'item' as const, orderDepositAmount: 150 };

describe('orderDepositAmount', () => {
  it('charges the set amount only in per-order mode on an allowed plan', () => {
    assert.equal(orderDepositAmount(perOrder, true), 150);
    assert.equal(orderDepositAmount(perOrder, false), 0);
    assert.equal(orderDepositAmount(perItem, true), 0);
    assert.equal(orderDepositAmount({ depositMode: 'order', orderDepositAmount: 0 }, true), 0);
    assert.equal(orderDepositAmount({ depositMode: 'order', orderDepositAmount: -5 }, true), 0);
    assert.equal(orderDepositAmount({ depositMode: 'order', orderDepositAmount: 12.345 }, true), 12.35);
  });
});

describe('itemDepositAmount', () => {
  it('zeroes item deposits only while a per-order deposit is charged', () => {
    assert.equal(itemDepositAmount(40, perOrder, true), 0);
    assert.equal(itemDepositAmount(40, perOrder, false), 40);
    assert.equal(itemDepositAmount(40, perItem, true), 40);
    // Per-order mode with no amount set keeps item deposits, so the site never silently charges none.
    assert.equal(itemDepositAmount(40, { depositMode: 'order', orderDepositAmount: 0 }, true), 40);
  });
});

describe('checkoutUnitPrice', () => {
  it('includes an item deposit but not an order deposit recorded after payment', () => {
    assert.equal(checkoutUnitPrice({ rental: 90, deposit: 30, quantity: 3 }, false), 40);
    assert.equal(checkoutUnitPrice({ rental: 90, deposit: 150, quantity: 3 }, true), 30);
    assert.equal(checkoutUnitPrice({ rental: 10, deposit: 0, quantity: 3 }, false), 3.33);
  });
});

describe('depositFeeName', () => {
  it('matches the language prefix and falls back to English', () => {
    assert.equal(depositFeeName('fr-FR'), 'Caution remboursable');
    assert.equal(depositFeeName('de'), 'Rückzahlbare Kaution');
    assert.equal(depositFeeName('ja-JP'), 'Refundable deposit');
    assert.equal(depositFeeName(undefined), 'Refundable deposit');
    for (const code of ['en', 'es', 'fr', 'de', 'pt', 'it', 'he']) assert.ok(depositFeeName(code).length <= 50);
  });
});

describe('orderDepositOnOrder', () => {
  const lines = [
    { lineItemId: 'line-1', bookingId: 'booking-1' },
    { lineItemId: 'line-2', bookingId: 'booking-2' },
  ];

  it('finds this app’s fee and the first covered line', () => {
    const fees = [
      { code: 'gift-wrap', price: { amount: '5' } },
      { code: ORDER_DEPOSIT_FEE_CODE, price: { amount: '150.00' }, lineItemIds: ['line-2'] },
    ];
    assert.deepEqual(orderDepositOnOrder(fees, lines), { amount: 150, bookingId: 'booking-2' });
  });

  it('treats a fee with no line ids as covering the whole order', () => {
    const fees = [{ code: ORDER_DEPOSIT_FEE_CODE, price: { amount: '75' }, lineItemIds: [] }];
    assert.deepEqual(orderDepositOnOrder(fees, lines), { amount: 75, bookingId: 'booking-1' });
  });

  it('returns null without a fee, a positive amount, or a confirmed covered line', () => {
    assert.equal(orderDepositOnOrder(undefined, lines), null);
    assert.equal(orderDepositOnOrder([{ code: ORDER_DEPOSIT_FEE_CODE, price: { amount: '0' } }], lines), null);
    assert.equal(orderDepositOnOrder([{ code: ORDER_DEPOSIT_FEE_CODE, price: { amount: '50' }, lineItemIds: ['other'] }], lines), null);
    assert.equal(orderDepositOnOrder([{ code: ORDER_DEPOSIT_FEE_CODE, price: { amount: '50' } }], []), null);
  });
});

describe('unfinishedInOrder', () => {
  it('lists the other bookings still out or not yet picked up', () => {
    const bookings = [
      { _id: 'a', reference: 'R-1', status: 'returned' },
      { _id: 'b', reference: 'R-2', status: 'active' },
      { _id: 'c', reference: 'R-3', status: 'cancelled' },
      { _id: 'd', reference: 'R-4', status: 'confirmed' },
    ];
    assert.deepEqual(unfinishedInOrder(bookings, 'b'), ['R-4']);
    assert.deepEqual(unfinishedInOrder(bookings), ['R-2', 'R-4']);
  });
});
