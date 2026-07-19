import { getAuthedOrg } from '@/lib/supabase/auth';
import { getWidget, updateWidget, deleteWidget } from '@/lib/db';
import { updateWidgetSchema } from '@/lib/schemas';
import { withEmbedSnippet } from '@/lib/embed';
import { json, httpError } from '@/lib/http';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

// GET /api/widgets/:id
export async function GET(req: Request, { params }: Ctx): Promise<Response> {
  const auth = await getAuthedOrg(req);
  if (!auth) return httpError(401, 'unauthorized');

  const widget = await getWidget(auth.orgId, params.id);
  if (!widget) return httpError(404, 'not found');
  return json({ widget: withEmbedSnippet(widget) });
}

// PATCH /api/widgets/:id
export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
  const auth = await getAuthedOrg(req);
  if (!auth) return httpError(401, 'unauthorized');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return httpError(400, 'invalid JSON body');
  }

  const parsed = updateWidgetSchema.safeParse(body);
  if (!parsed.success) {
    return httpError(400, 'invalid patch', { issues: parsed.error.issues });
  }

  const widget = await updateWidget(auth.orgId, params.id, parsed.data);
  if (!widget) return httpError(404, 'not found');
  return json({ widget: withEmbedSnippet(widget) });
}

// DELETE /api/widgets/:id
export async function DELETE(req: Request, { params }: Ctx): Promise<Response> {
  const auth = await getAuthedOrg(req);
  if (!auth) return httpError(401, 'unauthorized');

  const ok = await deleteWidget(auth.orgId, params.id);
  if (!ok) return httpError(404, 'not found');
  return json({ deleted: true });
}
