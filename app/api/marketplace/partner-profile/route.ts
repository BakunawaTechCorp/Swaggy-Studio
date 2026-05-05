import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { observeApiRoute, type ApiRequestContext } from "@/lib/observability";
import { requireSameOrigin } from "@/lib/security";
import { NICHES, PARTNER_TYPES, REGIONS } from "@/lib/marketplace/types";

export const runtime = "nodejs";

const VALID_PARTNER_TYPES = new Set(PARTNER_TYPES.map((p) => p.value));
const VALID_NICHES = new Set<string>(NICHES);
const VALID_REGIONS = new Set<string>(REGIONS);

function sanitizeStringArray(input: unknown, allowed?: Set<string>): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0 && s.length < 60)
    .filter((s) => (allowed ? allowed.has(s) : true))
    .slice(0, 20);
}

function sanitizeFreeTextArray(input: unknown, max = 20): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 60)
    .slice(0, max);
}

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
    .from("partner_profile")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[partner-profile.get]", error);
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

  const display_name =
    typeof input.display_name === "string" ? input.display_name.trim() : "";
  if (!display_name) {
    return NextResponse.json(
      { error: "missing_field", field: "display_name" },
      { status: 400 }
    );
  }
  if (display_name.length > 80) {
    return NextResponse.json({ error: "field_too_long", field: "display_name" }, { status: 400 });
  }

  const partner_type = typeof input.partner_type === "string" ? input.partner_type : "";
  if (!VALID_PARTNER_TYPES.has(partner_type as never)) {
    return NextResponse.json(
      { error: "invalid_field", field: "partner_type" },
      { status: 400 }
    );
  }

  const region =
    typeof input.region === "string" && VALID_REGIONS.has(input.region.trim())
      ? input.region.trim()
      : null;

  const audience_size_raw = input.audience_size;
  const audience_size =
    typeof audience_size_raw === "number" && Number.isFinite(audience_size_raw)
      ? Math.max(0, Math.floor(audience_size_raw))
      : null;

  const rate_min_raw = input.rate_card_min;
  const rate_max_raw = input.rate_card_max;
  const rate_card_min =
    typeof rate_min_raw === "number" && Number.isFinite(rate_min_raw)
      ? Math.max(0, Math.floor(rate_min_raw))
      : null;
  const rate_card_max =
    typeof rate_max_raw === "number" && Number.isFinite(rate_max_raw)
      ? Math.max(0, Math.floor(rate_max_raw))
      : null;

  if (rate_card_min != null && rate_card_max != null && rate_card_min > rate_card_max) {
    return NextResponse.json({ error: "rate_min_gt_max" }, { status: 400 });
  }

  const payload = {
    user_id: user.id,
    display_name,
    partner_type,
    bio: typeof input.bio === "string" ? input.bio.slice(0, 2000) || null : null,
    niches: sanitizeStringArray(input.niches, VALID_NICHES),
    region,
    audience_size,
    primary_outlet:
      typeof input.primary_outlet === "string" ? input.primary_outlet.trim() || null : null,
    outlet_url:
      typeof input.outlet_url === "string" ? input.outlet_url.trim() || null : null,
    portfolio_links: sanitizeFreeTextArray(input.portfolio_links, 10),
    rate_card_min,
    rate_card_max,
    keywords: sanitizeFreeTextArray(input.keywords, 20).map((k) => k.toLowerCase()),
  };

  const { data, error } = await supabase
    .from("partner_profile")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    console.error("[partner-profile.put]", error);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}

export const GET = observeApiRoute("/api/marketplace/partner-profile", handleGet);
export const PUT = observeApiRoute("/api/marketplace/partner-profile", handlePut);
