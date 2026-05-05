import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { observeApiRoute, type ApiRequestContext } from "@/lib/observability";
import { requireSameOrigin } from "@/lib/security";
import { spendOrFail, refund } from "@/lib/credits/spend";
import { ACTIVE_MODELS, type ActiveModelId } from "@/lib/credits/costs";

export const runtime = "nodejs";
export const maxDuration = 30;

// Map our internal model ids to the actual Anthropic API model strings.
type AnthropicModelId = "claude-haiku-4-5" | "claude-sonnet-4-7";
const ANTHROPIC_MODEL_MAP: Record<AnthropicModelId, string> = {
  "claude-haiku-4-5": "claude-haiku-4-5",
  "claude-sonnet-4-7": "claude-sonnet-4-5-20250929",
};
const TEXT_MODELS: Set<ActiveModelId> = new Set([
  "claude-haiku-4-5",
  "claude-sonnet-4-7",
]);

const VALID_LANGUAGES = new Set(["tagalog", "bisaya", "english", "taglish"]);
const VALID_GOALS = new Set([
  "awareness",
  "engagement",
  "conversion",
  "follower_growth",
  "loyalty",
]);
const VALID_TONES = new Set([
  "playful",
  "premium",
  "bold",
  "friendly",
  "luxury",
  "minimalist",
  "warm",
  "witty",
]);
const VALID_HOOKS = new Set([
  "storytelling",
  "direct_cta",
  "question",
  "controversial",
  "value_first",
]);
const VALID_EMOTIONS = new Set([
  "inspire",
  "excite",
  "curiosity",
  "trust",
  "urgency",
  "humor",
]);
const VALID_LENGTHS = new Set(["short", "medium", "long"]);
const VALID_MODELS = new Set<ActiveModelId>(ACTIVE_MODELS);

type Variant = {
  caption: string;
  hook_type: string;
  tone: string;
  reasoning?: string;
  score?: number;
};
type CaptionResult = {
  variants: Variant[];
  suggested_time: string;
  tip: string;
  best_index?: number;
  best_reason?: string;
};

