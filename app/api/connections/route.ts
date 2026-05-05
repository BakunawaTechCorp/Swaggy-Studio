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
      .from("connections")
      .select("id, provider, display_name, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
  );

  if (isTimeout(result)) {
    if (DEV_OFFLINE_FALLBACK) {
      return NextResponse.json({ connections: [] });
    }
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }

  const { data, error } = result;
  if (error) {
    if (DEV_OFFLINE_FALLBACK) {
      return NextResponse.json({ connections: [] });
    }
    console.error("[connections.list]", error);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }

  return NextResponse.json({ connections: data ?? [] });
}

export const GET = observeApiRoute("/api/connections", handleGet);
