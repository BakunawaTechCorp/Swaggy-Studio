import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/redirects";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = getSafeRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Something went wrong — back to login with an error flag.
  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
