-- Phase 1 — Row Level Security
--
-- Rule: widgets and submissions are readable/writable only by authenticated
-- users who belong to the owning org (via org_members).
--
-- The public submission path writes through the SERVICE-ROLE client, which
-- bypasses RLS entirely — so submissions/rate_limit_hits/side_effect_failures
-- need no anon INSERT policy. RLS on those tables therefore acts as a default
-- deny for any non-service (browser/anon) access.

alter table organizations       enable row level security;
alter table org_members         enable row level security;
alter table widgets             enable row level security;
alter table submissions         enable row level security;
alter table rate_limit_hits     enable row level security;
alter table side_effect_failures enable row level security;

-- --- org_members: a user may read their own membership rows -------------------
drop policy if exists org_members_self_select on org_members;
create policy org_members_self_select on org_members
  for select using (user_id = auth.uid());

-- --- organizations: members may read their org(s) ----------------------------
drop policy if exists organizations_member_select on organizations;
create policy organizations_member_select on organizations
  for select using (
    exists (
      select 1 from org_members m
      where m.org_id = organizations.id and m.user_id = auth.uid()
    )
  );

-- --- widgets: full CRUD scoped to the member's org ---------------------------
drop policy if exists widgets_member_all on widgets;
create policy widgets_member_all on widgets
  for all
  using (
    exists (
      select 1 from org_members m
      where m.org_id = widgets.org_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from org_members m
      where m.org_id = widgets.org_id and m.user_id = auth.uid()
    )
  );

-- --- submissions: read-only, scoped to the member's org ----------------------
-- (inserts happen server-side via the service-role client, bypassing RLS)
drop policy if exists submissions_member_select on submissions;
create policy submissions_member_select on submissions
  for select using (
    exists (
      select 1 from org_members m
      where m.org_id = submissions.org_id and m.user_id = auth.uid()
    )
  );

-- rate_limit_hits and side_effect_failures: no policies => default deny for
-- anon/authed roles. Only the service role (which bypasses RLS) touches them.
