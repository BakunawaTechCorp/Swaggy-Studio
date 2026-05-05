/**
 * /api/tools/create/refine — per-asset Joestar refinement.
 *
 * Two flavors via `kind`:
 *   - "caption": rewrites a caption given user feedback
 *   - "image":   rewrites the image prompt + re-renders via Imagen
 *
 * No extra credit charge for now (free during master-account phase).
 * If/when monetization returns, swap the no-op spend for `spendOrFail`.
 */
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { observeApiRoute, type ApiRequestContext } from "@/lib/observability";
import { requireSameOrigin } from "@/lib/security";
import { generateImage, type AspectRatio } from "@/lib/ai/imagen";

export const runtime = "nodejs";
export const maxDuration = 30;

const VALID_RATIOS = new Set<AspectRatio>(["1:1", "4:5", "9:16", "16:9"]);

function extractJson<T>(text: string): T | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    /* fallthrough */
  }
  const f = candidate.indexOf("{");
  const l = candidate.lastIndexOf("}");
  if (f !== -1 && l > f) {
    try {
      return JSON.parse(candidate.slice(f, l + 1)) as T;
    } catch {
      return null;
    }
  }
  return null;
}

// ---------- Caption refine ----------

const CAPTION_SYSTEM = `You are an elite social media copywriter. The user has a caption and wants you to revise it based on their feedback.

Rules:
- Apply the feedback faithfully. The feedback is the priority.
- Keep what's working unless the feedback contradicts it.
- First 8 words must hook.
- 1 emoji max, inline only. No hashtags.
- Match the platform's native voice.
- Never echo the brief verbatim.

Return EXACTLY:
{ "caption": "the revised post text", "reasoning": "1 sentence on what you changed and why" }`;

async function refineCaption(args: {
  brief: string;
  platform: string;
  audience: string;
  goal: string;
  tone: string;
  originalCaption: string;
  feedback: string;
}): Promise<{ caption: string; reasoning: string } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const anthropic = new Anthropic({ apiKey });

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 600,
      system: CAPTION_SYSTEM,
      messages: [
        {
          role: "user",
          content:
            `BRIEF: "${args.brief}"\n` +
            `PLATFORM: ${args.platform}\n` +
            `AUDIENCE: ${args.audience}\n` +
            `GOAL: ${args.goal}\n` +
            `TONE: ${args.tone}\n\n` +
            `ORIGINAL CAPTION:\n${args.originalCaption}\n\n` +
            `USER FEEDBACK:\n${args.feedback}\n\n` +
            `Return the JSON.`,
        },
      ],
    });
    const firstText = message.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    if (!firstText) return null;
    return extractJson<{ caption: string; reasoning: string }>(firstText.text);
  } catch (err) {
    console.error("[create.refine.caption]", err);
    return null;
  }
}

// ---------- Image-prompt refine ----------

const IMAGE_PROMPT_SYSTEM = `You revise image-generation prompts for an Imagen-style model.

The user has a prompt that produced an image, and feedback on what to change. Rewrite the prompt so the next render reflects the feedback.

Rules:
- Apply the feedback faithfully. Preserve subject + brand-safe constraints unless the feedback overrides them.
- 60-120 words. Specific composition, lighting, mood, palette.
- No copyrighted IP, no real recognizable people.
- Keep aspect ratio guidance consistent with the input.

Return EXACTLY:
{
  "image_prompt": "the revised 60-120 word prompt",
  "label": "3-5 word label for this revision",
  "rationale": "1-2 sentences on what changed"
}`;

