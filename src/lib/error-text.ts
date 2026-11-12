// Turns raw error text into one short, readable line. Wix API errors often arrive as a JSON dump such as
// {"message":"Internal Server Error","details":{"applicationError":{...}}}; users should only see the message.

const FALLBACK = 'Internal Server Error';

function pick(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  for (const key of ['message', 'description']) {
    const text = record[key];
    if (typeof text === 'string' && text.trim() && !text.trim().startsWith('{')) return text.trim();
  }
  const details = record.details as Record<string, unknown> | undefined;
  return pick(details?.applicationError) || pick(details) || pick(record.applicationError);
}

/** The readable message inside an error string. Plain text passes through; a JSON dump becomes its message. */
export function readableError(text: string | undefined | null, fallback = FALLBACK): string {
  const raw = (text ?? '').trim();
  if (!raw) return fallback;
  const start = raw.indexOf('{');
  if (start === -1) return raw;
  try {
    return pick(JSON.parse(raw.slice(start, raw.lastIndexOf('}') + 1))) || fallback;
  } catch {
    // Not valid JSON after all; keep the text before the brace if there is any.
    return raw.slice(0, start).trim() || fallback;
  }
}

/** Status lines that say something failed but not what; a renter should see our own wording instead. */
const GENERIC_ERROR = /^(internal server error|service unavailable|bad gateway|gateway timeout|request failed(\s*\(\d+\))?|failed to fetch|network error|load failed)\.?$/i;

/** A message fit for a shopper: the readable part of `text`, or `fallback` when that says nothing specific. */
export function renterError(text: string | undefined | null, fallback: string): string {
  const readable = readableError(text, fallback);
  return GENERIC_ERROR.test(readable) ? fallback : readable;
}
