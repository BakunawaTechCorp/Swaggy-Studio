# Deploying Swaggy Studio

## Prerequisites
- GitHub repo
- Vercel account
- Supabase project (with schema applied — see `supabase/schema.sql`)
- Anthropic API key
- Google AI Studio API key (for Gemini / Imagen)

## Steps

1. **Push to GitHub.** From repo root: `git push origin main`

2. **Import to Vercel.** vercel.com → Add New Project → select repo → Next.js auto-detected.

3. **Set environment variables in Vercel.** Project Settings → Environment Variables. Copy variable names from `.env.example`. Set each for **Production, Preview, and Development**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (the JWT, starts with `eyJ`)
   - `ANTHROPIC_API_KEY`
   - `GEMINI_API_KEY`

4. **Update Supabase auth URLs.** Supabase Dashboard → Authentication → URL Configuration:
   - Site URL: `https://your-domain.vercel.app`
   - Redirect URLs: add `https://your-domain.vercel.app/auth/callback`

5. **Deploy.** Vercel auto-deploys on every push to main. First deploy: 3–5 min.

6. **Smoke-test in production:**
   - Sign up with a real email
   - Verify the email link redirects correctly
   - Generate a caption → real Claude output
   - Generate an image → real Imagen image
   - Save to Library → persists
   - Generate a press release → outputs correctly

## Common production issues

- **`server_misconfigured` 500s** → an env var is missing in Vercel. Check function logs.
- **Auth callback errors** → Supabase Auth URLs not updated for the production domain.
- **Function timeouts** → check `maxDuration` exports on the failing route. Hobby plan caps at 60s.
- **Image upload fails** → Supabase Storage bucket policies haven't been applied. Re-run `supabase/schema.sql` Storage section in SQL Editor.
- **TypeScript build errors** → `next dev` is more lenient than `next build`. Fix locally first.

## What's NOT yet production-ready

- Stripe billing (manual credit top-ups only)
- Meta OAuth (no FB/IG posting until app review)
- Custom domain (using `*.vercel.app`)
- Privacy policy / terms of service pages
- Production-grade email deliverability (Supabase default sender hits spam)
