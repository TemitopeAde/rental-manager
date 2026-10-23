export function money(amount: number, currency?: string): string {
  if (!currency) return String(amount);
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function shortDate(date: Date | undefined): string {
  if (!date) return '';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

// Asks Wix media for a downscaled copy so grids don't download full-size originals.
export function sizedImage(src: string, width: number): string {
  const match = /^https:\/\/static\.wixstatic\.com\/media\/([^/]+)$/.exec(src);
  if (!match) return src;
  return `${src}/v1/fit/w_${width},h_${width},q_85,enc_auto/${match[1]}`;
}

export function partClass(base: string, part?: { className?: string }): string {
  return part?.className || base;
}
