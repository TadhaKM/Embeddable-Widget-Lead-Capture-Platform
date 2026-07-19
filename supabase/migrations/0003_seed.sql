-- Phase 1 — seed data (one test org + one widget)
--
-- Fixed UUIDs so local tooling / the demo page can reference the widget without
-- a lookup. Idempotent (safe to re-run).

insert into organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Acme Test Org')
on conflict (id) do nothing;

insert into widgets (
  id, org_id, type, name, copy_json, fields_json, targeting_json,
  allowed_origins, webhook_url, status
) values (
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-000000000001',
  'signup',
  'Newsletter Signup',
  '{"title":"Join our newsletter","subtitle":"Weekly tips, no spam.","submit":"Subscribe","success":"Thanks - you are in!"}'::jsonb,
  '[{"name":"email","label":"Email","type":"email","required":true},{"name":"name","label":"Name","type":"text","required":false}]'::jsonb,
  '{"showAfterMs":3000}'::jsonb,
  null,   -- allowed_origins: null => any origin may submit (demo-friendly)
  null,   -- webhook_url: none
  'active'
) on conflict (id) do nothing;

-- To exercise the AUTHENTICATED endpoints against a real Supabase project,
-- create a user (Auth > Users) and link them to the seed org by running, with
-- their auth uid substituted:
--
--   insert into org_members (org_id, user_id)
--   values ('00000000-0000-0000-0000-000000000001', '<YOUR-AUTH-USER-UUID>');
