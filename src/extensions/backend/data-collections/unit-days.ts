import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'unit-days';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'Unit Days',
  displayField: 'date',
  fields: [
    { key: 'bookingId', displayName: 'Booking', type: 'TEXT' },
    { key: 'itemId', displayName: 'Item', type: 'TEXT' },
    { key: 'date', displayName: 'Date', type: 'TEXT' },
    { key: 'unitIndex', displayName: 'Unit', type: 'NUMBER' },
  ],
  dataPermissions: {
    itemRead: 'CMS_EDITOR',
    itemInsert: 'CMS_EDITOR',
    itemUpdate: 'CMS_EDITOR',
    itemRemove: 'CMS_EDITOR',
  },
  indexes: [{ fields: [{ path: 'itemId' }, { path: 'date' }] }],
  initialData: [],
} satisfies DataCollection;
