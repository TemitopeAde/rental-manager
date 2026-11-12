import { appInstances } from '@wix/app-management';
import { auth } from '@wix/essentials';

const APP_INSTANCE_CACHE_TTL_MS = 30_000;
const APP_INSTANCE_CACHE_MAX_SITES = 256;

export type CurrentAppInstance = appInstances.GetAppInstanceResponse;

export async function getCurrentAppInstance(): Promise<CurrentAppInstance> {
  let siteId: string | undefined;
  try {
    siteId = (await auth.getTokenInfo()).siteId;
  } catch {
    // Continue without caching if the request token has no readable site context.
  }

  if (!siteId) return auth.elevate(appInstances.getAppInstance)();
  const cacheKey = siteId;

  const now = Date.now();
  const cached = appInstanceCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.value;
  if (cached) appInstanceCache.delete(cacheKey);

  const inFlight = appInstanceRequests.get(cacheKey);
  if (inFlight) return inFlight;

  const request = auth.elevate(appInstances.getAppInstance)()
    .then((value) => {
      appInstanceCache.set(cacheKey, { value, expiresAt: Date.now() + APP_INSTANCE_CACHE_TTL_MS });
      while (appInstanceCache.size > APP_INSTANCE_CACHE_MAX_SITES) {
        const oldestSiteId = appInstanceCache.keys().next().value;
        if (!oldestSiteId) break;
        appInstanceCache.delete(oldestSiteId);
      }
      return value;
    })
    .finally(() => appInstanceRequests.delete(cacheKey));
  appInstanceRequests.set(cacheKey, request);
  return request;
}


const appInstanceCache = new Map<string, { value: CurrentAppInstance; expiresAt: number }>();
const appInstanceRequests = new Map<string, Promise<CurrentAppInstance>>();

// The currency set in the site's General Info, which Wix checkout charges in. Empty when it can't be read.
export async function siteCurrency(): Promise<string> {
  try {
    const { site } = await getCurrentAppInstance();
    return site?.paymentCurrency ?? '';
  } catch {
    return '';
  }
}
