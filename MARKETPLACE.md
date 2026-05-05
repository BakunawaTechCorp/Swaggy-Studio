# Marketplace Framework

**Drop this in your repo root next to FRAMEWORK.md. `@MARKETPLACE.md` it in every Cursor prompt for marketplace work.**

This is a separate framework doc for the marketplace sub-product because it's substantial enough to warrant its own architectural treatment. The main FRAMEWORK.md still governs the AI tools (caption, image, campaign, blast).

---

## 1. Product thesis

A two-sided PR marketplace inside Swaggy Studio.

**Side A — Brands:** companies, solo founders, agencies who want media coverage. Post a "PR Project" (gig) with a brief, budget, deliverables, deadline.

**Side B — Media Partners:** bloggers, micro-influencers, journalists, niche outlets. Browse open gigs, apply with a proposal + rate, get awarded, deliver, get paid.

**Same auth, dual roles per account.** A user toggles between Brand mode and Partner mode in the topbar. Both modes are unlocked once a user creates the corresponding profile.

---

## 2. The 5 phases

| Phase | Scope | Days | Ship to |
|---|---|---|---|
| **2A** | Foundation: roles, profiles, schema, role-toggle UI | 4 | staging |
| **2B** | Listings: brand posts gigs, partners browse, brand kanban for posted gigs | 5 | staging |
| **2C** | Applications + messaging: apply, threads, accept/reject | 5 | soft-launch |
| **2D** | Coordination: award flow, deliverable tracking, "mark as paid" on trust | 3 | **public flip** |
| **2E** | Real escrow: payment intake, hold, release, refund (behind feature flag) | 5 | flip when legal greenlights |

---

## 3. Architecture

```
                            ┌────────────────────────┐
                            │   AUTH (shared)        │
                            │   Supabase auth.users  │
                            └───────────┬────────────┘
                                        │
                        ┌───────────────┼───────────────┐
                        ▼                               ▼
              ┌──────────────────┐            ┌──────────────────┐
              │  brand_profile   │            │ partner_profile  │
              │  one per user    │            │ one per user     │
              │  (optional)      │            │ (optional)       │
              └────────┬─────────┘            └────────┬─────────┘
                       │ posts                         │ applies
                       ▼                               ▼
              ┌──────────────────────────────────────────────┐
              │                  pr_gigs                     │
              │  brand_id, title, brief, budget, deadline,   │
              │  niches[], status, mode='open'               │
              └────────┬─────────────────────────────────────┘
                       │
                       ▼
              ┌──────────────────┐         ┌──────────────────┐
              │  applications    │ ◄─────► │   messages       │
              │  partner_id,     │         │  per-application │
              │  proposal, rate, │         │  thread          │
              │  status          │         └──────────────────┘
              └────────┬─────────┘
                       │ on accept
                       ▼
              ┌──────────────────┐         ┌──────────────────┐
              │   contracts      │ ───►    │     payouts      │
              │   awarded gig    │         │  amount, state   │
              │   + partner      │         │  (coord/escrow)  │
              └──────────────────┘         └──────────────────┘
```

---

## 4. Schema (Phase 2A delivers all of these)

The full marketplace schema gets created in 2A even though only the role/profile parts are wired in 2A. Reason: writing the full schema upfront means we don't migrate the same tables three more times across phases.

### 4.1 Roles + active mode

```sql
-- A user can be a brand, a partner, both, or neither (default).
-- "Active mode" is the role they're currently using; persisted on user_settings.

alter table public.user_settings
  add column if not exists active_mode text default 'brand'
    check (active_mode in ('brand', 'partner'));

comment on column public.user_settings.active_mode is
  'Which role the user is currently acting as. UI uses this for nav + filters.';
```

A user is "a brand" if they have a row in `brand_profile`. "A partner" if they have a row in `partner_profile`. They can have both. The toggle in the topbar flips `active_mode`.

### 4.2 Brand profile

