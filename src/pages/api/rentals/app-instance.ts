import type { APIRoute } from 'astro';
import { merchantOnly } from '../../../rental/guard';
import { getCurrentAppInstance } from '../../../rental/app-instance';
import { json } from '../../../rental/http';

export const GET: APIRoute = async () => {
  const denied = await merchantOnly();
  if (denied) return denied;

  try {
    const { site } = await getCurrentAppInstance();
    const installedWixApps = site?.installedWixApps ?? [];
    console.info('[app-instance] loaded site instance', {
      siteId: site?.siteId ?? null,
      installedWixApps,
    });
    return json({
      siteId: site?.siteId ?? null,
      installedWixApps,
    });
  } catch (error) {
    console.error('App instance lookup failed', error);
    return json({ ok: false, message: 'Could not load the Wix app instance.' }, 500);
  }
};
