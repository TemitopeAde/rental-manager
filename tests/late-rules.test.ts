import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  asLateFeeMode,
  atRiskBookings,
  buildLateReturn,
  clearReturnNotices,
  dueTodayReminderDue,
  isOverdue,
  lateFee,
  lateFeeSettlement,
  lateReturnCount,
  lateUnits,
  mergeNotices,
  minutesLate,
  overdueNoticesDue,
  shouldFlagLost,
  type LatePolicy,
  type RiskBooking,
} from '../src/rental/late-rules.ts';

const FIVE_PM = 17 * 60;
const policy = (patch: Partial<LatePolicy> = {}): LatePolicy => ({
  graceMinutes: 60,
  feeMode: 'day',
  feeAmount: 20,
  feeMax: 0,
  lostAfterDays: 0,
  ...patch,
});

describe('minutesLate', () => {
  it('is negative before the return time and positive after it', () => {
    assert.equal(minutesLate('2026-11-10', FIVE_PM, '2026-11-10', 16 * 60), -60);
    assert.equal(minutesLate('2026-11-10', FIVE_PM, '2026-11-10', 17 * 60 + 30), 30);
  });

  it('counts whole days across dates', () => {
    assert.equal(minutesLate('2026-11-10', FIVE_PM, '2026-11-12', FIVE_PM), 2 * 1440);
    assert.equal(minutesLate('2026-11-12', FIVE_PM, '2026-11-10', FIVE_PM), -2 * 1440);
  });

  it('crosses month and year boundaries', () => {
    assert.equal(minutesLate('2026-12-31', FIVE_PM, '2027-01-01', FIVE_PM), 1440);
  });
});

describe('isOverdue and lateUnits', () => {
  it('forgives lateness inside the grace period', () => {
    assert.equal(isOverdue(60, 60), false);
    assert.equal(isOverdue(61, 60), true);
    assert.equal(isOverdue(1, 0), true);
  });

  it('counts each started day and hour in full', () => {
    assert.deepEqual(lateUnits(0), { days: 0, hours: 0 });
    assert.deepEqual(lateUnits(1), { days: 1, hours: 1 });
    assert.deepEqual(lateUnits(61), { days: 1, hours: 2 });
    assert.deepEqual(lateUnits(1441), { days: 2, hours: 25 });
  });
});

describe('lateFee', () => {
  it('charges nothing when fees are off or inside the grace period', () => {
    assert.equal(lateFee(policy({ feeMode: 'off' }), 5000, 40, 1), 0);
    assert.equal(lateFee(policy(), 45, 40, 1), 0);
  });

  it('charges per late day, per unit, counted from the return time', () => {
    assert.equal(lateFee(policy(), 61, 40, 1), 20);
    assert.equal(lateFee(policy(), 1441, 40, 1), 40);
    assert.equal(lateFee(policy(), 1441, 40, 3), 120);
  });

  it('charges per late hour', () => {
    assert.equal(lateFee(policy({ feeMode: 'hour', feeAmount: 5 }), 125, 40, 1), 15);
  });

  it('charges a percentage of the daily rate per late day', () => {
    assert.equal(lateFee(policy({ feeMode: 'rate', feeAmount: 150 }), 1441, 40, 1), 120);
    assert.equal(lateFee(policy({ feeMode: 'rate', feeAmount: 33.333 }), 100, 10, 1), 3.33);
  });

  it('stops at the maximum', () => {
    assert.equal(lateFee(policy({ feeMax: 50 }), 10 * 1440, 40, 1), 50);
  });

  it('ignores negative or bad amounts', () => {
    assert.equal(lateFee(policy({ feeAmount: -5 }), 3000, 40, 1), 0);
    assert.equal(lateFee(policy({ feeAmount: Number.NaN }), 3000, 40, 1), 0);
  });
});

describe('notices', () => {
  it('sends the reminder once on the return date before the return time', () => {
    assert.equal(dueTodayReminderDue('2026-11-10', '2026-11-10', -120, []), true);
    assert.equal(dueTodayReminderDue('2026-11-10', '2026-11-10', -120, ['due-today']), false);
    assert.equal(dueTodayReminderDue('2026-11-10', '2026-11-10', 10, []), false);
    assert.equal(dueTodayReminderDue('2026-11-11', '2026-11-10', -1500, []), false);
  });

  it('lists overdue notices by day, skipping those already sent', () => {
    assert.deepEqual(overdueNoticesDue(30, 60, []), []);
    assert.deepEqual(overdueNoticesDue(61, 60, []), ['overdue-0']);
    assert.deepEqual(overdueNoticesDue(60 + 1440, 60, ['overdue-0']), ['overdue-1']);
    assert.deepEqual(overdueNoticesDue(60 + 2 * 1440, 60, ['overdue-0', 'overdue-1']), []);
    // A sweep that missed days lists them all; the caller sends only the newest.
    assert.deepEqual(overdueNoticesDue(60 + 4 * 1440, 60, []), ['overdue-0', 'overdue-1', 'overdue-3']);
  });

  it('merges without duplicates and clears a return cycle', () => {
    assert.deepEqual(mergeNotices(['a'], ['a', 'b']), ['a', 'b']);
    assert.deepEqual(clearReturnNotices(['due-today', 'overdue-0', 'overdue-3', 'at-risk', 'delay-warned']), ['at-risk', 'delay-warned']);
  });
});

