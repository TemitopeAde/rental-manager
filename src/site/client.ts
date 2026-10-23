import { httpClient } from '@wix/essentials';

export function endpoint(path: string): string {
  return new URL(path, import.meta.url).href;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await httpClient.fetchWithAuth(endpoint(path), init);
  const body = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(body.message || `Request failed (${response.status})`);
  return body;
}

export function post<T>(path: string, payload: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
