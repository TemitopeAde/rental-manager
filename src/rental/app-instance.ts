import { appInstances } from '@wix/app-management';
import { auth } from '@wix/essentials';

export async function getCurrentAppInstance() {
  return auth.elevate(appInstances.getAppInstance)();
}

// The currency set in the site's General Info, which Wix checkout charges in. Empty when it can't be read.
export async function siteCurrency(): Promise<string> {
  try {
    const { site } = await getCurrentAppInstance();
    return site?.paymentCurrency ?? '';
  } catch (error) {
    console.error('Could not read the site currency', error);
    return '';
  }
}
