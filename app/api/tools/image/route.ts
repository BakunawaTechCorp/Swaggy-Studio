import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { observeApiRoute, type ApiRequestContext } from "@/lib/observability";
import { requireSameOrigin } from "@/lib/security";
import { spendOrFail, refund } from "@/lib/credits/spend";
import { ACTIVE_MODELS, type ActiveModelId } from "@/lib/credits/costs";
import { runAiTool } from "@/lib/ai/client";
import {
  buildImageModulePrompt,
  normalizeImageOutput,
  type VariantCount,
} from "@/lib/ai/prompts/image";
import { generateImage, type ImagenModel, type AspectRatio } from "@/lib/ai/imagen";
import type { AiInput, Objective } from "@/lib/ai/schemas/input";

export const runtime = "nodejs";
export const maxDuration = 60;

const IMAGE_MODELS: Set<ActiveModelId> = new Set(["imagen-4-fast", "imagen-4"]);
const VALID_OBJECTIVES: Objective[] = [
  "engagement",
  "conversion",
  "awareness",
  "loyalty",
  "announcement",
];
const ALL_ACTIVE = new Set<ActiveModelId>(ACTIVE_MODELS);

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
  if (!process.env.GEMINI_API_KEY) {
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
  if (!ALL_ACTIVE.has(rawModel as ActiveModelId) || !IMAGE_MODELS.has(rawModel as ActiveModelId)) {
    return NextResponse.json({ error: "invalid_model" }, { status: 400 });
  }
  const model = rawModel as ImagenModel;

  let variantCount =
    typeof input.variant_count === "number" ? Math.floor(input.variant_count) : 2;
  variantCount = Math.max(1, Math.min(4, variantCount));
  const vc = variantCount as VariantCount;

  const description =
    typeof input.description === "string"
      ? input.description.trim().slice(0, 1000)
      : typeof input.prompt === "string"
        ? input.prompt.trim().slice(0, 1000)
        : "";
  if (!description) {
    return NextResponse.json(
      { error: "missing_field", field: "description" },
      { status: 400 }
    );
  }

  const audience =
    typeof input.audience === "string" ? input.audience.slice(0, 200) : "";
  const aspectRaw = typeof input.aspect_ratio === "string" ? input.aspect_ratio : "1:1";
  const aspectRatio: AspectRatio = (
    ["1:1", "4:5", "9:16", "16:9"].includes(aspectRaw) ? aspectRaw : "1:1"
  ) as AspectRatio;
  const goalRaw = typeof input.goal === "string" ? input.goal : "engagement";
  const objective: Objective = (VALID_OBJECTIVES as string[]).includes(goalRaw)
    ? (goalRaw as Objective)
    : "engagement";
  const tone = typeof input.tone === "string" ? input.tone.slice(0, 40) : "";

  const spend = await spendOrFail("image", {
    model: rawModel as ActiveModelId,
    multiplier: vc,
    metadata: { variant_count: vc, aspect_ratio: aspectRatio, goal: objective },
  });
  if (!spend.ok) return spend.response;

  const aiInput: AiInput = {
    user_goal: description,
    content_type: "image",
    platform: "instagram",
    brand_voice: { tone: tone ? [tone] : [], avoid: [] },
    target_audience: audience || "general",
    objective,
    constraints: {},
    context: `Aspect ratio: ${aspectRatio}.`,
  };

  try {
    const promptResult = await runAiTool({
      tool: "image",
      modulePrompt: buildImageModulePrompt(vc),
      input: aiInput,
    });

    if (!promptResult.ok) {
      await refund("image", { model: rawModel as ActiveModelId, multiplier: vc });
      const status =
        promptResult.error.kind === "missing_api_key"
          ? 500
          : promptResult.error.kind === "model_error"
            ? promptResult.error.status ?? 502
            : 502;
      return NextResponse.json(
        { error: "ai_unavailable", reason: "Couldn't write image prompts. Try again." },
        { status }
      );
    }

    const normalized = normalizeImageOutput(promptResult.data);
    if (!normalized || normalized.variants.length === 0) {
      await refund("image", { model: rawModel as ActiveModelId, multiplier: vc });
      return NextResponse.json({ error: "malformed_prompts" }, { status: 502 });
    }

    const variants = normalized.variants.slice(0, vc);
    const imageResults = await Promise.all(
      variants.map((v) =>
        generateImage({
          model,
          prompt: v.image_prompt,
          aspectRatio: (v.aspect_ratio as AspectRatio) || aspectRatio,
        })
      )
    );

    const successes = imageResults.filter((r) => r.ok);
    if (successes.length === 0) {
      await refund("image", { model: rawModel as ActiveModelId, multiplier: vc });
      const first = imageResults[0];
      const reason =
        !first.ok && first.error.kind === "policy_blocked"
          ? "Your prompt was blocked by content policy. Try a different description."
          : !first.ok && first.error.kind === "rate_limited"
            ? "Rate limited by image API. Try again in a moment."
            : "Image generation failed. Try again.";
      return NextResponse.json(
        { error: "image_generation_failed", reason },
        { status: 502 }
      );
    }

    const failedCount = imageResults.length - successes.length;
    if (failedCount > 0) {
      await refund("image", {
        model: rawModel as ActiveModelId,
        multiplier: failedCount,
      });
    }

    const responseVariants = variants.map((v, i) => {
      const img = imageResults[i];
      return {
        id: v.id,
        label: v.label,
        rationale: v.rationale,
        aspect_ratio: v.aspect_ratio,
        confidence: v.confidence,
        image: img.ok
          ? { base64: img.pngBase64, mimeType: img.mimeType }
          : null,
        error: img.ok ? null : img.error.kind,
      };
    });

    return NextResponse.json(
      {
        variants: responseVariants,
        failed_count: failedCount,
        challenge: normalized.challenge ?? null,
      },
      {
        headers: {
          "X-Credits-Balance": String(spend.newBalance),
          "X-Credits-Cost": String(spend.cost),
        },
      }
    );
  } catch (err) {
    console.error("[tools.image]", err);
    await refund("image", { model: rawModel as ActiveModelId, multiplier: vc });
    return NextResponse.json(
      { error: "ai_unavailable", reason: "Couldn't generate images right now. Try again." },
      { status: 502 }
    );
  }
}

export const POST = observeApiRoute("/api/tools/image", handlePost);
