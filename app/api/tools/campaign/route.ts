import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { observeApiRoute, type ApiRequestContext } from "@/lib/observability";
import { requireSameOrigin } from "@/lib/security";
import { spendOrFail, refund } from "@/lib/credits/spend";
import { ACTIVE_MODELS, type ActiveModelId } from "@/lib/credits/costs";
import { runAiTool } from "@/lib/ai/client";
import {
  CAMPAIGN_MODULE_PROMPT,
  normalizeCampaignOutput,
} from "@/lib/ai/prompts/campaign";
import type { AiInput, Platform, Objective } from "@/lib/ai/schemas/input";

export const runtime = "nodejs";
export const maxDuration = 30;

const VALID_MODELS = new Set<ActiveModelId>(ACTIVE_MODELS);
const VALID_PLATFORMS: Platform[] = [
  "instagram",
  "facebook",
  "tiktok",
  "twitter",
  "linkedin",
  "email",
  "sms",
];
const VALID_OBJECTIVES: Objective[] = [
  "engagement",
  "conversion",
  "awareness",
  "loyalty",
  "announcement",
];

async function handlePost(request: Request, context: ApiRequestContext) {
  const csrfError = requireSameOrigin(request);
  if (csrfError) return csrfError;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  context.userId = user.id;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;

  const rawModel = typeof input.model === "string" ? input.model : "";
  if (!VALID_MODELS.has(rawModel as ActiveModelId)) {
    return NextResponse.json({ error: "invalid_model" }, { status: 400 });
  }
  const model = rawModel as ActiveModelId;

  const brief =
    typeof input.brief === "string"
      ? input.brief.trim().slice(0, 1000)
      : typeof input.prompt === "string"
        ? input.prompt.trim().slice(0, 1000)
        : "";
  if (!brief) {
    return NextResponse.json(
      { error: "missing_field", field: "brief" },
      { status: 400 }
    );
  }

  const audience =
    typeof input.audience === "string" ? input.audience.slice(0, 200) : "";
  const channelRaw =
    typeof input.channel === "string" ? input.channel.toLowerCase() : "instagram";
  const goalRaw = typeof input.goal === "string" ? input.goal : "engagement";
  const tone = typeof input.tone === "string" ? input.tone.slice(0, 40) : "";
  const budget = typeof input.budget === "string" ? input.budget : "standard";

  const platform: Platform = (VALID_PLATFORMS as string[]).includes(channelRaw)
    ? (channelRaw as Platform)
    : "instagram";
  const objective: Objective = (VALID_OBJECTIVES as string[]).includes(goalRaw)
    ? (goalRaw as Objective)
    : "engagement";

  const spend = await spendOrFail("campaign", {
    model,
    metadata: { goal: objective, channel: platform, budget, audience: audience.slice(0, 60) },
  });
  if (!spend.ok) return spend.response;

  const aiInput: AiInput = {
    user_goal: brief,
    content_type: "campaign",
    platform,
    brand_voice: { tone: tone ? [tone] : [], avoid: [] },
    target_audience: audience || "general",
    objective,
    constraints: {},
    context: `Budget feel: ${budget}. Channel preference: ${channelRaw}.`,
  };

  try {
    const result = await runAiTool({
      tool: "campaign",
      modulePrompt: CAMPAIGN_MODULE_PROMPT,
      input: aiInput,
    });

    if (!result.ok) {
      await refund("campaign", { model });
      const status =
        result.error.kind === "missing_api_key"
          ? 500
          : result.error.kind === "model_error"
            ? result.error.status ?? 502
            : result.error.kind === "content_blocked"
              ? 400
              : 502;
      return NextResponse.json(
        {
          error: "ai_unavailable",
          reason: "Couldn't generate strategies right now. Try again.",
        },
        { status }
      );
    }

    const normalized = normalizeCampaignOutput(result.data);
    if (!normalized) {
      await refund("campaign", { model });
      return NextResponse.json({ error: "malformed_response" }, { status: 502 });
    }

    return NextResponse.json(normalized, {
      headers: {
        "X-Credits-Balance": String(spend.newBalance),
        "X-Credits-Cost": String(spend.cost),
      },
    });
  } catch (err) {
    console.error("[tools.campaign]", err);
    await refund("campaign", { model });
    return NextResponse.json(
      {
        error: "ai_unavailable",
        reason: "Couldn't generate strategies right now. Try again.",
      },
      { status: 502 }
    );
  }
}

export const POST = observeApiRoute("/api/tools/campaign", handlePost);
