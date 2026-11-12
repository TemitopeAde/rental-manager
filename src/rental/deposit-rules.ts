// Pure deposit rules: no SDK imports, so they can be unit tested without a Wix site.
//
// Two deposit modes:
// - 'item': each item's deposit × quantity is folded into that item's checkout price (the original behavior).
// - 'order': items carry no deposit; one flat "Refundable deposit" fee is added to the checkout by the
//   Additional Fees service plugin. After payment the fee is recorded on the order's first rental booking
//   (the "lead" booking), so settling it works like any other booking deposit.

export type DepositMode = 'item' | 'order';

/** The fee code this app adds at checkout. Order handlers look for it to find the deposit actually charged. */
export const ORDER_DEPOSIT_FEE_CODE = 'rental-order-deposit';

export interface DepositSettings {
  depositMode: DepositMode;
  orderDepositAmount: number;
}

export function asDepositMode(value: unknown): DepositMode {
  return value === 'order' ? 'order' : 'item';
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The per-order deposit to charge, or 0 when per-order deposits are off, not on the plan, or not set. */
export function orderDepositAmount(settings: DepositSettings, allowed: boolean): number {
  if (!allowed || settings.depositMode !== 'order') return 0;
  const amount = Number(settings.orderDepositAmount);
  return Number.isFinite(amount) && amount > 0 ? money(amount) : 0;
}

/** Whether item deposits are replaced by one per-order deposit. */
export function usesOrderDeposit(settings: DepositSettings, allowed: boolean): boolean {
  return orderDepositAmount(settings, allowed) > 0;
}

/** The deposit to quote for one item line: zero when the order carries one deposit instead. */
export function itemDepositAmount(itemDeposit: number, settings: DepositSettings, allowed: boolean): number {
  return usesOrderDeposit(settings, allowed) ? 0 : itemDeposit;
}

/**
 * What the item's checkout line charges per unit. A booking that holds its order's deposit was priced without it,
 * so its stored deposit (written after payment) must not be added back in.
 */
export function checkoutUnitPrice(quote: { rental: number; deposit: number; quantity: number }, holdsOrderDeposit: boolean): number {
  const total = quote.rental + (holdsOrderDeposit ? 0 : quote.deposit);
  return money(quote.quantity > 0 ? total / quote.quantity : total);
}

const feeNames: Record<string, string> = {
  en: 'Refundable deposit',
  es: 'Fianza reembolsable',
  fr: 'Caution remboursable',
  de: 'Rückzahlbare Kaution',
  pt: 'Caução reembolsável',
  it: 'Cauzione rimborsabile',
  he: 'פיקדון להחזר',
};

/** The fee's display name in a language such as "fr" or "fr-FR"; English when the language isn't supported. */
export function depositFeeName(language: string | undefined): string {
  const code = (language ?? '').slice(0, 2).toLowerCase();
  return feeNames[code] ?? feeNames.en;
}

export interface FeeLine {
  lineItemId: string;
  bookingId: string;
}

export interface OrderFee {
  code?: string | null;
  price?: { amount?: string | null } | null;
  lineItemIds?: string[] | null;
}

/**
 * The deposit this app's fee actually charged on an order, and the booking that holds it: the first rental line
 * the fee covers, in the order's own line order. Null when the order has no deposit fee from this app.
 */
export function orderDepositOnOrder(fees: OrderFee[] | null | undefined, lines: FeeLine[]): { amount: number; bookingId: string } | null {
  const fee = (fees ?? []).find((entry) => entry?.code === ORDER_DEPOSIT_FEE_CODE);
  if (!fee) return null;
  const amount = money(Number(fee.price?.amount ?? 0));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const covered = new Set(fee.lineItemIds ?? []);
  const lead = lines.find((line) => covered.size === 0 || covered.has(line.lineItemId));
  return lead ? { amount, bookingId: lead.bookingId } : null;
}

/** Statuses after which a booking no longer has items out, so an order-level deposit can be settled. */
const finished = new Set(['returned', 'cancelled', 'expired']);

/** Booking references in the order that still have items out (or not yet picked up). */
export function unfinishedInOrder(bookings: Array<{ _id: string; reference: string; status: string }>, exceptId = ''): string[] {
  return bookings
    .filter((booking) => booking._id !== exceptId && !finished.has(booking.status))
    .map((booking) => booking.reference);
}
