// Pure plan rules: no SDK imports, so they can be unit tested without a Wix site.

export type PlanTier = 'free' | 'starter' | 'pro';
export type PlanLabel = 'Basic' | 'Pro' | 'Business' | 'Business trial';

export interface PlanLimits {
  tier: PlanTier;
  label: PlanLabel;
  maxItems: number | null;
  maxBookingsPerMonth: number | null;
  manualApproval: boolean;
  perItemRules: boolean;
  calendar: boolean;
  branding: boolean;
  trialAvailable: boolean;
  trialActive: boolean;
  trialEnded: boolean;
  trialEndDate?: string;
  upgradeUrl?: string;
}

type TrialFields = Pick<PlanLimits, 'trialAvailable' | 'trialActive' | 'trialEnded' | 'trialEndDate' | 'upgradeUrl'>;

// Internal tiers keep their names; the billing packages are Basic → free, Pro → starter, Business → pro.
const LIMITS: Record<PlanTier, Omit<PlanLimits, 'label' | keyof TrialFields>> = {
  free: { tier: 'free', maxItems: 1, maxBookingsPerMonth: 10, manualApproval: false, perItemRules: false, calendar: false, branding: true },
  starter: { tier: 'starter', maxItems: 30, maxBookingsPerMonth: 150, manualApproval: true, perItemRules: false, calendar: false, branding: false },
  pro: { tier: 'pro', maxItems: null, maxBookingsPerMonth: null, manualApproval: true, perItemRules: true, calendar: true, branding: false },
};

const labels: Record<PlanTier, PlanLabel> = { free: 'Basic', starter: 'Pro', pro: 'Business' };

export function planFor(tier: PlanTier, trial: Partial<TrialFields> = {}): PlanLimits {
  return {
    ...LIMITS[tier],
    label: trial.trialActive ? 'Business trial' : labels[tier],
    trialAvailable: trial.trialAvailable ?? false,
    trialActive: trial.trialActive ?? false,
    trialEnded: trial.trialEnded ?? false,
    trialEndDate: trial.trialEndDate,
    upgradeUrl: trial.upgradeUrl,
  };
}

export function packageTier(packageName: string): PlanTier {
  const name = packageName.trim().toLowerCase();
  if (name.includes('business')) return 'pro';
  if (name.includes('pro') || name.includes('starter')) return 'starter';
  return 'free';
}

export function upgradeUrl(appId: string, instanceId?: string): string | undefined {
  return instanceId ? `https://www.wix.com/apps/upgrade/${appId}?appInstanceId=${encodeURIComponent(instanceId)}` : undefined;
}

// The SDK types this as a Date, but accept a string too: a throw here would drop a paying site to Basic.
function isoDate(value: unknown): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

// Sites owned by a verified @wix.com account get every feature regardless of billing.
// ownerInfo is only returned when the app has the "Read Site Owner Email" permission.
function isWixStaffOwner(owner?: { email?: string | null; emailStatus?: string | null } | null): boolean {
  const email = (owner?.email ?? '').trim().toLowerCase();
  const verified = (owner?.emailStatus ?? '').startsWith('VERIFIED');
  return verified && email.endsWith('@wix.com');
}

// The parts of a Get App Instance response the plan depends on.
export interface InstanceSnapshot {
  instance?: {
    instanceId?: string | null;
    isFree?: boolean | null;
    freeTrialAvailable?: boolean | null;
    billing?: {
      packageName?: string | null;
      freeTrialInfo?: { status?: string | null; endDate?: unknown } | null;
    } | null;
  } | null;
  site?: { ownerInfo?: { email?: string | null; emailStatus?: string | null } | null } | null;
}

/**
 * Wix counts a trial in progress as a paid state, so it gets Business limits. Once it ends, the site
 * is whatever it pays for: Basic when nothing, its package otherwise.
 */
export function resolvePlan(response: InstanceSnapshot, appId: string): PlanLimits {
  const instance = response.instance;
  const billing = instance?.billing;
  const status = billing?.freeTrialInfo?.status;
  const paid = instance?.isFree === false && Boolean(billing);
  const trialActive = status === 'IN_PROGRESS';
  const trial: TrialFields = {
    // Never offer a trial that is already running.
    trialAvailable: Boolean(instance?.freeTrialAvailable) && !trialActive,
    trialActive,
    trialEnded: status === 'ENDED' && !paid,
    trialEndDate: isoDate(billing?.freeTrialInfo?.endDate),
    upgradeUrl: upgradeUrl(appId, instance?.instanceId ?? undefined),
  };

  if (isWixStaffOwner(response.site?.ownerInfo)) return planFor('pro', trial);
  if (trialActive) return planFor('pro', trial);
  if (!paid || trial.trialEnded) return planFor('free', trial);
  return planFor(packageTier(billing?.packageName ?? ''), trial);
}

export interface ItemRowLike {
  _id?: unknown;
  _createdDate?: unknown;
  status?: unknown;
}

function createdAt(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const time = new Date(value).getTime();
    if (!Number.isNaN(time)) return time;
  }
  // Rows without a creation date sort last rather than taking the bookable slot.
  return Number.MAX_SAFE_INTEGER;
}

export function liveItemCount(rows: ItemRowLike[]): number {
  return rows.filter((row) => row.status !== 'archived').length;
}

/**
 * The items that may take new bookings: the oldest non-archived ones, up to the plan's item limit,
 * ties broken by ID. `null` means every item. Extra items stay visible; they just can't be booked.
 */
export function pickBookableIds(rows: ItemRowLike[], maxItems: number | null): Set<string> | null {
  if (maxItems === null) return null;
  const live = rows
    .filter((row): row is ItemRowLike & { _id: string } => row.status !== 'archived' && typeof row._id === 'string')
    .sort((a, b) => createdAt(a._createdDate) - createdAt(b._createdDate) || a._id.localeCompare(b._id));
  return new Set(live.slice(0, maxItems).map((row) => row._id));
}
