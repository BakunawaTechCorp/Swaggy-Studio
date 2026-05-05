# Phase 1 — Cursor Prompt Pack

**How to use:** open Cursor in your repo. For each prompt below, paste it into Cursor's chat with `@FRAMEWORK.md` attached. Run them **in order**. Each prompt includes acceptance criteria so you can verify before moving on.

---

## Prompt 0 — Pre-flight (read this, don't paste)

Before starting:

```bash
git checkout -b refactor/social-media-tool
git add -A && git commit -m "checkpoint before refactor" --allow-empty
```

This way every prompt below leaves a clean diff you can review and revert if needed.

---

## Prompt 1 — Hard cleanup (delete out-of-scope code)

> @FRAMEWORK.md
>
> I'm refactoring Swaggy Studio into a 5-tool social media manager. Per the framework's section 7, do a hard cut of all out-of-scope code.
>
> **Delete these files and directories:**
>
> ```
> app/(app)/calendar/
> app/(app)/insights/
> app/(app)/inbox/
> app/(app)/templates/
> app/(app)/search/
> app/(app)/brand/
> app/(app)/posts/
> app/api/post-instagram/
> app/api/post-tiktok/
> components/previews/
> components/home/CoachCard.tsx
> components/home/FeedGrid.tsx
> components/home/StatsRow.tsx
> components/home/HeroPrompt.tsx
> components/joestar/
> components/joestar-mascot.tsx
> app/create/_components/PrototypeDashboard.tsx
> app/create/_components/DashboardHome.tsx
> BUILD_PLAN.md
> Joestar Photos/
> Joestar.png
> ```
>
> **After deleting, fix any resulting broken imports:**
>
> 1. In `components/layout/Rail.tsx`: replace the `items` array so it shows only Home, Connections, Settings (drop Create/Calendar/Insights/Brand/Inbox icons).
> 2. In `components/layout/Sidebar.tsx`: remove the Quick start templates and Recent posts sections (anything that linked to the deleted routes). Keep the brand switcher and the Connected accounts section.
> 3. In `components/home/HomeDashboard.tsx`: remove imports and JSX for `CoachCard`, `FeedGrid`, `StatsRow`, `HeroPrompt`. The component should now only render the topbar and `<QuickstartGrid />`. Keep `Ask Joestar` modal removed too.
> 4. In `app/create/dashboard.tsx`: remove the `PrototypeDashboard` import and the entire `if (flow.view === "dashboard")` block — when the page loads, it should go straight to the prompt step.
> 5. Search the codebase for any remaining references to the deleted files and remove or fix them.
> 6. Run `npm run build` and fix any TypeScript errors that surface.
>
> **Do not touch:** anything in `lib/`, `components/ui/`, `components/auth/`, `components/logo.tsx`, `components/toast.tsx`, `app/api/generate-caption/`, `app/api/post-facebook/`, `app/api/auth/facebook/`, `supabase/schema.sql`, `tailwind.config.ts`, or `app/layout.tsx`.

**Acceptance criteria:**
- [ ] `npm run build` passes with zero errors
- [ ] `/home`, `/create`, `/login`, `/` all still render
- [ ] Sidebar and Rail show only Home / Connections / Settings (and the logo)
- [ ] No imports point to deleted files

---

## Prompt 2 — Database schema (credits + connections)

