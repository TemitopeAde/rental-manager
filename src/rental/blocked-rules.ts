// Pure rules for closed (blocked) dates: no SDK imports, so they can be unit tested without a Wix site.

const DAY_MS = 86_400_000;

/** The longest range one request may close, so a typo can't write years of rows. */
export const MAX_BLOCK_DAYS = 366;

export interface BlockRow {
  _id: string;
  itemId: string;
  date: string;
  reason: string;
}

export interface BlockGroup {
  itemId: string;
  reason: string;
  start: string;
  end: string;
  ids: string[];
}

function isDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function nextDay(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
}

/** Every day from start to end, inclusive. Empty when either date is invalid, end is before start, or the span is too long. */
export function datesBetween(start: string, end: string, max = MAX_BLOCK_DAYS): string[] {
  if (!isDay(start) || !isDay(end) || end < start) return [];
  const dates: string[] = [];
  for (let date = start; date <= end; date = nextDay(date)) {
    if (dates.length >= max) return [];
    dates.push(date);
  }
  return dates;
}

/** Valid, distinct dates that aren't already closed. */
export function newBlockDates(requested: string[], existing: Iterable<string>): string[] {
  const taken = new Set(existing);
  const result: string[] = [];
  for (const date of requested) {
    if (!isDay(date) || taken.has(date)) continue;
    taken.add(date);
    result.push(date);
  }
  return result;
}

/** Folds single-day rows into ranges of consecutive days that share an item and reason. */
export function groupBlocks(rows: BlockRow[]): BlockGroup[] {
  const sorted = [...rows].sort(
    (a, b) => a.itemId.localeCompare(b.itemId) || a.reason.localeCompare(b.reason) || a.date.localeCompare(b.date),
  );
  const groups: BlockGroup[] = [];
  for (const row of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.itemId === row.itemId && last.reason === row.reason && nextDay(last.end) === row.date) {
      last.end = row.date;
      last.ids.push(row._id);
    } else if (last && last.itemId === row.itemId && last.reason === row.reason && last.end === row.date) {
      // A duplicate row for a day already in the group: keep its id so removing the range removes it too.
      last.ids.push(row._id);
    } else {
      groups.push({ itemId: row.itemId, reason: row.reason, start: row.date, end: row.date, ids: [row._id] });
    }
  }
  return groups.sort((a, b) => a.start.localeCompare(b.start) || a.itemId.localeCompare(b.itemId));
}
