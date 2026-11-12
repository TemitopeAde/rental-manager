// Which deployment this is, from the WIX_ENVIRONMENT variable ("DEVELOPMENT" or "PRODUCTION").
//
// Backend extensions (service plugins, events) are bundled separately and can't read `astro:env/server`,
// so the middleware publishes the value here on every request, like lifecycle-env-bridge.ts does.
// Anything other than exactly "DEVELOPMENT" counts as production, so a missing or mistyped value never unlocks anything.

const KEY = Symbol.for('rental-manager-wix-environment');

type Holder = typeof globalThis & { [KEY]?: string };

export function isDevelopmentValue(value: string | undefined | null): boolean {
  return (value ?? '').trim().toUpperCase() === 'DEVELOPMENT';
}

export function publishEnvironment(value: string | undefined): void {
  (globalThis as Holder)[KEY] = value ?? '';
}

/** True only when WIX_ENVIRONMENT is "DEVELOPMENT". */
export function isDevelopment(): boolean {
  return isDevelopmentValue((globalThis as Holder)[KEY]);
}
