import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { itemDeleteCheck } from '../src/rental/item-delete-rules.ts';

const booking = (id: string, status: string, idempotencyKey = 'k') => ({ _id: id, status, idempotencyKey });

describe('itemDeleteCheck', () => {
  it('allows deleting an item nothing depends on', () => {
    assert.deepEqual(itemDeleteCheck([], false), { allowed: true, reason: null, liveCount: 0, historyCount: 0, sampleBookingIds: [] });
  });

  it('ignores sample bookings and lists them for removal', () => {
    const check = itemDeleteCheck([booking('s1', 'confirmed', 'sample-1'), booking('s2', 'returned', 'sample-2')], false);
    assert.equal(check.allowed, true);
    assert.deepEqual(check.sampleBookingIds, ['s1', 's2']);
  });

  it('blocks live bookings first, then a store link, then history', () => {
    assert.equal(itemDeleteCheck([booking('a', 'pending'), booking('b', 'returned')], true).reason, 'live');
    assert.equal(itemDeleteCheck([booking('b', 'returned')], true).reason, 'store');
    const history = itemDeleteCheck([booking('b', 'returned'), booking('c', 'cancelled')], false);
    assert.equal(history.reason, 'history');
    assert.equal(history.historyCount, 2);
  });

  it('counts every live status', () => {
    const check = itemDeleteCheck(['hold', 'pending', 'confirmed', 'active', 'overdue'].map((status, i) => booking(String(i), status)), false);
    assert.equal(check.liveCount, 5);
    assert.equal(check.historyCount, 0);
  });
});
