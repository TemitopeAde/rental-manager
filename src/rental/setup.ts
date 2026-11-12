// The dashboard's setup checklist for owners who just installed the app.
import { getCurrentAppInstance } from './app-instance';
import { loadSettings, defaultSettings } from './availability';
import { SETTINGS_ID, collections, hasMembersAreaApp } from './constants';
import { asBooking } from './holds';
import { isRealBooking, markStep, setupProgress, type SetupStep } from './setup-rules';
import { getRow, insertRow, queryRows, updateRow, type Row } from './store';
import { sampleItemIds } from '../extensions/backend/data-collections/rental-items';

const merchant = { elevate: true };
const SAMPLE_ITEM_IDS: readonly string[] = Object.values(sampleItemIds);

async function patchSettings(patch: Record<string, unknown>) {
  const row = await getRow(collections.settings, SETTINGS_ID, merchant);
  if (row) await updateRow(collections.settings, { ...row, ...patch }, merchant);
  else await insertRow(collections.settings, { ...defaultSettings(), _id: SETTINGS_ID, ...patch }, merchant);
}

async function membersAreaInstalled(fallback: boolean): Promise<boolean> {
  try {
    const { site } = await getCurrentAppInstance();
    return hasMembersAreaApp(site?.installedWixApps ?? []);
  } catch {
    return fallback;
  }
}

export async function setupStatus() {
  const settings = await loadSettings(merchant);
  const [items, bookings, membersArea] = await Promise.all([
    queryRows(collections.items, merchant).limit(1000).find(),
    queryRows(collections.bookings, merchant).ne('status', 'hold').limit(50).find(),
    membersAreaInstalled(settings.membersAreaInstalled),
  ]);
  const itemRows = items.items as Row[];
  const progress = setupProgress({
    realItems: itemRows.filter((row) => !SAMPLE_ITEM_IDS.includes(row._id) && row.status !== 'archived').length,
    sampleActive: itemRows.some((row) => SAMPLE_ITEM_IDS.includes(row._id) && (row.status ?? 'active') === 'active'),
    membersArea,
    realBookings: bookings.items.map((row) => asBooking(row as Row)).filter(isRealBooking).length,
    lateConfigured: settings.lateFeeMode !== 'off' || settings.lostAfterDays > 0,
    done: settings.setupDone,
  });
  return { ...progress, hidden: settings.setupHidden, marked: settings.setupDone };
}

export async function markSetupStep(step: SetupStep, done: boolean) {
  const settings = await loadSettings(merchant);
  await patchSettings({ setupDone: markStep(settings.setupDone, step, done) });
  return setupStatus();
}

export async function setSetupHidden(hidden: boolean) {
  await patchSettings({ setupHidden: hidden });
  return setupStatus();
}

/** Saving Settings from the dashboard counts as having reviewed the rental rules. */
export async function noteRulesReviewed() {
  const settings = await loadSettings(merchant);
  if (settings.setupDone.includes('rules')) return;
  await patchSettings({ setupDone: markStep(settings.setupDone, 'rules', true) });
}
