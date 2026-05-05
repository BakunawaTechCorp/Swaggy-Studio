import { NextResponse } from "next/server";

export function requireSameOrigin(request: Request): NextResponse | null {
  const requestUrl = new URL(request.url);
  const allowed = new Set([
    requestUrl.origin,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter(Boolean));

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const candidate = origin ?? (referer ? new URL(referer).origin : null);

  if (!candidate) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "missing_origin" }, { status: 403 });
    }
    return null;
  }

  if (!allowed.has(candidate)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  return null;
}
