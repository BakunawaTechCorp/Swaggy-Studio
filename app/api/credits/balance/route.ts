import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { observeApiRoute, type ApiRequestContext } from "@/lib/observability";
import { DEV_OFFLINE_FALLBACK, withTimeout, isTimeout } from "@/lib/dev-bypass";

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

  const result = await withTimeout(
    supabase
      .from("user_settings")
      .select("credits_balance, unlimited_credits, is_master")
      .eq("user_id", user.id)
      .maybeSingle()
  );

  if (isTimeout(result)) {
    if (DEV_OFFLINE_FALLBACK) {
      return NextResponse.json({ balance: 999999, unlimited: true, isMaster: true });
    }
    return NextResponse.json({ error: "balance_fetch_failed" }, { status: 500 });
  }

  const { data, error } = result;
  if (error) {
    if (DEV_OFFLINE_FALLBACK) {
      return NextResponse.json({ balance: 999999, unlimited: true, isMaster: true });
    }
    console.error("[credits.balance]", error);
    return NextResponse.json({ error: "balance_fetch_failed" }, { status: 500 });
  }

  if (!data) {
    if (DEV_OFFLINE_FALLBACK) {
      return NextResponse.json({ balance: 999999, unlimited: true, isMaster: true });
    }
    return NextResponse.json({ balance: 0, unlimited: false, isMaster: false });
  }

  return NextResponse.json({
    balance: data.credits_balance ?? 0,
    unlimited: data.unlimited_credits ?? false,
    isMaster: data.is_master ?? false,
  });
}

export const GET = observeApiRoute("/api/credits/balance", handleGet);
