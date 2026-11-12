import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { datesBetween, groupBlocks, newBlockDates, type BlockRow } from '../src/rental/blocked-rules.ts';

describe('datesBetween', () => {
  it('includes both ends', () => {
    assert.deepEqual(datesBetween('2026-12-24', '2026-12-26'), ['2026-12-24', '2026-12-25', '2026-12-26']);
  });

  it('handles a single day and month or year boundaries', () => {
    assert.deepEqual(datesBetween('2026-12-31', '2026-12-31'), ['2026-12-31']);
    assert.deepEqual(datesBetween('2026-12-31', '2027-01-01'), ['2026-12-31', '2027-01-01']);
    assert.deepEqual(datesBetween('2028-02-28', '2028-03-01'), ['2028-02-28', '2028-02-29', '2028-03-01']);
  });

  it('rejects reversed, invalid or over-long ranges', () => {
    assert.deepEqual(datesBetween('2026-12-26', '2026-12-24'), []);
    assert.deepEqual(datesBetween('2026-13-01', '2026-13-02'), []);
    assert.deepEqual(datesBetween('', '2026-12-24'), []);
    assert.deepEqual(datesBetween('2026-01-01', '2026-01-10', 5), []);
    assert.equal(datesBetween('2026-01-01', '2026-01-05', 5).length, 5);
  });
});

describe('newBlockDates', () => {
  it('drops invalid, repeated and already closed dates', () => {
    assert.deepEqual(
      newBlockDates(['2026-12-24', 'nope', '2026-12-25', '2026-12-24', '2026-12-26'], ['2026-12-25']),
      ['2026-12-24', '2026-12-26'],
    );
  });
});

describe('groupBlocks', () => {
  const row = (id: string, date: string, itemId = '*', reason = ''): BlockRow => ({ _id: id, itemId, date, reason });

  it('folds consecutive days with the same item and reason', () => {
    const groups = groupBlocks([
      row('c', '2026-12-26', '*', 'Holiday'),
      row('a', '2026-12-24', '*', 'Holiday'),
      row('b', '2026-12-25', '*', 'Holiday'),
      row('d', '2026-12-28', '*', 'Holiday'),
    ]);
    assert.deepEqual(groups.map((group) => [group.start, group.end, group.ids]), [
      ['2026-12-24', '2026-12-26', ['a', 'b', 'c']],
      ['2026-12-28', '2026-12-28', ['d']],
    ]);
  });

  it('keeps different items and reasons apart, sorted by start date', () => {
    const groups = groupBlocks([
      row('a', '2026-12-25', 'tent'),
      row('b', '2026-12-24', '*'),
      row('c', '2026-12-25', '*', 'Other'),
    ]);
    assert.deepEqual(groups.map((group) => [group.start, group.itemId, group.reason]), [
      ['2026-12-24', '*', ''],
      ['2026-12-25', '*', 'Other'],
      ['2026-12-25', 'tent', ''],
    ]);
  });

  it('keeps duplicate rows so reopening removes them all', () => {
    const groups = groupBlocks([row('a', '2026-12-24'), row('b', '2026-12-24'), row('c', '2026-12-25')]);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0].ids, ['a', 'b', 'c']);
  });
});
