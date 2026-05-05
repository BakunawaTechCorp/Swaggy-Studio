/**
 * Server-side helper: load the current user's profile bundle.
 *
 * Used by every marketplace page/route to know:
 *   - does this user have a brand profile?
 *   - does this user have a partner profile?
 *   - what mode are they currently in?
 *
 * Returns null for missing profiles. Callers decide whether to redirect to
 * onboarding.
 */
import { createClient } from "@/lib/supabase/server";
import { DEV_OFFLINE_FALLBACK, withTimeout, isTimeout } from "@/lib/dev-bypass";
import type {
  ActiveMode,
  BrandProfile,
  PartnerProfile,
  ProfileBundle,
} from "./types";

export async function getProfileBundle(): Promise<{
  userId: string | null;
  bundle: ProfileBundle | null;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, bundle: null };

  const combined = await withTimeout(
    Promise.all([
      supabase.from("brand_profile").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("partner_profile").select("*").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("user_settings")
        .select("active_mode")
        .eq("user_id", user.id)
        .maybeSingle(),
    ])
  );

  if (isTimeout(combined)) {
    if (DEV_OFFLINE_FALLBACK) {
      return {
        userId: user.id,
        bundle: { brand: null, partner: null, active_mode: "brand" },
      };
    }
    return { userId: user.id, bundle: null };
  }

  const [brandRes, partnerRes, settingsRes] = combined;
  const brand = (brandRes.data as BrandProfile | null) ?? null;
  const partner = (partnerRes.data as PartnerProfile | null) ?? null;

  // Determine active_mode: prefer stored, but coerce to a mode the user
  // actually has a profile for. Otherwise default to whichever they have,
  // else 'brand' (so they get prompted to create a brand profile).
  let active: ActiveMode =
    (settingsRes.data?.active_mode as ActiveMode | undefined) ?? "brand";

  if (active === "brand" && !brand && partner) active = "partner";
  if (active === "partner" && !partner && brand) active = "brand";

  return {
    userId: user.id,
    bundle: { brand, partner, active_mode: active },
  };
}

/**
 * Convenience: just the active_mode, with all the fallback logic.
 * Use this when a page only needs to know the current mode.
 */
export async function getActiveMode(): Promise<ActiveMode | null> {
  const { bundle } = await getProfileBundle();
  return bundle?.active_mode ?? null;
}
