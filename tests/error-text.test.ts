import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readableError, renterError } from '../src/lib/error-text.ts';

const wixDump = JSON.stringify({
  message: 'Internal Server Error',
  details: {
    applicationError: {
      description: 'Internal Server Error',
      code: 500,
      data: { requestId: '1794428034.266324973081494', details: { message: 'Internal Server Error', details: {} } },
    },
    requestId: '1794428034.266324973081494',
  },
});

describe('readableError', () => {
  it('reduces a Wix error dump to its message', () => {
    assert.equal(readableError(wixDump), 'Internal Server Error');
    assert.equal(readableError(`Wix did not accept the refund. ${wixDump}`), 'Internal Server Error');
  });

  it('falls back to the application error description', () => {
    const dump = JSON.stringify({ details: { applicationError: { description: 'Payment can’t be refunded.', code: 'PAYMENT_NOT_REFUNDABLE' } } });
    assert.equal(readableError(dump), 'Payment can’t be refunded.');
  });

  it('leaves plain messages alone and handles empty or broken input', () => {
    assert.equal(readableError('Booking not found.'), 'Booking not found.');
    assert.equal(readableError(''), 'Internal Server Error');
    assert.equal(readableError(undefined, 'Request failed (404)'), 'Request failed (404)');
    assert.equal(readableError('Bad thing {not json'), 'Bad thing');
    assert.equal(readableError('{}'), 'Internal Server Error');
  });
});

describe('renterError', () => {
  it('replaces a generic server error with the fallback', () => {
    assert.equal(renterError(wixDump, 'Could not start checkout.'), 'Could not start checkout.');
    assert.equal(renterError('Request failed (503)', 'Could not start checkout.'), 'Could not start checkout.');
    assert.equal(renterError('Failed to fetch', 'Could not start checkout.'), 'Could not start checkout.');
  });

  it('keeps a specific message, even inside a Wix dump', () => {
    const dump = JSON.stringify({ details: { applicationError: { description: 'Item is out of stock.', code: 'OUT_OF_STOCK' } } });
    assert.equal(renterError(dump, 'Could not start checkout.'), 'Item is out of stock.');
    assert.equal(renterError('Those dates were just taken.', 'Could not start checkout.'), 'Those dates were just taken.');
  });
});
