import { corsHeaders, isOriginAllowed } from '@/lib/cors';
import { getClientIp, hashIp } from '@/lib/ip-hash';
import { buildSubmissionSchema } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limit';
import { enrichGeo } from '@/lib/geo/providers';
import { fireWebhook } from '@/lib/webhook';
import { getWidgetForSubmission, insertSubmission } from '@/lib/db';
import { HONEYPOT_FIELD, MAX_BODY_BYTES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const SUBMIT_METHODS = 'POST, OPTIONS';

// CORS echoes the request Origin (fallback '*'); per-widget origin enforcement
// happens at body-time in POST (step 4), because preflight has no widget_id.
function baseCors(req: Request): Record<string, string> {
  return corsHeaders(req, { methods: SUBMIT_METHODS });
}

function respond(
  req: Request,
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...baseCors(req),
      ...extraHeaders,
    },
  });
}

// --- 1. CORS preflight ------------------------------------------------------
export async function OPTIONS(req: Request): Promise<Response> {
  return new Response(null, { status: 204, headers: baseCors(req) });
}

export async function POST(req: Request): Promise<Response> {
  // --- 2. Size guard (before parsing / any DB work) -------------------------
  const declaredLen = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLen) && declaredLen > MAX_BODY_BYTES) {
    return respond(req, { error: 'payload too large' }, 413);
  }
  const raw = await req.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return respond(req, { error: 'payload too large' }, 413);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return respond(req, { error: 'invalid payload' }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return respond(req, { error: 'invalid JSON' }, 400);
  }

  const widgetId = typeof body.widget_id === 'string' ? body.widget_id : null;
  if (!widgetId) {
    return respond(req, { error: 'widget_id required' }, 400);
  }

  // --- 3. Widget lookup (load-bearing) --------------------------------------
  const widget = await getWidgetForSubmission(widgetId);
  if (!widget) {
    return respond(req, { error: 'widget not found' }, 404);
  }
  if (widget.status !== 'active') {
    return respond(req, { error: 'widget not accepting submissions' }, 404);
  }

  // --- 4. Origin check (per-widget allowlist) -------------------------------
  const origin = req.headers.get('origin');
  if (!isOriginAllowed(origin, widget.allowed_origins)) {
    return respond(req, { error: 'origin not allowed' }, 403);
  }

  // --- 5. Validation built from fields_json ---------------------------------
  const schema = buildSubmissionSchema(widget.fields_json ?? []);
  const fieldsInput =
    body.fields && typeof body.fields === 'object' && !Array.isArray(body.fields)
      ? (body.fields as Record<string, unknown>)
      : {};
  const validated = schema.safeParse(fieldsInput);
  if (!validated.success) {
    return respond(
      req,
      { error: 'validation failed', issues: validated.error.issues },
      400,
    );
  }

  const ip = getClientIp(req);
  const ipHash = hashIp(ip);

  // --- 6. Rate limit (records a hit on every attempt, then counts) ----------
  const rl = await checkRateLimit(widget.id, ipHash);
  if (!rl.allowed) {
    return respond(req, { error: 'rate limit exceeded' }, 429, {
      'Retry-After': String(rl.retryAfterSec),
    });
  }

  // --- 7. Honeypot: silent fake success; store spam, skip geo + webhook -----
  const honeypot = body[HONEYPOT_FIELD];
  const isSpam = typeof honeypot === 'string' && honeypot.trim().length > 0;

  // --- 8. Enrichment (non-spam only) ----------------------------------------
  let geo = null as Awaited<ReturnType<typeof enrichGeo>>['geo'];
  let geoProvider = 'none';
  if (!isSpam) {
    const lookup = await enrichGeo(ip);
    geo = lookup.geo;
    geoProvider = lookup.provider;
  }

  // --- 9. Store submission (always) -----------------------------------------
  const submissionId = await insertSubmission({
    widget_id: widget.id,
    org_id: widget.org_id,
    fields_json: validated.data,
    ip_hash: ipHash,
    geo_json: geo,
    geo_provider_used: geoProvider,
    is_spam: isSpam,
  });

  if (isSpam) {
    // Look exactly like a normal success. Never signal the bot it was caught.
    return respond(req, { ok: true, id: submissionId }, 200);
  }

  // --- 10. Safe side effect: webhook (never fails/blocks the response) -------
  if (widget.webhook_url) {
    await fireWebhook({
      url: widget.webhook_url,
      submissionId,
      payload: {
        submission_id: submissionId,
        widget_id: widget.id,
        fields: validated.data,
        geo,
      },
    });
  }

  // --- 11. Success ----------------------------------------------------------
  return respond(req, { ok: true, id: submissionId }, 201);
}
