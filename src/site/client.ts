import { httpClient } from '@wix/essentials';
import { readableError } from '../lib/error-text.ts';

export function endpoint(path: string): string {
  return new URL(path, import.meta.url).href;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await httpClient.fetchWithAuth(endpoint(path), init);
  // A crashed route can answer with an HTML error page, and Wix errors can be a JSON dump; show one short line.
  const body = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) throw new Error(readableError(body.message, response.status >= 500 ? 'Internal Server Error' : `Request failed (${response.status})`));
  return body;
}

export function post<T>(path: string, payload: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
