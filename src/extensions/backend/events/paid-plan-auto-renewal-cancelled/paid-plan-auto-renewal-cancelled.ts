import { appInstances } from '@wix/app-management';
import { recordLifecycleEvent } from '../../../../backend/record-lifecycle-event';
import { runInBackground } from '../../../../backend/run-in-background';

export default appInstances.onAppInstancePaidPlanAutoRenewalCancelled((event) => {
  runInBackground('PaidPlanAutoRenewalCancelled Sheets record', () => recordLifecycleEvent('PaidPlanAutoRenewalCancelled', event));
});