```sql
create table if not exists public.brand_profile (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  company_name     text not null,
  website          text,
  industry         text,                       -- 'fashion', 'food', 'tech', 'beauty', 'travel', 'other'
  description      text,
  logo_url         text,
  contact_email    text,
  verified         boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
```

### 4.3 Partner profile (structured + free-text per your decision)

```sql
create table if not exists public.partner_profile (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  display_name       text not null,
  partner_type       text not null,             -- 'blogger' | 'influencer' | 'journalist' | 'outlet' | 'creator'
  bio                text,                      -- free-text "about me"
  niches             text[] not null default '{}',  -- structured: ['fashion','beauty']
  region             text,                      -- 'NCR' | 'Cebu' | 'Davao' | 'PH-nationwide' | 'international'
  audience_size      integer,                   -- followers/monthly readers
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
  primary_outlet     text,                      -- 'Instagram' | 'TikTok' | 'YouTube' | website
  outlet_url         text,                      -- main link
  portfolio_links    text[] not null default '{}',
  rate_card_min      integer,                   -- PHP per post / engagement, optional
  rate_card_max      integer,
  keywords           text[] not null default '{}',  -- free-text-ish: ['streetwear','sustainability']
  verified           boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists partner_profile_niches_idx on public.partner_profile using gin (niches);
create index if not exists partner_profile_keywords_idx on public.partner_profile using gin (keywords);
```

### 4.4 PR Gigs (the projects)

```sql
create table if not exists public.pr_gigs (
  id                uuid primary key default gen_random_uuid(),
  brand_id          uuid not null references auth.users(id) on delete cascade,
  title             text not null,
  brief             text not null,
  deliverables      jsonb not null default '[]'::jsonb,   -- [{type:'instagram_post', count:1, ...}]
  budget_min        integer,
  budget_max        integer,
  budget_currency   text not null default 'PHP',
  deadline          timestamptz,
  niches            text[] not null default '{}',
  region            text,                                  -- target region for partners
  audience_size_min integer,
  audience_size_max integer,
  partner_types     text[] not null default '{}',          -- which partner_types they want
  status            text not null default 'draft'
    check (status in ('draft','open','reviewing','awarded','in_progress','completed','cancelled')),
  -- Customizable kanban: status above is the ground truth, but each brand
  -- can rename/reorder columns for their UI. We store that per-user.
  mode              text not null default 'open'
    check (mode in ('open','invite_only')),       -- 'open' for v1
  applications_count integer not null default 0,
  awarded_application_id uuid,                    -- backref to the chosen application
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  published_at      timestamptz                  -- null until first moved off draft
);

create index if not exists pr_gigs_status_idx on public.pr_gigs (status, created_at desc);
create index if not exists pr_gigs_brand_idx on public.pr_gigs (brand_id, created_at desc);
create index if not exists pr_gigs_niches_idx on public.pr_gigs using gin (niches);
```

### 4.5 Per-user kanban column config (the customizable part)

```sql
create table if not exists public.kanban_columns (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  scope        text not null,                  -- 'brand_gigs' (Phase 2B); future: 'partner_apps'
  status_key   text not null,                  -- maps to pr_gigs.status values
  display_name text not null,                  -- 'Backlog', 'Up Next', 'Live', etc.
  position     integer not null,
  color        text,
  archived     boolean not null default false,
  unique (user_id, scope, status_key)
);

create index if not exists kanban_columns_user_idx
  on public.kanban_columns (user_id, scope, position);
```

Each user gets seeded with default columns the first time they enter the kanban. They can rename them, reorder via drag, or hide some — but the underlying `pr_gigs.status` enum stays fixed (otherwise filters/queries become a nightmare).

### 4.6 Applications

```sql
create table if not exists public.applications (
  id              uuid primary key default gen_random_uuid(),
  gig_id          uuid not null references public.pr_gigs(id) on delete cascade,
  partner_id      uuid not null references auth.users(id) on delete cascade,
  proposal        text not null,
  proposed_rate   integer,                          -- PHP, partner's quote
  estimated_delivery timestamptz,
  status          text not null default 'submitted'
    check (status in ('submitted','shortlisted','accepted','rejected','withdrawn')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (gig_id, partner_id)                       -- one application per partner per gig
);

create index if not exists applications_gig_idx on public.applications (gig_id, status);
create index if not exists applications_partner_idx on public.applications (partner_id, created_at desc);
```

