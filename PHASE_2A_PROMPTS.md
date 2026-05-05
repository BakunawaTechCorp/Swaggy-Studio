# Phase 2A — Cursor Prompt Pack

**Prerequisite:** Phase 1 is shipped. `FRAMEWORK.md` exists. Cleanup ran. Caption tool lives at `/tools/caption` and credits work.

**How to use:** open Cursor in your repo. For each prompt, paste with `@FRAMEWORK.md` AND `@MARKETPLACE.md` attached. Run them in order.

---

## Prompt 0 — Pre-flight

```bash
git checkout -b marketplace/phase-2a
git add -A && git commit -m "checkpoint before phase 2a" --allow-empty
```

Drop `MARKETPLACE.md` in repo root.

---

## Prompt 1 — Schema (run in Supabase SQL editor, not Cursor)

This one isn't a Cursor prompt — it's a SQL run.

1. Open the Supabase SQL editor for your project.
2. Paste the entire contents of `marketplace-schema.sql` and execute.
3. Verify by running:
   ```sql
   select count(*) from information_schema.tables
   where table_schema='public' and table_name in (
     'brand_profile','partner_profile','pr_gigs','kanban_columns',
     'applications','message_threads','messages','contracts','payouts'
   );
   ```
   Should return `9`.
4. Verify the `set_active_mode` and `seed_default_kanban_columns` functions exist:
   ```sql
   select proname from pg_proc
   where proname in ('set_active_mode','seed_default_kanban_columns');
   ```

**Acceptance:**
- [ ] All 9 tables exist
- [ ] Both functions exist
- [ ] `select active_mode from user_settings limit 1;` works (returns 'brand' default)

---

## Prompt 2 — Drop in lib code

> @FRAMEWORK.md @MARKETPLACE.md
>
> Add the marketplace shared library code:
>
> 1. Create `lib/features.ts` — paste from `lib/features.ts` in the package.
> 2. Create `lib/marketplace/types.ts` — paste from `lib/marketplace/types.ts`.
> 3. Create `lib/marketplace/profile.ts` — paste from `lib/marketplace/profile.ts`.
>
> All three are pure helper code. After adding them, run `npm run build` to make sure they compile.

**Acceptance:**
- [ ] `npm run build` passes
- [ ] `import { isFeatureOn } from "@/lib/features"` works
- [ ] `import { getProfileBundle } from "@/lib/marketplace/profile"` works

---

## Prompt 3 — Profile + mode API routes

> @FRAMEWORK.md @MARKETPLACE.md
>
> Create these API routes by pasting in the provided files:
>
> 1. `app/api/marketplace/profile/route.ts`
> 2. `app/api/marketplace/profile/mode/route.ts`
> 3. `app/api/marketplace/brand-profile/route.ts`
> 4. `app/api/marketplace/partner-profile/route.ts`
>
> All four follow the existing observability + CSRF patterns from `app/api/generate-caption/route.ts`. Don't change them; just paste them.
>
> Then test manually with curl (replace `localhost:3000` if needed):
>
> ```bash
> # 1. Bundle endpoint
> curl http://localhost:3000/api/marketplace/profile
> # Expected: { brand: null, partner: null, active_mode: 'brand' } (assuming you're the master user)
>
> # 2. Try to switch to partner mode without profile — should 409
> curl -X POST http://localhost:3000/api/marketplace/profile/mode \
>   -H 'Content-Type: application/json' \
>   -H 'Origin: http://localhost:3000' \
>   -d '{"mode":"partner"}'
> # Expected: { error: 'missing_profile', missing: 'partner' }
>
> # 3. Create a brand profile
> curl -X PUT http://localhost:3000/api/marketplace/brand-profile \
>   -H 'Content-Type: application/json' \
>   -H 'Origin: http://localhost:3000' \
>   -d '{"company_name":"Test Brand","industry":"fashion"}'
> # Expected: { profile: { ... } }
> ```

**Acceptance:**
- [ ] All four routes return JSON, not 404
- [ ] Bundle endpoint returns the user's active_mode
- [ ] Mode switch returns 409 if no profile in target role
- [ ] Brand and partner profile PUT endpoints upsert correctly

---

## Prompt 4 — UI components + onboarding

> @FRAMEWORK.md @MARKETPLACE.md
>
> Create these UI files:
>
> 1. `components/marketplace/RoleToggle.tsx` — paste from package
> 2. `components/marketplace/BrandProfileForm.tsx` — paste from package
> 3. `components/marketplace/PartnerProfileForm.tsx` — paste from package
> 4. `app/onboarding/role/[role]/page.tsx` — paste from package
>
> Then update `components/home/HomeDashboard.tsx`:
> - Replace it with the version from the package (which adds `<RoleToggle />` next to `<CreditBalance />` in the topbar).
>
> Append the entire contents of `globals-additions-2a.css` to `app/globals.css`.
>
> Run `npm run build` and fix any TypeScript errors.