function buildSystemPrompt(args: {
  variantCount: number;
  language: string;
  manilaTime: string;
  goal?: string;
  tone?: string;
  audience?: string;
  hook?: string;
  emotion?: string;
  length?: string;
  includeCta?: boolean;
  includeEmojis?: boolean;
}) {
  const {
    variantCount,
    language,
    manilaTime,
    goal,
    tone,
    audience,
    hook,
    emotion,
    length,
    includeCta,
    includeEmojis,
  } = args;

  const intent: string[] = [];
  if (goal) intent.push(`PRIMARY GOAL: ${goal}`);
  if (tone) intent.push(`TONE: ${tone}`);
  if (audience) intent.push(`TARGET AUDIENCE: ${audience}`);
  if (hook) intent.push(`HOOK STYLE: ${hook}`);
  if (emotion) intent.push(`EMOTIONAL INTENT: make the reader feel "${emotion}"`);
  if (length) intent.push(`LENGTH: ${length}`);
  if (typeof includeCta === "boolean")
    intent.push(`INCLUDE CTA: ${includeCta ? "yes" : "no"}`);
  if (typeof includeEmojis === "boolean")
    intent.push(
      `INCLUDE EMOJIS: ${includeEmojis ? "yes (1 max, inline not decorative)" : "no"}`
    );

  return `You are an elite social media copywriter. You generate finished captions ready to be posted as-is.

## CRITICAL RULES — read carefully before writing anything

The user's input is a BRIEF describing what they want. It is NOT caption text. Do not:
- Quote the brief inside any caption
- Echo the brief's wording into the caption
- Treat the brief as a draft to remix

Instead: read the brief to understand the user's intent (what they're launching, what they want to communicate), then write FRESH original caption text that achieves that intent.

Example of WRONG output (DO NOT DO THIS):
  Brief: "I'm launching a new brand called Frigga, I need a post inviting people to follow"
  Bad caption: "New drop: Create me a quick caption I need for my brand launch inviting people to follow..."
  ↑ this is wrong because it echoes the brief's words ("Create me a quick caption", "inviting people")

Example of CORRECT output:
  Brief: "I'm launching a new brand called Frigga, I need a post inviting people to follow"
  Good caption: "Meet Frigga. Three years of late nights, finally a name. Hit follow — the first drop is closer than you think."
  ↑ this is right because it speaks IN the brand's voice, refers to the brand by name, has a fresh hook, and doesn't echo the brief

## Output rules

- Generate ${variantCount} caption variant${variantCount === 1 ? "" : "s"} that are MEANINGFULLY DIFFERENT from each other.
- Each variant uses a different hook angle (story, question, direct CTA, contrarian stance, surprising fact).
- Same brand voice and same product/brand details across all variants.
- The first 8 words of each caption must hook. No "In today's world..." style openers.
- At least one concrete detail per caption (brand name, product name, number, comparison) — never generic phrases.
- 1 emoji maximum per caption, inline placement only. 0 is acceptable.
- No hashtags.
- Output language: ${language}. If language is taglish/tagalog/bisaya, code-switching must feel natural, not performative.

## Reasoning field rules

The reasoning field is METADATA shown in a separate UI element. It must NOT appear in the caption text itself. Specifically:
- The caption is what the user posts to social media.
- The reasoning is one short sentence explaining WHY the hook works for the goal — for the user's eyes only.
- Never put the reasoning sentence inside the caption.
- Never end a caption with the reasoning sentence.
- The two fields are independent: the caption stands alone as a finished post; the reasoning explains the strategy behind it.

Wrong example (reasoning leaking into caption):
  caption: "Meet Frigga. A question creates a moment of pause + reply."   ← BAD
  reasoning: "A question creates a moment of pause + reply."

Right example:
  caption: "Meet Frigga. What would you wear if comfort came first?"      ← GOOD
  reasoning: "Question hook invites replies and signals the brand's POV."

## Context

Current time: ${manilaTime}.

${intent.length ? "INTENT (treat these as constraints, not as text to include):\n" + intent.join("\n") : "(No specific intent provided — use your best judgment based on the brief.)"}

## Self-check before returning

For each variant ask yourself:
1. Does the caption echo any phrase from the user's brief? If yes, REWRITE.
2. Is the reasoning sentence visible inside the caption text? If yes, REWRITE.
3. Could a reader copy-paste this caption directly to Instagram with zero editing? If no, REWRITE.
4. Is the hook in the first 8 words? If no, REWRITE.

If any answer is "no good," fix it once. Do not loop.

## Scoring rule (REQUIRED)

For each variant, estimate a "score" from 1-100 representing how effective it is at achieving the user's PRIMARY GOAL${
    goal ? ` ("${goal}")` : ""
  }. Be honest — spread the scores. Do not give every variant 90+. Use the full range:
  - 90-100: rare, only when the variant is unmistakably aligned
  - 70-89: solid match for the goal
  - 50-69: workable but not optimal
  - below 50: misaligned with the goal

Then pick ONE variant as the recommendation:
- "best_index": integer 0-${variantCount - 1} indicating which variant is the recommended pick (highest goal-fit, not just highest score)
- "best_reason": one short sentence (max 18 words) explaining WHY this one wins for the user's goal

## Return shape

Return EXACTLY this JSON. No prose before or after, no code fences:

{
  "variants": [
    {
      "caption": "the finished post text — ready to publish as-is",
      "hook_type": "story|question|cta|stance|insight",
      "tone": "one-word descriptor",
      "reasoning": "one sentence explaining why this hook works for the goal — NOT included in the caption",
      "score": 84
    }
    // ... exactly ${variantCount} items
  ],
  "best_index": 1,
  "best_reason": "Question hook + curiosity drives the most replies for engagement.",
  "suggested_time": "best posting window today (e.g. 'Tonight 7-9 PM')",
  "tip": "one specific actionable nudge — never vague advice"
}`;
}

function nowInManila(): string {
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date()) + " (Manila)"
  );
}

