import type { DataCollection } from '@wix/astro/builders';
import { sampleItemIds } from './rental-items';

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

// Seeded on install next to the sample items. Both are finished ("returned") with past dates:
// seed data can't be relative to the install date, so an upcoming booking would go stale, and
// finished bookings never hold units, so they can't block a real renter's dates.
const sampleBookings = [
  {
    reference: 'RB-SAMPLE-1',
    itemId: sampleItemIds.camera,
    quantity: 1,
    startDate: '2026-09-04',
    endDate: '2026-09-07',
    status: 'returned',
    holdExtended: false,
    quote: { days: 3, rental: 135, deposit: 150, total: 285, dailyRate: 45, weeklyRate: 220, quantity: 1 },
    cartLineItemId: '',
    ecomOrderId: '',
    renter: { name: 'Sample Renter', email: 'renter@example.com', phone: '' },
    depositOutcome: { outcome: 'released', amountKept: 0, note: 'Returned in good condition.' },
    idempotencyKey: 'sample-booking-1',
    refundNeeded: false,
  },
  {
    reference: 'RB-SAMPLE-2',
    itemId: sampleItemIds.tent,
    quantity: 2,
    startDate: '2026-09-18',
    endDate: '2026-09-21',
    status: 'returned',
    holdExtended: false,
    quote: { days: 3, rental: 108, deposit: 80, total: 188, dailyRate: 18, weeklyRate: 90, quantity: 2 },
    cartLineItemId: '',
    ecomOrderId: '',
    renter: { name: 'Sample Renter', email: 'renter@example.com', phone: '' },
    depositOutcome: { outcome: 'kept', amountKept: 15, note: 'One tent pole replaced.' },
    idempotencyKey: 'sample-booking-2',
    refundNeeded: false,
  },
];

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
    { key: 'memberId', displayName: 'Member', type: 'TEXT' },
    {
      key: 'changeRequest',
      displayName: 'Date Change Request',
      type: 'OBJECT',
      objectOptions: {
        fields: [
          { key: 'startDate', displayName: 'Pickup', type: 'TEXT' },
          { key: 'endDate', displayName: 'Return', type: 'TEXT' },
          { key: 'quote', displayName: 'Quote', ...quote },
          { key: 'requestedAt', displayName: 'Requested', type: 'TEXT' },
          { key: 'status', displayName: 'Status', type: 'TEXT' },
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
  initialData: sampleBookings,
} satisfies DataCollection;
