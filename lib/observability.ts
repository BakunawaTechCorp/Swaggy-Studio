import { NextResponse } from "next/server";

export type ApiRequestContext = {
  requestId: string;
  route: string;
  method: string;
  startedAt: number;
  userId?: string;
};

type ApiHandler = (
  request: Request,
  context: ApiRequestContext
) => Response | Promise<Response>;

export function observeApiRoute(route: string, handler: ApiHandler) {
  return async function observed(request: Request) {
    const context: ApiRequestContext = {
      requestId: getRequestId(request),
      route,
      method: request.method,
      startedAt: Date.now(),
    };

    try {
      const response = await handler(request, context);
      response.headers.set("X-Request-Id", context.requestId);
      logApiOutcome(context, response.status < 500 ? "success" : "error", response.status);
      return response;
    } catch (err) {
      logApiOutcome(context, "exception", 500, {
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { error: "internal_error", request_id: context.requestId },
        {
          status: 500,
          headers: { "X-Request-Id": context.requestId },
        }
      );
    }
  };
}

export function logApiOutcome(
  context: ApiRequestContext,
  outcome: "success" | "error" | "exception",
  status: number,
  extra: Record<string, unknown> = {}
) {
  const event = {
    level: outcome === "success" ? "info" : "error",
    request_id: context.requestId,
    user_id: context.userId ?? null,
    route: context.route,
    method: context.method,
    latency_ms: Date.now() - context.startedAt,
    status,
    outcome,
    ...extra,
  };

  const line = JSON.stringify(event);
  if (outcome === "success") {
    console.info(line);
  } else {
    console.error(line);
  }
}

function getRequestId(request: Request): string {
  return (
    request.headers.get("x-request-id") ??
    request.headers.get("x-vercel-id") ??
    crypto.randomUUID()
  );
}