**Acceptance:**
- [ ] `npm run build` passes
- [ ] `/home` shows a "Brand mode" pill in the topbar (alongside the credit balance)
- [ ] Clicking the pill opens a dropdown with two options
- [ ] Clicking "Brand mode" when no brand profile exists → redirects to `/onboarding/role/brand`
- [ ] Filling in the brand profile form → saves and redirects back to `/home`
- [ ] After creating a brand profile, the topbar shows "Brand mode"
- [ ] Doing the same for partner works
- [ ] After both profiles exist, the dropdown lets you toggle between them without redirect

---

## Prompt 5 — Make Rail role-aware (light-touch version for 2A)

> @FRAMEWORK.md @MARKETPLACE.md
>
> Update `components/layout/Rail.tsx` to be aware of the active mode but keep the change minimal in 2A — we're not yet hiding/showing big chunks of nav, just adjusting the home label and the projects label.
>
> Make Rail a client component that reads `/api/marketplace/profile` on mount (similar to how RoleToggle does it) and adjusts the items array:
>
> - In **brand mode**: items show "Home, Caption, Image, Campaign, Blast, Projects, Connections" (current behavior)
> - In **partner mode**: items show "Home, Browse Gigs, Applications, Profile, Connections"
>
> The Brand and Partner partial item lists should be defined as constants at the top of the file, and chosen based on `bundle?.active_mode`.
>
> For partner mode, link "Browse Gigs" to `/tools/projects` (we'll wire the actual browse view in Phase 2B), "Applications" to `/applications` (will 404 until 2C), "Profile" to `/onboarding/role/partner` (it doubles as the edit page since the form pre-fills from existing data — though if `initial` exists, it shows "Save changes" instead of "Create").
>
> Listen for the `profile:changed` window event the same way `RoleToggle` does so the Rail re-fetches when the user switches modes.
>
> Keep all existing icons. Use `Compass` from lucide for "Browse Gigs" and `FileText` for "Applications" and `User` for "Profile".

**Acceptance:**
- [ ] `npm run build` passes
- [ ] In brand mode the rail shows the original 7 items
- [ ] Switching to partner mode changes the rail to 5 items (Home, Browse Gigs, Applications, Profile, Connections)
- [ ] The change happens without a full page refresh

---

## Prompt 6 — Edit-existing-profile entry point

> @FRAMEWORK.md @MARKETPLACE.md
>
> The onboarding pages double as edit pages — but right now they redirect away if the profile already exists. Update `app/onboarding/role/[role]/page.tsx` to NOT redirect when `?edit=1` is in the query string.
>
> When `?edit=1`, render the form pre-filled with `initial` set to the existing profile, and change the page title to "Edit your brand profile" / "Edit your partner profile".
>
> Then update the `RoleToggle` dropdown footer link from `/settings/account` to `/onboarding/role/{currentMode}?edit=1` so the "Manage profiles" link works.

**Acceptance:**
- [ ] Visiting `/onboarding/role/brand?edit=1` after creating a brand profile shows the form pre-filled
- [ ] Saving updates the profile (form button says "Save changes" not "Create brand profile")
- [ ] No redirect-loop

---

## Prompt 7 — Polish + verify

> @FRAMEWORK.md @MARKETPLACE.md
>
> Final pass:
>
> 1. Run `npm run lint` and fix anything reasonable
> 2. Verify the master user (UUID `00000000-0000-4000-8000-000000000000`) can:
>    - Visit /home (works without onboarding because they have settings already)
>    - Click role toggle, see "Set up brand profile →" prompt because no profile exists yet
>    - Go through brand onboarding
>    - Switch to partner mode → "Set up partner profile →" prompt
>    - Go through partner onboarding
>    - Toggle freely between modes after both profiles exist
> 3. Verify in the database:
>    ```sql
>    select * from brand_profile;
>    select * from partner_profile;
>    select active_mode from user_settings where user_id = '00000000-0000-4000-8000-000000000000';
>    ```
> 4. Commit: `git commit -am "phase 2a: marketplace foundation — roles, profiles, role toggle"`

**Acceptance:**
- [ ] All seven steps in the manual verify pass
- [ ] No console errors
- [ ] No TypeScript errors

---

## Done with Phase 2A?

You now have:
- All marketplace tables in the DB (mostly empty until 2B)
- Brand and partner profile CRUD
- A role toggle in the topbar
- A role-aware nav rail
- Onboarding flows for both roles
- The `set_active_mode` RPC enforcing that you must have the corresponding profile before switching

Phase 2B will add: gig posting, gig browsing, kanban for brand's posted gigs (with drag-and-drop and customizable columns).

Ping back with what worked and broke, and I'll deliver 2B.
