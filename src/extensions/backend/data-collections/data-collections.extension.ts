import { extensions } from '@wix/astro/builders'

import rentalItemsCollection from './rental-items';

import bookingsCollection from './bookings';

import unitDaysCollection from './unit-days';

import blockedDatesCollection from './blocked-dates';

import rentalSettingsCollection from './rental-settings';

import auditLogCollection from './audit-log';

export default extensions.dataCollections({
  id: '193bd89b-b927-4f25-9c52-ab0cfe7bb77d',
  name: 'Data Collections',
  collections: [
    rentalItemsCollection,
    bookingsCollection,
    unitDaysCollection,
    blockedDatesCollection,
    rentalSettingsCollection,
    auditLogCollection
  ],
});
