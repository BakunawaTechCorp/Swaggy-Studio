/**
 * Server-side credit spend / refund helpers.
 *
 * Every paid API route does:
 *   const spend = await spendOrFail("caption", { model });
 *   if (!spend.ok) return spend.response;
 *   try { ...do work... }
 *   catch { await refund("caption", { model }); throw; }
 *
 * Failure modes (all surface honestly — never silent):
 *   - insufficient_credits → 402
 *   - unauthorized         → 401
 *   - RPC error            → 503 service_unavailable
 *   - timeout / network    → 503 service_unavailable
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withTimeout, isTimeout } from "@/lib/dev-bypass";
import { getCost, type ActiveModelId, type ToolName } from "./costs";

export type SpendResult =
  | { ok: true; newBalance: number; cost: number }
  | { ok: false; response: NextResponse };

export type SpendOptions = {
  model?: ActiveModelId;
  multiplier?: number;
  metadata?: Record<string, unknown>;
};

export async function spendOrFail(
  tool: ToolName,
  options: SpendOptions = {}
): Promise<SpendResult> {
  const { model, multiplier = 1, metadata = {} } = options;
  const cost = getCost(tool, model, multiplier);

  // Free tools: no ledger entry, no cost.
  if (cost === 0) return { ok: true, newBalance: -1, cost: 0 };

  const supabase = createClient();
  const meta = { ...metadata, model };

  const result = await withTimeout(
    supabase.rpc("spend_credits", {
      p_amount: cost,
      p_reason: `${tool}_generate`,
      p_tool: tool,
      p_metadata: meta,
    }),
    2000
  );

  if (isTimeout(result)) {
    console.error("[credits.spend] timeout/network failure");
    return {
      ok: false,
      response: NextResponse.json(
        { error: "service_unavailable", reason: "credits_unreachable" },
        { status: 503 }
      ),
    };
  }

  const { data, error } = result;

  if (error) {
    if (error.message?.includes("insufficient_credits")) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "insufficient_credits", required: cost, tool },
          { status: 402 }
        ),
      };
    }
    if (error.message?.includes("unauthorized")) {
      return {
        ok: false,
        response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
      };
    }
    console.error("[credits.spend] rpc error", error);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "service_unavailable", reason: "credits_rpc_error" },
        { status: 503 }
      ),
    };
  }

  return {
    ok: true,
    newBalance: typeof data === "number" ? data : 0,
    cost,
  };
}

/**
 * Best-effort refund. Logs loudly on failure but never throws.
 */
export async function refund(
  tool: ToolName,
  options: SpendOptions = {}
): Promise<void> {
  const { model, multiplier = 1, metadata = {} } = options;
  const amount = getCost(tool, model, multiplier);
  if (amount === 0) return;

  const supabase = createClient();

  const result = await withTimeout(
    supabase.rpc("refund_credits", {
      p_amount: amount,
      p_reason: `${tool}_generate`,
      p_tool: tool,
      p_metadata: { ...metadata, model },
    }),
    2000
  );

  if (isTimeout(result)) {
    console.error("[credits.refund] timeout/network failure", { tool, amount });
    return;
  }
  if (result.error) {
    console.error("[credits.refund] failed", { tool, amount, error: result.error });
  }
}

export function creditHeaders(spend: Extract<SpendResult, { ok: true }>): HeadersInit {
  return {
    "X-Credits-Balance": String(spend.newBalance),
    "X-Credits-Cost": String(spend.cost),
  };
}
