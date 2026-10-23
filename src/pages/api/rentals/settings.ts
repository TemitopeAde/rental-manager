import type { APIRoute } from 'astro';
import { loadSettings } from '../../../rental/availability';
import { merchantOnly } from '../../../rental/guard';
import { json, readJson, str, int } from '../../../rental/http';
import { saveSettings } from '../../../rental/merchant';
import { readPlan } from '../../../rental/plans';

const merchant = { elevate: true };

export const GET: APIRoute = async () => {
  const denied = await merchantOnly();
  if (denied) return denied;
  const [settings, plan] = await Promise.all([loadSettings(merchant), readPlan(merchant)]);
  return json({ settings, plan });
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
    currency: str(body.currency) || undefined,
    storeCategoryId: str(body.storeCategoryId),
    storeCategoryName: str(body.storeCategoryName),
    storeCategoryVersion:
      str(body.storeCategoryVersion) === 'V1_CATALOG' || str(body.storeCategoryVersion) === 'V3_CATALOG'
        ? (str(body.storeCategoryVersion) as 'V1_CATALOG' | 'V3_CATALOG')
        : undefined,
  });
  return json({ settings });
};
