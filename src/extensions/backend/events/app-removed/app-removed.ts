import { appInstances } from '@wix/app-management';
import { recordLifecycleEvent } from '../../../../backend/record-lifecycle-event';
import { runInBackground } from '../../../../backend/run-in-background';

export default appInstances.onAppInstanceRemoved((event) => {
  runInBackground('AppRemoved Sheets record', () => recordLifecycleEvent('AppRemoved', event));
});
