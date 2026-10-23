import type { DataCollection } from '@wix/astro/builders';

export const collectionIdSuffix = 'bookings';

const quote = {
  type: 'OBJECT' as const,
  objectOptions: {
    fields: [
      { key: 'days', displayName: 'Days', type: 'NUMBER' as const },
      { key: 'rental', displayName: 'Rental', type: 'NUMBER' as const },
      { key: 'deposit', displayName: 'Deposit', type: 'NUMBER' as const },
      { key: 'total', displayName: 'Total', type: 'NUMBER' as const },
      { key: 'dailyRate', displayName: 'Daily Rate', type: 'NUMBER' as const },
      { key: 'weeklyRate', displayName: 'Weekly Rate', type: 'NUMBER' as const },
      { key: 'quantity', displayName: 'Quantity', type: 'NUMBER' as const },
    ],
  },
};

export default {
  idSuffix: collectionIdSuffix,
  displayName: 'Bookings',
  displayField: 'reference',
  fields: [
    { key: 'reference', displayName: 'Reference', type: 'TEXT' },
    { key: 'itemId', displayName: 'Item', type: 'TEXT' },
    { key: 'quantity', displayName: 'Quantity', type: 'NUMBER' },
    { key: 'startDate', displayName: 'Pickup', type: 'TEXT' },
    { key: 'endDate', displayName: 'Return', type: 'TEXT' },
    { key: 'status', displayName: 'Status', type: 'TEXT' },
    { key: 'holdExpiresAt', displayName: 'Hold Expires', type: 'DATETIME' },
    { key: 'holdExtended', displayName: 'Hold Extended', type: 'BOOLEAN' },
    { key: 'quote', displayName: 'Quote', ...quote },
    { key: 'cartLineItemId', displayName: 'Cart Line', type: 'TEXT' },
    { key: 'ecomOrderId', displayName: 'Order', type: 'TEXT' },
    {
      key: 'renter',
      displayName: 'Renter',
      type: 'OBJECT',
      objectOptions: {
        fields: [
          { key: 'name', displayName: 'Name', type: 'TEXT' },
          { key: 'email', displayName: 'Email', type: 'TEXT' },
          { key: 'phone', displayName: 'Phone', type: 'TEXT' },
        ],
      },
    },
    {
      key: 'depositOutcome',
      displayName: 'Deposit Outcome',
      type: 'OBJECT',
      objectOptions: {
        fields: [
          { key: 'outcome', displayName: 'Outcome', type: 'TEXT' },
          { key: 'amountKept', displayName: 'Amount Kept', type: 'NUMBER' },
          { key: 'note', displayName: 'Note', type: 'TEXT' },
        ],
      },
    },
    { key: 'idempotencyKey', displayName: 'Idempotency Key', type: 'TEXT' },
    { key: 'refundNeeded', displayName: 'Refund Needed', type: 'BOOLEAN' },
  ],
  dataPermissions: {
    itemRead: 'CMS_EDITOR',
    itemInsert: 'CMS_EDITOR',
    itemUpdate: 'CMS_EDITOR',
    itemRemove: 'CMS_EDITOR',
  },
  indexes: [{ fields: [{ path: 'idempotencyKey' }], unique: true }],
  initialData: [],
} satisfies DataCollection;
