export type ItemStatus = 'active' | 'hidden' | 'archived';
export type BookingStatus =
  | 'hold'
  | 'pending'
  | 'confirmed'
  | 'active'
  | 'returned'
  | 'cancelled'
  | 'overdue'
  | 'expired';
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
export interface DateChangeRequest {
  type: 'dates' | 'cancel';
  startDate: string;
  endDate: string;
  quote: Quote;
  requestedAt: string;
  status: 'pending' | 'declined';
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
  idempotencyKey: string;
  refundNeeded: boolean;
}

export interface Settings {
  _id: string;
  timezone: string;
  pickupHour: string;
  returnHour: string;
  approvalMode: ApprovalMode;
  defaultBufferDays: number;
  defaultMinDays: number;
  defaultMaxDays: number;
  defaultLeadDays: number;
  countReturnDay: boolean;
  emailSenderName: string;
  currency: string;
  storeCategoryId: string;
  storeCategoryName: string;
  storeCategoryVersion?: StoreCatalogVersion;
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
