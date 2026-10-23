import { appInstances } from '@wix/app-management';
import { appsInstaller } from '@wix/apps-installer';
import { auth } from '@wix/essentials';
import { MEMBERS_AREA_APP_ID } from './constants';
import { saveSettings } from './merchant';

// Both installer calls need a logged-in Wix user, so these only run from dashboard requests.

export async function checkMembersArea(): Promise<boolean> {
  const { appInstances: installed = [] } = await appsInstaller.getInstalledApps();
  const found = installed.some((app) => app.appDefId === MEMBERS_AREA_APP_ID && app.enabled !== false);
  await saveSettings({ membersAreaInstalled: found });
  return found;
}

export async function installMembersArea() {
  const { site } = await auth.elevate(appInstances.getAppInstance)();
  if (!site?.siteId) return { ok: false as const, message: 'Could not identify this site.' };
  await appsInstaller.installApp(
    { _id: site.siteId, tenantType: 'SITE' },
    { appInstance: { appDefId: MEMBERS_AREA_APP_ID } },
  );
  await saveSettings({ membersAreaInstalled: true });
  return { ok: true as const };
}
