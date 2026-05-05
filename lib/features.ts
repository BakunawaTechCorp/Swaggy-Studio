/**
 * Feature flags. Used to gate phased rollout.
 *
 * The marketplace ships in 5 internal phases (2A → 2E). Each later phase
 * lights up its features by flipping a flag here. This lets us merge code
 * for an unfinished phase without exposing it to users.
 *
 * IMPORTANT: when a flag is OFF, both the API and the UI must check it.
 * - API routes return 404 (not 403 — we want it to look like the route
 *   doesn't exist, since "coming soon" features shouldn't leak shape).
 * - UI renders a "Coming soon" stub instead of the real surface.
 *
 * For local-only testing, you can override these via env vars (see below).
 */

const ENV_OVERRIDES = {
  marketplaceEnabled: process.env.NEXT_PUBLIC_FF_MARKETPLACE,
  marketplaceMessaging: process.env.NEXT_PUBLIC_FF_MARKETPLACE_MESSAGING,
  marketplaceCoordinationPay: process.env.NEXT_PUBLIC_FF_MARKETPLACE_COORD_PAY,
  marketplaceEscrow: process.env.NEXT_PUBLIC_FF_MARKETPLACE_ESCROW,
} as const;

const DEFAULTS = {
  marketplaceEnabled: true,           // Phase 2A landed
  marketplaceMessaging: false,        // Phase 2C
  marketplaceCoordinationPay: false,  // Phase 2D
  marketplaceEscrow: false,           // Phase 2E — flip when legal + banking ready
} as const;

export type FeatureKey = keyof typeof DEFAULTS;

export const FEATURES: Record<FeatureKey, boolean> = (() => {
  const out: Record<FeatureKey, boolean> = { ...DEFAULTS };
  for (const k of Object.keys(out) as FeatureKey[]) {
    const env = ENV_OVERRIDES[k];
    if (env === "1" || env === "true") out[k] = true;
    if (env === "0" || env === "false") out[k] = false;
  }
  return out;
})();

export function isFeatureOn(key: FeatureKey): boolean {
  return Boolean(FEATURES[key]);
}
