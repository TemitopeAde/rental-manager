import type { DepositMode } from './deposit-rules';
import type { RefundRecord } from './refund-rules';
import type { LateFeeMode } from './late-rules';
export type ItemStatus = 'active' | 'hidden' | 'archived';
export type BookingStatus =
  | 'hold'
  | 'pending'
  | 'confirmed'
  | 'active'
  | 'returned'
  | 'cancelled'
  | 'overdue'
  | 'expired'
  // Written off: the renter never brought it back.
  | 'lost';
export const BOOKING_STATUSES: readonly BookingStatus[] = ['hold', 'pending', 'confirmed', 'active', 'returned', 'cancelled', 'overdue', 'expired', 'lost'];
/** Bookings the merchant still has to act on; the dashboard's "Open" tab. */
export const OPEN_BOOKING_STATUSES: readonly BookingStatus[] = ['pending', 'confirmed', 'active', 'overdue'];
export type ApprovalMode = 'auto' | 'manual';
export type StoreCatalogVersion = 'V1_CATALOG' | 'V3_CATALOG';
export type StoreRentalOverride = 'inherit' | 'enabled' | 'disabled';

export interface RentalImage {
  src: string;
  alt: string;
}

export interface RentalItem {
  _id: string;
  name: string;
  description: string;
  slug: string;
  images: RentalImage[];
  category: string;
  unitCount: number;
  dailyRate: number;
  weeklyRate: number;
  depositAmount: number;
  minDays: number;
  maxDays: number;
  bufferDays: number;
  leadDays: number;
  status: ItemStatus;
  storeProductId?: string;
  storeRentalOverride: StoreRentalOverride;
}

export interface Quote {
  days: number;
  rental: number;
  deposit: number;
  total: number;
  dailyRate: number;
  weeklyRate: number;
  quantity: number;
}

export interface Renter {
  name: string;
  email: string;
  phone: string;
}

// A renter's request to move or cancel a paid booking; nothing changes until the site owner approves.
// An 'extend' request keeps the pickup date and moves only the return date of a rental that is out.
export interface DateChangeRequest {
  type: 'dates' | 'cancel' | 'extend';
  startDate: string;
  endDate: string;
  quote: Quote;
  requestedAt: string;
  status: 'pending' | 'declined';
}

// Tracks a rental that came back (or is still out) after its return time.
export interface LateReturn {
  /** When the rental first went overdue (ISO time). */
  overdueSince: string;
  /** Started late days and hours, counted from the return time. */
  lateDays: number;
  lateHours: number;
  /** Late fee owed so far, or the final fee once `final` is set. */
  fee: number;
  /** True once the rental is back or written off; the fee no longer grows. */
  final: boolean;
  returnedAt?: string;
  /** Set when the rental passed the "probably lost" threshold in Settings. */
  lostFlaggedAt?: string;
}

// A Wix payment link sent to the renter for money owed after checkout.
export interface PaymentRequest {
  kind: 'late-fee' | 'extension';
  amount: number;
  linkId: string;
  url: string;
  status: 'unpaid' | 'paid' | 'inactive';
  at: string;
}

export interface Booking {
  _id: string;
  reference: string;
  itemId: string;
  quantity: number;
  startDate: string;
  endDate: string;
  status: BookingStatus;
  holdExpiresAt?: string;
  holdExtended: boolean;
  quote: Quote;
  cartLineItemId: string;
  ecomOrderId: string;
  renter: Renter;
  memberId: string;
  changeRequest?: DateChangeRequest;
  depositOutcome?: { outcome: 'released' | 'kept'; amountKept: number; note: string };
  // True when quote.deposit is the whole order's per-order deposit, not this item's own.
  orderDeposit: boolean;
  // Refunds issued from this app against this booking's Wix order.
  refunds: RefundRecord[];
  idempotencyKey: string;
  refundNeeded: boolean;
  lateReturn?: LateReturn;
  /** Keys of return reminders and alerts already sent for this booking, so each goes out once. */
  notices: string[];
  paymentRequests: PaymentRequest[];
  /** Why the shop declined or cancelled the booking, as sent to the renter. */
  cancelReason: string;
}