### 4.7 Messages (per-application threads)

```sql
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
```

### 4.8 Contracts + payouts (skeleton in 2A, wired in 2D/2E)

```sql
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

-- Payouts: in 2D this is "coordination-only" — just tracks state, no money.
-- In 2E the same table gets used for real escrow.
create table if not exists public.payouts (
  id              uuid primary key default gen_random_uuid(),
  contract_id     uuid not null unique references public.contracts(id) on delete cascade,
  amount          integer not null,
  currency        text not null default 'PHP',
  mode            text not null default 'coordination'
    check (mode in ('coordination','escrow')),
  state           text not null default 'pending'
    check (state in ('pending','funded','held','released','refunded','cancelled')),
  -- Coordination mode: brand uploads receipt, partner confirms. No money in our hands.
  brand_marked_paid_at   timestamptz,
  brand_payment_proof_url text,
  partner_confirmed_at    timestamptz,
  -- Escrow mode (2E only): real money fields
  escrow_funded_at        timestamptz,
  escrow_released_at      timestamptz,
  escrow_provider         text,                  -- 'manual' | 'paymongo' | 'stripe' (2E)
  escrow_external_ref     text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
```

### 4.9 RLS policies

Every table above gets RLS enabled. The pattern:

- `select` policies are scoped: brand sees their own gigs and applications to them; partner sees open gigs and their own applications.
- `insert` policies check role: only users with a `partner_profile` can insert into `applications`; only users with a `brand_profile` can insert into `pr_gigs`.
- `update`/`delete` policies are owner-scoped.

Full SQL is in `marketplace-schema.sql`.

---

## 5. Role + mode model (UX rules)

### 5.1 The toggle

In the topbar, next to the credit balance, a pill: `Brand mode ⇄ Partner mode`. Clicking flips `user_settings.active_mode`. The UI re-fetches state and adjusts:

- **Rail nav:** Brand mode shows Tools (caption/image/etc.) + Projects + Connections. Partner mode shows Browse Gigs + My Applications + Profile.
- **Home dashboard:** Brand mode shows the existing 5-tool grid + a "Recent gigs" panel. Partner mode shows a feed of recommended gigs.
- **Projects route (`/tools/projects`):** Two tabs visible to dual-role users. Brand-mode active → "My posted gigs" tab is default. Partner-mode active → "Browse gigs" is default.

### 5.2 Onboarding gate

A user lands in the app without a profile in the role they're trying to use → we redirect them through `/onboarding/role/[brand|partner]` to fill it out. Once they have at least one profile, they can use that mode. Adding the second mode is a one-form click later.

### 5.3 What "active mode" affects

| Surface | Brand mode | Partner mode |
|---|---|---|
| Topbar greeting | "Welcome back, {company_name}" | "Welcome back, {display_name}" |
| Rail nav | Tools + Projects + Connections | Browse + Applications + Profile |
| `/tools/projects` default tab | "My posted gigs" (kanban) | "Browse gigs" (feed) |
| `/home` content | 5-tool grid + posted gigs widget | Recommended gigs feed |
| Permissions | Can post gigs, message applicants | Can apply, message brands |

### 5.4 What "active mode" does NOT affect

