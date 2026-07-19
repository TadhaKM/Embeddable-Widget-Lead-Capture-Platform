import { getAuthedOrg } from '@/lib/supabase/auth';
import { getWidget, listSubmissions } from '@/lib/db';
import { json, httpError } from '@/lib/http';

export const dynamic = 'force-dynamic';

function intParam(value: string | null, fallback: number): number {
  const n = parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// GET /api/widgets/:id/submissions?page=&pageSize=&includeSpam=
// Paginated, org-scoped. Excludes spam by default; includeSpam=true to include.
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const auth = await getAuthedOrg(req);
  if (!auth) return httpError(401, 'unauthorized');

  // Scope check: the widget must belong to the caller's org.
  const widget = await getWidget(auth.orgId, params.id);
  if (!widget) return httpError(404, 'not found');

  const url = new URL(req.url);
  const page = intParam(url.searchParams.get('page'), 1);
  const pageSize = Math.min(100, intParam(url.searchParams.get('pageSize'), 20));
  const includeSpam = url.searchParams.get('includeSpam') === 'true';

  const result = await listSubmissions(auth.orgId, params.id, {
    page,
    pageSize,
    includeSpam,
  });
  return json(result);
}
