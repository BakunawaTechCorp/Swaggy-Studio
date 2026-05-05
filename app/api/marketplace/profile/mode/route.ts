import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { observeApiRoute, type ApiRequestContext } from "@/lib/observability";
import { requireSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

async function handlePost(request: Request, context: ApiRequestContext) {
  const csrfError = requireSameOrigin(request);
  if (csrfError) return csrfError;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  context.userId = user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const mode = (body as { mode?: unknown })?.mode;
  if (mode !== "brand" && mode !== "partner") {
    return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("set_active_mode", { p_mode: mode });

  if (error) {
    if (
      error.message?.includes("no_brand_profile") ||
      error.message?.includes("no_partner_profile")
    ) {
      return NextResponse.json(
        { error: "missing_profile", missing: mode },
        { status: 409 }
      );
    }
    console.error("[marketplace.profile.mode]", error);
    return NextResponse.json({ error: "mode_switch_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, active_mode: data });
}

export const POST = observeApiRoute("/api/marketplace/profile/mode", handlePost);
