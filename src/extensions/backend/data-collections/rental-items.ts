import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'rental-items';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'Rental Items',
  displayField: 'name',
  fields: [
    { key: 'name', displayName: 'Name', type: 'TEXT' },
    { key: 'description', displayName: 'Description', type: 'TEXT' },
    { key: 'slug', displayName: 'Slug', type: 'TEXT' },
    { key: 'images', displayName: 'Images', type: 'MEDIA_GALLERY' },
    { key: 'category', displayName: 'Category', type: 'TEXT' },
    { key: 'unitCount', displayName: 'Units', type: 'NUMBER' },
    { key: 'dailyRate', displayName: 'Daily Rate', type: 'NUMBER' },
    { key: 'weeklyRate', displayName: 'Weekly Rate', type: 'NUMBER' },
    { key: 'depositAmount', displayName: 'Deposit', type: 'NUMBER' },
    { key: 'minDays', displayName: 'Minimum Days', type: 'NUMBER' },
    { key: 'maxDays', displayName: 'Maximum Days', type: 'NUMBER' },
    { key: 'bufferDays', displayName: 'Buffer Days', type: 'NUMBER' },
    { key: 'leadDays', displayName: 'Lead Days', type: 'NUMBER' },
    { key: 'status', displayName: 'Status', type: 'TEXT' },
  ],
  dataPermissions: {
    itemRead: 'ANYONE',
    itemInsert: 'CMS_EDITOR',
    itemUpdate: 'CMS_EDITOR',
    itemRemove: 'CMS_EDITOR',
  },
  indexes: [{ fields: [{ path: 'slug' }], unique: true }],
  initialData: [],
} satisfies DataCollection;
