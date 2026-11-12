// Pure setup-checklist rules: no SDK imports, so they can be unit tested without a Wix site.
//
// Steps the app can see for itself tick off automatically. The rest (adding widgets in the Editor,
// connecting payments) can't be read from here, so the owner marks them done.

export const SETUP_STEPS = ['item', 'sample', 'rules', 'late', 'members', 'site', 'payments', 'booking'] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

/** Steps the owner ticks off by hand; the others follow the site's data. */
export const MANUAL_STEPS: readonly SetupStep[] = ['rules', 'late', 'site', 'payments'];

export function isSetupStep(value: unknown): value is SetupStep {
  return SETUP_STEPS.includes(value as SetupStep);
}

export interface SetupFacts {
  /** Rental items other than the sample seeded on install. */
  realItems: number;
  /** The sample item is still live on the site. */
  sampleActive: boolean;
  membersArea: boolean;
  /** Bookings that went past checkout (or were added by hand), not counting the seeded sample. */
  realBookings: number;
  /** A late fee or "may be lost" limit is set. */
  lateConfigured: boolean;
  /** Steps the owner marked done. */
  done: readonly string[];
}

export interface SetupProgress {
  steps: Array<{ id: SetupStep; complete: boolean; manual: boolean }>;
  completed: number;
  total: number;
  finished: boolean;
}

export function setupProgress(facts: SetupFacts): SetupProgress {
  const marked = (id: SetupStep) => facts.done.includes(id);
  const complete: Record<SetupStep, boolean> = {
    item: facts.realItems > 0,
    sample: !facts.sampleActive,
    rules: marked('rules'),
    late: facts.lateConfigured || marked('late'),
    members: facts.membersArea,
    site: marked('site'),
    payments: marked('payments'),
    booking: facts.realBookings > 0,
  };
  const steps = SETUP_STEPS.map((id) => ({ id, complete: complete[id], manual: MANUAL_STEPS.includes(id) }));
  const completed = steps.filter((step) => step.complete).length;
  return { steps, completed, total: steps.length, finished: completed === steps.length };
}

/** Adds or removes a manual step from the done list. Steps the app tracks itself can't be marked. */
export function markStep(done: readonly string[], step: SetupStep, value: boolean): string[] {
  if (!MANUAL_STEPS.includes(step)) return [...done];
  const rest = done.filter((id) => id !== step);
  return value ? [...rest, step] : rest;
}

/** A booking counts toward "first booking" once it is more than an unpaid hold and isn't seeded sample data. */
export function isRealBooking(booking: { status: string; idempotencyKey: string }): boolean {
  if (booking.idempotencyKey.startsWith('sample-')) return false;
  return booking.status !== 'hold' && booking.status !== 'expired';
}
