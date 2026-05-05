import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { observeApiRoute, type ApiRequestContext } from "@/lib/observability";
import { requireSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

// TODO(phase 6): replace this with a Stripe checkout session. For now this is
// the dev / admin manual topup endpoint.
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

  const amount =
    typeof (body as { amount?: unknown })?.amount === "number"
      ? Math.floor((body as { amount: number }).amount)
      : NaN;

  if (!Number.isFinite(amount) || amount < 10 || amount > 10000) {
    return NextResponse.json(
      { error: "invalid_amount", min: 10, max: 10000 },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc("add_credits", {
    p_amount: amount,
    p_reason: "manual_topup",
    p_metadata: { source: "dev_topup_endpoint" },
  });

  if (error) {
    console.error("[credits.topup]", error);
    return NextResponse.json({ error: "topup_failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    newBalance: typeof data === "number" ? data : 0,
    addedCredits: amount,
  });
}

export const POST = observeApiRoute("/api/credits/topup", handlePost);