> @FRAMEWORK.md
>
> Update `supabase/schema.sql` to add the credit system and connections table per sections 4 and 6 of the framework.
>
> **Append (don't replace) the following to `supabase/schema.sql`:**
>
> 1. The credit columns added to `user_settings` (`credits_balance`, `unlimited_credits`, `is_master`)
> 2. The `credit_ledger` table + RLS policies + index
> 3. The `spend_credits()`, `add_credits()`, `refund_credits()` SECURITY DEFINER RPCs
> 4. The `connections` table + RLS policies
> 5. The master user seed (using the fixed UUID `00000000-0000-4000-8000-000000000000`)
>
> **Use the exact SQL from sections 4.1, 4.2, 6, and 5 of the framework.** Don't paraphrase — copy the SQL verbatim so we can run it idempotently.
>
> Also: I want to deprecate the `caption_usage` table since the credit ledger replaces it. Add a comment above it that says "DEPRECATED — replaced by credit_ledger. Keep for historical data, do not write to it."
>
> Don't drop the `increment_caption_usage()` RPC yet either — we'll remove the API call in the next prompt and drop the function in a later cleanup.

**Acceptance criteria:**
- [ ] `supabase/schema.sql` has all the new tables, columns, and functions
- [ ] Running the full SQL file in a fresh Supabase project succeeds without errors
- [ ] `select credits_balance from user_settings limit 1;` returns a number
- [ ] `select * from credit_ledger limit 1;` works (returns empty)

---

## Prompt 3 — Credit system code (lib helpers + API routes)

> @FRAMEWORK.md
>
> Build the credit system code per section 4 of the framework.
>
> **Create these files:**
>
> 1. `lib/credits/costs.ts` — exact contents from framework section 4.2
> 2. `lib/credits/spend.ts` — exact contents from framework section 4.3
> 3. `app/api/credits/balance/route.ts` — GET endpoint:
>    - Auth check via `createClient()` from `@/lib/supabase/server`
>    - Selects `credits_balance, unlimited_credits, is_master` from `user_settings` for the current user
>    - Returns `{ balance: number, unlimited: boolean, isMaster: boolean }`
>    - If no user_settings row exists, return `{ balance: 0, unlimited: false, isMaster: false }`
> 4. `app/api/credits/ledger/route.ts` — GET endpoint:
>    - Auth check
>    - Selects last 50 entries from `credit_ledger` for the current user, ordered `created_at desc`
>    - Returns `{ entries: Array<{ id, delta, reason, tool, metadata, created_at }> }`
> 5. `app/api/credits/topup/route.ts` — POST endpoint (stub for now):
>    - Auth check
>    - Body: `{ amount: number }`
>    - Validate amount is positive integer between 10 and 10000
>    - Calls `supabase.rpc("add_credits", { p_amount: amount, p_reason: "manual_topup", p_metadata: {} })`
>    - Returns `{ ok: true, newBalance: number }`
>    - Add a TODO comment: `// TODO: replace with Stripe checkout in Phase 6`
>
> **Use the existing patterns:** `observeApiRoute` wrapper from `@/lib/observability`, `requireSameOrigin` from `@/lib/security`, `runtime = "nodejs"`. Look at `app/api/generate-caption/route.ts` for the exact pattern.
>
> Don't add a frontend yet — just the API and the helpers.

**Acceptance criteria:**
- [ ] `npm run build` passes
- [ ] `curl http://localhost:3000/api/credits/balance` returns valid JSON (with auth in dev mode)
- [ ] `lib/credits/costs.ts` is the only place credit costs are defined — grep confirms no hardcoded numbers in API routes

---

## Prompt 4 — Migrate caption tool to new structure

> @FRAMEWORK.md
>
> Move the existing caption generator into the new `/tools/caption` location and wire it through the credit system.
>
> **Step 1 — Move files:**
> - Move `app/create/page.tsx` → `app/tools/caption/page.tsx`
> - Move `app/create/dashboard.tsx` → `app/tools/caption/CaptionTool.tsx` (and rename the export from `Dashboard` to `CaptionTool`)
> - Move `app/create/_components/` → `app/tools/caption/_components/`
> - Move `app/create/_hooks/` → `app/tools/caption/_hooks/`
> - Move `app/create/_lib/` → `app/tools/caption/_lib/`
> - Move `app/create/actions.ts` → `app/tools/caption/actions.ts`
> - Move `app/api/generate-caption/route.ts` → `app/api/tools/caption/route.ts`
> - Update every import that referenced the old paths
> - Update fetch URLs in the hooks (`useCaptionGen.ts` etc.) from `/api/generate-caption` to `/api/tools/caption`
>
> **Step 2 — Wire the credit system into the API:**
>
> In the new `app/api/tools/caption/route.ts`:
> - Import `spendOrFail` and `refund` from `@/lib/credits/spend`
> - Replace the entire rate-limit block (the `increment_caption_usage` RPC call and the 429 response) with:
>   ```ts
>   const spend = await spendOrFail("caption", 1, { language, style, length, goal });
>   if (!spend.ok) return spend.response;
>   ```
> - At the end, after a successful Claude response, set the response header `X-Credits-Balance: spend.newBalance.toString()` instead of the old `X-RateLimit-*` headers
> - In the catch block (when Claude fails), call `await refund("caption", 1, { reason: "claude_error" })` before returning the error
> - Remove the `DAILY_CAPTION_LIMIT` constant and the rate-limit-related response code paths
>
> **Step 3 — Add a redirect from old route:**
> - Create `app/create/page.tsx` that just does `redirect("/tools/caption")` from `next/navigation`. This keeps any existing bookmarks alive.
>
> **Step 4 — Update navigation:**
> - In `components/layout/Rail.tsx`, the items array should now be:
>   ```ts
>   const items = [
>     { href: "/home", label: "Home", icon: Home },
>     { href: "/tools/caption", label: "Caption", icon: MessageSquare },
>     { href: "/connections", label: "Connections", icon: Link2 },
>   ];
>   ```
>   (We'll add the other 4 tools as their stubs land in Prompt 5.)

**Acceptance criteria:**
- [ ] `npm run build` passes
- [ ] Visiting `/tools/caption` shows the prompt step (not the old prototype dashboard)
- [ ] Generating a caption works end-to-end and the response includes `X-Credits-Balance` header
- [ ] As the master user, balance does not decrement (because `unlimited_credits = true`)
- [ ] Visiting `/create` redirects to `/tools/caption`
- [ ] No file in `app/api/` imports `increment_caption_usage`

---

## Prompt 5 — New /home (5-tool grid) + tool stubs

> @FRAMEWORK.md
>
> Rebuild the `/home` page as a 5-tool grid and add stub pages for the four tools we haven't built yet.
>
> **Step 1 — Replace `components/home/QuickstartGrid.tsx` contents:**
>
> ```tsx
> import Link from "next/link";
> import { MessageSquare, Image, Megaphone, Send, Briefcase } from "lucide-react";
> import { CREDIT_COSTS } from "@/lib/credits/costs";
>
> const tools = [
>   {
>     title: "Caption Generator",
>     subtitle: "Photo + caption in 30 seconds",
>     icon: MessageSquare,
>     href: "/tools/caption",
>     cost: CREDIT_COSTS.caption,
>     className: "qs-1",
>     status: "ready" as const,
>   },
>   {
>     title: "Image Generator",
>     subtitle: "Editable AI images for your brand",
>     icon: Image,
>     href: "/tools/image",
>     cost: CREDIT_COSTS.image,
>     className: "qs-2",
>     status: "soon" as const,
>   },
>   {
>     title: "Ads / Campaign",
>     subtitle: "Multi-platform campaign in one click",
>     icon: Megaphone,
>     href: "/tools/campaign",
>     cost: CREDIT_COSTS.campaign,
>     className: "qs-3",
>     status: "soon" as const,
>   },
>   {
>     title: "Text + Email Blast",
>     subtitle: "Bulk send to your customer list",
>     icon: Send,
>     href: "/tools/blast",
>     cost: `${CREDIT_COSTS.blast_per_recipient}/recipient`,
>     className: "qs-4",
>     status: "soon" as const,
>   },
>   {
>     title: "PR Projects",
>     subtitle: "Track outlets, deadlines, assets",
>     icon: Briefcase,
>     href: "/tools/projects",
>     cost: "free",
>     className: "qs-5",
>     status: "soon" as const,
>   },
> ];
>
> export function QuickstartGrid() {
>   return (
>     <>
>       <div className="section-title">
>         <div>
>           <h2>Pick a <span className="italic">tool</span></h2>
>           <p>One credit, one job. Top up anytime.</p>
>         </div>
>       </div>
>       <div className="quickstart-grid">
>         {tools.map(({ title, subtitle, icon: Icon, className, href, cost, status }) => (
>           <Link key={title} href={href} className={`quickstart-card ${className} ${status === "soon" ? "opacity-70" : ""}`}>
>             <div className="quickstart-icon"><Icon size={24} /></div>
>             <div className="quickstart-content">
>               <div className="quickstart-title">{title}</div>
>               <div className="quickstart-sub">{subtitle}</div>
>               <div className="quickstart-cost">
>                 {typeof cost === "number" ? `${cost} credit${cost === 1 ? "" : "s"}` : cost}
>                 {status === "soon" && " · coming soon"}
>               </div>
>             </div>
>           </Link>
>         ))}
>       </div>
>     </>
>   );
> }
> ```
>
> **Step 2 — Add a credit balance pill to the topbar.**
>
> Create `components/home/CreditBalance.tsx`:
> - Client component
> - On mount, fetches `/api/credits/balance` and displays the balance
> - If `unlimited`, shows "∞ credits" with a small star icon
> - Otherwise shows `{balance} credits` and a "Top up" button (which for now just opens a `window.prompt("How many credits?")` and POSTs to `/api/credits/topup`)
> - Use Tailwind classes consistent with the existing `pill` style in the codebase
>
> Then in `components/home/HomeDashboard.tsx`, replace the existing `pill` link ("Payday in 4 days") with `<CreditBalance />`.
>
> **Step 3 — Create stub pages for the four unbuilt tools.**
>
> For each of `/tools/image`, `/tools/campaign`, `/tools/blast`, `/tools/projects`, create a `page.tsx` that uses the existing `AppPageStub` component:
>
> ```tsx
> // app/tools/image/page.tsx
> import { AppPageStub } from "@/components/layout/AppPageStub";
> export default function Page() {
>   return <AppPageStub title="Image Generator" subtitle="Coming in Phase 3 — editable AI images for your brand." />;
> }
> ```
>
> Title/subtitle for each:
> - Image: "Image Generator" / "Coming in Phase 3 — editable AI images for your brand."
> - Campaign: "Ads / Campaign Generator" / "Coming in Phase 4 — multi-platform campaign in one click."
> - Blast: "Text + Email Blast" / "Coming in Phase 5 — bulk send to your customer list."
> - Projects: "PR Projects" / "Coming in Phase 2 — track outlets, deadlines, assets."
>
> **Step 4 — Update Rail with all five tool icons:**
>
> ```tsx
> // components/layout/Rail.tsx items
> const items = [
>   { href: "/home", label: "Home", icon: Home },
>   { href: "/tools/caption", label: "Caption", icon: MessageSquare },
>   { href: "/tools/image", label: "Image", icon: Image },
>   { href: "/tools/campaign", label: "Campaign", icon: Megaphone },
>   { href: "/tools/blast", label: "Blast", icon: Send },
>   { href: "/tools/projects", label: "Projects", icon: Briefcase },
>   { href: "/connections", label: "Connections", icon: Link2 },
> ];
> ```
>
> **Step 5 — Add CSS for `qs-5` and `quickstart-cost`:**
>
> In `app/globals.css`, find the existing `.qs-1`, `.qs-2`, etc. rules and add:
>
> ```css
> .qs-5 {
>   background: linear-gradient(135deg, rgba(103, 232, 249, 0.18), rgba(247, 201, 72, 0.18));
>   border-color: rgba(103, 232, 249, 0.32);
> }
> .quickstart-cost {
>   font-size: 11px;
>   color: rgba(245, 243, 255, 0.48);
>   margin-top: 4px;
> }
> ```

**Acceptance criteria:**
- [ ] `/home` shows 5 tool cards with credit costs visible
- [ ] Top bar shows current balance (or "∞ credits" for master user)
- [ ] Clicking each tool card navigates to either the working caption page or the appropriate "Coming soon" stub
- [ ] Rail shows all 7 nav items
- [ ] No console errors on `/home`

---

## Prompt 6 — Connections page (consolidate FB OAuth)

> @FRAMEWORK.md
>
> Build the `/connections` page that consolidates social account integration.
>
> **Step 1 — Move and rename FB OAuth routes:**
> - `app/api/auth/facebook/route.ts` → `app/api/connections/facebook/route.ts`
> - `app/api/auth/facebook/callback/route.ts` → `app/api/connections/facebook/callback/route.ts`
> - Update both to write to the new `connections` table instead of `user_settings.fb_*` columns:
>   - On successful callback, upsert into `connections` with `provider='facebook'`, `provider_account_id=fb_page_id`, `display_name=fb_page_name`, `access_token_encrypted=<encrypted token>`, `scopes=['pages_manage_posts','pages_read_engagement']`
>   - Use the existing `encrypt`/`decrypt` from `lib/token-crypto.ts`
>   - Keep writing to the legacy `user_settings.fb_*` columns too for backward compat with `/api/post-facebook` (we'll migrate that next)
> - Update any redirect URLs in those files to point to `/connections?fb=connected` instead of `/create?fb=connected`
>
> **Step 2 — Update `/api/post-facebook/route.ts`:**
> - Read the access token from `connections` table first (by `user_id` + `provider='facebook'`), fall back to `user_settings.fb_access_token_encrypted` if not found
> - Otherwise leave its logic alone
>
> **Step 3 — Create `app/connections/page.tsx`:**
>
> Server component that:
> 1. Reads the current user (or master user in dev)
> 2. Fetches all rows from `connections` for that user
> 3. Renders a card grid with one card per provider:
>    - Facebook (live)
>    - Instagram (coming soon)
>    - TikTok (coming soon)
>    - Twitter/X (coming soon)
>    - LinkedIn (coming soon)
>    - Gmail (coming soon — for blast tool)
>    - Twilio SMS (coming soon — for blast tool)
> 4. Each card shows: provider name, status (Connected · {display_name} / Not connected / Coming soon), and a button (Connect / Disconnect / disabled)
> 5. The Facebook "Connect" button links to `/api/connections/facebook` (existing OAuth start)
> 6. Disconnect calls `DELETE /api/connections/[id]` (build this route — just deletes the row after auth check)
>
> Use the existing `Rail` + `Sidebar` + `ToastProvider` shell, same pattern as `/home`.
>
> **Step 4 — Add `app/api/connections/route.ts` (GET) and `app/api/connections/[id]/route.ts` (DELETE):**
> - GET: returns `{ connections: Array<{ id, provider, display_name, created_at }> }` — no tokens in response
> - DELETE: auth check, deletes by id where `user_id = current user`, returns `{ ok: true }`
>
> **Step 5 — Update Sidebar to read from connections table:**
>
> In `components/layout/Sidebar.tsx`, the "Connected" section is currently hardcoded. Make it a server component (or convert to a client component that fetches `/api/connections` on mount) so it reflects actual connected accounts.

**Acceptance criteria:**
- [ ] `/connections` renders a card grid with FB connectable
- [ ] Connecting Facebook works end-to-end (writes to `connections` table, redirects back with success state)
- [ ] Disconnect button works and removes the row
- [ ] `/tools/caption` "Post to Facebook" still works after the migration
- [ ] Sidebar shows live connection state, not hardcoded "Maria's Thrift Store"

---

## Prompt 7 — Polish & verify

> @FRAMEWORK.md
>
> Final cleanup pass.
>
> 1. Update `README.md` — replace the "AI captions for online sellers" framing with the 5-tool framework. Use FRAMEWORK.md as the source of truth.
> 2. Update the route table in README to match the new structure.
> 3. Update `app/page.tsx` (the landing page) tagline from "AI captions for online sellers" to something like "Your social media manager, in one tab. Five tools. One credit balance."
> 4. Update `app/layout.tsx` metadata title and description to match.
> 5. Drop the old `caption_usage` table from `supabase/schema.sql` and remove the `increment_caption_usage()` function (we replaced it with credits).
> 6. Search for any remaining references to deleted features ("hugot", "Filipino sellers", "Maria", "Joestar mascot") in user-facing copy and update them.
> 7. Run `npm run build` one more time. Fix any warnings.
> 8. Run `npm run lint` and fix anything reasonable.
>
> Don't change the design tokens, fonts, or color palette — those still match the brand.

**Acceptance criteria:**
- [ ] `npm run build` passes
- [ ] `npm run lint` has no errors
- [ ] Landing page, /home, /tools/caption, /connections all render
- [ ] Generating a caption as master user works and balance stays "∞"
- [ ] You can see the spend reflected in `/api/credits/ledger` if you flip `unlimited_credits = false` for testing

---

## Done with Phase 1?

Commit it: `git commit -am "phase 1: skeleton + credit system + caption tool migrated"`

Next phase prompts (Phase 2: PR Projects kanban) will be delivered separately. Ping me when you're done with this phase and tell me what worked, what broke, and which tool you want to build next.
