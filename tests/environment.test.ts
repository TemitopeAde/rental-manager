import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isDevelopment, isDevelopmentValue, publishEnvironment } from '../src/backend/environment.ts';
import { resolvePlan } from '../src/rental/plan-rules.ts';

const APP_ID = 'app';

describe('WIX_ENVIRONMENT', () => {
  it('treats only DEVELOPMENT as development', () => {
    assert.equal(isDevelopmentValue('DEVELOPMENT'), true);
    assert.equal(isDevelopmentValue(' development '), true);
    assert.equal(isDevelopmentValue('PRODUCTION'), false);
    assert.equal(isDevelopmentValue('DEV'), false);
    assert.equal(isDevelopmentValue(''), false);
    assert.equal(isDevelopmentValue(undefined), false);
  });

  it('reads the value the middleware published', () => {
    publishEnvironment('DEVELOPMENT');
    assert.equal(isDevelopment(), true);
    publishEnvironment('PRODUCTION');
    assert.equal(isDevelopment(), false);
    publishEnvironment(undefined);
    assert.equal(isDevelopment(), false);
  });
});

describe('resolvePlan in development', () => {
  const freeSite = { instance: { instanceId: 'i', isFree: true, freeTrialAvailable: true } };

  it('unlocks every feature for a free site only when asked', () => {
    const dev = resolvePlan(freeSite, APP_ID, { unlockAll: true });
    assert.equal(dev.tier, 'pro');
    assert.equal(dev.maxItems, null);
    assert.equal(dev.manualApproval, true);
    assert.equal(dev.orderDeposit, true);

    const prod = resolvePlan(freeSite, APP_ID);
    assert.equal(prod.tier, 'free');
    assert.equal(prod.orderDeposit, false);
  });
});
