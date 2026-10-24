import { appsInstaller } from '@wix/apps-installer';
import { getCurrentAppInstance } from './app-instance';
import { hasMembersAreaApp, MEMBERS_AREA_APP_ID, MEMBERS_AREA_APP_KEYS } from './constants';
import { saveSettings } from './merchant';

// Both installer calls need a logged-in Wix user, so these only run from dashboard requests.

export async function checkMembersArea(): Promise<boolean> {
  const { site } = await getCurrentAppInstance();
  const installedWixApps = site?.installedWixApps ?? [];
  const found = hasMembersAreaApp(installedWixApps);
  console.info('[members-area] installation check', {
    siteId: site?.siteId ?? null,
    expectedAppKeys: MEMBERS_AREA_APP_KEYS,
    installedWixApps,
    found,
  });
  await saveSettings({ membersAreaInstalled: found });
  return found;
}

export async function installMembersArea() {
  const { site } = await getCurrentAppInstance();
  if (!site?.siteId) return { ok: false as const, message: 'Could not identify this site.' };
  await appsInstaller.installApp(
    { _id: site.siteId, tenantType: 'SITE' },
    { appInstance: { appDefId: MEMBERS_AREA_APP_ID } },
  );
  await saveSettings({ membersAreaInstalled: true });
  return { ok: true as const };
}
