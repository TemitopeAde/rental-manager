// Backend event extensions are bundled separately from the Astro app and cannot
// read `astro:env/server` directly. The middleware publishes the secrets here.
const KEY = Symbol.for('rental-manager-lifecycle-sheets-env');

export type LifecycleSheetsEnv = {
  LIFECYCLE_SHEETS_WEBHOOK_URL?: string | undefined;
  LIFECYCLE_SHEETS_WEBHOOK_SECRET?: string | undefined;
};

type Holder = typeof globalThis & { [KEY]?: LifecycleSheetsEnv };

export function publishLifecycleSheetsEnv(env: LifecycleSheetsEnv): void {
  (globalThis as Holder)[KEY] = env;
}

export function readLifecycleSheetsEnv(): LifecycleSheetsEnv {
  return (globalThis as Holder)[KEY] ?? {};
}
