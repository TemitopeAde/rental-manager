import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'blocked-dates';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'Blocked Dates',
  displayField: 'date',
  fields: [
    { key: 'itemId', displayName: 'Item', type: 'TEXT' },
    { key: 'date', displayName: 'Date', type: 'TEXT' },
    { key: 'reason', displayName: 'Reason', type: 'TEXT' },
  ],
  dataPermissions: {
    itemRead: 'CMS_EDITOR',
    itemInsert: 'CMS_EDITOR',
    itemUpdate: 'CMS_EDITOR',
    itemRemove: 'CMS_EDITOR',
  },
  indexes: [],
  initialData: [],
} satisfies DataCollection;
