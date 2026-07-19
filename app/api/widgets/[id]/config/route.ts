import { getPublicConfig } from '@/lib/db';
import { corsHeaders } from '@/lib/cors';
import { json } from '@/lib/http';

export const dynamic = 'force-dynamic';

const CONFIG_METHODS = 'GET, OPTIONS';

// Public, CORS-open (Access-Control-Allow-Origin: *) so any embedding site can read it.
function publicCors(req: Request): Record<string, string> {
  return corsHeaders(req, { methods: CONFIG_METHODS, allowOrigin: '*' });
}

export async function OPTIONS(req: Request): Promise<Response> {
  return new Response(null, { status: 204, headers: publicCors(req) });
}

// GET /api/widgets/:id/config
// Returns ONLY {type, copy, fields, targeting}. Cached at the edge/browser,
// with an ETag derived from updated_at so unchanged configs 304.
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const cors = publicCors(req);
  const result = await getPublicConfig(params.id);

  if (!result) {
    return new Response(JSON.stringify({ error: 'not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json; charset=utf-8', ...cors },
    });
  }

  const etag = `W/"${result.updated_at}"`;
  const cacheHeaders = {
    ...cors,
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    ETag: etag,
  };

  if (req.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: cacheHeaders });
  }

  return json(result.config, { headers: cacheHeaders });
}
