import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { observeApiRoute, type ApiRequestContext } from "@/lib/observability";
import { requireSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

async function handleGet(_request: Request, context: ApiRequestContext) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  context.userId = user.id;

  const { data, error } = await supabase
    .from("brand_profile")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[brand-profile.get]", error);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  return NextResponse.json({ profile: data ?? null });
}

async function handlePut(request: Request, context: ApiRequestContext) {
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

  const input = body as Record<string, unknown>;

  // Validate required fields on first create
  const company_name =
    typeof input.company_name === "string" ? input.company_name.trim() : "";
  if (!company_name) {
    return NextResponse.json(
      { error: "missing_field", field: "company_name" },
      { status: 400 }
    );
  }
  if (company_name.length > 120) {
    return NextResponse.json({ error: "field_too_long", field: "company_name" }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    user_id: user.id,
    company_name,
    website: typeof input.website === "string" ? input.website.trim() || null : null,
    industry: typeof input.industry === "string" ? input.industry.trim() || null : null,
    description:
      typeof input.description === "string"
        ? input.description.slice(0, 2000) || null
        : null,
    logo_url: typeof input.logo_url === "string" ? input.logo_url.trim() || null : null,
    contact_email:
      typeof input.contact_email === "string" ? input.contact_email.trim() || null : null,
  };

  const { data, error } = await supabase
    .from("brand_profile")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    console.error("[brand-profile.put]", error);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}

export const GET = observeApiRoute("/api/marketplace/brand-profile", handleGet);
export const PUT = observeApiRoute("/api/marketplace/brand-profile", handlePut);
