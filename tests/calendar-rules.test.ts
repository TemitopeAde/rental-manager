import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  availabilityWindowEnd,
  isFullyBooked,
  occupiedDates,
  rangeProblem,
  startProblem,
  type ItemAvailability,
} from '../src/rental/calendar-rules.ts';

function availability(overrides: Partial<ItemAvailability> = {}): ItemAvailability {
  return {
    itemId: 'camera',
    bookable: true,
    unitCount: 1,
    used: {},
    closed: [],
    earliestStart: '2026-12-01',
    latestStart: '2027-05-30',
    minDays: 1,
    maxDays: 30,
    bufferDays: 0,
    countReturnDay: false,
    ...overrides,
  };
}

describe('occupiedDates', () => {
  it('holds the nights only when the return day is free', () => {
    assert.deepEqual(occupiedDates('2026-12-10', '2026-12-12', false, 0).occupied, ['2026-12-10', '2026-12-11']);
  });

  it('includes the return day when it is billed', () => {
    assert.deepEqual(occupiedDates('2026-12-10', '2026-12-12', true, 0).occupied, ['2026-12-10', '2026-12-11', '2026-12-12']);
  });

  it('adds the turnaround buffer after the rental', () => {
    const { billedDays, occupied } = occupiedDates('2026-12-10', '2026-12-12', false, 2);
    assert.equal(billedDays, 2);
    assert.deepEqual(occupied, ['2026-12-10', '2026-12-11', '2026-12-12', '2026-12-13']);
  });
});

describe('startProblem', () => {
  it('rejects a pickup on a paid-for day', () => {
    const calendar = availability({ used: { '2026-12-10': 1 } });
    assert.equal(startProblem(calendar, '2026-12-10', 1), 'taken');
    assert.equal(startProblem(calendar, '2026-12-11', 1), null);
  });

  it('allows a pickup while units remain, judged against the quantity', () => {
    const calendar = availability({ unitCount: 3, used: { '2026-12-10': 2 } });
    assert.equal(startProblem(calendar, '2026-12-10', 1), null);
    assert.equal(startProblem(calendar, '2026-12-10', 2), 'taken');
  });

  it('respects the booking window, closed days and unbookable items', () => {
    assert.equal(startProblem(availability(), '2026-11-30', 1), 'too_early');
    assert.equal(startProblem(availability(), '2027-05-31', 1), 'too_late');
    assert.equal(startProblem(availability({ closed: ['2026-12-10'] }), '2026-12-10', 1), 'closed');
    assert.equal(startProblem(availability({ bookable: false }), '2026-12-10', 1), 'unbookable');
  });
});

describe('rangeProblem', () => {
  it('rejects a range that runs over a paid-for day', () => {
    const calendar = availability({ used: { '2026-12-12': 1 } });
    assert.equal(rangeProblem(calendar, '2026-12-10', '2026-12-14', 1), 'taken');
    assert.equal(rangeProblem(calendar, '2026-12-13', '2026-12-15', 1), null);
  });

  it('allows returning on the day the next renter picks up when the return day is not billed', () => {
    const calendar = availability({ used: { '2026-12-12': 1 } });
    assert.equal(rangeProblem(calendar, '2026-12-10', '2026-12-12', 1), null);
    assert.equal(rangeProblem({ ...calendar, countReturnDay: true }, '2026-12-10', '2026-12-12', 1), 'taken');
  });

  it('keeps the buffer clear after the return', () => {
    const calendar = availability({ bufferDays: 1, used: { '2026-12-12': 1 } });
    assert.equal(rangeProblem(calendar, '2026-12-10', '2026-12-12', 1), 'taken');
    assert.equal(rangeProblem(calendar, '2026-12-10', '2026-12-11', 1), null);
  });

  it('lets a rental span a closed day but not start or end on one', () => {
    const calendar = availability({ closed: ['2026-12-11'] });
    assert.equal(rangeProblem(calendar, '2026-12-10', '2026-12-12', 1), null);
    assert.equal(rangeProblem(calendar, '2026-12-10', '2026-12-11', 1), 'closed');
  });

  it('enforces the minimum and maximum length', () => {
    const calendar = availability({ minDays: 3, maxDays: 5 });
    assert.equal(rangeProblem(calendar, '2026-12-10', '2026-12-12', 1), 'too_short');
    assert.equal(rangeProblem(calendar, '2026-12-10', '2026-12-13', 1), null);
    assert.equal(rangeProblem(calendar, '2026-12-10', '2026-12-16', 1), 'too_long');
  });
});

describe('isFullyBooked', () => {
  it('is true once no unit is left for the quantity', () => {
    const calendar = availability({ unitCount: 2, used: { '2026-12-10': 2, '2026-12-11': 1 } });
    assert.equal(isFullyBooked(calendar, '2026-12-10', 1), true);
    assert.equal(isFullyBooked(calendar, '2026-12-11', 1), false);
    assert.equal(isFullyBooked(calendar, '2026-12-11', 2), true);
  });
});

describe('availabilityWindowEnd', () => {
  it('covers the longest rental and buffer from the last pickup', () => {
    assert.equal(availabilityWindowEnd('2027-05-30', 30, 2), '2027-07-02');
  });
});
