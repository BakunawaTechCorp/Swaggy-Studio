import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FB_GRAPH, validateAndRefreshPageToken } from "@/lib/facebook";
import { observeApiRoute, type ApiRequestContext } from "@/lib/observability";
import { requireSameOrigin } from "@/lib/security";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "@/lib/token-crypto";

export const runtime = "nodejs";

async function handlePost(request: Request, context: ApiRequestContext) {
  const csrfError = requireSameOrigin(request);
  if (csrfError) return csrfError;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  context.userId = user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const input = body as Partial<{ photo_url: unknown; caption: unknown }>;
  const photoUrl =
    typeof input.photo_url === "string" ? input.photo_url.trim() : "";
  const caption =
    typeof input.caption === "string" ? input.caption.trim() : "";

  if (!photoUrl || !/^https?:\/\//i.test(photoUrl)) {
    return NextResponse.json({ error: "invalid_photo_url" }, { status: 400 });
  }
  if (!caption) {
    return NextResponse.json({ error: "missing_caption" }, { status: 400 });
  }

  // Defense-in-depth: only accept photos hosted on our Supabase project.
  try {
    const host = new URL(photoUrl).host;
    const allowed = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host;
    if (host !== allowed) {
      return NextResponse.json({ error: "invalid_photo_url" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "invalid_photo_url" }, { status: 400 });
  }

  const { data: settings, error: settingsError } = await supabase
    .from("user_settings")
    .select("fb_access_token, fb_access_token_encrypted, fb_page_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (settingsError) {
    console.error("[post-facebook] settings fetch", settingsError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  let pageToken =
    typeof settings?.fb_access_token_encrypted === "string"
      ? decryptSecret(settings.fb_access_token_encrypted)
      : settings?.fb_access_token;
  const pageId = settings?.fb_page_id;
  if (!pageToken || !pageId) {
    return NextResponse.json(
      { error: "facebook_not_connected" },
      { status: 428 }
    );
  }

  try {
    const refreshedToken = await validateAndRefreshPageToken(pageId, pageToken);
    if (refreshedToken !== pageToken || !isEncryptedSecret(settings?.fb_access_token_encrypted)) {
      pageToken = refreshedToken;
      const { error: tokenUpdateError } = await supabase
        .from("user_settings")
        .update({
          fb_access_token: null,
          fb_access_token_encrypted: encryptSecret(refreshedToken),
        })
        .eq("user_id", user.id);

      if (tokenUpdateError) {
        console.error("[post-facebook] token update failed", tokenUpdateError);
      }
    }
  } catch (err) {
    console.error("[post-facebook] token validation failed", err);
    return NextResponse.json({ error: "facebook_token_invalid" }, { status: 428 });
  }

  // Post to the Page's /photos edge. Graph accepts the URL directly — no need to proxy bytes.
  const fbBody = new URLSearchParams({
    url: photoUrl,
    caption,
    access_token: pageToken,
  });

  let fbJson: unknown;
  try {
    const fbRes = await fetch(`${FB_GRAPH}/${encodeURIComponent(pageId)}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: fbBody.toString(),
      cache: "no-store",
    });
    fbJson = await fbRes.json();
    if (!fbRes.ok) {
      console.error("[post-facebook] graph error", fbJson);
      return NextResponse.json(
        { error: "facebook_error" },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("[post-facebook] graph fetch", err);
    return NextResponse.json({ error: "network_error" }, { status: 502 });
  }

  const fbPostId =
    typeof (fbJson as { post_id?: unknown })?.post_id === "string"
      ? (fbJson as { post_id: string }).post_id
      : typeof (fbJson as { id?: unknown })?.id === "string"
        ? (fbJson as { id: string }).id
        : null;

  const now = new Date().toISOString();

  const { error: insertError } = await supabase.from("posts").insert({
    user_id: user.id,
    photo_url: photoUrl,
    caption,
    status: "posted",
    fb_page_id: pageId,
    fb_post_id: fbPostId,
    posted_at: now,
  });

  if (insertError) {
    // The post is already live on Facebook; log but don't surface a failure.
    console.error("[post-facebook] posts insert failed", insertError);
  }

  return NextResponse.json({ success: true, fb_post_id: fbPostId });
}

export const POST = observeApiRoute("/api/post-facebook", handlePost);
