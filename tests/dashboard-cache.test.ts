import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getDashboardRequestCount, readDashboardCache, requestDashboardData } from '../src/dashboard/data-cache.ts';

let nextKey = 0;
const key = () => `test-dashboard-cache-${++nextKey}`;

describe('dashboard request cache', () => {
  it('stores fresh results under independent request keys', async () => {
    const bookingsKey = key();
    const analyticsKey = key();

    await requestDashboardData(bookingsKey, async () => ['booking']);
    await requestDashboardData(analyticsKey, async () => ({ range: '30d' }));

    assert.deepEqual(readDashboardCache(bookingsKey), ['booking']);
    assert.deepEqual(readDashboardCache(analyticsKey), { range: '30d' });
  });

  it('keeps the last successful value when a refresh fails', async () => {
    const cacheKey = key();
    await requestDashboardData(cacheKey, async () => 'cached');

    await assert.rejects(requestDashboardData(cacheKey, async () => { throw new Error('offline'); }), /offline/);

    assert.equal(readDashboardCache(cacheKey), 'cached');
  });

  it('deduplicates concurrent requests for the same key', async () => {
    const cacheKey = key();
    let calls = 0;
    let finish: ((value: string) => void) | undefined;
    const load = () => {
      calls += 1;
      return new Promise<string>((resolve) => { finish = resolve; });
    };
    const first = requestDashboardData(cacheKey, load);
    const second = requestDashboardData(cacheKey, load);

    assert.equal(calls, 0);
    await Promise.resolve();
    assert.equal(calls, 1);
    finish?.('ready');
    assert.deepEqual(await Promise.all([first, second]), ['ready', 'ready']);
  });

  it('tracks active requests until each request settles', async () => {
    const cacheKey = key();
    let finish: ((value: string) => void) | undefined;
    const pending = requestDashboardData(cacheKey, () => new Promise<string>((resolve) => { finish = resolve; }));

    assert.equal(getDashboardRequestCount(), 1);
    await Promise.resolve();
    finish?.('ready');
    await pending;
    assert.equal(getDashboardRequestCount(), 0);
  });
});
