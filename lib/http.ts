/** Small helpers for JSON route-handler responses. */

export function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init?.headers ?? {}),
    },
  });
}

export function httpError(
  status: number,
  message: string,
  extra?: Record<string, unknown>,
): Response {
  return json({ error: message, ...(extra ?? {}) }, { status });
}
