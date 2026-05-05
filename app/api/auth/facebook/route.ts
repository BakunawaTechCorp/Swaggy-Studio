import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  FB_OAUTH,
  FB_SCOPES,
  FB_STATE_COOKIE,
  getAppUrl,
  getRedirectUri,
  makeNonce,
  signOAuthState,
} from "@/lib/facebook";
import { observeApiRoute, type ApiRequestContext } from "@/lib/observability";

export const runtime = "nodejs";

async function handleGet(request: Request, context: ApiRequestContext) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const origin = new URL(request.url).origin;

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }
  context.userId = user.id;

  if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
    return NextResponse.json(
      { error: "facebook_not_configured" },
      { status: 500 }
    );
  }

  const appUrl = getAppUrl(origin);
  const redirectUri = getRedirectUri(appUrl);
  const state = signOAuthState(user.id, makeNonce());

  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID,
    redirect_uri: redirectUri,
    scope: FB_SCOPES,
    response_type: "code",
    state,
  });

  const res = NextResponse.redirect(`${FB_OAUTH}?${params.toString()}`);
  res.cookies.set(FB_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10, // 10 minutes
  });
  return res;
}

export const GET = observeApiRoute("/api/auth/facebook", handleGet);
