import type { APIRoute } from 'astro';
import { loadSettings } from '../../../rental/availability';
import { merchantOnly } from '../../../rental/guard';
import { json, readJson, str, int } from '../../../rental/http';
import { saveSettings } from '../../../rental/merchant';
import { noteRulesReviewed } from '../../../rental/setup';
import { isEmailAddress } from '../../../rental/notify-rules';
import { readPlan } from '../../../rental/plans';
import { getCurrentAppInstance } from '../../../rental/app-instance';
import { LATE_FEE_MODES, type LateFeeMode } from '../../../rental/late-rules';
import { asStoreCategoryRefs } from '../../../rental/models';

const merchant = { elevate: true };

/** A non-negative number from the request, or undefined to leave the setting as it is. */
function number(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : undefined;
}

export const GET: APIRoute = async () => {
  const startedAt = Date.now();
  const timings: Record<string, number> = {};
  let failure: string | undefined;
  const timed = async <T>(name: string, operation: () => Promise<T>): Promise<T> => {
    const stageStartedAt = Date.now();
    try {
      return await operation();
    } finally {
      timings[name] = Date.now() - stageStartedAt;
    }
  };

  try {
    const denied = await timed('merchantCheckMs', () => merchantOnly());
    if (denied) return denied;

    const appInstance = await timed('getAppInstanceMs', async () => {
      try {
        return await getCurrentAppInstance();
      } catch (error) {
        console.error('Unable to read the app instance for rental settings and plan.', error);
        return null;
      }
    });
    const [settings, plan] = await Promise.all([
      timed('loadSettingsMs', () => loadSettings(merchant, appInstance)),
      timed('readPlanMs', () => readPlan(merchant, appInstance)),
    ]);
    return json({ settings, plan });
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    console.info('[RentalManager settings timing]', JSON.stringify({
      event: 'rental_settings_timing',
      durationMs: Date.now() - startedAt,
      timings,
      failed: Boolean(failure),
      ...(failure ? { error: failure } : {}),
    }));
  }
};

export const POST: APIRoute = async ({ request }) => {
  const denied = await merchantOnly();
  if (denied) return denied;
  const body = await readJson(request);
  if (typeof body.ownerNotificationEmail === 'string' && body.ownerNotificationEmail.trim() && !isEmailAddress(body.ownerNotificationEmail)) {
    return json({ message: 'Enter a valid email address for booking alerts, or leave it empty.' }, 400);
  }
  const settings = await saveSettings({
    timezone: str(body.timezone) || undefined,
    pickupHour: str(body.pickupHour) || undefined,
    returnHour: str(body.returnHour) || undefined,
    approvalMode: str(body.approvalMode) === 'manual' ? 'manual' : str(body.approvalMode) === 'auto' ? 'auto' : undefined,
    depositMode: str(body.depositMode) === 'order' ? 'order' : str(body.depositMode) === 'item' ? 'item' : undefined,
    orderDepositAmount:
      body.orderDepositAmount === undefined || !Number.isFinite(Number(body.orderDepositAmount))
        ? undefined
        : Math.max(0, Number(body.orderDepositAmount)),
    defaultBufferDays: body.defaultBufferDays === undefined ? undefined : int(body.defaultBufferDays, 0),
    defaultMinDays: body.defaultMinDays === undefined ? undefined : int(body.defaultMinDays, 1),
    defaultMaxDays: body.defaultMaxDays === undefined ? undefined : int(body.defaultMaxDays, 30),
    defaultLeadDays: body.defaultLeadDays === undefined ? undefined : int(body.defaultLeadDays, 1),
    countReturnDay: typeof body.countReturnDay === 'boolean' ? body.countReturnDay : undefined,
    emailSenderName: str(body.emailSenderName) || undefined,
    emailOwnerNewBookings: typeof body.emailOwnerNewBookings === 'boolean' ? body.emailOwnerNewBookings : undefined,
    ownerNotificationEmail: typeof body.ownerNotificationEmail === 'string' ? body.ownerNotificationEmail : undefined,
    emailOwnerRenterRequests: typeof body.emailOwnerRenterRequests === 'boolean' ? body.emailOwnerRenterRequests : undefined,
    emailOwnerRefundAlerts: typeof body.emailOwnerRefundAlerts === 'boolean' ? body.emailOwnerRefundAlerts : undefined,
    emailRentersRequestUpdates: typeof body.emailRentersRequestUpdates === 'boolean' ? body.emailRentersRequestUpdates : undefined,
    emailRentersBookingUpdates: typeof body.emailRentersBookingUpdates === 'boolean' ? body.emailRentersBookingUpdates : undefined,
    emailRentersDepositUpdates: typeof body.emailRentersDepositUpdates === 'boolean' ? body.emailRentersDepositUpdates : undefined,
    emailRentersReturnReminders: typeof body.emailRentersReturnReminders === 'boolean' ? body.emailRentersReturnReminders : undefined,
    emailOwnerOverdueAlerts: typeof body.emailOwnerOverdueAlerts === 'boolean' ? body.emailOwnerOverdueAlerts : undefined,
    lateGraceMinutes: number(body.lateGraceMinutes),
    lateFeeMode: LATE_FEE_MODES.includes(str(body.lateFeeMode) as LateFeeMode) ? (str(body.lateFeeMode) as LateFeeMode) : undefined,
    lateFeeAmount: number(body.lateFeeAmount),
    lateFeeMax: number(body.lateFeeMax),
    lostAfterDays: number(body.lostAfterDays),
    reviewLateRenters: typeof body.reviewLateRenters === 'boolean' ? body.reviewLateRenters : undefined,
    language: str(body.language) || undefined,
    storeCategories: Array.isArray(body.storeCategories) ? asStoreCategoryRefs(body.storeCategories) : undefined,
    storeCategoryVersion:
      str(body.storeCategoryVersion) === 'V1_CATALOG' || str(body.storeCategoryVersion) === 'V3_CATALOG'
        ? (str(body.storeCategoryVersion) as 'V1_CATALOG' | 'V3_CATALOG')
        : undefined,
  });
  await noteRulesReviewed().catch(() => undefined);
  return json({ settings });
};
