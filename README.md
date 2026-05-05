# Swaggy Studio

AI captions for online sellers. Write a post in 30 seconds.

Live at [swaggy.studio](https://swaggy.studio).

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase (Auth, Postgres, Storage)

## Local setup

### 1. Install

```bash
npm install
```

### 2. Supabase project

1. Create a new project at [supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy `URL` and `anon key`.
3. In **Authentication → Providers → Google**, enable Google and paste your
   Google OAuth client ID + secret.
   - Add this **Authorized redirect URI** in your Google Cloud OAuth client:
     `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. In **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000` (dev) or `https://swaggy.studio` (prod)
   - **Redirect URLs**: add both `http://localhost:3000/auth/callback` and
     `https://swaggy.studio/auth/callback`.
5. Open the **SQL Editor** and run [`supabase/schema.sql`](./supabase/schema.sql).
   This creates the `posts` and `user_settings` tables, enables RLS, and
   provisions the `post-photos` storage bucket.

### 3. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` (use `http://localhost:3000` in dev) — Supabase OAuth redirect base
- `NEXT_PUBLIC_APP_URL` (usually same as `NEXT_PUBLIC_SITE_URL`) — Facebook OAuth redirect base
- `ANTHROPIC_API_KEY` — required by `/api/generate-caption` (Claude Vision). Create a key at [console.anthropic.com](https://console.anthropic.com/).
- `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` — from [developers.facebook.com](https://developers.facebook.com/). In your app, add the following redirect URIs under **Facebook Login → Settings → Valid OAuth Redirect URIs**:
  - `http://localhost:3000/api/auth/facebook/callback`
  - `https://swaggy.studio/api/auth/facebook/callback`

### 4. Run

```bash
npm run dev
```

Open <http://localhost:3000>.

## Routes

| Route                              | Auth     | Purpose                                                           |
| ---------------------------------- | -------- | ----------------------------------------------------------------- |
| `/`                                | Public   | Landing page                                                      |
| `/login`                           | Public   | Continue with Google                                              |
| `/auth/callback`                   | Public   | Supabase OAuth code exchange                                      |
| `/create`                          | Required | Upload a photo, get an AI caption, post to Facebook               |
| `/api/generate-caption`            | Required | POST → Claude Vision → `{ caption, suggested_time, tip }`         |
| `/api/auth/facebook`               | Required | GET → redirect to Facebook OAuth with `pages_*` scopes + signed state |
| `/api/auth/facebook/callback`      | Required | GET → exchange code, fetch Pages, persist page token              |
| `/api/post-facebook`               | Required | POST → `graph.facebook.com/{page}/photos`, writes `posts` row     |

All non-public pages are guarded by `middleware.ts`. API routes under `/api/*`
enforce auth themselves and return JSON errors instead of HTML redirects.

## Rate limiting

`/api/generate-caption` enforces a **free-tier cap of 20 captions per user per
day** (UTC). Each request atomically increments
`public.caption_usage (user_id, day, count)` via the `increment_caption_usage()`
SECURITY DEFINER RPC. When the cap is exceeded the endpoint returns
`429 { error: "rate_limited", limit: 20 }` with `X-RateLimit-*` headers. The UI
renders a friendly "Come back tomorrow" state; no hard paywall yet.

## First-run onboarding

`/create` reads the user's `posts` count server-side. If it's zero, the drop
zone shows a one-time tooltip ("Start here — any product photo works!"). The
tooltip disappears on first upload and its dismissed state is persisted in
`localStorage` under `swaggy.onboarding.dismissed`.

## Facebook connection flow

1. User hits **Post to Facebook →**. If they don't have `fb_page_id` in
   `user_settings`, the modal "Connect your Facebook Page to post" opens.
2. Continue → `/api/auth/facebook` → Facebook consent screen.
3. Callback exchanges the code, upgrades to a long-lived user token, hits
   `/me/accounts`, and saves the chosen Page's `access_token` (long-lived page
   token), `id`, and `name` to `user_settings`.
4. Redirect back to `/create?fb=connected`; the button is clicked again, which
   now POSTs to `/api/post-facebook`.
5. On success the UI flips to the "Posted." success screen and writes a row to
   `posts` with `status='posted'` and the returned `fb_post_id`.

## Design tokens

Defined in `tailwind.config.ts`:

| Token              | Hex       |
| ------------------ | --------- |
| `bg-base`          | `#0a0820` |
| `bg-card`          | `#0f0b2a` |
| `bg-elevated`      | `#1a1440` |
| `border`           | `#2a1f5e` |
| `brand-purple`     | `#7b2ff7` |
| `brand-pink`       | `#f059c0` |
| `brand-cyan`       | `#67e8f9` |
| `joestar-yellow`   | `#f7c948` |

Brand gradient utility: `bg-brand-gradient` (purple → light purple → pink).

## Project structure

```
app/
  layout.tsx              root layout + fonts + globals
  page.tsx                landing "/"
  login/page.tsx          Google OAuth entry
  auth/callback/route.ts  OAuth code exchange
  create/
    page.tsx              placeholder (auth-gated)
    actions.ts            sign-out server action
components/
  logo.tsx                SwaggyLogo + SwaggyWordmark
lib/supabase/
  client.ts               browser client
  server.ts               RSC / server client
  middleware.ts           session refresh + route guard helper
middleware.ts             Next.js middleware entry
supabase/schema.sql       database + storage setup
```

## Next

Build the `/create` caption generator — photo upload → AI caption → publish
to Facebook Page.
