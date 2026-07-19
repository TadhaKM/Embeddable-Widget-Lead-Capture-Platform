-- Phase 1 — core schema
-- Tables: organizations, org_members, widgets, submissions, rate_limit_hits, side_effect_failures.
-- IPs are stored ONLY as salted sha256 hashes (ip_hash) — never raw.

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type widget_type as enum ('popover', 'signup', 'cta');
exception when duplicate_object then null; end $$;

do $$ begin
  create type widget_status as enum ('active', 'paused', 'archived');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- organizations — the tenant boundary
-- ---------------------------------------------------------------------------
create table if not exists organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- org_members — maps Supabase auth users to organizations (drives RLS + auth)
-- ---------------------------------------------------------------------------
create table if not exists org_members (
  org_id     uuid not null references organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists org_members_user_id_idx on org_members(user_id);

-- ---------------------------------------------------------------------------
-- widgets — a customer's embeddable definition
-- ---------------------------------------------------------------------------
create table if not exists widgets (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  type            widget_type not null,
  name            text not null,
  copy_json       jsonb not null default '{}'::jsonb,
  fields_json     jsonb not null default '[]'::jsonb,
  targeting_json  jsonb not null default '{}'::jsonb,
  allowed_origins text[] null,          -- null => allow any origin
  webhook_url     text null,            -- null => no side effect
  status          widget_status not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists widgets_org_id_idx on widgets(org_id);

-- keep updated_at fresh (drives the config endpoint's ETag)
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists widgets_set_updated_at on widgets;
create trigger widgets_set_updated_at
  before update on widgets
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- submissions — one row per accepted submission (incl. silently-caught spam)
-- ---------------------------------------------------------------------------
create table if not exists submissions (
  id                uuid primary key default gen_random_uuid(),
  widget_id         uuid not null references widgets(id) on delete cascade,
  org_id            uuid not null references organizations(id) on delete cascade,
  fields_json       jsonb not null default '{}'::jsonb,
  ip_hash           text not null,
  geo_json          jsonb null,
  geo_provider_used text not null default 'none',
  is_spam           boolean not null default false,
  created_at        timestamptz not null default now()
);
create index if not exists submissions_widget_created_idx
  on submissions(widget_id, created_at desc);
create index if not exists submissions_org_id_idx on submissions(org_id);

-- ---------------------------------------------------------------------------
-- rate_limit_hits — sliding-window log; one row per submission attempt
-- ---------------------------------------------------------------------------
create table if not exists rate_limit_hits (
  id         uuid primary key default gen_random_uuid(),
  widget_id  uuid not null references widgets(id) on delete cascade,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_limit_hits_lookup_idx
  on rate_limit_hits(widget_id, ip_hash, created_at);

-- ---------------------------------------------------------------------------
-- side_effect_failures — durable log when a webhook POST fails
-- ---------------------------------------------------------------------------
create table if not exists side_effect_failures (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  type          text not null,          -- e.g. 'webhook'
  error_message text not null,
  created_at    timestamptz not null default now()
);
create index if not exists side_effect_failures_submission_idx
  on side_effect_failures(submission_id);