export interface Settings {
  _id: string;
  timezone: string;
  pickupHour: string;
  returnHour: string;
  approvalMode: ApprovalMode;
  depositMode: DepositMode;
  orderDepositAmount: number;
  defaultBufferDays: number;
  defaultMinDays: number;
  defaultMaxDays: number;
  defaultLeadDays: number;
  countReturnDay: boolean;
  emailSenderName: string;
  emailOwnerNewBookings: boolean;
  // Where owner alerts go; empty means the site owner's Wix login email.
  ownerNotificationEmail: string;
  emailOwnerRenterRequests: boolean;
  emailOwnerRefundAlerts: boolean;
  emailRentersRequestUpdates: boolean;
  emailRentersBookingUpdates: boolean;
  emailRentersDepositUpdates: boolean;
  // Return reminder on the due date and overdue notices to renters.
  emailRentersReturnReminders: boolean;
  // Owner alerts when a rental goes overdue, puts the next rental at risk, or may be lost.
  emailOwnerOverdueAlerts: boolean;
  // Late returns: see late-rules.ts.
  lateGraceMinutes: number;
  lateFeeMode: LateFeeMode;
  lateFeeAmount: number;
  lateFeeMax: number;
  lostAfterDays: number;
  // Paid bookings from renters with a late or lost rental wait for approval (needs manual approval on the plan).
  reviewLateRenters: boolean;
  // When the overdue sweep last ran (ISO time); it runs at most every few minutes.
  lastReturnSweepAt: string;
  // Setup checklist: steps the owner marked done, and whether it is hidden from Today.
  setupDone: string[];
  setupHidden: boolean;
  language: string;
  // Confirmed from the dashboard; online bookings stay closed until the Members Area is installed.
  membersAreaInstalled: boolean;
  currency: string;
  // Wix Stores categories whose products are rentable by default. Empty means none.
  storeCategories: StoreCategoryRef[];
  storeCategoryVersion?: StoreCatalogVersion;
}

export interface StoreCategoryRef {
  id: string;
  name: string;
}

/**
 * Reads the selected rental categories. Older settings rows stored a single category in
 * storeCategoryId/storeCategoryName, so those still count when the list was never saved.
 */
export function asStoreCategoryRefs(list: unknown, legacyId?: unknown, legacyName?: unknown): StoreCategoryRef[] {
  if (Array.isArray(list)) {
    const seen = new Set<string>();
    return list.flatMap((entry) => {
      const row = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
      const id = typeof row.id === 'string' ? row.id.trim() : '';
      if (!id || seen.has(id)) return [];
      seen.add(id);
      return [{ id, name: typeof row.name === 'string' ? row.name : '' }];
    });
  }
  const id = typeof legacyId === 'string' ? legacyId.trim() : '';
  return id ? [{ id, name: typeof legacyName === 'string' ? legacyName : '' }] : [];
}

export interface BlockedDate {
  _id: string;
  itemId: string;
  date: string;
  reason: string;
}

export function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

// CMS media fields store `wix:image://v1/<fileId>/<name>#…` URIs; browsers need the static media URL.
export function mediaUrl(value: unknown): string {
  const src = text(value);
  const match = /^wix:image:\/\/v1\/([^/#]+)/.exec(src);
  if (match) return `https://static.wixstatic.com/media/${match[1]}`;
  return /^https?:\/\//.test(src) ? src : '';
}

// A MEDIA_GALLERY field is an array of `{ type, src, title, alt }` entries; non-images are skipped.
export function images(value: unknown, fallbackAlt: string): RentalImage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const media = entry as Record<string, unknown>;
    if (media.type && media.type !== 'image') return [];
    const src = mediaUrl(media.src);
    return src ? [{ src, alt: text(media.alt) || text(media.title) || fallbackAlt }] : [];
  });
}
