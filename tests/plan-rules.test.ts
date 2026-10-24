import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pickBookableIds, resolvePlan, type InstanceSnapshot } from '../src/rental/plan-rules.ts';

const APP_ID = '3775e684-24cc-431a-9049-066df8aa81fd';
const INSTANCE_ID = 'f1e2d3c4-0000-4000-8000-000000000001';

function snapshot(instance: NonNullable<InstanceSnapshot['instance']>): InstanceSnapshot {
  return { instance: { instanceId: INSTANCE_ID, ...instance } };
}

describe('resolvePlan', () => {
  it('offers a trial on an eligible free site, with the Wix upgrade URL', () => {
    const plan = resolvePlan(snapshot({ isFree: true, freeTrialAvailable: true }), APP_ID);
    assert.equal(plan.tier, 'free');
    assert.equal(plan.label, 'Basic');
    assert.equal(plan.maxItems, 1);
    assert.equal(plan.trialAvailable, true);
    assert.equal(plan.upgradeUrl, `https://www.wix.com/apps/upgrade/${APP_ID}?appInstanceId=${INSTANCE_ID}`);
  });

  it('gives an active trial Business limits', () => {
    const plan = resolvePlan(snapshot({
      isFree: false,
      freeTrialAvailable: false,
      billing: { packageName: 'business', freeTrialInfo: { status: 'IN_PROGRESS' } },
    }), APP_ID);
    assert.equal(plan.tier, 'pro');
    assert.equal(plan.label, 'Business trial');
    assert.equal(plan.maxItems, null);
    assert.equal(plan.maxBookingsPerMonth, null);
    assert.equal(plan.perItemRules, true);
    assert.equal(plan.trialActive, true);
    assert.equal(plan.trialAvailable, false);
  });

  it('never offers a trial while one is running', () => {
    const plan = resolvePlan(snapshot({
      isFree: false,
      freeTrialAvailable: true,
      billing: { packageName: 'business', freeTrialInfo: { status: 'IN_PROGRESS' } },
    }), APP_ID);
    assert.equal(plan.trialAvailable, false);
  });

  it('drops an ended, unsubscribed trial to Basic', () => {
    const plan = resolvePlan(snapshot({
      isFree: true,
      freeTrialAvailable: false,
      billing: { freeTrialInfo: { status: 'ENDED', endDate: '2026-10-20T00:00:00.000Z' } },
    }), APP_ID);
    assert.equal(plan.tier, 'free');
    assert.equal(plan.label, 'Basic');
    assert.equal(plan.maxItems, 1);
    assert.equal(plan.maxBookingsPerMonth, 10);
    assert.equal(plan.trialEnded, true);
    assert.equal(plan.trialAvailable, false);
    assert.equal(plan.trialEndDate, '2026-10-20T00:00:00.000Z');
  });

  it('keeps a paid Business subscription after the trial ends', () => {
    const plan = resolvePlan(snapshot({
      isFree: false,
      billing: { packageName: 'Business', freeTrialInfo: { status: 'ENDED', endDate: new Date('2026-10-20T00:00:00Z') } },
    }), APP_ID);
    assert.equal(plan.tier, 'pro');
    assert.equal(plan.label, 'Business');
    assert.equal(plan.maxItems, null);
    assert.equal(plan.trialEnded, false);
  });

  it('keeps the normal Pro limits', () => {
    const plan = resolvePlan(snapshot({ isFree: false, billing: { packageName: 'pro' } }), APP_ID);
    assert.equal(plan.tier, 'starter');
    assert.equal(plan.label, 'Pro');
    assert.equal(plan.maxItems, 30);
    assert.equal(plan.maxBookingsPerMonth, 150);
  });

  it('ignores an unparseable trial end date instead of failing', () => {
    const plan = resolvePlan(snapshot({
      isFree: false,
      billing: { packageName: 'business', freeTrialInfo: { status: 'ENDED', endDate: 'not a date' } },
    }), APP_ID);
    assert.equal(plan.tier, 'pro');
    assert.equal(plan.trialEndDate, undefined);
  });
});

describe('pickBookableIds', () => {
  const rows = [
    { _id: 'c-newest', _createdDate: new Date('2026-10-10T00:00:00Z'), status: 'active' },
    { _id: 'b-oldest', _createdDate: new Date('2026-10-01T00:00:00Z'), status: 'active' },
    { _id: 'a-archived', _createdDate: new Date('2026-09-01T00:00:00Z'), status: 'archived' },
    { _id: 'd-middle', _createdDate: new Date('2026-10-05T00:00:00Z'), status: 'hidden' },
  ];

  it('allows every item on an unlimited plan', () => {
    assert.equal(pickBookableIds(rows, null), null);
  });

  it('keeps only the oldest non-archived item on Basic, by date not by text', () => {
    // Compared as text, these dates would order by weekday name ("Sat…", "Thu…"), not by time.
    assert.deepEqual([...pickBookableIds(rows, 1)!], ['b-oldest']);
  });

  it('breaks ties on creation date by item ID', () => {
    const same = new Date('2026-10-01T00:00:00Z');
    const tied = [
      { _id: 'item-b', _createdDate: same, status: 'active' },
      { _id: 'item-a', _createdDate: same, status: 'active' },
    ];
    assert.deepEqual([...pickBookableIds(tied, 1)!], ['item-a']);
  });

  it('allows up to the limit on Pro', () => {
    assert.deepEqual([...pickBookableIds(rows, 2)!].sort(), ['b-oldest', 'd-middle']);
  });
});
