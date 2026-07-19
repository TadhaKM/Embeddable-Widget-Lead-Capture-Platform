import { serviceClient } from '@/lib/supabase/server';
import type { Widget } from '@/lib/types';
import type { CreateWidgetInput, UpdateWidgetInput } from '@/lib/schemas';

/**
 * The single data-access seam. Every Supabase query in the app goes through a
 * named function here so route handlers stay thin AND tests can mock the whole
 * DB with `vi.mock('@/lib/db')` — this is what makes the build offline-friendly.
 *
 * Admin/dashboard functions take `orgId` and filter on it explicitly
 * (defense-in-depth alongside RLS) so there is no cross-tenant leakage.
 */

// ---------------------------------------------------------------------------
// Auth / membership
// ---------------------------------------------------------------------------
export async function getOrgIdForUser(userId: string): Promise<string | null> {
  const sb = serviceClient();
  const { data, error } = await sb
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.org_id as string;
}

// ---------------------------------------------------------------------------
// Widgets — admin CRUD (Phase 2), always org-scoped
// ---------------------------------------------------------------------------
export async function listWidgets(orgId: string): Promise<Widget[]> {
  const sb = serviceClient();
  const { data, error } = await sb
    .from('widgets')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Widget[];
}

export async function getWidget(
  orgId: string,
  id: string,
): Promise<Widget | null> {
  const sb = serviceClient();
  const { data, error } = await sb
    .from('widgets')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Widget | null) ?? null;
}

export async function createWidget(
  orgId: string,
  input: CreateWidgetInput,
): Promise<Widget> {
  const sb = serviceClient();
  const { data, error } = await sb
    .from('widgets')
    .insert({ org_id: orgId, ...input })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as Widget;
}

export async function updateWidget(
  orgId: string,
  id: string,
  patch: UpdateWidgetInput,
): Promise<Widget | null> {
  const sb = serviceClient();
  const { data, error } = await sb
    .from('widgets')
    .update(patch)
    .eq('org_id', orgId)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Widget | null) ?? null;
}

export async function deleteWidget(
  orgId: string,
  id: string,
): Promise<boolean> {
  const sb = serviceClient();
  const { data, error } = await sb
    .from('widgets')
    .delete()
    .eq('org_id', orgId)
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data != null;
}
