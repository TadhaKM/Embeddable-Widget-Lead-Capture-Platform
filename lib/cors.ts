export interface CorsOptions {
  /** Allowed methods, e.g. 'POST, OPTIONS'. */
  methods?: string;
  /** Preflight cache seconds. */
  maxAge?: number;
  /**
   * Override the Allow-Origin value. By DEFAULT this helper ECHOES the request
   * `Origin` (falling back to '*') — it must NEVER hardcode one fixed customer
   * origin, or every other embedding site silently breaks. The config endpoint
   * passes '*' explicitly because it is a cacheable, fully public GET.
   */
  allowOrigin?: string;
}

export function corsHeaders(
  req: Request,
  opts: CorsOptions = {},
): Record<string, string> {
  const requestOrigin = req.headers.get('origin');
  const allowOrigin = opts.allowOrigin ?? requestOrigin ?? '*';

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': opts.methods ?? 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': String(opts.maxAge ?? 86400),
  };
  // If we echoed a concrete origin, caches must key on it.
  if (allowOrigin !== '*') headers['Vary'] = 'Origin';
  return headers;
}

/**
 * Per-widget origin enforcement (body-time, in the POST handler — NOT preflight).
 * A null/empty allowlist means "allow any origin".
 */
export function isOriginAllowed(
  origin: string | null,
  allowed: string[] | null | undefined,
): boolean {
  if (!allowed || allowed.length === 0) return true; // allow-all
  if (!origin) return false; // allowlist configured but request sent no Origin
  return allowed.includes(origin);
}
