import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'rental-settings';

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'Rental Settings',
  displayField: 'timezone',
  fields: [
    { key: 'timezone', displayName: 'Timezone', type: 'TEXT' },
    { key: 'pickupHour', displayName: 'Pickup Hour', type: 'TEXT' },
    { key: 'returnHour', displayName: 'Return Hour', type: 'TEXT' },
    { key: 'approvalMode', displayName: 'Approval Mode', type: 'TEXT' },
    { key: 'defaultBufferDays', displayName: 'Default Buffer Days', type: 'NUMBER' },
    { key: 'defaultMinDays', displayName: 'Default Minimum Days', type: 'NUMBER' },
    { key: 'defaultMaxDays', displayName: 'Default Maximum Days', type: 'NUMBER' },
    { key: 'defaultLeadDays', displayName: 'Default Lead Days', type: 'NUMBER' },
    { key: 'countReturnDay', displayName: 'Count Return Day', type: 'BOOLEAN' },
    { key: 'emailSenderName', displayName: 'Email Sender Name', type: 'TEXT' },
    { key: 'currency', displayName: 'Currency', type: 'TEXT' },
    { key: 'storeCategoryId', displayName: 'Wix Store Rental Category ID', type: 'TEXT' },
    { key: 'storeCategoryName', displayName: 'Wix Store Rental Category Name', type: 'TEXT' },
    { key: 'storeCategoryVersion', displayName: 'Wix Store Catalog Version', type: 'TEXT' },
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