function extractJson(text: string): unknown | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    /* fall through */
  }
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(candidate.slice(first, last + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function coerceResult(parsed: unknown): CaptionResult | null {
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.variants) || obj.variants.length === 0) return null;

  const variants: Variant[] = [];
  for (const v of obj.variants) {
    if (!v || typeof v !== "object") continue;
    const vo = v as Record<string, unknown>;
    const caption = typeof vo.caption === "string" ? vo.caption.trim() : "";
    if (!caption) continue;
    let score: number | undefined;
    if (typeof vo.score === "number" && Number.isFinite(vo.score)) {
      score = Math.max(1, Math.min(100, Math.round(vo.score)));
    }
    variants.push({
      caption,
      hook_type: typeof vo.hook_type === "string" ? vo.hook_type : "",
      tone: typeof vo.tone === "string" ? vo.tone : "",
      reasoning:
        typeof vo.reasoning === "string"
          ? vo.reasoning.trim().slice(0, 200)
          : undefined,
      score,
    });
  }
  if (variants.length === 0) return null;

  let bestIndex: number | undefined;
  if (typeof obj.best_index === "number" && Number.isFinite(obj.best_index)) {
    const n = Math.floor(obj.best_index);
    if (n >= 0 && n < variants.length) bestIndex = n;
  }
  // Fallback: pick highest-scored variant.
  if (bestIndex === undefined) {
    let bestScore = -1;
    variants.forEach((v, i) => {
      const s = v.score ?? 0;
      if (s > bestScore) {
        bestScore = s;
        bestIndex = i;
      }
    });
  }

  return {
    variants,
    best_index: bestIndex,
    best_reason:
      typeof obj.best_reason === "string"
        ? obj.best_reason.trim().slice(0, 200)
        : undefined,
    suggested_time:
      typeof obj.suggested_time === "string" ? obj.suggested_time : "",
    tip: typeof obj.tip === "string" ? obj.tip : "",
  };
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

  const photoUrl =
    typeof input.photo_url === "string" ? input.photo_url.trim() : "";
  const userBrief =
    typeof input.prompt === "string" ? input.prompt.trim().slice(0, 1000) : "";
  const language =
    typeof input.language === "string"
      ? input.language.trim().toLowerCase()
      : "english";

  const rawModel = typeof input.model === "string" ? input.model : "";
  if (
    !VALID_MODELS.has(rawModel as ActiveModelId) ||
    !TEXT_MODELS.has(rawModel as ActiveModelId)
  ) {
    return NextResponse.json({ error: "invalid_model" }, { status: 400 });
  }
  const model = rawModel as AnthropicModelId;

  let variantCount =
    typeof input.variant_count === "number" ? Math.floor(input.variant_count) : 4;
  variantCount = Math.max(1, Math.min(4, variantCount));

  if (!VALID_LANGUAGES.has(language)) {
    return NextResponse.json({ error: "invalid_language" }, { status: 400 });
  }

  const opt = (key: string, set: Set<string>): string | undefined => {
    const v = input[key];
    return typeof v === "string" && set.has(v) ? v : undefined;
  };

  const goal = opt("goal", VALID_GOALS);
  const tone = opt("tone", VALID_TONES);
  const hook = opt("hook_style", VALID_HOOKS);
  const emotion = opt("emotion", VALID_EMOTIONS);
  const length = opt("length", VALID_LENGTHS);
  const audience =
    typeof input.audience === "string" ? input.audience.slice(0, 120) : undefined;
  const includeCta =
    typeof input.include_cta === "boolean" ? input.include_cta : undefined;
  const includeEmojis =
    typeof input.include_emojis === "boolean" ? input.include_emojis : undefined;

  if (photoUrl && !/^https?:\/\//i.test(photoUrl)) {
    return NextResponse.json({ error: "invalid_photo_url" }, { status: 400 });
  }

  // Defense-in-depth: only accept URLs hosted on our own Supabase project.
  const supabaseOrigin = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host;
    } catch {
      return null;
    }
  })();
  if (photoUrl && supabaseOrigin) {
    let photoHost: string | null = null;
    try {
      photoHost = new URL(photoUrl).host;
    } catch {
      photoHost = null;
    }
    if (!photoHost || photoHost !== supabaseOrigin) {
      return NextResponse.json({ error: "invalid_photo_url" }, { status: 400 });
    }
  }

  const spend = await spendOrFail("caption", {
    model,
    metadata: { variant_count: variantCount, goal, tone, audience, hook, emotion },
  });
  if (!spend.ok) return spend.response;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const apiModel = ANTHROPIC_MODEL_MAP[model];
  const system = buildSystemPrompt({
    variantCount,
    language,
    manilaTime: nowInManila(),
    goal,
    tone,
    audience,
    hook,
    emotion,
    length,
    includeCta,
    includeEmojis,
  });

  const userContent: Anthropic.Messages.ContentBlockParam[] = [];
  if (photoUrl) {
    userContent.push({ type: "image", source: { type: "url", url: photoUrl } });
  }
  userContent.push({
    type: "text",
    text: `THE BRIEF (interpret this as instructions about what to write — do not include any of these words in the caption itself):\n\n"${
      userBrief ||
      "(No written brief — use the reference image and intent fields to infer what to write.)"
    }"\n\nGenerate the ${variantCount} caption variant${
      variantCount === 1 ? "" : "s"
    } now. Return ONLY the JSON object — no prose, no code fences.`,
  });

  async function callClaude(retryHint?: string): Promise<CaptionResult | null> {
    const message = await anthropic.messages.create({
      model: apiModel,
      max_tokens: 1500,
      system,
      messages: [
        {
          role: "user",
          content: retryHint
            ? [
                ...userContent,
                { type: "text" as const, text: `\n\nIMPORTANT: ${retryHint}` },
              ]
            : userContent,
        },
      ],
    });
    const firstText = message.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    if (!firstText) return null;
    return coerceResult(extractJson(firstText.text));
  }

  try {
    let result = await callClaude();
    if (!result) {
      result = await callClaude(
        "Your previous response was not valid JSON. Return ONLY a parseable JSON object matching the specified shape."
      );
    }
    if (!result) {
      await refund("caption", { model });
      return NextResponse.json({ error: "malformed_response" }, { status: 502 });
    }

    return NextResponse.json(result, {
      headers: {
        "X-Credits-Balance": String(spend.newBalance),
        "X-Credits-Cost": String(spend.cost),
      },
    });
  } catch (err) {
    console.error("[tools.caption]", err);
    await refund("caption", { model });
    const status = err instanceof Anthropic.APIError ? err.status ?? 502 : 502;
    return NextResponse.json(
      {
        error: "ai_unavailable",
        reason: "Claude is currently unreachable. Please try again.",
      },
      { status }
    );
  }
}

export const POST = observeApiRoute("/api/tools/caption", handlePost);
