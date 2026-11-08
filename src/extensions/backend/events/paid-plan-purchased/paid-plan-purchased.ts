import { appInstances } from '@wix/app-management';
import { isFreeTrialInProgress, notifyLifecycleEvent } from '../../../../backend/notify-lifecycle-event';
import { recordLifecycleEvent } from '../../../../backend/record-lifecycle-event';
import { runInBackground } from '../../../../backend/run-in-background';

export default appInstances.onAppInstancePaidPlanPurchased((event) => {
  runInBackground('PaidPlanPurchased email', async () => notifyLifecycleEvent({
    eventType: (await isFreeTrialInProgress()) ? 'FREE_TRIAL' : 'PAID_PLAN_PURCHASED',
    vendorProductId: event.data.vendorProductId,
    cycle: event.data.cycle,
    invoiceId: event.data.invoiceId,
    occurredAt: event.data.operationTimeStamp,
    instanceIdHint: event.metadata?.instanceId,
  }));
  runInBackground('PaidPlanPurchased Sheets record', () => recordLifecycleEvent('PaidPlanPurchased', event));
});
