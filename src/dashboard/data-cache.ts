const cache = new Map<string, unknown>();
const inFlight = new Map<string, Promise<unknown>>();
const listeners = new Set<() => void>();
let activeRequests = 0;

export function readDashboardCache<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function requestDashboardData<T>(key: string, load: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  activeRequests += 1;
  notify();
  const request = Promise.resolve()
    .then(load)
    .then((value) => {
      cache.set(key, value);
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    activeRequests = Math.max(0, activeRequests - 1);
    notify();
    });
  inFlight.set(key, request);
  return request;
}

export function subscribeToDashboardRequests(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDashboardRequestCount(): number {
  return activeRequests;
}

function notify() {
  for (const listener of listeners) listener();
}
