import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'rental-items';

// Seeded on install so a new site has something to look at. The Basic tier allows one item,
// so the sample can be edited or archived before a real item is added.
export const sampleItemIds = { camera: 'sample-camera-kit' } as const;

const sampleItems = [
  {
    _id: sampleItemIds.camera,
    name: 'Camera kit (sample)',
    description: 'A sample rental item. Edit it to make it yours, or archive it from the Items tab.',
    slug: 'sample-camera-kit',
    category: 'Cameras',
    unitCount: 2,
    dailyRate: 45,
    weeklyRate: 220,
    depositAmount: 150,
    minDays: 2,
    maxDays: 30,
    bufferDays: 1,
    leadDays: 1,
    status: 'active',
    storeProductId: '',
    storeRentalOverride: 'inherit',
  },
];

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
    { key: 'storeProductId', displayName: 'Wix Store Product ID', type: 'TEXT' },
    { key: 'storeRentalOverride', displayName: 'Store Rental Override', type: 'TEXT' },
  ],
  dataPermissions: {
    itemRead: 'ANYONE',
    itemInsert: 'CMS_EDITOR',
    itemUpdate: 'CMS_EDITOR',
    itemRemove: 'CMS_EDITOR',
  },
  indexes: [{ fields: [{ path: 'slug' }], unique: true }],
  initialData: sampleItems,
} satisfies DataCollection;
