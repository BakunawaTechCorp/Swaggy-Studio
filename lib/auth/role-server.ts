import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { isValidRole, type UserRole } from "./role";

/**
 * Resolve the role of the currently authenticated user. Returns null when
 * unauthenticated. Defaults to "free" if no user_settings row exists yet.
 */
export async function getCurrentRole(): Promise<{
  user_id: string;
  role: UserRole;
} | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("user_settings")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = isValidRole(data?.role) ? data!.role : "free";
  return { user_id: user.id, role };
}

/**
 * Service-role Supabase client for admin operations (listing users via the
 * auth admin API, deleting users, etc.). Throws if SUPABASE_SERVICE_ROLE_KEY
 * isn't set — never call this from code paths reachable without an admin
 * check.
 */
export function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "service_role_misconfigured: SUPABASE_SERVICE_ROLE_KEY is not set"
    );
  }
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
