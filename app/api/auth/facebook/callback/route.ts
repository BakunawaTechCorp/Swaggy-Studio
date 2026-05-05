import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  FB_GRAPH,
  FB_STATE_COOKIE,
  getAppUrl,
  getRedirectUri,
  verifyOAuthState,
} from "@/lib/facebook";
import { observeApiRoute, type ApiRequestContext } from "@/lib/observability";
import { encryptSecret } from "@/lib/token-crypto";

export const runtime = "nodejs";

function fail(origin: string, reason: string) {
  const url = new URL("/connections", origin);
  url.searchParams.set("fb", "error");
  url.searchParams.set("reason", reason);
  const res = NextResponse.redirect(url);
  res.cookies.set(FB_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

async function handleGet(request: Request, context: ApiRequestContext) {
  const reqUrl = new URL(request.url);
  const origin = reqUrl.origin;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  context.userId = user.id;

  const fbError = reqUrl.searchParams.get("error");
  if (fbError) return fail(origin, fbError);

  const code = reqUrl.searchParams.get("code");
  const state = reqUrl.searchParams.get("state");
  const cookieState = request.headers
    .get("cookie")
    ?.split(/;\s*/)
    .map((p) => p.split("="))
    .find(([k]) => k === FB_STATE_COOKIE)?.[1];

  if (!code || !state || !cookieState) return fail(origin, "missing_params");
  if (cookieState !== state) return fail(origin, "state_mismatch");

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) return fail(origin, "not_configured");

  if (!verifyOAuthState(state, user.id)) return fail(origin, "state_invalid");

  const redirectUri = getRedirectUri(getAppUrl(origin));

  try {
    // 1. Code -> short-lived user access token.
    const tokenRes = await fetch(
      `${FB_GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          code,
        }).toString(),
      { cache: "no-store" }
    );
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || typeof tokenJson?.access_token !== "string") {
      console.error("[fb/callback] code exchange failed", tokenJson);
      return fail(origin, "code_exchange_failed");
    }
    const shortLivedUserToken: string = tokenJson.access_token;

    // 2. Short-lived -> long-lived user token.
    const longRes = await fetch(
      `${FB_GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: shortLivedUserToken,
        }).toString(),
      { cache: "no-store" }
    );
    const longJson = await longRes.json();
    const longLivedUserToken: string =
      typeof longJson?.access_token === "string"
        ? longJson.access_token
        : shortLivedUserToken;

    // 3. /me/accounts with the long-lived token returns pages + per-page access tokens.
    const pagesRes = await fetch(
      `${FB_GRAPH}/me/accounts?` +
        new URLSearchParams({
          access_token: longLivedUserToken,
          fields: "id,name,access_token",
          limit: "50",
        }).toString(),
      { cache: "no-store" }
    );
    const pagesJson = await pagesRes.json();
    if (!pagesRes.ok || !Array.isArray(pagesJson?.data)) {
      console.error("[fb/callback] pages fetch failed", pagesJson);
      return fail(origin, "pages_fetch_failed");
    }

    type PageRow = { id: string; name: string; access_token: string };
    const pages: PageRow[] = pagesJson.data.filter(
      (p: unknown): p is PageRow =>
        !!p &&
        typeof p === "object" &&
        typeof (p as PageRow).id === "string" &&
        typeof (p as PageRow).name === "string" &&
        typeof (p as PageRow).access_token === "string"
    );

    if (pages.length === 0) return fail(origin, "no_pages");

    // First page for the MVP. A picker can come later.
    const chosen = pages[0];

    // 4. Persist to user_settings (upsert).
    const { error: dbError } = await supabase
      .from("user_settings")
      .upsert(
        {
          user_id: user.id,
          fb_access_token: null,
          fb_access_token_encrypted: encryptSecret(chosen.access_token),
          fb_page_id: chosen.id,
          fb_page_name: chosen.name,
        },
        { onConflict: "user_id" }
      );
    if (dbError) {
      console.error("[fb/callback] db upsert failed", dbError);
      return fail(origin, "db_error");
    }

    // Mirror to the new connections table (Phase 1 unified schema).
    const { error: connError } = await supabase
      .from("connections")
      .upsert(
        {
          user_id: user.id,
          provider: "facebook",
          provider_account_id: chosen.id,
          display_name: chosen.name,
          access_token_encrypted: encryptSecret(chosen.access_token),
          scopes: ["pages_manage_posts", "pages_read_engagement"],
        },
        { onConflict: "user_id,provider,provider_account_id" }
      );
    if (connError) {
      console.error("[fb/callback] connections upsert failed", connError);
    }

    const done = new URL("/connections", origin);
    done.searchParams.set("fb", "connected");
    const res = NextResponse.redirect(done);
    res.cookies.set(FB_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  } catch (err) {
    console.error("[fb/callback] unexpected", err);
    return fail(origin, "unexpected");
  }
}

export const GET = observeApiRoute("/api/auth/facebook/callback", handleGet);
