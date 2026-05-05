-- =====================================================================
-- Swaggy Studio — initial schema
-- Run this in the Supabase SQL editor on a fresh project.
-- =====================================================================

-- --------- Extensions ---------
create extension if not exists "pgcrypto";
create extension if not exists "pgsodium";

-- --------- Enums ---------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'post_status') then
    create type post_status as enum ('draft', 'posted', 'scheduled');
  end if;

  if not exists (select 1 from pg_type where typname = 'caption_language') then
    -- Captions are English-only for now. Older deployments may still have
    -- additional values in this enum; Postgres can't drop them safely, so
    -- application code should ignore anything other than 'english'.
    create type caption_language as enum ('english');
  end if;
end $$;

-- Safe to run on projects where the enum was created before 'scheduled' existed.
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumtypid = 'post_status'::regtype
      and enumlabel = 'scheduled'
  ) then
    alter type post_status add value 'scheduled';
  end if;
end $$;

-- =====================================================================
-- Table: posts
-- =====================================================================
create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  photo_url     text not null,
  caption       text not null default '',
  status        post_status not null default 'draft',
  fb_page_id    text,
  fb_post_id    text,
  platform      text,
  post_type     text,
  scheduled_at  timestamptz,
  created_at    timestamptz not null default now(),
  posted_at     timestamptz
);

-- Additive columns for projects created before these existed.
alter table public.posts add column if not exists scheduled_at timestamptz;
alter table public.posts add column if not exists platform text;
alter table public.posts add column if not exists post_type text;

create index if not exists posts_user_id_created_at_idx
  on public.posts (user_id, created_at desc);

alter table public.posts enable row level security;

drop policy if exists "posts_select_own" on public.posts;
create policy "posts_select_own" on public.posts
  for select using (auth.uid() = user_id);

drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own" on public.posts
  for insert with check (auth.uid() = user_id);

drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own" on public.posts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own" on public.posts
  for delete using (auth.uid() = user_id);

