import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isRealBooking, isSetupStep, markStep, setupProgress, type SetupFacts } from '../src/rental/setup-rules.ts';

const fresh: SetupFacts = { realItems: 0, sampleActive: true, membersArea: false, realBookings: 0, lateConfigured: false, done: [] };

describe('setupProgress', () => {
  it('starts with nothing done on a fresh install', () => {
    const progress = setupProgress(fresh);
    assert.equal(progress.completed, 0);
    assert.equal(progress.total, 8);
    assert.equal(progress.finished, false);
  });

  it('ticks off steps it can see for itself', () => {
    const progress = setupProgress({ ...fresh, realItems: 2, sampleActive: false, membersArea: true, realBookings: 1, lateConfigured: true });
    const complete = progress.steps.filter((step) => step.complete).map((step) => step.id);
    assert.deepEqual(complete, ['item', 'sample', 'late', 'members', 'booking']);
  });

  it('finishes once the manual steps are marked too', () => {
    const progress = setupProgress({
      realItems: 1,
      sampleActive: false,
      membersArea: true,
      realBookings: 1,
      lateConfigured: false,
      done: ['rules', 'late', 'site', 'payments'],
    });
    assert.equal(progress.finished, true);
  });

  it('flags which steps the owner marks by hand', () => {
    const manual = setupProgress(fresh).steps.filter((step) => step.manual).map((step) => step.id);
    assert.deepEqual(manual, ['rules', 'late', 'site', 'payments']);
  });
});

describe('markStep', () => {
  it('adds and removes manual steps without duplicates', () => {
    assert.deepEqual(markStep([], 'site', true), ['site']);
    assert.deepEqual(markStep(['site'], 'site', true), ['site']);
    assert.deepEqual(markStep(['site', 'rules'], 'site', false), ['rules']);
  });

  it('ignores steps the app tracks itself', () => {
    assert.deepEqual(markStep([], 'booking', true), []);
    assert.deepEqual(markStep(['rules'], 'item', true), ['rules']);
  });
});

describe('isRealBooking and isSetupStep', () => {
  it('skips holds, expired holds and seeded samples', () => {
    assert.equal(isRealBooking({ status: 'confirmed', idempotencyKey: 'abc12345' }), true);
    assert.equal(isRealBooking({ status: 'confirmed', idempotencyKey: 'manual-RB-1' }), true);
    assert.equal(isRealBooking({ status: 'hold', idempotencyKey: 'abc12345' }), false);
    assert.equal(isRealBooking({ status: 'expired', idempotencyKey: 'abc12345' }), false);
    assert.equal(isRealBooking({ status: 'returned', idempotencyKey: 'sample-booking-1' }), false);
  });

  it('accepts only known step ids', () => {
    assert.equal(isSetupStep('site'), true);
    assert.equal(isSetupStep('launch'), false);
  });
});
