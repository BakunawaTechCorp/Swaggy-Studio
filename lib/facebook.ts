import crypto from "node:crypto";

export const FB_GRAPH_VERSION = "v19.0";
export const FB_GRAPH = `https://graph.facebook.com/${FB_GRAPH_VERSION}`;
export const FB_OAUTH = "https://www.facebook.com/v19.0/dialog/oauth";

export const FB_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
].join(",");

export const FB_STATE_COOKIE = "swaggy_fb_oauth_state";

export function getAppUrl(fallbackOrigin: string): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    fallbackOrigin
  );
}

export function getRedirectUri(appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/api/auth/facebook/callback`;
}

function getStateSecret(): string {
  if (process.env.FACEBOOK_APP_SECRET) {
    return process.env.FACEBOOK_APP_SECRET;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("FACEBOOK_APP_SECRET is required to sign OAuth state.");
  }

  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "dev-unsigned-state";
}

/**
 * Signs an OAuth state payload so the callback can verify both the cookie
 * and the state URL parameter were minted together for this user.
 */
export function signOAuthState(userId: string, nonce: string): string {
  const payload = `${userId}.${nonce}`;
  const sig = crypto
    .createHmac("sha256", getStateSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyOAuthState(
  token: string | undefined | null,
  expectedUserId: string
): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [userId, nonce, sig] = parts;
  if (userId !== expectedUserId) return false;

  const expected = crypto
    .createHmac("sha256", getStateSecret())
    .update(`${userId}.${nonce}`)
    .digest("base64url");

  if (expected.length !== sig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

export function makeNonce(): string {
  return crypto.randomBytes(16).toString("base64url");
}

export async function validateAndRefreshPageToken(
  pageId: string,
  pageToken: string
): Promise<string> {
  const accountsUrl = `${FB_GRAPH}/me/accounts?${new URLSearchParams({
    fields: "id,access_token",
    access_token: pageToken,
  }).toString()}`;

  const accountsRes = await fetch(accountsUrl, { cache: "no-store" });
  if (accountsRes.ok) {
    const accountsJson = (await accountsRes.json()) as {
      data?: Array<{ id?: unknown; access_token?: unknown }>;
    };
    const page = accountsJson.data?.find((item) => item.id === pageId);
    if (typeof page?.access_token === "string" && page.access_token) {
      return page.access_token;
    }
  }

  const validateRes = await fetch(
    `${FB_GRAPH}/${encodeURIComponent(pageId)}?${new URLSearchParams({
      fields: "id",
      access_token: pageToken,
    }).toString()}`,
    { cache: "no-store" }
  );

  if (!validateRes.ok) {
    throw new Error("facebook_token_invalid");
  }

  return pageToken;
}
