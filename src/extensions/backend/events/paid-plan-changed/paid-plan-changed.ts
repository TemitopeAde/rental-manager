import { appInstances } from '@wix/app-management';
import { notifyLifecycleEvent } from '../../../../backend/notify-lifecycle-event';
import { recordLifecycleEvent } from '../../../../backend/record-lifecycle-event';
import { runInBackground } from '../../../../backend/run-in-background';

export default appInstances.onAppInstancePaidPlanChanged((event) => {
  runInBackground('PaidPlanChanged email', () => notifyLifecycleEvent({
    eventType: 'PAID_PLAN_CHANGED',
    vendorProductId: event.data.vendorProductId,
    previousVendorProductId: event.data.previousVendorProductId,
    cycle: event.data.cycle,
    invoiceId: event.data.invoiceId,
    occurredAt: event.data.operationTimeStamp,
    instanceIdHint: event.metadata?.instanceId,
  }));
  runInBackground('PaidPlanChanged Sheets record', () => recordLifecycleEvent('PaidPlanChanged', event));
});
