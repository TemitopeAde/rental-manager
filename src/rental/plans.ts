import { appInstances } from '@wix/app-management';
import { auth } from '@wix/essentials';
import { APP_ID, collections } from './constants';
import type { CurrentAppInstance } from './app-instance';
import { pickBookableIds, planFor, resolvePlan, type InstanceSnapshot, type PlanLimits } from './plan-rules';
import type { Access } from './store';
import { isDevelopment } from '../backend/environment';
import { queryRows } from './store';

export type { PlanLabel, PlanLimits, PlanTier } from './plan-rules';
export { liveItemCount } from './plan-rules';

export async function readPlan(access: Access, appInstance?: CurrentAppInstance | null): Promise<PlanLimits> {
  if (appInstance !== undefined) {
    if (!appInstance) return planFor(isDevelopment() ? 'pro' : 'free');
    return resolvePlan(appInstance as InstanceSnapshot, APP_ID, { unlockAll: isDevelopment() });
  }
  try {
    const getInstance = access.elevate
      ? auth.elevate(appInstances.getAppInstance)
      : appInstances.getAppInstance;
    return resolvePlan((await getInstance()) as InstanceSnapshot, APP_ID, { unlockAll: isDevelopment() });
  } catch (error) {
    console.error('Unable to read the app plan; using the Basic tier.', error);
    return planFor(isDevelopment() ? 'pro' : 'free');
  }
}

/** The item IDs that may accept new bookings under the current plan; `null` means all of them. */
export async function bookableItemIds(access: Access, plan: PlanLimits): Promise<Set<string> | null> {
  if (plan.maxItems === null) return null;
  const result = await queryRows(collections.items, access).limit(1000).find();
  return pickBookableIds(result.items, plan.maxItems);
}

export async function canBookItem(itemId: string, access: Access, plan: PlanLimits): Promise<boolean> {
  const allowed = await bookableItemIds(access, plan);
  return allowed === null || allowed.has(itemId);
}