-- =====================================================================
-- Table: user_settings
-- =====================================================================
create table if not exists public.user_settings (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  fb_access_token      text,           -- legacy plaintext column; migrate to fb_access_token_encrypted
  fb_access_token_encrypted text,       -- encrypted by the app with a server-side key before storage
  fb_page_id           text,
  fb_page_name         text,
  language             caption_language not null default 'english',
  business_description text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Safe to run repeatedly on projects created before fb_page_name existed.
alter table public.user_settings
  add column if not exists fb_page_name text;

alter table public.user_settings
  add column if not exists fb_access_token_encrypted text;

comment on column public.user_settings.fb_access_token is
  'Legacy plaintext token storage. New writes should set this to null.';

comment on column public.user_settings.fb_access_token_encrypted is
  'Encrypted Facebook Page token. Rotate FACEBOOK_TOKEN_ENCRYPTION_KEY if exposed.';

alter table public.user_settings enable row level security;

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own" on public.user_settings
  for select using (auth.uid() = user_id);

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own" on public.user_settings
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own" on public.user_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_settings_delete_own" on public.user_settings;
create policy "user_settings_delete_own" on public.user_settings
  for delete using (auth.uid() = user_id);

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Storage: post-photos bucket
-- Authenticated users can upload to a folder that matches their UID.
-- Everyone can read (public).
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('post-photos', 'post-photos', true)
on conflict (id) do update set public = excluded.public;

-- Public read of objects in this bucket
drop policy if exists "post_photos_public_read" on storage.objects;
create policy "post_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'post-photos');

-- Authenticated users can upload into a folder named after their uid
drop policy if exists "post_photos_auth_insert" on storage.objects;
create policy "post_photos_auth_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can update/delete only their own objects
drop policy if exists "post_photos_auth_update" on storage.objects;
create policy "post_photos_auth_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "post_photos_auth_delete" on storage.objects;
create policy "post_photos_auth_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================================
-- Table: caption_usage  (daily rate limiting for /api/generate-caption)
-- =====================================================================
create table if not exists public.caption_usage (
  user_id   uuid not null references auth.users(id) on delete cascade,
  day       date not null,
  count     integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.caption_usage enable row level security;

drop policy if exists "caption_usage_select_own" on public.caption_usage;
create policy "caption_usage_select_own" on public.caption_usage
  for select using (auth.uid() = user_id);

-- Writes happen via the SECURITY DEFINER RPC below, so no insert/update
-- policies are needed here.

-- Atomic increment + read. Returns the NEW count after incrementing.
-- The caller enforces the daily cap based on the returned number.
create or replace function public.increment_caption_usage()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'UTC')::date;
  new_count integer;
begin
  if uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  insert into public.caption_usage (user_id, day, count)
  values (uid, today, 1)
  on conflict (user_id, day)
  do update set count = public.caption_usage.count + 1,
                updated_at = now()
  returning count into new_count;

  return new_count;
end;
$$;

revoke all on function public.increment_caption_usage() from public;
grant execute on function public.increment_caption_usage() to authenticated;
-- =====================================================================
-- Swaggy Studio — credit system + connections (Phase 1 patch)
-- Append this to supabase/schema.sql (or run separately in SQL editor).
-- Idempotent: safe to run multiple times.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Extend user_settings with credit columns
-- ---------------------------------------------------------------------
alter table public.user_settings
  add column if not exists credits_balance integer not null default 100,
  add column if not exists unlimited_credits boolean not null default false,
  add column if not exists is_master boolean not null default false;

comment on column public.user_settings.credits_balance is
  'Available credits for paid tool actions. Decremented by spend_credits().';
comment on column public.user_settings.unlimited_credits is
  'When true, spend_credits() is a no-op for this user (master / dev accounts).';
comment on column public.user_settings.is_master is
  'Internal admin flag — currently mirrors unlimited_credits. Reserved for future role logic.';

-- ---------------------------------------------------------------------
-- 2. Credit ledger
-- ---------------------------------------------------------------------
create table if not exists public.credit_ledger (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  delta        integer not null,            -- negative=spend, positive=topup, 0=unlimited record
  reason       text not null,               -- 'caption_generate', 'topup', 'caption_generate_refund', etc.
  tool         text,                        -- 'caption' | 'image' | 'campaign' | 'blast' | null
  metadata     jsonb default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists credit_ledger_user_idx
  on public.credit_ledger (user_id, created_at desc);

alter table public.credit_ledger enable row level security;

drop policy if exists "credit_ledger_select_own" on public.credit_ledger;
create policy "credit_ledger_select_own" on public.credit_ledger
  for select using (auth.uid() = user_id);

-- writes happen via SECURITY DEFINER RPCs below; no direct insert/update policy

-- ---------------------------------------------------------------------
-- 3. spend_credits() — atomic, raises 'insufficient_credits' if broke
-- ---------------------------------------------------------------------
create or replace function public.spend_credits(
  p_amount integer,
  p_reason text,
  p_tool text default null,
  p_metadata jsonb default '{}'::jsonb
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  unlimited boolean;
  current_balance integer;
  new_balance integer;
begin
  if uid is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if p_amount <= 0 then raise exception 'invalid_amount'; end if;

  select unlimited_credits, credits_balance
    into unlimited, current_balance
  from public.user_settings
  where user_id = uid
  for update;

  -- auto-provision if no settings row yet
  if not found then
    insert into public.user_settings (user_id) values (uid);
    select unlimited_credits, credits_balance
      into unlimited, current_balance
    from public.user_settings
    where user_id = uid
    for update;
  end if;

  if unlimited then
    insert into public.credit_ledger (user_id, delta, reason, tool, metadata)
    values (uid, 0, p_reason, p_tool, p_metadata || jsonb_build_object('unlimited', true));
    return current_balance;
  end if;

  if current_balance < p_amount then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;

  update public.user_settings
    set credits_balance = credits_balance - p_amount,
        updated_at = now()
    where user_id = uid
    returning credits_balance into new_balance;

  insert into public.credit_ledger (user_id, delta, reason, tool, metadata)
  values (uid, -p_amount, p_reason, p_tool, p_metadata);

  return new_balance;
end $$;

revoke all on function public.spend_credits(integer, text, text, jsonb) from public;
grant execute on function public.spend_credits(integer, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 4. add_credits() — for topups
-- ---------------------------------------------------------------------
create or replace function public.add_credits(
  p_amount integer,
  p_reason text default 'topup',
  p_metadata jsonb default '{}'::jsonb
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  new_balance integer;
begin
  if uid is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if p_amount <= 0 then raise exception 'invalid_amount'; end if;

  insert into public.user_settings (user_id, credits_balance)
  values (uid, p_amount)
  on conflict (user_id) do update
    set credits_balance = public.user_settings.credits_balance + p_amount,
        updated_at = now()
  returning credits_balance into new_balance;

  insert into public.credit_ledger (user_id, delta, reason, metadata)
  values (uid, p_amount, p_reason, p_metadata);

  return new_balance;
end $$;

revoke all on function public.add_credits(integer, text, jsonb) from public;
grant execute on function public.add_credits(integer, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 5. refund_credits() — for tool failures after spend
-- ---------------------------------------------------------------------
create or replace function public.refund_credits(
  p_amount integer,
  p_reason text,
  p_tool text default null,
  p_metadata jsonb default '{}'::jsonb
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  unlimited boolean;
  new_balance integer;
begin
  if uid is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if p_amount <= 0 then raise exception 'invalid_amount'; end if;

  select unlimited_credits into unlimited
  from public.user_settings
  where user_id = uid
  for update;

  if unlimited then return null; end if;

  update public.user_settings
    set credits_balance = credits_balance + p_amount,
        updated_at = now()
    where user_id = uid
    returning credits_balance into new_balance;

  insert into public.credit_ledger (user_id, delta, reason, tool, metadata)
  values (uid, p_amount, p_reason || '_refund', p_tool, p_metadata);

  return new_balance;
end $$;

revoke all on function public.refund_credits(integer, text, text, jsonb) from public;
grant execute on function public.refund_credits(integer, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 6. connections — generalized social account integration
-- ---------------------------------------------------------------------
create table if not exists public.connections (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  provider        text not null,                -- 'facebook'|'instagram'|'tiktok'|'twitter'|'linkedin'|'gmail'|'twilio'
  provider_account_id text,                     -- e.g. FB Page ID, IG Business ID
  display_name    text,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  expires_at      timestamptz,
  scopes          text[],
  metadata        jsonb default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, provider, provider_account_id)
);

create index if not exists connections_user_idx
  on public.connections (user_id, provider);

alter table public.connections enable row level security;

drop policy if exists "connections_select_own" on public.connections;
create policy "connections_select_own" on public.connections
  for select using (auth.uid() = user_id);

drop policy if exists "connections_delete_own" on public.connections;
create policy "connections_delete_own" on public.connections
  for delete using (auth.uid() = user_id);

-- writes happen via service role from API callbacks; no insert/update policy

drop trigger if exists connections_set_updated_at on public.connections;
create trigger connections_set_updated_at
  before update on public.connections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 7. Master user seed (for dev / DEV_BYPASS_AUTH)
-- ---------------------------------------------------------------------
-- NOTE: this assumes you have inserted a row into auth.users with this UUID,
-- OR that you've disabled FK enforcement in dev. If neither, run this AFTER
-- creating the auth user via Supabase dashboard or signup.
do $$
begin
  if exists (select 1 from auth.users where id = '00000000-0000-4000-8000-000000000000') then
    insert into public.user_settings (user_id, is_master, unlimited_credits, credits_balance)
    values ('00000000-0000-4000-8000-000000000000', true, true, 999999)
    on conflict (user_id) do update
      set is_master = true,
          unlimited_credits = true;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 8. Deprecate old caption_usage rate limiter (replaced by credit_ledger)
-- ---------------------------------------------------------------------
comment on table public.caption_usage is
  'DEPRECATED — replaced by credit_ledger. Keep for historical data, do not write to it.';
-- We do NOT drop it yet (preserve history). Drop in a later cleanup migration.


-- =====================================================================
-- Phase 2A: Marketplace foundation (run in Supabase SQL editor)
-- =====================================================================

-- =====================================================================
-- Swaggy Studio — Marketplace schema (Phase 2A creates the full thing)
-- Append this to supabase/schema.sql or run separately in SQL editor.
-- Idempotent: safe to run multiple times.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. active_mode column on user_settings
-- ---------------------------------------------------------------------
alter table public.user_settings
  add column if not exists active_mode text default 'brand';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_settings_active_mode_check'
  ) then
    alter table public.user_settings
      add constraint user_settings_active_mode_check
      check (active_mode in ('brand','partner'));
  end if;
end $$;

comment on column public.user_settings.active_mode is
  'Which role the user is currently acting as. Brand or partner.';

-- ---------------------------------------------------------------------
-- 1. brand_profile
-- ---------------------------------------------------------------------
create table if not exists public.brand_profile (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  company_name     text not null,
  website          text,
  industry         text,
  description      text,
  logo_url         text,
  contact_email    text,
  verified         boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.brand_profile enable row level security;

drop policy if exists "brand_profile_select_own" on public.brand_profile;
create policy "brand_profile_select_own" on public.brand_profile
  for select using (auth.uid() = user_id);

drop policy if exists "brand_profile_insert_own" on public.brand_profile;
create policy "brand_profile_insert_own" on public.brand_profile
  for insert with check (auth.uid() = user_id);

drop policy if exists "brand_profile_update_own" on public.brand_profile;
create policy "brand_profile_update_own" on public.brand_profile
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "brand_profile_delete_own" on public.brand_profile;
create policy "brand_profile_delete_own" on public.brand_profile
  for delete using (auth.uid() = user_id);

-- Brand profile is also publicly readable (for gig pages showing the brand).
drop policy if exists "brand_profile_public_read" on public.brand_profile;
create policy "brand_profile_public_read" on public.brand_profile
  for select to authenticated using (true);

drop trigger if exists brand_profile_set_updated_at on public.brand_profile;
create trigger brand_profile_set_updated_at
  before update on public.brand_profile
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 2. partner_profile (structured + free-text)
-- ---------------------------------------------------------------------
create table if not exists public.partner_profile (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  display_name       text not null,
  partner_type       text not null
    check (partner_type in ('blogger','influencer','journalist','outlet','creator')),
  bio                text,
  niches             text[] not null default '{}',
  region             text,
  audience_size      integer,
  audience_size_band text generated always as (
    case
      when audience_size is null then 'unknown'
      when audience_size < 1000 then 'nano'
      when audience_size < 10000 then 'micro'
      when audience_size < 100000 then 'mid'
      when audience_size < 1000000 then 'macro'
      else 'mega'
    end
  ) stored,
  primary_outlet     text,
  outlet_url         text,
  portfolio_links    text[] not null default '{}',
  rate_card_min      integer,
  rate_card_max      integer,
  keywords           text[] not null default '{}',
  verified           boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists partner_profile_niches_idx
  on public.partner_profile using gin (niches);
create index if not exists partner_profile_keywords_idx
  on public.partner_profile using gin (keywords);
create index if not exists partner_profile_band_idx
  on public.partner_profile (audience_size_band);

alter table public.partner_profile enable row level security;

drop policy if exists "partner_profile_select_authenticated" on public.partner_profile;
create policy "partner_profile_select_authenticated" on public.partner_profile
  for select to authenticated using (true);

drop policy if exists "partner_profile_insert_own" on public.partner_profile;
create policy "partner_profile_insert_own" on public.partner_profile
  for insert with check (auth.uid() = user_id);

drop policy if exists "partner_profile_update_own" on public.partner_profile;
create policy "partner_profile_update_own" on public.partner_profile
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "partner_profile_delete_own" on public.partner_profile;
create policy "partner_profile_delete_own" on public.partner_profile
  for delete using (auth.uid() = user_id);

drop trigger if exists partner_profile_set_updated_at on public.partner_profile;
create trigger partner_profile_set_updated_at
  before update on public.partner_profile
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. pr_gigs (the projects)
-- ---------------------------------------------------------------------
create table if not exists public.pr_gigs (
  id                uuid primary key default gen_random_uuid(),
  brand_id          uuid not null references auth.users(id) on delete cascade,
  title             text not null,
  brief             text not null,
  deliverables      jsonb not null default '[]'::jsonb,
  budget_min        integer,
  budget_max        integer,
  budget_currency   text not null default 'PHP',
  deadline          timestamptz,
  niches            text[] not null default '{}',
  region            text,
  audience_size_min integer,
  audience_size_max integer,
  partner_types     text[] not null default '{}',
  status            text not null default 'draft'
    check (status in ('draft','open','reviewing','awarded','in_progress','completed','cancelled')),
  mode              text not null default 'open'
    check (mode in ('open','invite_only')),
  applications_count     integer not null default 0,
  awarded_application_id uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  published_at      timestamptz
);

create index if not exists pr_gigs_status_idx on public.pr_gigs (status, created_at desc);
create index if not exists pr_gigs_brand_idx on public.pr_gigs (brand_id, created_at desc);
create index if not exists pr_gigs_niches_idx on public.pr_gigs using gin (niches);
create index if not exists pr_gigs_open_idx
  on public.pr_gigs (created_at desc) where status = 'open';

alter table public.pr_gigs enable row level security;

drop policy if exists "pr_gigs_select_open" on public.pr_gigs;
create policy "pr_gigs_select_open" on public.pr_gigs
  for select to authenticated
  using (status in ('open','reviewing','awarded','in_progress','completed') or auth.uid() = brand_id);

drop policy if exists "pr_gigs_insert_brand" on public.pr_gigs;
create policy "pr_gigs_insert_brand" on public.pr_gigs
  for insert
  with check (
    auth.uid() = brand_id
    and exists (select 1 from public.brand_profile bp where bp.user_id = auth.uid())
  );

drop policy if exists "pr_gigs_update_own" on public.pr_gigs;
create policy "pr_gigs_update_own" on public.pr_gigs
  for update using (auth.uid() = brand_id) with check (auth.uid() = brand_id);

drop policy if exists "pr_gigs_delete_own" on public.pr_gigs;
create policy "pr_gigs_delete_own" on public.pr_gigs
  for delete using (auth.uid() = brand_id);

drop trigger if exists pr_gigs_set_updated_at on public.pr_gigs;
create trigger pr_gigs_set_updated_at
  before update on public.pr_gigs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. kanban_columns (per-user customizable kanban)
-- ---------------------------------------------------------------------
create table if not exists public.kanban_columns (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  scope        text not null,
  status_key   text not null,
  display_name text not null,
  position     integer not null,
  color        text,
  archived     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, scope, status_key)
);

create index if not exists kanban_columns_user_idx
  on public.kanban_columns (user_id, scope, position);

alter table public.kanban_columns enable row level security;

drop policy if exists "kanban_columns_select_own" on public.kanban_columns;
create policy "kanban_columns_select_own" on public.kanban_columns
  for select using (auth.uid() = user_id);

drop policy if exists "kanban_columns_insert_own" on public.kanban_columns;
create policy "kanban_columns_insert_own" on public.kanban_columns
  for insert with check (auth.uid() = user_id);

drop policy if exists "kanban_columns_update_own" on public.kanban_columns;
create policy "kanban_columns_update_own" on public.kanban_columns
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "kanban_columns_delete_own" on public.kanban_columns;
create policy "kanban_columns_delete_own" on public.kanban_columns
  for delete using (auth.uid() = user_id);

drop trigger if exists kanban_columns_set_updated_at on public.kanban_columns;
create trigger kanban_columns_set_updated_at
  before update on public.kanban_columns
  for each row execute function public.set_updated_at();

-- Function: seed default brand-gig kanban columns for a user (idempotent)
create or replace function public.seed_default_kanban_columns(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  defaults jsonb := '[
    {"key":"draft","name":"Draft","pos":0,"color":"#3d2d80"},
    {"key":"open","name":"Live","pos":1,"color":"#7b2ff7"},
    {"key":"reviewing","name":"Reviewing","pos":2,"color":"#f7c948"},
    {"key":"awarded","name":"Awarded","pos":3,"color":"#67e8f9"},
    {"key":"in_progress","name":"In Progress","pos":4,"color":"#a855f7"},
    {"key":"completed","name":"Completed","pos":5,"color":"#34d399"},
    {"key":"cancelled","name":"Archived","pos":6,"color":"#f87171"}
  ]'::jsonb;
  rec jsonb;
begin
  if p_user_id is null then return; end if;

  for rec in select * from jsonb_array_elements(defaults) loop
    insert into public.kanban_columns (user_id, scope, status_key, display_name, position, color)
    values (
      p_user_id,
      'brand_gigs',
      rec->>'key',
      rec->>'name',
      (rec->>'pos')::integer,
      rec->>'color'
    )
    on conflict (user_id, scope, status_key) do nothing;
  end loop;
end $$;

grant execute on function public.seed_default_kanban_columns(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. applications
-- ---------------------------------------------------------------------
create table if not exists public.applications (
  id              uuid primary key default gen_random_uuid(),
  gig_id          uuid not null references public.pr_gigs(id) on delete cascade,
  partner_id      uuid not null references auth.users(id) on delete cascade,
  proposal        text not null,
  proposed_rate   integer,
  estimated_delivery timestamptz,
  status          text not null default 'submitted'
    check (status in ('submitted','shortlisted','accepted','rejected','withdrawn')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (gig_id, partner_id)
);

create index if not exists applications_gig_idx on public.applications (gig_id, status);
create index if not exists applications_partner_idx
  on public.applications (partner_id, created_at desc);

alter table public.applications enable row level security;

-- Partners see their own applications. Brands see applications to gigs they own.
drop policy if exists "applications_select_visible" on public.applications;
create policy "applications_select_visible" on public.applications
  for select to authenticated
  using (
    auth.uid() = partner_id
    or auth.uid() in (select brand_id from public.pr_gigs where id = applications.gig_id)
  );

-- Only partners (with profile) can apply, and only to open gigs.
drop policy if exists "applications_insert_partner" on public.applications;
create policy "applications_insert_partner" on public.applications
  for insert
  with check (
    auth.uid() = partner_id
    and exists (select 1 from public.partner_profile pp where pp.user_id = auth.uid())
    and exists (select 1 from public.pr_gigs g where g.id = gig_id and g.status = 'open')
  );

-- Partner can update their own (e.g. withdraw); brand can update status (shortlist/accept/reject).
drop policy if exists "applications_update_visible" on public.applications;
create policy "applications_update_visible" on public.applications
  for update to authenticated
  using (
    auth.uid() = partner_id
    or auth.uid() in (select brand_id from public.pr_gigs where id = applications.gig_id)
  );

drop trigger if exists applications_set_updated_at on public.applications;
create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 6. message_threads + messages
-- ---------------------------------------------------------------------
create table if not exists public.message_threads (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null unique references public.applications(id) on delete cascade,
  brand_id        uuid not null references auth.users(id) on delete cascade,
  partner_id      uuid not null references auth.users(id) on delete cascade,
  last_message_at timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.message_threads(id) on delete cascade,
  sender_id   uuid not null references auth.users(id) on delete cascade,
  body        text not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists messages_thread_idx on public.messages (thread_id, created_at);

alter table public.message_threads enable row level security;
alter table public.messages enable row level security;

drop policy if exists "message_threads_select_party" on public.message_threads;
create policy "message_threads_select_party" on public.message_threads
  for select using (auth.uid() in (brand_id, partner_id));

drop policy if exists "messages_select_thread_party" on public.messages;
create policy "messages_select_thread_party" on public.messages
  for select using (
    auth.uid() in (
      select brand_id from public.message_threads where id = messages.thread_id
      union
      select partner_id from public.message_threads where id = messages.thread_id
    )
  );

drop policy if exists "messages_insert_party" on public.messages;
create policy "messages_insert_party" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and auth.uid() in (
      select brand_id from public.message_threads where id = messages.thread_id
      union
      select partner_id from public.message_threads where id = messages.thread_id
    )
  );

-- ---------------------------------------------------------------------
-- 7. contracts (skeleton; wired in 2D)
-- ---------------------------------------------------------------------
create table if not exists public.contracts (
  id              uuid primary key default gen_random_uuid(),
  gig_id          uuid not null references public.pr_gigs(id) on delete cascade,
  application_id  uuid not null unique references public.applications(id) on delete cascade,
  brand_id        uuid not null references auth.users(id) on delete cascade,
  partner_id      uuid not null references auth.users(id) on delete cascade,
  amount          integer not null,
  currency        text not null default 'PHP',
  terms           text,
  deliverable_due timestamptz,
  state           text not null default 'awarded'
    check (state in ('awarded','delivered','approved','disputed','cancelled','completed')),
  created_at      timestamptz not null default now(),
  delivered_at    timestamptz,
  approved_at     timestamptz,
  completed_at    timestamptz
);

create index if not exists contracts_brand_idx on public.contracts (brand_id, created_at desc);
create index if not exists contracts_partner_idx on public.contracts (partner_id, created_at desc);

alter table public.contracts enable row level security;

drop policy if exists "contracts_select_party" on public.contracts;
create policy "contracts_select_party" on public.contracts
  for select using (auth.uid() in (brand_id, partner_id));

-- ---------------------------------------------------------------------
-- 8. payouts (skeleton; coordination wired in 2D, escrow in 2E)
-- ---------------------------------------------------------------------
create table if not exists public.payouts (
  id              uuid primary key default gen_random_uuid(),
  contract_id     uuid not null unique references public.contracts(id) on delete cascade,
  amount          integer not null,
  currency        text not null default 'PHP',
  mode            text not null default 'coordination'
    check (mode in ('coordination','escrow')),
  state           text not null default 'pending'
    check (state in ('pending','funded','held','released','refunded','cancelled')),
  brand_marked_paid_at   timestamptz,
  brand_payment_proof_url text,
  partner_confirmed_at    timestamptz,
  escrow_funded_at        timestamptz,
  escrow_released_at      timestamptz,
  escrow_provider         text,
  escrow_external_ref     text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists payouts_state_idx on public.payouts (state, created_at desc);

alter table public.payouts enable row level security;

drop policy if exists "payouts_select_party" on public.payouts;
create policy "payouts_select_party" on public.payouts
  for select using (
    auth.uid() in (
      select brand_id from public.contracts where id = payouts.contract_id
      union
      select partner_id from public.contracts where id = payouts.contract_id
    )
  );

drop trigger if exists payouts_set_updated_at on public.payouts;
create trigger payouts_set_updated_at
  before update on public.payouts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 9. Helper RPC: switch active mode
-- ---------------------------------------------------------------------
create or replace function public.set_active_mode(p_mode text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  has_brand boolean;
  has_partner boolean;
begin
  if uid is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if p_mode not in ('brand','partner') then
    raise exception 'invalid_mode';
  end if;

  select exists(select 1 from public.brand_profile where user_id = uid),
         exists(select 1 from public.partner_profile where user_id = uid)
    into has_brand, has_partner;

  if p_mode = 'brand' and not has_brand then
    raise exception 'no_brand_profile' using errcode = 'P0002';
  end if;
  if p_mode = 'partner' and not has_partner then
    raise exception 'no_partner_profile' using errcode = 'P0002';
  end if;

  insert into public.user_settings (user_id, active_mode)
  values (uid, p_mode)
  on conflict (user_id) do update
    set active_mode = p_mode, updated_at = now();

  return p_mode;
end $$;

grant execute on function public.set_active_mode(text) to authenticated;

-- ---------------------------------------------------------------------
-- 10. View: gig with brand info (used by browse feed)
-- ---------------------------------------------------------------------
create or replace view public.pr_gigs_with_brand as
select
  g.*,
  bp.company_name as brand_company_name,
  bp.industry     as brand_industry,
  bp.logo_url     as brand_logo_url,
  bp.verified     as brand_verified
from public.pr_gigs g
join public.brand_profile bp on bp.user_id = g.brand_id;

-- (RLS on the underlying tables governs visibility through this view.)

-- =====================================================================
-- Storage bucket: generated-images
-- =====================================================================
-- Creates a public bucket for AI-generated images. Each user can upload
-- only to a folder named after their auth.uid; reads are public.
-- Run once; safe to re-run.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-images',
  'generated-images',
  true,
  10 * 1024 * 1024,
  array['image/png', 'image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users can upload to their own folder" on storage.objects;
create policy "users can upload to their own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'generated-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "public read access for generated images" on storage.objects;
create policy "public read access for generated images" on storage.objects
  for select to public
  using (bucket_id = 'generated-images');

drop policy if exists "users can delete their own generated images" on storage.objects;
create policy "users can delete their own generated images" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'generated-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================================
-- Library — saved AI generations
-- =====================================================================
-- Save-on-pick: only persists when the user clicks "Use this" on a
-- generation. Items are immutable (no update policy) — delete and redo
-- if you want to change something.

create table if not exists public.library_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null check (kind in ('caption', 'image', 'campaign')),
  title         text not null,
  payload       jsonb not null default '{}'::jsonb,
  thumbnail_url text,
  metadata      jsonb default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists library_items_user_idx
  on public.library_items (user_id, created_at desc);
create index if not exists library_items_kind_idx
  on public.library_items (user_id, kind, created_at desc);

alter table public.library_items enable row level security;

drop policy if exists "library_items_select_own" on public.library_items;
create policy "library_items_select_own" on public.library_items
  for select using (auth.uid() = user_id);

drop policy if exists "library_items_insert_own" on public.library_items;
create policy "library_items_insert_own" on public.library_items
  for insert with check (auth.uid() = user_id);

drop policy if exists "library_items_delete_own" on public.library_items;
create policy "library_items_delete_own" on public.library_items
  for delete using (auth.uid() = user_id);



-- ---------------------------------------------------------------------------
-- Library: allow press_release as a kind (idempotent)
-- ---------------------------------------------------------------------------
alter table public.library_items
  drop constraint if exists library_items_kind_check;
alter table public.library_items
  add constraint library_items_kind_check
  check (kind in ('caption', 'image', 'campaign', 'press_release'));

-- =====================================================================
-- Account profile fields on user_settings (idempotent)
-- Allows users to edit their display info from /settings/account.
-- =====================================================================
alter table public.user_settings
  add column if not exists first_name text,
  add column if not exists last_name  text,
  add column if not exists username   text;

-- Username should be unique when present.
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'user_settings_username_unique'
  ) then
    create unique index user_settings_username_unique
      on public.user_settings ((lower(username)))
      where username is not null;
  end if;
end $$;
