/**
 * /api/tools/create — All-in-One Create orchestrator.
 *
 * Modes:
 *   - "auto":       planner decides what to make
 *   - "quick_post": caption forced on, campaign forced off, image planner-decides
 *   - "campaign":   caption + image + campaign all forced on
 *   - "image_only": image only
 *   - "critique":   short-circuit; Claude reviews the pasted content
 *
 * The "advanced" object carries explicit overrides:
 *   audience, tone, avoid (text), language ("auto" | …), platform ("auto" | …),
 *   include_fit_score (bool — only the caption/critique honor it)
 */
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { observeApiRoute, type ApiRequestContext } from "@/lib/observability";
import { requireSameOrigin } from "@/lib/security";
import { spendOrFail, refund } from "@/lib/credits/spend";
import { runAiTool } from "@/lib/ai/client";
import {
  buildImageModulePrompt,
  normalizeImageOutput,
  type ImageOutput,
} from "@/lib/ai/prompts/image";
import {
  CAMPAIGN_MODULE_PROMPT,
  normalizeCampaignOutput,
  type CampaignOutput,
} from "@/lib/ai/prompts/campaign";
import { generateImage, type AspectRatio } from "@/lib/ai/imagen";
import type {
  AiInput,
  Language,
  Objective,
  Platform,
} from "@/lib/ai/schemas/input";
import type { ActiveModelId } from "@/lib/credits/costs";

export const runtime = "nodejs";
export const maxDuration = 60;

// ---------- Anthropic model mapping ----------

const ANTHROPIC_MODEL_MAP: Record<string, string> = {
  "claude-haiku-4-5": "claude-haiku-4-5",
  "claude-sonnet-4-7": "claude-sonnet-4-5-20250929",
};

function mapModel(id: string): string {
  return ANTHROPIC_MODEL_MAP[id] ?? "claude-sonnet-4-5-20250929";
}

// ---------- Planner ----------

type PlanDecision = {
  wants_caption: boolean;
  wants_image: boolean;
  wants_campaign: boolean;
  inferred_platform: string;
  inferred_audience: string;
  inferred_goal: string;
  inferred_tone: string;
  reasoning: string;
};

const PLANNER_SYSTEM = `You are a marketing AI router. Given a user's brief, decide which deliverables to generate:

- caption: a social media caption (always useful for posts)
- image: AI-generated visual (use when the brief mentions visuals, products, photos, "show", "picture", or implies a finished post)
- campaign: 3-strategy campaign plan (use when the brief mentions a launch, multi-post effort, paid spend, "campaign", or a multi-week plan)

Default heuristics:
- "post about X" -> caption only (or caption + image if visual is implied)
- "launch X" -> caption + image + campaign
- "make me an ad for X" -> caption + image
- "create content for X" -> caption + image
- When in doubt, lean toward caption + image.

Also infer:
- platform: instagram | facebook | tiktok | twitter | linkedin (default instagram)
- audience: a 1-line description (default "general audience")
- goal: awareness | engagement | conversion | loyalty | announcement (default engagement)
- tone: 1-2 word description (default warm)

Return EXACTLY this JSON, no prose:
{
  "wants_caption": boolean,
  "wants_image": boolean,
  "wants_campaign": boolean,
  "inferred_platform": "...",
  "inferred_audience": "...",
  "inferred_goal": "...",
  "inferred_tone": "...",
  "reasoning": "1 sentence explaining the decision"
}`;

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

async function planFromBrief(brief: string): Promise<PlanDecision | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const anthropic = new Anthropic({ apiKey });
  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      system: PLANNER_SYSTEM,
      messages: [{ role: "user", content: `BRIEF: ${brief}\n\nReturn the JSON.` }],
    });
    const firstText = message.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    if (!firstText) return null;
    return extractJson<PlanDecision>(firstText.text);
  } catch (err) {
    console.error("[create.planner]", err);
    return null;
  }
}

// ---------- Caption ----------

type CaptionResult = {
  caption: string;
  reasoning: string;
  fit_score?: { value: number; reasoning: string };
};

