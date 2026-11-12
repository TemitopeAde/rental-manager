import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isEmailAddress, orderAlertTitle, ownerAlertAddress } from '../src/rental/notify-rules.ts';

describe('isEmailAddress', () => {
  it('accepts ordinary addresses and rejects obvious mistakes', () => {
    assert.equal(isEmailAddress('bookings@bbevents.co.uk'), true);
    assert.equal(isEmailAddress('  owner@example.com '), true);
    assert.equal(isEmailAddress('owner@example'), false);
    assert.equal(isEmailAddress('owner example.com'), false);
    assert.equal(isEmailAddress(''), false);
  });
});

describe('ownerAlertAddress', () => {
  it('prefers the address set in Settings, then the Wix login email', () => {
    assert.equal(ownerAlertAddress('bookings@bbevents.co.uk', 'owner@gmail.com'), 'bookings@bbevents.co.uk');
    assert.equal(ownerAlertAddress('', 'owner@gmail.com'), 'owner@gmail.com');
    assert.equal(ownerAlertAddress('not-an-email', 'owner@gmail.com'), 'owner@gmail.com');
    assert.equal(ownerAlertAddress('', ''), '');
  });
});

describe('orderAlertTitle', () => {
  it('says when approval is needed and how many rentals the order has', () => {
    assert.deepEqual(orderAlertTitle('10045', [{ reference: 'R-1', status: 'pending' }]), {
      needsApproval: true,
      subject: 'Approve new rental order #10045 (R-1)',
      heading: 'A new rental needs your approval',
    });
    const confirmed = orderAlertTitle('', [{ reference: 'R-1', status: 'confirmed' }, { reference: 'R-2', status: 'confirmed' }]);
    assert.equal(confirmed.needsApproval, false);
    assert.equal(confirmed.subject, 'New rental order (2 rentals)');
    assert.equal(confirmed.heading, 'New rentals are confirmed');
  });
});
