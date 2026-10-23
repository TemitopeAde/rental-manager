import { appInstances } from '@wix/app-management';
import { auth } from '@wix/essentials';
import type { Access } from './store';

export type PlanTier = 'free' | 'starter' | 'pro';

export interface PlanLimits {
  tier: PlanTier;
  maxItems: number | null;
  maxBookingsPerMonth: number | null;
  manualApproval: boolean;
  perItemRules: boolean;
  calendar: boolean;
  branding: boolean;
}

const LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    tier: 'free',
    maxItems: 3,
    maxBookingsPerMonth: 10,
    manualApproval: false,
    perItemRules: false,
    calendar: false,
    branding: true,
  },
  starter: {
    tier: 'starter',
    maxItems: 25,
    maxBookingsPerMonth: 150,
    manualApproval: true,
    perItemRules: false,
    calendar: false,
    branding: false,
  },
  pro: {
    tier: 'pro',
    maxItems: null,
    maxBookingsPerMonth: null,
    manualApproval: true,
    perItemRules: true,
    calendar: true,
    branding: false,
  },
};

// Sites owned by a verified @wix.com account get every feature regardless of billing.
// ownerInfo is only returned when the app has the "Read Site Owner Email" permission.
function isWixStaffOwner(owner?: { email?: string; emailStatus?: string }): boolean {
  const email = (owner?.email ?? '').trim().toLowerCase();
  const verified = (owner?.emailStatus ?? '').startsWith('VERIFIED');
  return verified && email.endsWith('@wix.com');
}

export async function readPlan(access: Access): Promise<PlanLimits> {
  try {
    const getInstance = access.elevate
      ? auth.elevate(appInstances.getAppInstance)
      : appInstances.getAppInstance;
    const response = await getInstance();
    if (isWixStaffOwner(response.site?.ownerInfo)) return LIMITS.pro;
    const instance = response.instance;
    if (!instance || instance.isFree || !instance.billing) return LIMITS.free;
    const name = (instance.billing.packageName ?? '').toLowerCase();
    if (name.includes('pro')) return LIMITS.pro;
    if (name.includes('starter')) return LIMITS.starter;
    return LIMITS.free;
  } catch (error) {
    console.error('Unable to read the app plan; using the free tier.', error);
    return LIMITS.free;
  }
}