async function generateCaption(args: {
  brief: string;
  platform: string;
  audience: string;
  goal: string;
  tone: string;
  avoid?: string;
  language?: string;
  includeFitScore?: boolean;
  textModel: string;
}): Promise<CaptionResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const anthropic = new Anthropic({ apiKey });
  const model = mapModel(args.textModel);

  const fitScoreInstruction = args.includeFitScore
    ? `Also include a fit_score field with value (0-100) AND reasoning. The score is YOUR self-assessed fit for the platform/audience — explicitly NOT a real-world performance prediction.`
    : `Do NOT include a fit_score field.`;

  const system = `You are an elite social media copywriter. Generate ONE caption ready to post.

Rules:
- The brief is INSTRUCTIONS, not text to include. Never echo the brief verbatim.
- First 8 words must hook.
- 1 emoji max, inline only.
- No hashtags unless explicitly requested.
- Match the platform's native voice.
- Honor any "avoid" list strictly.

${fitScoreInstruction}

Return EXACTLY this JSON shape (no prose, no fences):
{
  "caption": "the post text",
  "reasoning": "1 sentence on why this hook works"${
    args.includeFitScore ? `,\n  "fit_score": { "value": 0-100, "reasoning": "1 sentence" }` : ""
  }
}`;

  const extras: string[] = [];
  if (args.avoid) extras.push(`AVOID: ${args.avoid}`);
  if (args.language) extras.push(`LANGUAGE: ${args.language}`);

  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 700,
      system,
      messages: [
        {
          role: "user",
          content:
            `BRIEF: "${args.brief}"\n` +
            `PLATFORM: ${args.platform}\n` +
            `AUDIENCE: ${args.audience}\n` +
            `GOAL: ${args.goal}\n` +
            `TONE: ${args.tone}\n` +
            (extras.length ? extras.join("\n") + "\n" : "") +
            `\nReturn the JSON.`,
        },
      ],
    });
    const firstText = message.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    if (!firstText) return null;
    return extractJson<CaptionResult>(firstText.text);
  } catch (err) {
    console.error("[create.caption]", err);
    return null;
  }
}

// ---------- Critique ----------

type CritiqueResult = {
  overall: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  structural_check: {
    hook_strong: boolean;
    hook_note: string;
    specificity_present: boolean;
    specificity_note: string;
    cta_clear: boolean;
    cta_note: string;
    voice_match: boolean;
    voice_note: string;
  };
  fit_score?: { value: number; reasoning: string };
};

async function runCritique(args: {
  content: string;
  platform: string;
  audience: string;
  textModel: string;
  includeFitScore?: boolean;
}): Promise<CritiqueResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const anthropic = new Anthropic({ apiKey });

  const fitScoreInstruction = args.includeFitScore
    ? `Also include a fit_score field with value (0-100) AND reasoning. The score is YOUR self-assessed fit for the platform/audience — explicitly NOT a real-world performance prediction.`
    : `Do NOT include a fit_score field.`;

  const system = `You are an honest social-media-content reviewer. The user pastes content; you critique it.

Be specific. Avoid vague advice ("make it more engaging"). Quote phrases from the content when pointing things out.

Rules:
- Strengths: 1-3 SPECIFIC things that work, with the phrase that demonstrates each.
- Weaknesses: 1-3 SPECIFIC issues. No platitudes.
- Suggestions: 1-3 concrete rewrites or actionable changes the user can apply.
- Structural check: hook (first 8 words), specificity (concrete details), CTA (presence + clarity), voice match (tone consistency).
- For each structural item, return both a boolean AND a 1-sentence note explaining the call.

${fitScoreInstruction}

If the content provided isn't actually content (just a vague description, or nothing to critique), return:
{ "overall": "Paste actual content to critique — caption text, post copy, etc.", "strengths": [], "weaknesses": [], "suggestions": [], "structural_check": { "hook_strong": false, "hook_note": "no content provided", "specificity_present": false, "specificity_note": "no content provided", "cta_clear": false, "cta_note": "no content provided", "voice_match": false, "voice_note": "no content provided" } }

Return EXACTLY this JSON, no prose, no fences:
{
  "overall": "...",
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "suggestions": ["...", "..."],
  "structural_check": {
    "hook_strong": boolean, "hook_note": "...",
    "specificity_present": boolean, "specificity_note": "...",
    "cta_clear": boolean, "cta_note": "...",
    "voice_match": boolean, "voice_note": "..."
  }${args.includeFitScore ? `,\n  "fit_score": { "value": 0-100, "reasoning": "..." }` : ""}
}`;

  try {
    const message = await anthropic.messages.create({
      model: mapModel(args.textModel),
      max_tokens: 1500,
      system,
      messages: [
        {
          role: "user",
          content:
            `CONTENT TO CRITIQUE:\n\n${args.content}\n\n` +
            `PLATFORM: ${args.platform}\n` +
            `AUDIENCE: ${args.audience || "general"}\n\n` +
            `Return the JSON.`,
        },
      ],
    });
    const firstText = message.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    if (!firstText) return null;
    return extractJson<CritiqueResult>(firstText.text);
  } catch (err) {
    console.error("[create.critique]", err);
    return null;
  }
}

