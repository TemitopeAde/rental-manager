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

export interface RentalItem {
  _id: string;
  name: string;
  description: string;
  slug: string;
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
