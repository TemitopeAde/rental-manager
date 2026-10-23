export interface PriceInput {
  billedDays: number;
  dailyRate: number;
  weeklyRate?: number;
  depositAmount: number;
  quantity: number;
}

export interface PriceQuote {
  days: number;
  rental: number;
  deposit: number;
  total: number;
  dailyRate: number;
  weeklyRate: number;
  quantity: number;
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Cheapest mix of full weeks and leftover days. Without a weekly rate, charge every day. */
export function quotePrice(input: PriceInput): PriceQuote {
  const days = input.billedDays;
  const daily = input.dailyRate;
  const weekly = input.weeklyRate && input.weeklyRate > 0 ? input.weeklyRate : 0;
  const byDay = days * daily;
  const mixed = weekly
    ? Math.min(Math.floor(days / 7) * weekly + (days % 7) * daily, Math.ceil(days / 7) * weekly)
    : byDay;
  const rentalEach = money(mixed);
  const rental = money(rentalEach * input.quantity);
  const deposit = money(input.depositAmount * input.quantity);
  return {
    days,
    rental,
    deposit,
    total: money(rental + deposit),
    dailyRate: daily,
    weeklyRate: weekly,
    quantity: input.quantity,
  };
}

/** Pickup-to-return span. Monday to Wednesday is 2 days. Same-day is 1. Count-return-day adds one. */
export function rentalLength(start: string, end: string, countReturnDay: boolean): number {
  const diff = Math.round(
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000,
  );
  const base = diff <= 0 ? 1 : diff;
  return base + (countReturnDay ? 1 : 0);
}
