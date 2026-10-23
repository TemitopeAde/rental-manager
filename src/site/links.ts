import { useEffect, useState, type MouseEvent } from 'react';
import { location } from '@wix/site-location';

// SDK calls throw synchronously (not a rejected promise) when no Wix context is set up,
// so every call goes through here to keep the widget rendering either way.
function safely<T>(call: () => Promise<T>): Promise<T> {
  try {
    return call();
  } catch (error) {
    return Promise.reject(error);
  }
}

// Free sites live under a path (user.wixsite.com/site), so page links need the site's base URL.
export function useSiteBase(): string {
  const [base, setBase] = useState('');
  useEffect(() => {
    safely(() => location.baseUrl())
      .then((url) => setBase(url.replace(/\/$/, '')))
      .catch(() => undefined);
  }, []);
  return base;
}

// Accepts what a site owner is likely to type: "rental-details", "/rental-details" or a full URL.
export function pagePath(page: string): string {
  const trimmed = page.trim();
  if (!trimmed || /^https?:\/\//.test(trimmed)) return trimmed;
  return `/${trimmed.replace(/^\/+/, '')}`;
}

export function itemPath(detailsPage: string, slug: string): string {
  const path = pagePath(detailsPage);
  if (!path) return '';
  return `${path}${path.includes('?') ? '&' : '?'}slug=${encodeURIComponent(slug)}`;
}

export function absolute(base: string, path: string): string {
  return /^https?:\/\//.test(path) ? path : `${base}${path}`;
}

// Lets Wix route the click (keeps the site's SPA navigation) while the real href keeps
// open-in-new-tab, crawlers and modifier clicks working.
export function navigate(event: MouseEvent<HTMLAnchorElement>, path: string) {
  if (!path || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (/^https?:\/\//.test(path)) return;
  const href = event.currentTarget.href;
  event.preventDefault();
  safely(() => location.to(path)).catch(() => window.location.assign(href));
}

export async function readSlug(): Promise<string> {
  try {
    const query = (await safely(() => location.query())) as Record<string, unknown>;
    const value = query.slug ?? query.item;
    if (typeof value === 'string' && value) return value;
  } catch {
    // Not running inside a Wix site (e.g. local preview); fall back to the browser URL.
  }
  const params = new URLSearchParams(window.location.search);
  return params.get('slug') || params.get('item') || '';
}
