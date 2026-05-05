import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client.
 *
 * `NEXT_PUBLIC_*` variables are embedded when the dev server **starts** (or at
 * `next build` time). If you edit `.env.local`, you must fully stop and
 * restart `npm run dev`. Hot reload does not refresh them. If you use
 * `next start`, run `npm run build` again after any env change.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (process.env.NODE_ENV === "development") {
    const u = url?.trim() ?? "";
    const k = key?.trim() ?? "";
    const bad =
      !u ||
      !k ||
      u.includes("your-project-ref") ||
      k === "your-anon-key" ||
      k.length < 20;
    if (bad) {
      // eslint-disable-next-line no-console
      console.error(
        "[Swaggy Studio] Supabase env missing or still placeholders in this JS bundle.\n" +
          "→ Save `.env.local` in the project folder (next to package.json).\n" +
          "→ Stop the dev server (Ctrl+C), then run `npm run dev` again.\n" +
          "→ If you use `next start`, run `npm run build` after changing env.\n" +
          "→ Check you are not running Next from a different copy of the repo."
      );
    }
  }

  return createBrowserClient(url!, key!);
}
