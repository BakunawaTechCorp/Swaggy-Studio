import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { observeApiRoute, type ApiRequestContext } from "@/lib/observability";
import { requireSameOrigin } from "@/lib/security";
import type { LibraryItemKind } from "@/lib/library/types";

export const runtime = "nodejs";

const VALID_KINDS = new Set<LibraryItemKind>([
  "caption",
  "image",
  "campaign",
  "press_release",
]);

async function handleGet(_request: Request, context: ApiRequestContext) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  context.userId = user.id;

  const { data, error } = await supabase
    .from("library_items")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[library.list]", error);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

async function handlePost(request: Request, context: ApiRequestContext) {
  const csrfError = requireSameOrigin(request);
  if (csrfError) return csrfError;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  context.userId = user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;

  const kind = typeof input.kind === "string" ? input.kind : "";
  if (!VALID_KINDS.has(kind as LibraryItemKind)) {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }

  const title =
    typeof input.title === "string" ? input.title.trim().slice(0, 200) : "";
  if (!title) {
    return NextResponse.json(
      { error: "missing_field", field: "title" },
      { status: 400 }
    );
  }

  const payload =
    input.payload && typeof input.payload === "object" ? input.payload : null;
  if (!payload) {
    return NextResponse.json(
      { error: "missing_field", field: "payload" },
      { status: 400 }
    );
  }

  const thumbnail_url =
    typeof input.thumbnail_url === "string" ? input.thumbnail_url : null;
  const metadata =
    input.metadata && typeof input.metadata === "object" ? input.metadata : {};

  const { data, error } = await supabase
    .from("library_items")
    .insert({
      user_id: user.id,
      kind: kind as LibraryItemKind,
      title,
      payload,
      thumbnail_url,
      metadata,
    })
    .select()
    .single();

  if (error) {
    console.error("[library.create]", error);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}

export const GET = observeApiRoute("/api/library", handleGet);
export const POST = observeApiRoute("/api/library", handlePost);