describe('shouldFlagLost', () => {
  it('flags only when turned on and enough days have passed', () => {
    assert.equal(shouldFlagLost(10 * 1440, 60, 0), false);
    assert.equal(shouldFlagLost(60 + 6 * 1440, 60, 7), false);
    assert.equal(shouldFlagLost(60 + 7 * 1440, 60, 7), true);
  });
});

describe('lateFeeSettlement', () => {
  it('takes what it can from the deposit and leaves the rest as a balance', () => {
    assert.deepEqual(lateFeeSettlement(40, 100), { fromDeposit: 40, balance: 0 });
    assert.deepEqual(lateFeeSettlement(140, 100), { fromDeposit: 100, balance: 40 });
    assert.deepEqual(lateFeeSettlement(40, 0), { fromDeposit: 0, balance: 40 });
    assert.deepEqual(lateFeeSettlement(40, 100, 80), { fromDeposit: 20, balance: 20 });
  });
});

describe('atRiskBookings', () => {
  const today = '2026-11-10';
  const overdue: RiskBooking = { _id: 'late', itemId: 'cam', quantity: 1, startDate: '2026-11-01', endDate: '2026-11-08', status: 'overdue' };
  const next: RiskBooking = { _id: 'next', itemId: 'cam', quantity: 1, startDate: '2026-11-11', endDate: '2026-11-13', status: 'confirmed' };

  it('flags the next rental of a single-unit item that is overdue', () => {
    assert.deepEqual(atRiskBookings([overdue, next], { cam: 1 }, today), [
      { bookingId: 'next', itemId: 'cam', startDate: '2026-11-11', blockedBy: ['late'] },
    ]);
  });

  it('ignores rentals a spare unit can cover', () => {
    assert.deepEqual(atRiskBookings([overdue, next], { cam: 2 }, today), []);
  });

  it('counts other rentals on the same day against the spare units', () => {
    const other: RiskBooking = { ...next, _id: 'other', startDate: '2026-11-09', endDate: '2026-11-12', status: 'active' };
    assert.equal(atRiskBookings([overdue, next, other], { cam: 2 }, today).length, 1);
  });

  it('ignores rentals outside the window, of other items, or not yet paid', () => {
    assert.deepEqual(atRiskBookings([overdue, { ...next, startDate: '2026-11-20' }], { cam: 1 }, today), []);
    assert.deepEqual(atRiskBookings([overdue, { ...next, itemId: 'tent' }], { cam: 1, tent: 1 }, today), []);
    assert.deepEqual(atRiskBookings([overdue, { ...next, status: 'hold' }], { cam: 1 }, today), []);
    assert.deepEqual(atRiskBookings([next], { cam: 1 }, today), []);
  });
});

describe('lateReturnCount and asLateFeeMode', () => {
  it('counts finished late returns and lost rentals', () => {
    assert.equal(lateReturnCount([
      { status: 'returned', lateReturn: { lateDays: 2, final: true } },
      { status: 'returned', lateReturn: { lateDays: 0, final: true } },
      { status: 'overdue', lateReturn: { lateDays: 3 } },
      { status: 'lost' },
      { status: 'returned' },
    ]), 2);
  });

  it('defaults unknown fee modes to off', () => {
    assert.equal(asLateFeeMode('day'), 'day');
    assert.equal(asLateFeeMode('weekly'), 'off');
    assert.equal(asLateFeeMode(undefined), 'off');
  });
});

describe('buildLateReturn', () => {
  const now = '2026-11-12T18:00:00.000Z';

  it('is null while the rental is on time or inside the grace period', () => {
    assert.equal(buildLateReturn(policy(), 30, 40, 1, undefined, now), null);
  });

  it('records days, hours and the fee, keeping the first overdue time and lost flag', () => {
    const previous = { overdueSince: '2026-11-10T18:00:00.000Z', lateDays: 1, lateHours: 2, fee: 20, final: false, lostFlaggedAt: 'x' };
    assert.deepEqual(buildLateReturn(policy(), 1441, 40, 1, previous, now), {
      overdueSince: '2026-11-10T18:00:00.000Z',
      lateDays: 2,
      lateHours: 25,
      fee: 40,
      final: false,
      lostFlaggedAt: 'x',
    });
  });

  it('stamps the return time when final', () => {
    const record = buildLateReturn(policy(), 120, 40, 1, undefined, now, true);
    assert.equal(record?.final, true);
    assert.equal(record?.returnedAt, now);
    assert.equal(record?.overdueSince, now);
  });
});
