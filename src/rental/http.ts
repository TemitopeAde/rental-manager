export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function int(value: unknown, fallback = 1): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}
