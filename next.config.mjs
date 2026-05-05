/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  // Belt-and-suspenders cache-busting in dev. Middleware already does this
  // for routed pages, but `headers()` covers anything that bypasses it (e.g.
  // direct file responses). In production we leave caching alone so Next's
  // hashed chunk URLs do their job.
  async headers() {
    if (!isDev) return [];
    // Only target HTML page routes — never `_next` chunks (would break HMR and
    // tank dev perf) and never static assets.
    const noStore = [
      { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
      { key: "Pragma", value: "no-cache" },
      { key: "Expires", value: "0" },
    ];
    return [
      { source: "/", headers: noStore },
      // Match any path that does NOT start with `_next`, `assets`, `favicon`,
      // or end in a static asset extension.
      {
        source:
          "/:path((?!_next/|assets/|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|css|js|map)$).*)",
        headers: noStore,
      },
    ];
  },
};

export default nextConfig;