// ---------- Helpers ----------

const VALID_PLATFORMS: Platform[] = [
  "instagram",
  "facebook",
  "tiktok",
  "twitter",
  "linkedin",
];
const VALID_OBJECTIVES: Objective[] = [
  "engagement",
  "conversion",
  "awareness",
  "loyalty",
  "announcement",
];
const VALID_LANGUAGES: Language[] = ["english", "tagalog", "taglish", "bisaya"];
const VALID_MODES = new Set([
  "auto",
  "quick_post",
  "campaign",
  "critique",
  "image_only",
]);

type CreateMode = "auto" | "quick_post" | "campaign" | "critique" | "image_only";

function coercePlatform(p: string): Platform {
  return (VALID_PLATFORMS as string[]).includes(p) ? (p as Platform) : "instagram";
}
function coerceObjective(o: string): Objective {
  return (VALID_OBJECTIVES as string[]).includes(o) ? (o as Objective) : "engagement";
}

// ---------- Streaming helpers ----------

type StepEvent = {
  type: "step";
  id: string;
  status: "running" | "done" | "failed";
  title: string;
  note?: string;
};
type ResultEvent = { type: "result"; payload: unknown };
type ErrorEvent = { type: "error"; reason: string };
type StreamEvent = StepEvent | ResultEvent | ErrorEvent;

function makeStream() {
  const encoder = new TextEncoder();
  let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  const ts = new TransformStream<Uint8Array, Uint8Array>();
  writer = ts.writable.getWriter();

  function emit(ev: StreamEvent) {
    if (!writer) return;
    void writer.write(encoder.encode(JSON.stringify(ev) + "\n"));
  }
  async function close() {
    if (!writer) return;
    try { await writer.close(); } catch { /* noop */ }
    writer = null;
  }
  return { stream: ts.readable, emit, close };
}

// ---------- Handler ----------

