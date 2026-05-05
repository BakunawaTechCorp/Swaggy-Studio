import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { observeApiRoute, type ApiRequestContext } from "@/lib/observability";

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
    .from("credit_ledger")
    .select("id, delta, reason, tool, metadata, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[credits.ledger]", error);
    return NextResponse.json({ error: "ledger_fetch_failed" }, { status: 500 });
  }

  return NextResponse.json({ entries: data ?? [] });
}

export const GET = observeApiRoute("/api/credits/ledger", handleGet);
