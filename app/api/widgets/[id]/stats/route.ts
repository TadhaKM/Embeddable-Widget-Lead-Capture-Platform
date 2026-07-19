import { getAuthedOrg } from '@/lib/supabase/auth';
import { getWidget, getStats } from '@/lib/db';
import { json, httpError } from '@/lib/http';

export const dynamic = 'force-dynamic';

// GET /api/widgets/:id/stats — total, spam_dropped, last-24h volume, geo breakdown.
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const auth = await getAuthedOrg(req);
  if (!auth) return httpError(401, 'unauthorized');

  const widget = await getWidget(auth.orgId, params.id);
  if (!widget) return httpError(404, 'not found');

  const stats = await getStats(auth.orgId, params.id);
  return json(stats);
}
