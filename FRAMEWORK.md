# Swaggy Studio → Social Media Manager Tool

**Drop this in your repo root. In Cursor, `@FRAMEWORK.md` it on every prompt so the model has full context.**

---

## 1. Product thesis

Five-tool social media manager for solo operators and small marketing teams. Every tool action costs credits. Connections (FB / IG / TikTok / email / SMS) live in one settings area and are reused across all tools.

**The five tools:**

| Tool | Route | What it does | Credit cost (default) |
|---|---|---|---|
| Caption Generator | `/tools/caption` | Photo or text in → caption + suggested time + tip | 1 |
| Image Generator | `/tools/image` | Prompt + brand kit → editable AI image | 5 |
| Ads / Campaign | `/tools/campaign` | Brief → multi-asset campaign (hook/headline/body/CTA × platform) | 10 |
| Text + Email Blast | `/tools/blast` | List + message → bulk send via SMS / email provider | 1 per recipient |
| PR Project Listing | `/tools/projects` | Kanban for PR/marketing projects (outlets, status, assets, deadlines) | 0 (free) |

All credit costs live in `lib/credits/costs.ts` and can be tuned without touching API routes.

---

## 2. Architecture

```
                      ┌──────────────────────┐
                      │   CREDIT SYSTEM      │  ← every tool spends through this
                      │   spend_credits()    │
                      └──────────┬───────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
   ┌────────┐              ┌─────────┐              ┌─────────┐
   │ TOOLS  │              │ PROJECTS│              │ CONNECT │
   │ 4 paid │              │ 1 free  │              │  FB/IG  │
   │ + 1    │              │ kanban  │              │  email  │
   └────────┘              └─────────┘              │  SMS    │
                                                    └─────────┘
```

Every tool follows the same vertical slice:

```
UI form → POST /api/tools/{name} → 1. auth check
                                  → 2. validate input
                                  → 3. spend_credits(N)  ← raises if broke
                                  → 4. do the work (Claude / image API / send)
                                  → 5. return result + new balance
                                  → 6. on failure, refund via positive ledger entry
```

---

## 3. Routes (final map)

```
PUBLIC
/                         landing
/login                    google sign-in (auto-bypassed in dev)
/auth/callback            oauth handoff

APP (auth-gated)
/home                     5-tool grid + recent activity + credit balance
/tools/caption            caption generator
/tools/image              editable image generator
/tools/campaign           ads / campaign generator
/tools/blast              text + email blast
/tools/projects           PR project kanban
/connections              connect FB / IG / TikTok / email / SMS
/settings                 account
/settings/billing         credits + topup history

API
/api/credits/balance      GET → current balance
/api/credits/spend        POST → atomic spend (internal use)
/api/credits/topup        POST → stripe checkout (stub for now)
/api/credits/ledger       GET → spend history

/api/tools/caption        POST → generate caption (renamed from /api/generate-caption)
/api/tools/image          POST → generate image
/api/tools/campaign       POST → generate campaign
/api/tools/blast          POST → send blast

/api/projects             GET, POST → list/create projects
/api/projects/[id]        GET, PATCH, DELETE → CRUD single project

/api/connections          GET → list user connections
/api/connections/facebook GET → start facebook oauth
/api/connections/facebook/callback   GET → finish facebook oauth
/api/connections/[id]     DELETE → disconnect
```

---

## 4. Credit system (the Lovable model)

**Concept**: every user has `credits_balance`. Tool actions spend credits atomically server-side. Master user has `unlimited_credits = true` so spends are no-ops.

### 4.1 Schema (additive — appended to `supabase/schema.sql`)

