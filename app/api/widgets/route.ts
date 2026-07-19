import { getAuthedOrg } from '@/lib/supabase/auth';
import { listWidgets, createWidget } from '@/lib/db';
import { createWidgetSchema } from '@/lib/schemas';
import { withEmbedSnippet } from '@/lib/embed';
import { json, httpError } from '@/lib/http';

export const dynamic = 'force-dynamic';

// GET /api/widgets — list the authenticated org's widgets
export async function GET(req: Request): Promise<Response> {
  const auth = await getAuthedOrg(req);
  if (!auth) return httpError(401, 'unauthorized');

  const widgets = await listWidgets(auth.orgId);
  return json({ widgets: widgets.map(withEmbedSnippet) });
}

// POST /api/widgets — create a widget for the authenticated org
export async function POST(req: Request): Promise<Response> {
  const auth = await getAuthedOrg(req);
  if (!auth) return httpError(401, 'unauthorized');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return httpError(400, 'invalid JSON body');
  }

  const parsed = createWidgetSchema.safeParse(body);
  if (!parsed.success) {
    return httpError(400, 'invalid widget', { issues: parsed.error.issues });
  }

  const widget = await createWidget(auth.orgId, parsed.data);
  return json({ widget: withEmbedSnippet(widget) }, { status: 201 });
}
