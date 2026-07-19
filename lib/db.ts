import { serviceClient } from '@/lib/supabase/server';
import type {
  GeoResult,
  PublicWidgetConfig,
  Submission,
  Widget,
  WidgetField,
  WidgetStatus,
  WidgetType,
} from '@/lib/types';
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

// ---------------------------------------------------------------------------
// Public config (Phase 3) — NOT org-scoped (public), and selects ONLY the
// non-sensitive columns. webhook_url / allowed_origins / org_id never leave here.
// ---------------------------------------------------------------------------
export interface PublicConfigRow {
  config: PublicWidgetConfig;
  updated_at: string;
}

export async function getPublicConfig(
  id: string,
): Promise<PublicConfigRow | null> {
  const sb = serviceClient();
  const { data, error } = await sb
    .from('widgets')
    .select('type, copy_json, fields_json, targeting_json, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    config: {
      type: data.type,
      copy: (data.copy_json ?? {}) as Record<string, unknown>,
      fields: (data.fields_json ?? []) as PublicWidgetConfig['fields'],
      targeting: (data.targeting_json ?? {}) as Record<string, unknown>,
    },
    updated_at: data.updated_at as string,
  };
}

// ---------------------------------------------------------------------------
// Public submission path (Phase 4) — service-role writes, bypassing RLS.
// ---------------------------------------------------------------------------

/** Just the columns the submission handler needs — incl. status/allowlist/webhook. */
export interface SubmissionWidget {
  id: string;
  org_id: string;
  type: WidgetType;
  fields_json: WidgetField[];
  allowed_origins: string[] | null;
  webhook_url: string | null;
  status: WidgetStatus;
}

export async function getWidgetForSubmission(
  id: string,
): Promise<SubmissionWidget | null> {
  const sb = serviceClient();
  const { data, error } = await sb
    .from('widgets')
    .select('id, org_id, type, fields_json, allowed_origins, webhook_url, status')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SubmissionWidget | null) ?? null;
}

export async function countRecentHits(
  widgetId: string,
  ipHash: string,
  sinceIso: string,
): Promise<number> {
  const sb = serviceClient();
  const { count, error } = await sb
    .from('rate_limit_hits')
    .select('id', { count: 'exact', head: true })
    .eq('widget_id', widgetId)
    .eq('ip_hash', ipHash)
    .gte('created_at', sinceIso);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function insertHit(
  widgetId: string,
  ipHash: string,
): Promise<void> {
  const sb = serviceClient();
  const { error } = await sb
    .from('rate_limit_hits')
    .insert({ widget_id: widgetId, ip_hash: ipHash });
  if (error) throw new Error(error.message);
}

export interface InsertSubmissionInput {
  widget_id: string;
  org_id: string;
  fields_json: Record<string, unknown>;
  ip_hash: string;
  geo_json: GeoResult | null;
  geo_provider_used: string;
  is_spam: boolean;
}

export async function insertSubmission(
  input: InsertSubmissionInput,
): Promise<string> {
  const sb = serviceClient();
  const { data, error } = await sb
    .from('submissions')
    .insert(input)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function logSideEffectFailure(
  submissionId: string,
  type: string,
  message: string,
): Promise<void> {
  const sb = serviceClient();
  const { error } = await sb
    .from('side_effect_failures')
    .insert({ submission_id: submissionId, type, error_message: message });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Dashboard (Phase 5) — authed, org-scoped reads.
// ---------------------------------------------------------------------------
export interface ListSubmissionsOpts {
  page: number;
  pageSize: number;
  includeSpam: boolean;
}

export interface ListSubmissionsResult {
  submissions: Submission[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listSubmissions(
  orgId: string,
  widgetId: string,
  opts: ListSubmissionsOpts,
): Promise<ListSubmissionsResult> {
  const sb = serviceClient();
  const from = (opts.page - 1) * opts.pageSize;
  const to = from + opts.pageSize - 1;

  let q = sb
    .from('submissions')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId)
    .eq('widget_id', widgetId);
  if (!opts.includeSpam) q = q.eq('is_spam', false);

  const { data, count, error } = await q
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);

  return {
    submissions: (data ?? []) as Submission[],
    total: count ?? 0,
    page: opts.page,
    pageSize: opts.pageSize,
  };
}

export interface WidgetStats {
  total: number; // non-spam (real leads)
  spam_dropped: number; // honeypot-caught
  last_24h: number; // non-spam in trailing 24h
  geo: Record<string, number>; // country -> count (non-spam)
}

export async function getStats(
  orgId: string,
  widgetId: string,
): Promise<WidgetStats> {
  const sb = serviceClient();

  const countWith = async (
    apply: (q: any) => any, // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<number> => {
    let q: any = sb // eslint-disable-line @typescript-eslint/no-explicit-any
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('widget_id', widgetId);
    q = apply(q);
    const { count, error } = await q;
    if (error) throw new Error(error.message);
    return count ?? 0;
  };

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [total, spam_dropped, last_24h] = await Promise.all([
    countWith((q) => q.eq('is_spam', false)),
    countWith((q) => q.eq('is_spam', true)),
    countWith((q) => q.eq('is_spam', false).gte('created_at', since24h)),
  ]);

  // Geo breakdown among non-spam submissions.
  const { data: geoRows, error } = await sb
    .from('submissions')
    .select('geo_json')
    .eq('org_id', orgId)
    .eq('widget_id', widgetId)
    .eq('is_spam', false);
  if (error) throw new Error(error.message);

  const geo: Record<string, number> = {};
  for (const row of geoRows ?? []) {
    const g = row.geo_json as GeoResult | null;
    const country = g?.country ?? 'unknown';
    geo[country] = (geo[country] ?? 0) + 1;
  }

  return { total, spam_dropped, last_24h, geo };
}
