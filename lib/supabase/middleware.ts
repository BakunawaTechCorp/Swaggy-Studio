import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSafeRedirectPath } from "@/lib/redirects";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/auth/callback"];
const DEV_BYPASS_AUTH = false;

// Pages that should bounce *authenticated* users back into the app.
const AUTH_PAGES = new Set(["/login", "/signup"]);
const NO_STORE_PAGE_PATHS = new Set(["/home", "/create", "/login", "/signup"]);

// Next.js App Router metadata routes that resolve to public image assets.
const METADATA_ROUTES = new Set([
  "/icon",
  "/apple-icon",
  "/opengraph-image",
  "/twitter-image",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
]);

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  // Allow Next.js internal assets and static files.
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/assets")) return true;
  // API routes enforce their own auth and must not be HTML-redirected to /login.
  if (pathname.startsWith("/api/")) return true;
  // App Router metadata image routes are public by nature.
  if (METADATA_ROUTES.has(pathname)) return true;
  return false;
}

function withNoStoreHeaders(response: NextResponse, pathname: string) {
  // In development, force no-store on every non-asset response. This prevents
  // the browser from rendering a stale HTML shell that references CSS / JS
  // chunk URLs from a previous build (the classic "page renders unstyled
  // after rebuild" bug).
  const isDev = process.env.NODE_ENV !== "production";
  const isAsset =
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/favicon") ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico|woff2?|css|js|map)$/i.test(pathname);

  if ((isDev && !isAsset) || NO_STORE_PAGE_PATHS.has(pathname)) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  }
  return response;
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (DEV_BYPASS_AUTH) {
    return withNoStoreHeaders(NextResponse.next({
      request: { headers: request.headers },
    }), pathname);
  }

  // Fast-path: skip the Supabase round-trip entirely for paths that never
  // need an auth decision. Hitting `getUser()` on the landing page added
  // ~300-500ms to the "Get started" → /login transition for no benefit.
  const SKIP_AUTH_PATHS = new Set(["/"]);
  if (
    SKIP_AUTH_PATHS.has(pathname) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/favicon")
  ) {
    return withNoStoreHeaders(
      NextResponse.next({ request: { headers: request.headers } }),
      pathname
    );
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return withNoStoreHeaders(NextResponse.redirect(url), pathname);
  }

  // Signed-in users shouldn't linger on /login or /signup — send them into
  // the product. Honour ?redirectTo= if present so deep links still work.
  if (user && AUTH_PAGES.has(pathname)) {
    const requested = request.nextUrl.searchParams.get("redirectTo");
    const url = new URL(
      getSafeRedirectPath(requested),
      request.nextUrl.origin
    );
    return withNoStoreHeaders(NextResponse.redirect(url), pathname);
  }

  return withNoStoreHeaders(response, pathname);
}