type ImageVariantOut = {
  id: string;
  label: string;
  rationale: string;
  aspect_ratio: string;
  image_prompt: string;
  image: { base64: string; mimeType: string } | null;
};

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
    return NextResponse.json(
      { error: "server_misconfigured", reason: "ANTHROPIC_API_KEY missing" },
      { status: 500 }
    );
  }

  // Detect streaming clients (we always stream now, but keep a non-stream
  // fallback so direct curl/JSON consumers still work).
  const wantsStream =
    request.headers.get("accept")?.includes("application/x-ndjson") ?? false;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const input = (body ?? {}) as Record<string, unknown>;
  const brief =
    typeof input.brief === "string" ? input.brief.trim().slice(0, 2000) : "";
  if (!brief) {
    return NextResponse.json({ error: "missing_brief" }, { status: 400 });
  }

  const modeRaw = typeof input.mode === "string" ? input.mode : "auto";
  const mode: CreateMode = (
    VALID_MODES.has(modeRaw) ? modeRaw : "auto"
  ) as CreateMode;

  const advancedRaw =
    input.advanced && typeof input.advanced === "object"
      ? (input.advanced as Record<string, unknown>)
      : {};
  const modelRaw =
    typeof input.model === "string" ? input.model : "claude-sonnet-4-7";
  const textModel: ActiveModelId = (
    modelRaw in ANTHROPIC_MODEL_MAP ? modelRaw : "claude-sonnet-4-7"
  ) as ActiveModelId;

  const explicitPlatform =
    typeof advancedRaw.platform === "string" && advancedRaw.platform !== "auto"
      ? advancedRaw.platform
      : null;
  const explicitAudience =
    typeof advancedRaw.audience === "string"
      ? advancedRaw.audience.trim().slice(0, 400)
      : "";
  const explicitTone =
    typeof advancedRaw.tone === "string"
      ? advancedRaw.tone.trim().slice(0, 200)
      : "";
  const explicitAvoid =
    typeof advancedRaw.avoid === "string"
      ? advancedRaw.avoid.trim().slice(0, 200)
      : "";
  const explicitLanguage =
    typeof advancedRaw.language === "string" &&
    advancedRaw.language !== "auto" &&
    (VALID_LANGUAGES as string[]).includes(advancedRaw.language)
      ? (advancedRaw.language as Language)
      : null;
  // Fit score is always included now — Claude's self-assessed confidence,
  // surfaced honestly under the caption / critique.
  const includeFitScore = true;

  const VALID_POST_TYPES = new Set([
    "feed",
    "story",
    "reel",
    "carousel",
    "cover",
  ]);
  const explicitPostType =
    typeof advancedRaw.post_type === "string" &&
    VALID_POST_TYPES.has(advancedRaw.post_type)
      ? advancedRaw.post_type
      : null;

  const referenceImageUrls = Array.isArray(input.reference_image_urls)
    ? (input.reference_image_urls as unknown[])
        .filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u))
        .slice(0, 10)
    : [];

  // ---------- CRITIQUE short-circuit ----------
  if (mode === "critique") {
    const spend = await spendOrFail("caption", {
      model: textModel,
      metadata: { tool: "create_critique" },
    });
    if (!spend.ok) return spend.response;

    if (wantsStream) {
      const { stream, emit, close } = makeStream();
      (async () => {
        emit({
          type: "step",
          id: "critique",
          status: "running",
          title: "Reading the post…",
        });
        const critique = await runCritique({
          content: brief,
          platform: explicitPlatform ?? "instagram",
          audience: explicitAudience,
          textModel,
          includeFitScore,
        });
        if (!critique) {
          await refund("caption", { model: textModel });
          emit({
            type: "step",
            id: "critique",
            status: "failed",
            title: "Couldn't run the critique",
          });
          emit({ type: "error", reason: "Couldn't run the critique. Try again." });
          await close();
          return;
        }
        emit({
          type: "step",
          id: "critique",
          status: "done",
          title: "Critique ready",
          note: critique.overall.slice(0, 140),
        });
        emit({ type: "result", payload: { mode: "critique", critique } });
        await close();
      })();
      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Credits-Balance": String(spend.newBalance),
          "X-Credits-Cost": String(spend.cost),
        },
      });
    }

    const critique = await runCritique({
      content: brief,
      platform: explicitPlatform ?? "instagram",
      audience: explicitAudience,
      textModel,
      includeFitScore,
    });
    if (!critique) {
      await refund("caption", { model: textModel });
      return NextResponse.json(
        { error: "critique_failed", reason: "Couldn't run the critique. Try again." },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { mode: "critique", critique },
      {
        headers: {
          "X-Credits-Balance": String(spend.newBalance),
          "X-Credits-Cost": String(spend.cost),
        },
      }
    );
  }

  // ---------- Generation flow (everything else) ----------
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "server_misconfigured", reason: "GEMINI_API_KEY missing" },
      { status: 500 }
    );
  }

  // Spend a flat caption credit per generative Create call.
  const spend = await spendOrFail("caption", {
    model: textModel,
    metadata: { tool: "create", mode },
  });
  if (!spend.ok) return spend.response;

  // ---------- Streaming branch ----------
  if (wantsStream) {
    const { stream, emit, close } = makeStream();
    (async () => {
      try {
        emit({
          type: "step",
          id: "plan",
          status: "running",
          title: "Reading your brief…",
        });
        const plan = await planFromBrief(brief);
        if (!plan) {
          await refund("caption", { model: textModel });
          emit({
            type: "step",
            id: "plan",
            status: "failed",
            title: "Couldn't understand the brief",
          });
          emit({ type: "error", reason: "Couldn't understand the brief. Try again." });
          await close();
          return;
        }

        // Apply mode bias and overrides.
        if (mode === "quick_post") {
          plan.wants_caption = true;
          plan.wants_campaign = false;
        } else if (mode === "image_only") {
          plan.wants_caption = false;
          plan.wants_image = true;
          plan.wants_campaign = false;
        } else if (mode === "campaign") {
          plan.wants_caption = true;
          plan.wants_image = true;
          plan.wants_campaign = true;
        }
        if (explicitPlatform) plan.inferred_platform = explicitPlatform;
        if (explicitAudience) plan.inferred_audience = explicitAudience;
        if (explicitTone) plan.inferred_tone = explicitTone;

        const decided: string[] = [];
        if (plan.wants_caption) decided.push("caption");
        if (plan.wants_image) decided.push("image");
        if (plan.wants_campaign) decided.push("campaign");

        emit({
          type: "step",
          id: "plan",
          status: "done",
          title: `Decided: ${decided.join(" + ") || "nothing to make"}`,
          note: plan.reasoning,
        });

        const platform = coercePlatform(plan.inferred_platform);
        const objective = coerceObjective(plan.inferred_goal);
        const audience = (plan.inferred_audience || "general audience").slice(0, 400);

        const toneList = (explicitTone || plan.inferred_tone || "")
          .split(/[,;]/).map((s) => s.trim()).filter(Boolean).slice(0, 8);
        const avoidList = explicitAvoid
          .split(/[,;]/).map((s) => s.trim()).filter(Boolean).slice(0, 8);

        const aiInput: AiInput = {
          user_goal: brief.slice(0, 200),
          content_type: "image",
          platform,
          brand_voice: { tone: toneList, avoid: avoidList },
          target_audience: audience,
          objective,
          constraints: {
            ...(explicitLanguage ? { language: explicitLanguage } : {}),
            ...(avoidList.length ? { avoid_hashtags: true } : {}),
          },
          context:
            [
              brief.length > 200 ? brief : null,
              explicitPostType ? `post_type: ${explicitPostType}` : null,
            ]
              .filter(Boolean)
              .join("\n") || undefined,
          reference_images: referenceImageUrls.length ? referenceImageUrls : undefined,
        };

        // Caption — emits its own running/done events.
        const captionPromise: Promise<CaptionResult | null> = (async () => {
          if (!plan.wants_caption) return null;
          emit({
            type: "step",
            id: "caption",
            status: "running",
            title: "Writing the caption…",
          });
          const r = await generateCaption({
            brief: explicitPostType ? `${brief}\n[post type: ${explicitPostType}]` : brief,
            platform: plan.inferred_platform,
            audience,
            goal: plan.inferred_goal,
            tone: plan.inferred_tone,
            avoid: explicitAvoid || undefined,
            language: explicitLanguage ?? undefined,
            includeFitScore,
            textModel,
          });
          emit({
            type: "step",
            id: "caption",
            status: r ? "done" : "failed",
            title: r ? "Caption ready" : "Caption failed",
            note: r?.caption.slice(0, 140),
          });
          return r;
        })();

        // Image — two phases (prompt + render).
        const imagePromise: Promise<ImageVariantOut[] | null> = (async () => {
          if (!plan.wants_image) return null;
          emit({
            type: "step",
            id: "image-prompts",
            status: "running",
            title: "Designing image prompts…",
          });
          const promptResult = await runAiTool<unknown>({
            tool: "image",
            modulePrompt: buildImageModulePrompt(2),
            input: aiInput,
            includeImages: referenceImageUrls.length > 0,
          });
          if (!promptResult.ok) {
            emit({
              type: "step",
              id: "image-prompts",
              status: "failed",
              title: "Image prompts failed",
            });
            return null;
          }
          const normalized: ImageOutput | null = normalizeImageOutput(promptResult.data);
          if (!normalized || normalized.variants.length === 0) {
            emit({
              type: "step",
              id: "image-prompts",
              status: "failed",
              title: "No image prompts produced",
            });
            return null;
          }
          const variants = normalized.variants.slice(0, 2);
          emit({
            type: "step",
            id: "image-prompts",
            status: "done",
            title: `Designed ${variants.length} image concepts`,
            note: variants.map((v) => v.label).join(" · "),
          });

          emit({
            type: "step",
            id: "image-render",
            status: "running",
            title: `Rendering ${variants.length} images…`,
          });
          const imageResults = await Promise.all(
            variants.map((v) =>
              generateImage({
                model: "imagen-4-fast",
                prompt: v.image_prompt,
                aspectRatio: (v.aspect_ratio as AspectRatio) || "1:1",
              })
            )
          );
          const out = variants.map((v, i): ImageVariantOut => {
            const r = imageResults[i];
            return {
              id: v.id,
              label: v.label,
              rationale: v.rationale,
              aspect_ratio: v.aspect_ratio,
              image_prompt: v.image_prompt,
              image: r.ok ? { base64: r.pngBase64, mimeType: r.mimeType } : null,
            };
          });
          const successCount = out.filter((v) => v.image).length;
          emit({
            type: "step",
            id: "image-render",
            status: successCount > 0 ? "done" : "failed",
            title:
              successCount === out.length
                ? `Rendered ${successCount} images`
                : successCount > 0
                  ? `Rendered ${successCount}/${out.length} images`
                  : "All image renders failed",
          });
          return out;
        })();

        // Campaign.
        const campaignPromise: Promise<CampaignOutput | null> = (async () => {
          if (!plan.wants_campaign) return null;
          emit({
            type: "step",
            id: "campaign",
            status: "running",
            title: "Drafting campaign strategies…",
          });
          const result = await runAiTool<unknown>({
            tool: "campaign",
            modulePrompt: CAMPAIGN_MODULE_PROMPT,
            input: { ...aiInput, content_type: "campaign" },
          });
          const out = result.ok ? normalizeCampaignOutput(result.data) : null;
          emit({
            type: "step",
            id: "campaign",
            status: out ? "done" : "failed",
            title: out ? "Campaign drafted" : "Campaign failed",
            note: out?.options[0]?.big_idea?.slice(0, 140),
          });
          return out;
        })();

        const [captionResult, imageResult, campaignResult] = await Promise.all([
          captionPromise,
          imagePromise,
          campaignPromise,
        ]);

        const wantedCount =
          (plan.wants_caption ? 1 : 0) +
          (plan.wants_image ? 1 : 0) +
          (plan.wants_campaign ? 1 : 0);
        const gotCount =
          (plan.wants_caption && captionResult ? 1 : 0) +
          (plan.wants_image && imageResult && imageResult.some((v) => v.image) ? 1 : 0) +
          (plan.wants_campaign && campaignResult ? 1 : 0);

        if (wantedCount > 0 && gotCount === 0) {
          await refund("caption", { model: textModel });
          emit({
            type: "error",
            reason: "Couldn't generate any of the requested deliverables. Try again.",
          });
          await close();
          return;
        }

        emit({
          type: "result",
          payload: {
            plan,
            caption: captionResult,
            image_variants: imageResult,
            campaign: campaignResult,
            partial: gotCount < wantedCount,
          },
        });
        await close();
      } catch (err) {
        console.error("[create.stream]", err);
        const msg = err instanceof Error ? err.message : "Unexpected error.";
        emit({ type: "error", reason: msg });
        await close();
      }
    })();

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Credits-Balance": String(spend.newBalance),
        "X-Credits-Cost": String(spend.cost),
      },
    });
  }

  // ---------- Non-streaming legacy path ----------

  // Plan (Haiku). Then bias by mode + apply explicit overrides.
  const plan = await planFromBrief(brief);
  if (!plan) {
    await refund("caption", { model: textModel });
    return NextResponse.json(
      { error: "planner_failed", reason: "Couldn't understand the brief. Try again." },
      { status: 502 }
    );
  }

  if (mode === "quick_post") {
    plan.wants_caption = true;
    plan.wants_campaign = false;
    // image left to planner
  } else if (mode === "image_only") {
    plan.wants_caption = false;
    plan.wants_image = true;
    plan.wants_campaign = false;
  } else if (mode === "campaign") {
    plan.wants_caption = true;
    plan.wants_image = true;
    plan.wants_campaign = true;
  }

  if (explicitPlatform) plan.inferred_platform = explicitPlatform;
  if (explicitAudience) plan.inferred_audience = explicitAudience;
  if (explicitTone) plan.inferred_tone = explicitTone;

  const platform = coercePlatform(plan.inferred_platform);
  const objective = coerceObjective(plan.inferred_goal);
  const audience = (plan.inferred_audience || "general audience").slice(0, 400);

  const toneList = (explicitTone || plan.inferred_tone || "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
  const avoidList = explicitAvoid
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);

  const aiInput: AiInput = {
    user_goal: brief.slice(0, 200),
    content_type: "image",
    platform,
    brand_voice: { tone: toneList, avoid: avoidList },
    target_audience: audience,
    objective,
    constraints: {
      ...(explicitLanguage ? { language: explicitLanguage } : {}),
      ...(avoidList.length ? { avoid_hashtags: true } : {}),
    },
    context:
      [
        brief.length > 200 ? brief : null,
        explicitPostType ? `post_type: ${explicitPostType}` : null,
      ]
        .filter(Boolean)
        .join("\n") || undefined,
    reference_images: referenceImageUrls.length ? referenceImageUrls : undefined,
  };

  const captionPromise: Promise<CaptionResult | null> = plan.wants_caption
    ? generateCaption({
        brief: explicitPostType ? `${brief}\n[post type: ${explicitPostType}]` : brief,
        platform: plan.inferred_platform,
        audience,
        goal: plan.inferred_goal,
        tone: plan.inferred_tone,
        avoid: explicitAvoid || undefined,
        language: explicitLanguage ?? undefined,
        includeFitScore,
        textModel,
      })
    : Promise.resolve(null);

  const imagePromise: Promise<ImageVariantOut[] | null> = plan.wants_image
    ? (async () => {
        const promptResult = await runAiTool<unknown>({
          tool: "image",
          modulePrompt: buildImageModulePrompt(2),
          input: aiInput,
          includeImages: referenceImageUrls.length > 0,
        });
        if (!promptResult.ok) return null;
        const normalized: ImageOutput | null = normalizeImageOutput(
          promptResult.data
        );
        if (!normalized || normalized.variants.length === 0) return null;
        const variants = normalized.variants.slice(0, 2);
        const imageResults = await Promise.all(
          variants.map((v) =>
            generateImage({
              model: "imagen-4-fast",
              prompt: v.image_prompt,
              aspectRatio: (v.aspect_ratio as AspectRatio) || "1:1",
            })
          )
        );
        return variants.map((v, i): ImageVariantOut => {
          const r = imageResults[i];
          return {
            id: v.id,
            label: v.label,
            rationale: v.rationale,
            aspect_ratio: v.aspect_ratio,
            image_prompt: v.image_prompt,
            image: r.ok ? { base64: r.pngBase64, mimeType: r.mimeType } : null,
          };
        });
      })()
    : Promise.resolve(null);

  const campaignPromise: Promise<CampaignOutput | null> = plan.wants_campaign
    ? runAiTool<unknown>({
        tool: "campaign",
        modulePrompt: CAMPAIGN_MODULE_PROMPT,
        input: { ...aiInput, content_type: "campaign" },
      }).then((result) => (result.ok ? normalizeCampaignOutput(result.data) : null))
    : Promise.resolve(null);

  const [captionResult, imageResult, campaignResult] = await Promise.all([
    captionPromise,
    imagePromise,
    campaignPromise,
  ]);

  const wantedCount =
    (plan.wants_caption ? 1 : 0) +
    (plan.wants_image ? 1 : 0) +
    (plan.wants_campaign ? 1 : 0);
  const gotCount =
    (plan.wants_caption && captionResult ? 1 : 0) +
    (plan.wants_image && imageResult && imageResult.some((v) => v.image) ? 1 : 0) +
    (plan.wants_campaign && campaignResult ? 1 : 0);

  if (wantedCount > 0 && gotCount === 0) {
    await refund("caption", { model: textModel });
    return NextResponse.json(
      {
        error: "all_components_failed",
        reason: "Couldn't generate any of the requested deliverables. Try again.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json(
    {
      plan,
      caption: captionResult,
      image_variants: imageResult,
      campaign: campaignResult,
      partial: gotCount < wantedCount,
    },
    {
      headers: {
        "X-Credits-Balance": String(spend.newBalance),
        "X-Credits-Cost": String(spend.cost),
      },
    }
  );
}

export const POST = observeApiRoute("/api/tools/create", handlePost);
