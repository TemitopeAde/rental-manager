import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bucketFor,
  bucketKey,
  itemStats,
  rentedUnitDays,
  series,
  statusCounts,
  totals,
  utilization,
  type AnalyticsBooking,
} from '../src/rental/analytics-rules.ts';

function booking(overrides: Partial<AnalyticsBooking>): AnalyticsBooking {
  return {
    itemId: 'camera',
    status: 'confirmed',
    startDate: '2026-10-05',
    quantity: 1,
    ecomOrderId: 'order-1',
    idempotencyKey: 'key-1',
    quote: { days: 2, rental: 100 },
    ...overrides,
  };
}

describe('totals', () => {
  it('counts only paid bookings as revenue, and leaves deposits out', () => {
    const result = totals([
      booking({ quote: { days: 2, rental: 100 } }),
      booking({ status: 'returned', quote: { days: 4, rental: 200 }, depositOutcome: { outcome: 'kept', amountKept: 15 } }),
      booking({ status: 'hold', quote: { days: 1, rental: 999 } }),
      booking({ status: 'expired', quote: { days: 1, rental: 999 } }),
      booking({ status: 'cancelled', quote: { days: 1, rental: 999 } }),
    ]);
    assert.equal(result.revenue, 300);
    assert.equal(result.bookings, 2);
    assert.equal(result.averageValue, 150);
    assert.equal(result.averageDays, 3);
    assert.equal(result.depositsKept, 15);
    assert.equal(result.cancelled, 1);
  });

  it('ignores abandoned cart holds when counting cancellations', () => {
    const result = totals([
      booking({ status: 'cancelled', ecomOrderId: '', idempotencyKey: 'browser-uuid' }),
      booking({ status: 'cancelled', ecomOrderId: '', idempotencyKey: 'manual-RB-ABC' }),
    ]);
    assert.equal(result.cancelled, 1);
  });

  it('is all zeros with no bookings', () => {
    assert.deepEqual(totals([]), { revenue: 0, bookings: 0, averageValue: 0, averageDays: 0, depositsKept: 0, cancelled: 0 });
  });
});

describe('buckets', () => {
  it('picks day, week or month by span', () => {
    assert.equal(bucketFor('2026-10-01', '2026-10-30'), 'day');
    assert.equal(bucketFor('2026-07-27', '2026-10-24'), 'week');
    assert.equal(bucketFor('2025-10-25', '2026-10-24'), 'month');
  });

  it('starts weeks on Monday', () => {
    // 2026-10-24 is a Saturday; its week starts Monday 2026-10-19.
    assert.equal(bucketKey('2026-10-24', 'week'), '2026-10-19');
    assert.equal(bucketKey('2026-10-19', 'week'), '2026-10-19');
    assert.equal(bucketKey('2026-10-25', 'week'), '2026-10-19');
    assert.equal(bucketKey('2026-10-24', 'month'), '2026-10-01');
  });

  it('fills empty buckets so the axis has no gaps', () => {
    const points = series([booking({ startDate: '2026-10-02', quote: { days: 1, rental: 40 } })], '2026-10-01', '2026-10-03', 'day');
    assert.deepEqual(points, [
      { key: '2026-10-01', revenue: 0, bookings: 0 },
      { key: '2026-10-02', revenue: 40, bookings: 1 },
      { key: '2026-10-03', revenue: 0, bookings: 0 },
    ]);
  });
});

describe('utilization', () => {
  it('clips a rental to the range and multiplies by quantity', () => {
    // Out Sep 29 – Oct 3 (5 days); only Oct 1–3 fall in range, for 2 units.
    assert.equal(rentedUnitDays(booking({ startDate: '2026-09-29', quantity: 2, quote: { days: 5, rental: 0 } }), '2026-10-01', '2026-10-30'), 6);
    assert.equal(rentedUnitDays(booking({ startDate: '2026-09-01', quote: { days: 3, rental: 0 } }), '2026-10-01', '2026-10-30'), 0);
  });

  it('is rented unit-days over available unit-days, capped at 100%', () => {
    const active = [booking({ startDate: '2026-10-01', quote: { days: 5, rental: 0 } })];
    // 5 of 2 units × 10 days.
    assert.equal(utilization(active, 2, '2026-10-01', '2026-10-10'), 0.25);
    assert.equal(utilization(active, 0, '2026-10-01', '2026-10-10'), 0);
    assert.equal(utilization([booking({ status: 'cancelled', quote: { days: 5, rental: 0 } })], 1, '2026-10-01', '2026-10-10'), 0);
  });

  it('ranks items by revenue', () => {
    const bookings = [
      booking({ itemId: 'tent', quote: { days: 1, rental: 30 } }),
      booking({ itemId: 'camera', quote: { days: 1, rental: 90 } }),
    ];
    const stats = itemStats(bookings, bookings, [
      { _id: 'tent', name: 'Tent', unitCount: 1 },
      { _id: 'camera', name: 'Camera', unitCount: 1 },
    ], '2026-10-01', '2026-10-10');
    assert.deepEqual(stats.map((stat) => stat.itemId), ['camera', 'tent']);
  });
});

describe('statusCounts', () => {
  it('skips holds, expired holds and abandoned-cart cancellations', () => {
    const counts = statusCounts([
      booking({ status: 'confirmed' }),
      booking({ status: 'hold' }),
      booking({ status: 'expired' }),
      booking({ status: 'cancelled', ecomOrderId: '', idempotencyKey: 'browser-uuid' }),
      booking({ status: 'cancelled' }),
    ]);
    assert.deepEqual(counts, { confirmed: 1, cancelled: 1 });
  });
});
