import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const csrfError = requireSameOrigin(request);
  if (csrfError) return csrfError;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("connections")
    .delete()
    .eq("user_id", user.id)
    .eq("id", params.id);

  if (error) {
    console.error("[connections.delete]", error);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
