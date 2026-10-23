import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'audit-log';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'Rental Audit Log',
  displayField: 'summary',
  fields: [
    { key: 'source', displayName: 'Source', type: 'TEXT' },
    { key: 'action', displayName: 'Action', type: 'TEXT' },
    { key: 'bookingId', displayName: 'Booking', type: 'TEXT' },
    { key: 'summary', displayName: 'Summary', type: 'TEXT' },
    { key: 'actor', displayName: 'Actor', type: 'TEXT' },
  ],
  dataPermissions: {
    itemRead: 'CMS_EDITOR',
    itemInsert: 'CMS_EDITOR',
    itemUpdate: 'PRIVILEGED',
    itemRemove: 'PRIVILEGED',
  },
  indexes: [],
  initialData: [],
} satisfies DataCollection;
