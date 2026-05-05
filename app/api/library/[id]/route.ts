import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logApiOutcome, type ApiRequestContext } from "@/lib/observability";
import { requireSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

// Inline observability — Next 14 dynamic route handlers receive `{ params }`
// as their second argument, which the shared observeApiRoute wrapper doesn't
// pass through. Auth, CSRF, and logging are duplicated here on purpose.
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const context: ApiRequestContext = {
    requestId:
      request.headers.get("x-request-id") ?? crypto.randomUUID(),
    route: "/api/library/[id]",
    method: "DELETE",
    startedAt: Date.now(),
  };

  try {
    const csrfError = requireSameOrigin(request);
    if (csrfError) {
      logApiOutcome(context, "error", csrfError.status);
      return csrfError;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      logApiOutcome(context, "error", 401);
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    context.userId = user.id;

    const id = params?.id;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      logApiOutcome(context, "error", 400);
      return NextResponse.json({ error: "invalid_id" }, { status: 400 });
    }

    const { error } = await supabase
      .from("library_items")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("[library.delete]", error);
      logApiOutcome(context, "error", 500, { error: error.message });
      return NextResponse.json({ error: "delete_failed" }, { status: 500 });
    }

    logApiOutcome(context, "success", 200);
    return NextResponse.json({ ok: true }, {
      headers: { "X-Request-Id": context.requestId },
    });
  } catch (err) {
    logApiOutcome(context, "exception", 500, {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "internal_error", request_id: context.requestId },
      { status: 500, headers: { "X-Request-Id": context.requestId } }
    );
  }
}