```sql
-- Extend user_settings with credits + master flag
alter table public.user_settings
  add column if not exists credits_balance integer not null default 100,
  add column if not exists unlimited_credits boolean not null default false,
  add column if not exists is_master boolean not null default false;

-- Credit ledger
create table if not exists public.credit_ledger (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  delta        integer not null,
  reason       text not null,
  tool         text,
  metadata     jsonb default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index credit_ledger_user_idx on public.credit_ledger (user_id, created_at desc);
alter table public.credit_ledger enable row level security;

drop policy if exists "credit_ledger_select_own" on public.credit_ledger;
create policy "credit_ledger_select_own" on public.credit_ledger
  for select using (auth.uid() = user_id);

-- Atomic spend RPC
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

  select unlimited_credits, credits_balance into unlimited, current_balance
  from public.user_settings where user_id = uid for update;

  if not found then
    -- auto-provision settings row on first spend
    insert into public.user_settings (user_id) values (uid);
    select unlimited_credits, credits_balance into unlimited, current_balance
    from public.user_settings where user_id = uid for update;
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
    set credits_balance = credits_balance - p_amount, updated_at = now()
    where user_id = uid
    returning credits_balance into new_balance;

  insert into public.credit_ledger (user_id, delta, reason, tool, metadata)
  values (uid, -p_amount, p_reason, p_tool, p_metadata);

  return new_balance;
end $$;

grant execute on function public.spend_credits(integer, text, text, jsonb) to authenticated;

-- Topup RPC (called from stripe webhook later; can be called manually for now)
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

grant execute on function public.add_credits(integer, text, jsonb) to authenticated;

-- Refund RPC (used when a tool fails after spending)
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
  from public.user_settings where user_id = uid for update;

  if unlimited then return null; end if;

  update public.user_settings
    set credits_balance = credits_balance + p_amount, updated_at = now()
    where user_id = uid
    returning credits_balance into new_balance;

  insert into public.credit_ledger (user_id, delta, reason, tool, metadata)
  values (uid, p_amount, p_reason || '_refund', p_tool, p_metadata);

  return new_balance;
end $$;

grant execute on function public.refund_credits(integer, text, text, jsonb) to authenticated;
```

### 4.2 Cost configuration (single source of truth)

`lib/credits/costs.ts`:

```ts
// Edit these numbers freely. API routes import from here, never hardcode.
export const CREDIT_COSTS = {
  caption: 1,
  image: 5,
  campaign: 10,
  blast_per_recipient: 1,
  projects: 0,
} as const;

export type ToolName = keyof typeof CREDIT_COSTS;

export function getCost(tool: ToolName, multiplier = 1): number {
  return CREDIT_COSTS[tool] * multiplier;
}
```

### 4.3 Helper: every API route uses this

`lib/credits/spend.ts`:

```ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { CREDIT_COSTS, type ToolName } from "./costs";

export type SpendResult =
  | { ok: true; newBalance: number }
  | { ok: false; response: NextResponse };

export async function spendOrFail(
  tool: ToolName,
  multiplier = 1,
  metadata: Record<string, unknown> = {}
): Promise<SpendResult> {
  const supabase = createClient();
  const amount = CREDIT_COSTS[tool] * multiplier;

  if (amount === 0) {
    return { ok: true, newBalance: -1 };  // -1 = "not tracked"
  }

  const { data, error } = await supabase.rpc("spend_credits", {
    p_amount: amount,
    p_reason: `${tool}_generate`,
    p_tool: tool,
    p_metadata: metadata,
  });

  if (error) {
    if (error.message?.includes("insufficient_credits")) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "insufficient_credits", required: amount },
          { status: 402 }
        ),
      };
    }
    return {
      ok: false,
      response: NextResponse.json({ error: "credit_spend_failed" }, { status: 500 }),
    };
  }

  return { ok: true, newBalance: typeof data === "number" ? data : 0 };
}

export async function refund(tool: ToolName, multiplier = 1, metadata: Record<string, unknown> = {}) {
  const supabase = createClient();
  const amount = CREDIT_COSTS[tool] * multiplier;
  if (amount === 0) return;
  await supabase.rpc("refund_credits", {
    p_amount: amount,
    p_reason: `${tool}_generate`,
    p_tool: tool,
    p_metadata: metadata,
  });
}
```

### 4.4 The pattern every tool route follows

```ts
// app/api/tools/{name}/route.ts
const spend = await spendOrFail("caption");
if (!spend.ok) return spend.response;

try {
  const result = await doTheWork(input);
  return NextResponse.json(result, {
    headers: { "X-Credits-Balance": String(spend.newBalance) },
  });
} catch (err) {
  await refund("caption");
  return NextResponse.json({ error: "tool_failed" }, { status: 500 });
}
```

---

## 5. Master user setup (you, right now)

While you're building, you want unlimited credits and to skip login. The repo already has `DEV_BYPASS_AUTH = true` in `lib/supabase/middleware.ts` — extend the pattern:

