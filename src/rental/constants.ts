export const APP_ID = '3775e684-24cc-431a-9049-066df8aa81fd';
// Wix Members Area, from https://dev.wix.com/docs/api-reference/articles/work-with-wix-apis/platform/about-apps-created-by-wix
export const MEMBERS_AREA_APP_ID = '14cc59bc-f0b7-15b8-e1c7-89ce41d0e0c9';
export const NAMESPACE = '@admin14744/rental-manager';

export const collections = {
  items: `${NAMESPACE}/rental-items`,
  bookings: `${NAMESPACE}/bookings`,
  unitDays: `${NAMESPACE}/unit-days`,
  blockedDates: `${NAMESPACE}/blocked-dates`,
  settings: `${NAMESPACE}/rental-settings`,
  audit: `${NAMESPACE}/audit-log`,
} as const;

export const SETTINGS_ID = 'default';
export const HOLD_MINUTES = 15;
export const HOLD_EXTENSION_MINUTES = 30;
export const BOOKING_WINDOW_DAYS = 180;
export const ALL_ITEMS = '*';

export const LIVE_STATUSES = ['hold', 'pending', 'confirmed', 'active', 'overdue'] as const;
