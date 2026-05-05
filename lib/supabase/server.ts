import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Dev bypass: when true, server-side auth checks return a fake master user
// without ever calling the Supabase auth endpoint. Mirrors lib/supabase/middleware.ts.
const DEV_BYPASS_AUTH = false;
const MASTER_USER_ID = "00000000-0000-4000-8000-000000000000";

export function createClient() {
  const cookieStore = cookies();

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // See note above.
          }
        },
      },
    }
  );

  if (DEV_BYPASS_AUTH) {
    const fakeUser = {
      id: MASTER_USER_ID,
      email: "dev@swaggy.local",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
      created_at: new Date(0).toISOString(),
    };
    const auth = client.auth as unknown as {
      getUser: () => Promise<unknown>;
      getSession: () => Promise<unknown>;
    };
    auth.getUser = async () => ({ data: { user: fakeUser }, error: null });
    auth.getSession = async () => ({
      data: { session: { user: fakeUser } },
      error: null,
    });
  }

  return client;
}
