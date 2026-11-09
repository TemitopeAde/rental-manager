import type { APIRoute } from 'astro';
import { loadSettings } from '../../../rental/availability';
import { merchantOnly } from '../../../rental/guard';
import { json, readJson, str, int } from '../../../rental/http';
import { saveSettings } from '../../../rental/merchant';
import { readPlan } from '../../../rental/plans';
import { getCurrentAppInstance } from '../../../rental/app-instance';

const merchant = { elevate: true };

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
  const settings = await saveSettings({
    timezone: str(body.timezone) || undefined,
    pickupHour: str(body.pickupHour) || undefined,
    returnHour: str(body.returnHour) || undefined,
    approvalMode: str(body.approvalMode) === 'manual' ? 'manual' : str(body.approvalMode) === 'auto' ? 'auto' : undefined,
    defaultBufferDays: body.defaultBufferDays === undefined ? undefined : int(body.defaultBufferDays, 0),
    defaultMinDays: body.defaultMinDays === undefined ? undefined : int(body.defaultMinDays, 1),
    defaultMaxDays: body.defaultMaxDays === undefined ? undefined : int(body.defaultMaxDays, 30),
    defaultLeadDays: body.defaultLeadDays === undefined ? undefined : int(body.defaultLeadDays, 1),
    countReturnDay: typeof body.countReturnDay === 'boolean' ? body.countReturnDay : undefined,
    emailSenderName: str(body.emailSenderName) || undefined,
    emailOwnerNewBookings: typeof body.emailOwnerNewBookings === 'boolean' ? body.emailOwnerNewBookings : undefined,
    emailOwnerRenterRequests: typeof body.emailOwnerRenterRequests === 'boolean' ? body.emailOwnerRenterRequests : undefined,
    emailOwnerRefundAlerts: typeof body.emailOwnerRefundAlerts === 'boolean' ? body.emailOwnerRefundAlerts : undefined,
    emailRentersRequestUpdates: typeof body.emailRentersRequestUpdates === 'boolean' ? body.emailRentersRequestUpdates : undefined,
    emailRentersBookingUpdates: typeof body.emailRentersBookingUpdates === 'boolean' ? body.emailRentersBookingUpdates : undefined,
    emailRentersDepositUpdates: typeof body.emailRentersDepositUpdates === 'boolean' ? body.emailRentersDepositUpdates : undefined,
    language: str(body.language) || undefined,
    storeCategoryId: str(body.storeCategoryId),
    storeCategoryName: str(body.storeCategoryName),
    storeCategoryVersion:
      str(body.storeCategoryVersion) === 'V1_CATALOG' || str(body.storeCategoryVersion) === 'V3_CATALOG'
        ? (str(body.storeCategoryVersion) as 'V1_CATALOG' | 'V3_CATALOG')
        : undefined,
  });
  return json({ settings });
};
