import { NextResponse } from "next/server";
import { observeApiRoute, type ApiRequestContext } from "@/lib/observability";
import { getProfileBundle } from "@/lib/marketplace/profile";

export const runtime = "nodejs";

async function handleGet(_request: Request, context: ApiRequestContext) {
  const { userId, bundle } = await getProfileBundle();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  context.userId = userId;
  return NextResponse.json(bundle);
}

export const GET = observeApiRoute("/api/marketplace/profile", handleGet);
