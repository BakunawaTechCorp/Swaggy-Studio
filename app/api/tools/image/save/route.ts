import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { observeApiRoute, type ApiRequestContext } from "@/lib/observability";
import { requireSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 30;

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

  const { base64, mimeType } = body as { base64?: string; mimeType?: string };
  if (typeof base64 !== "string" || base64.length === 0) {
    return NextResponse.json({ error: "missing_image" }, { status: 400 });
  }

  const ext = (mimeType ?? "image/png").includes("jpeg") ? "jpg" : "png";
  const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const buffer = Buffer.from(base64, "base64");

  const { error: uploadError } = await supabase.storage
    .from("generated-images")
    .upload(path, buffer, {
      contentType: mimeType ?? "image/png",
      upsert: false,
    });

  if (uploadError) {
    console.error("[image.save] upload error", uploadError);
    return NextResponse.json(
      { error: "upload_failed", reason: uploadError.message },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("generated-images").getPublicUrl(path);

  return NextResponse.json({ url: publicUrl, path });
}

export const POST = observeApiRoute("/api/tools/image/save", handlePost);
