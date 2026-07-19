import { anonClient } from '@/lib/supabase/server';
import { getOrgIdForUser } from '@/lib/db';

export interface AuthedOrg {
  userId: string;
  orgId: string;
}

function extractBearer(req: Request): string | null {
  const header =
    req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value) return null;
  return value.trim() || null;
}

/**
 * Resolve the authenticated user's org from a Supabase access token
 * (Authorization: Bearer <token>). Returns null if unauthenticated or not a
 * member of any org. Handlers translate null -> 401.
 */
export async function getAuthedOrg(req: Request): Promise<AuthedOrg | null> {
  const token = extractBearer(req);
  if (!token) return null;

  const sb = anonClient(token);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return null;

  const orgId = await getOrgIdForUser(data.user.id);
  if (!orgId) return null;

  return { userId: data.user.id, orgId };
}