async function refineImagePrompt(args: {
  brief: string;
  platform: string;
  audience: string;
  tone: string;
  originalPrompt: string;
  aspectRatio: AspectRatio;
  feedback: string;
}): Promise<{ image_prompt: string; label: string; rationale: string } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const anthropic = new Anthropic({ apiKey });

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 800,
      system: IMAGE_PROMPT_SYSTEM,
      messages: [
        {
          role: "user",
          content:
            `BRIEF: "${args.brief}"\n` +
            `PLATFORM: ${args.platform}\n` +
            `AUDIENCE: ${args.audience}\n` +
            `TONE: ${args.tone}\n` +
            `ASPECT_RATIO: ${args.aspectRatio}\n\n` +
            `ORIGINAL IMAGE PROMPT:\n${args.originalPrompt}\n\n` +
            `USER FEEDBACK:\n${args.feedback}\n\n` +
            `Return the JSON.`,
        },
      ],
    });
    const firstText = message.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    if (!firstText) return null;
    return extractJson<{ image_prompt: string; label: string; rationale: string }>(
      firstText.text
    );
  } catch (err) {
    console.error("[create.refine.image-prompt]", err);
    return null;
  }
}

// ---------- Handler ----------

async function handlePost(request: Request, context: ApiRequestContext) {
  const csrfError = requireSameOrigin(request);
  if (csrfError) return csrfError;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
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

  const b = (body ?? {}) as Record<string, unknown>;
  const kind = b.kind;
  const feedback =
    typeof b.feedback === "string" ? b.feedback.trim().slice(0, 1000) : "";
  if (!feedback) {
    return NextResponse.json({ error: "missing_feedback" }, { status: 400 });
  }

  const brief = typeof b.brief === "string" ? b.brief.trim().slice(0, 2000) : "";
  const platform =
    typeof b.platform === "string" ? b.platform : "instagram";
  const audience =
    typeof b.audience === "string" ? b.audience : "general audience";
  const goal = typeof b.goal === "string" ? b.goal : "engagement";
  const tone = typeof b.tone === "string" ? b.tone : "warm";

  if (kind === "caption") {
    const original =
      typeof b.originalCaption === "string" ? b.originalCaption : "";
    if (!original) {
      return NextResponse.json(
        { error: "missing_original" },
        { status: 400 }
      );
    }
    const result = await refineCaption({
      brief,
      platform,
      audience,
      goal,
      tone,
      originalCaption: original,
      feedback,
    });
    if (!result) {
      return NextResponse.json(
        { error: "refine_failed", reason: "Couldn't rewrite the caption. Try different wording." },
        { status: 502 }
      );
    }
    return NextResponse.json({ caption: result });
  }

  if (kind === "image") {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "server_misconfigured", reason: "Imagen key missing" },
        { status: 500 }
      );
    }
    const originalPrompt =
      typeof b.originalPrompt === "string" ? b.originalPrompt : "";
    if (!originalPrompt) {
      return NextResponse.json({ error: "missing_original" }, { status: 400 });
    }
    const ratioRaw = typeof b.aspectRatio === "string" ? b.aspectRatio : "1:1";
    const aspectRatio: AspectRatio = VALID_RATIOS.has(ratioRaw as AspectRatio)
      ? (ratioRaw as AspectRatio)
      : "1:1";

    const refined = await refineImagePrompt({
      brief,
      platform,
      audience,
      tone,
      originalPrompt,
      aspectRatio,
      feedback,
    });
    if (!refined) {
      return NextResponse.json(
        { error: "refine_failed", reason: "Couldn't rewrite the image prompt. Try different wording." },
        { status: 502 }
      );
    }

    const render = await generateImage({
      model: "imagen-4-fast",
      prompt: refined.image_prompt,
      aspectRatio,
    });
    if (!render.ok) {
      const reason =
        render.error.kind === "policy_blocked"
          ? "The new prompt was blocked by safety filters. Try different wording."
          : render.error.kind === "rate_limited"
            ? "Image API is rate-limited. Try again in a moment."
            : "Image generation failed.";
      return NextResponse.json(
        { error: "render_failed", reason },
        { status: 502 }
      );
    }

    return NextResponse.json({
      image: {
        label: refined.label,
        rationale: refined.rationale,
        image_prompt: refined.image_prompt,
        aspect_ratio: aspectRatio,
        image: { base64: render.pngBase64, mimeType: render.mimeType },
      },
    });
  }

  return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
}

export const POST = observeApiRoute("/api/tools/create/refine", handlePost);