1. Pick a fixed dev user UUID: `00000000-0000-4000-8000-000000000000` (already used in the repo)
2. In dev, every server request injects this user
3. Seed that user with `is_master = true, unlimited_credits = true` in `supabase/schema.sql`

When you're ready to ship, flip one constant: `DEV_BYPASS_AUTH = false`.

```sql
-- Seed master user (run once after creating the auth.users row, OR in dev with the fixed UUID)
insert into public.user_settings (user_id, is_master, unlimited_credits, credits_balance)
values ('00000000-0000-4000-8000-000000000000', true, true, 999999)
on conflict (user_id) do update
  set is_master = true, unlimited_credits = true;
```

---

## 6. Connections (one place to wire socials)

Generalize the existing FB-only OAuth into a `connections` table. Phase 1 only ships FB working; the rest are "Coming soon" placeholders.

```sql
create table if not exists public.connections (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  provider        text not null,
  provider_account_id text,
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

alter table public.connections enable row level security;

drop policy if exists "connections_select_own" on public.connections;
create policy "connections_select_own" on public.connections
  for select using (auth.uid() = user_id);

drop policy if exists "connections_delete_own" on public.connections;
create policy "connections_delete_own" on public.connections
  for delete using (auth.uid() = user_id);

-- writes happen server-side via service role
```

---

## 7. What gets DELETED in Phase 1 (hard cut)

Out of scope, gone:

```
app/(app)/calendar/
app/(app)/insights/
app/(app)/inbox/
app/(app)/templates/
app/(app)/search/
app/(app)/brand/
app/(app)/posts/
app/api/post-instagram/
app/api/post-tiktok/
components/previews/                     ← all 14 preview frames
components/home/CoachCard.tsx
components/home/FeedGrid.tsx
components/home/StatsRow.tsx
components/home/HeroPrompt.tsx
components/joestar/
components/joestar-mascot.tsx
app/create/_components/PrototypeDashboard.tsx
app/create/_components/DashboardHome.tsx
BUILD_PLAN.md                            ← replaced by this file
Joestar Photos/                          ← move keepers to /public/brand/
Joestar.png                              ← move to /public/brand/ if keeping
```

What stays and gets repurposed:

- `app/create/` → renamed to `app/tools/caption/` (route + folder)
- `app/api/generate-caption/` → renamed to `app/api/tools/caption/`
- `app/api/post-facebook/` → kept as-is for now (caption tool uses it for "post now")
- `app/api/auth/facebook/*` → moved to `app/api/connections/facebook/*`
- `lib/facebook.ts`, `lib/token-crypto.ts` → kept
- `components/ui/*`, `components/auth/*`, `components/logo.tsx`, `components/toast.tsx` → kept
- `components/layout/Rail.tsx`, `Sidebar.tsx`, `AppPageStub.tsx` → kept, navigation updated
- `components/home/HomeDashboard.tsx`, `QuickstartGrid.tsx` → kept, content rewritten

---

## 8. Build phases

| Phase | Scope | Time |
|---|---|---|
| **1** | Cleanup + skeleton + credit system + rebuilt /home + caption tool migrated | 1–2 days |
| **2** | PR Projects (kanban) + connections page polish | 1 day |
| **3** | Image generator (Claude prompt → image API → inline editor) | 2–3 days |
| **4** | Campaign generator (Claude → structured multi-platform JSON → preview) | 2 days |
| **5** | Blast (Twilio + Resend, CSV upload, schedule) | 3–4 days |
| **6** | Stripe topups, switch off DEV_BYPASS_AUTH, real auth | 2 days |

---

## 9. Tone, design tokens, conventions

Keep what's already in `tailwind.config.ts`:
- `bg-base #0a0820`, `bg-card #0f0b2a`, `bg-elevated #1a1440`
- `brand-purple #7b2ff7`, `brand-pink #f059c0`, `brand-cyan #67e8f9`, `brand-yellow #f7c948`
- `bg-brand-gradient` utility
- Plus Jakarta Sans + Fraunces (for italics in headings)

Component primitives in `components/ui/` (Button, Card, Input, Textarea, Badge, etc.) — use them, don't reinvent.

Toast system: `import { useToast } from "@/components/toast"`.
