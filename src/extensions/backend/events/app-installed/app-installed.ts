import { appInstances } from '@wix/app-management';
import { notifyLifecycleEvent } from '../../../../backend/notify-lifecycle-event';
import { recordLifecycleEvent } from '../../../../backend/record-lifecycle-event';
import { runInBackground } from '../../../../backend/run-in-background';

export default appInstances.onAppInstanceInstalled((event) => {
  runInBackground('AppInstalled email', () => notifyLifecycleEvent({
    eventType: 'APP_INSTALLED',
    instanceIdHint: event.metadata?.instanceId,
  }));
  runInBackground('AppInstalled Sheets record', () => recordLifecycleEvent('AppInstalled', event));
});