- Auth: same session
- Credits: shared balance (brand-mode tools spend credits; partner-mode is free)
- Connections: shared (a user's FB Page connection works in both modes)
- Settings: shared

This is the dual-role split. Mode = which lens you're currently using.

---

## 6. URL map (after marketplace lands)

```
PUBLIC (unchanged)
/                           landing
/login                      google sign-in
/auth/callback              oauth handoff

APP — SHARED
/home                       role-aware home
/connections                shared
/settings                   shared
/settings/account           shared
/settings/billing           shared (credits)

APP — BRAND TOOLS (Phase 1, unchanged)
/tools/caption              caption generator (1 credit)
/tools/image                image generator (5 credits, Phase 3)
/tools/campaign             campaign generator (10 credits, Phase 4)
/tools/blast                blast (per recipient, Phase 5)

APP — MARKETPLACE (Phase 2)
/tools/projects                   tabs: Browse / My posted gigs (role-aware default)
/tools/projects/new               brand: create a gig (2B)
/tools/projects/[id]              gig detail page (visible to all logged-in)
/tools/projects/[id]/applicants   brand-only: list of applications (2C)
/tools/projects/[id]/edit         brand-only: edit/post gig (2B)

/applications                     partner: my applications list (2C)
/applications/[id]                application + thread (2C)

/messages                         optional: unified inbox (2C+)

/contracts                        list of awarded contracts (2D)
/contracts/[id]                   contract detail + delivery + payment (2D/2E)

/onboarding/role/brand            create brand profile
/onboarding/role/partner          create partner profile

API
/api/marketplace/profile          GET → { brand?, partner?, active_mode }
/api/marketplace/profile/mode     POST → switch active_mode
/api/marketplace/brand-profile    GET, PUT → brand profile CRUD
/api/marketplace/partner-profile  GET, PUT → partner profile CRUD

/api/marketplace/gigs                    GET (browse, partner) | POST (create, brand)
/api/marketplace/gigs/[id]               GET | PATCH | DELETE
/api/marketplace/gigs/[id]/publish       POST (draft→open)
/api/marketplace/gigs/[id]/applicants    GET (brand-only)

/api/marketplace/applications            GET (partner's own) | POST (apply to gig)
/api/marketplace/applications/[id]       GET | PATCH (brand: status; partner: withdraw)

/api/marketplace/messages/[application_id]   GET (thread) | POST (send)

/api/marketplace/contracts               GET (mine) | POST (award)
/api/marketplace/contracts/[id]          GET | PATCH (deliver/approve)
/api/marketplace/contracts/[id]/payment  POST (mark paid / fund escrow)

/api/marketplace/kanban-columns          GET | PUT (save layout)
```

---

## 7. Feature flags (the abstraction that lets 2D ship before 2E)

Add to `lib/features.ts`:

```ts
export const FEATURES = {
  marketplaceEnabled: true,        // 2A onward
  marketplaceMessaging: true,      // 2C+
  marketplaceCoordinationPay: true,// 2D
  marketplaceEscrow: false,        // 2E — flip when legal greenlights
} as const;

export function isFeatureOn<K extends keyof typeof FEATURES>(key: K): boolean {
  return Boolean(FEATURES[key]);
}
```

Routes that touch escrow check `isFeatureOn('marketplaceEscrow')` and 404 / show "coming soon" UI when off. This lets you merge 2E code now and flip later.

---

## 8. What Phase 2A actually delivers (this package)

Phase 2A is the foundation. After 2A you can:

- View role-aware navigation (toggle in topbar)
- Create a brand profile and a partner profile
- Be in either mode
- See the marketplace tables exist in the DB (empty)
- Run the kanban-columns seeding once you enter brand mode for the first time

Phase 2A does NOT yet:

- Let you post a gig (that's 2B)
- Let you browse or apply (2B/2C)
- Have any messaging (2C)
- Touch contracts or payments (2D/2E)

The reason for this phasing is that role + profile + nav are everywhere. If we get them wrong, every later phase has to rework the same surfaces. So 2A is small in user-facing surface but high in architectural impact.

---

## 9. Defaults I locked in (override before building if needed)

You said "continue" without answering the last 3 questions, so I picked:

- **Phased launch:** YES — 2D ships public first, 2E behind feature flag
- **Role toggle UX:** small toggle in topbar, same UI everywhere (least churn)
- **Partner profile:** structured fields PLUS free-text keywords/bio (most flexible)

These are reflected throughout the schema and prompts. If any feel wrong, tell me before running Phase 2A prompts.
