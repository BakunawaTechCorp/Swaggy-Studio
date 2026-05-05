/**
 * Tiny client-side fetch cache + in-flight dedupe.
 *
 * Why this exists:
 *   - Rail / Sidebar / page hooks all fetch the same shell endpoints
 *     (/api/marketplace/profile, /api/connections, /api/credits/balance) on
 *     every mount.
 *   - In dev we send `Cache-Control: no-store` to dodge stale-CSS issues, so
 *     the browser can't dedupe.
 *   - Result: 3-5 redundant Supabase round-trips per page load, each 400-2000ms.
 *
 * What it does:
 *   - In-flight promises are shared by URL — concurrent callers get one fetch.
 *   - Successful responses are cached for `ttlMs` (default 30s).
 *   - `invalidate(url)` busts the cache after a known mutation.
 *
 * Out of scope:
 *   - Any cross-tab sync (use BroadcastChannel later if needed).
 *   - Background revalidation (SWR-style). Add when this becomes a bottleneck.
 */

type Entry = {
  ts: number;
  data: unknown;
};

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL_MS = 30_000;

export async function cachedFetchJson<T = unknown>(
  url: string,
  options?: { ttlMs?: number; force?: boolean }
): Promise<T> {
  const ttl = options?.ttlMs ?? DEFAULT_TTL_MS;
  const force = options?.force ?? false;

  if (!force) {
    const hit = cache.get(url);
    if (hit && Date.now() - hit.ts < ttl) {
      return hit.data as T;
    }
    const pending = inflight.get(url);
    if (pending) {
      return pending as Promise<T>;
    }
  }

  const promise = (async () => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    const json = (await res.json()) as unknown;
    cache.set(url, { ts: Date.now(), data: json });
    return json;
  })();

  inflight.set(url, promise);
  try {
    return (await promise) as T;
  } finally {
    inflight.delete(url);
  }
}

export function invalidate(url: string) {
  cache.delete(url);
  inflight.delete(url);
}

export function invalidateAll() {
  cache.clear();
  inflight.clear();
}
