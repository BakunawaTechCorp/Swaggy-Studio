/**
 * Shared input envelope for every AI tool.
 *
 * Per AI_FRAMEWORK.md section 4. Never pass raw user text into the model
 * without going through this envelope.
 */

export type ContentType = "caption" | "image" | "campaign" | "blast";
export type Platform =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "twitter"
  | "linkedin"
  | "email"
  | "sms";

export type Objective =
  | "engagement"
  | "conversion"
  | "awareness"
  | "loyalty"
  | "announcement";

export type Language = "tagalog" | "bisaya" | "english" | "taglish";

export type BrandVoice = {
  tone: string[];
  avoid: string[];
  industry?: string;
};

export type AudienceSignals = {
  region?: string;
  age_band?: string;
  interests?: string[];
};

export type Constraints = {
  max_length?: number;
  min_length?: number;
  require_cta?: boolean;
  avoid_hashtags?: boolean;
  language?: Language;
};

export type AiInput = {
  user_goal: string;
  content_type: ContentType;
  platform: Platform;
  brand_voice: BrandVoice;
  target_audience: string;
  audience_signals?: AudienceSignals;
  objective: Objective;
  constraints?: Constraints;
  context?: string;
  reference_images?: string[];
};

// ---------- Validation ----------

const VALID_PLATFORMS: ReadonlySet<Platform> = new Set([
  "instagram",
  "facebook",
  "tiktok",
  "twitter",
  "linkedin",
  "email",
  "sms",
]);

const VALID_CONTENT_TYPES: ReadonlySet<ContentType> = new Set([
  "caption",
  "image",
  "campaign",
  "blast",
]);

const VALID_OBJECTIVES: ReadonlySet<Objective> = new Set([
  "engagement",
  "conversion",
  "awareness",
  "loyalty",
  "announcement",
]);

const VALID_LANGUAGES: ReadonlySet<Language> = new Set([
  "tagalog",
  "bisaya",
  "english",
  "taglish",
]);

export type ValidationResult =
  | { ok: true; input: AiInput }
  | { ok: false; field: string; message: string };

/**
 * Validates and normalizes an unknown input object.
 * Returns the validated input or a structured error.
 */
export function validateAiInput(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, field: "_root", message: "input must be an object" };
  }

  const i = raw as Record<string, unknown>;

  if (typeof i.user_goal !== "string" || !i.user_goal.trim()) {
    return { ok: false, field: "user_goal", message: "user_goal is required" };
  }

  if (typeof i.content_type !== "string" || !VALID_CONTENT_TYPES.has(i.content_type as ContentType)) {
    return {
      ok: false,
      field: "content_type",
      message: `content_type must be one of: ${[...VALID_CONTENT_TYPES].join(", ")}`,
    };
  }

  if (typeof i.platform !== "string" || !VALID_PLATFORMS.has(i.platform as Platform)) {
    return {
      ok: false,
      field: "platform",
      message: `platform must be one of: ${[...VALID_PLATFORMS].join(", ")}`,
    };
  }

  if (typeof i.objective !== "string" || !VALID_OBJECTIVES.has(i.objective as Objective)) {
    return {
      ok: false,
      field: "objective",
      message: `objective must be one of: ${[...VALID_OBJECTIVES].join(", ")}`,
    };
  }

  if (typeof i.target_audience !== "string" || !i.target_audience.trim()) {
    return {
      ok: false,
      field: "target_audience",
      message: "target_audience is required",
    };
  }

  // brand_voice
  const bv = i.brand_voice;
  if (!bv || typeof bv !== "object") {
    return { ok: false, field: "brand_voice", message: "brand_voice is required" };
  }
  const bvObj = bv as Record<string, unknown>;
  const tone = Array.isArray(bvObj.tone) ? (bvObj.tone as unknown[]).filter((t): t is string => typeof t === "string") : [];
  const avoid = Array.isArray(bvObj.avoid) ? (bvObj.avoid as unknown[]).filter((t): t is string => typeof t === "string") : [];

  // constraints
  const c = (i.constraints && typeof i.constraints === "object" ? i.constraints : {}) as Record<string, unknown>;
  if (c.language !== undefined && !VALID_LANGUAGES.has(c.language as Language)) {
    return {
      ok: false,
      field: "constraints.language",
      message: `language must be one of: ${[...VALID_LANGUAGES].join(", ")}`,
    };
  }

  const constraints: Constraints = {
    max_length: typeof c.max_length === "number" ? Math.floor(c.max_length) : undefined,
    min_length: typeof c.min_length === "number" ? Math.floor(c.min_length) : undefined,
    require_cta: typeof c.require_cta === "boolean" ? c.require_cta : undefined,
    avoid_hashtags: typeof c.avoid_hashtags === "boolean" ? c.avoid_hashtags : undefined,
    language: c.language as Language | undefined,
  };

  // reference_images
  const refs = Array.isArray(i.reference_images)
    ? (i.reference_images as unknown[])
        .filter((u): u is string => typeof u === "string")
        .filter((u) => /^https?:\/\//.test(u))
        .slice(0, 5)
    : undefined;

  const input: AiInput = {
    user_goal: i.user_goal.trim().slice(0, 200),
    content_type: i.content_type as ContentType,
    platform: i.platform as Platform,
    brand_voice: {
      tone: tone.slice(0, 8),
      avoid: avoid.slice(0, 8),
      industry: typeof bvObj.industry === "string" ? bvObj.industry : undefined,
    },
    target_audience: i.target_audience.trim().slice(0, 400),
    objective: i.objective as Objective,
    constraints,
    context: typeof i.context === "string" ? i.context.slice(0, 1000) : undefined,
    reference_images: refs,
    audience_signals:
      i.audience_signals && typeof i.audience_signals === "object"
        ? (i.audience_signals as AudienceSignals)
        : undefined,
  };

  return { ok: true, input };
}

/**
 * Renders the AiInput as a compact, model-readable string. Used as the user
 * message body. Keeps the format stable so prompts can reference fields.
 */
export function renderInputForModel(input: AiInput): string {
  const lines: string[] = [];
  lines.push(`USER_GOAL: ${input.user_goal}`);
  lines.push(`CONTENT_TYPE: ${input.content_type}`);
  lines.push(`PLATFORM: ${input.platform}`);
  lines.push(`OBJECTIVE: ${input.objective}`);
  lines.push(`TARGET_AUDIENCE: ${input.target_audience}`);
  lines.push(`BRAND_VOICE.tone: ${input.brand_voice.tone.join(", ") || "(unspecified)"}`);
  lines.push(`BRAND_VOICE.avoid: ${input.brand_voice.avoid.join(", ") || "(unspecified)"}`);
  if (input.brand_voice.industry) lines.push(`BRAND_VOICE.industry: ${input.brand_voice.industry}`);
  if (input.audience_signals) {
    if (input.audience_signals.region) lines.push(`AUDIENCE.region: ${input.audience_signals.region}`);
    if (input.audience_signals.age_band) lines.push(`AUDIENCE.age_band: ${input.audience_signals.age_band}`);
    if (input.audience_signals.interests?.length)
      lines.push(`AUDIENCE.interests: ${input.audience_signals.interests.join(", ")}`);
  }
  if (input.constraints) {
    const c = input.constraints;
    if (c.max_length != null) lines.push(`CONSTRAINT.max_length: ${c.max_length}`);
    if (c.min_length != null) lines.push(`CONSTRAINT.min_length: ${c.min_length}`);
    if (c.require_cta != null) lines.push(`CONSTRAINT.require_cta: ${c.require_cta}`);
    if (c.avoid_hashtags != null) lines.push(`CONSTRAINT.avoid_hashtags: ${c.avoid_hashtags}`);
    if (c.language) lines.push(`CONSTRAINT.language: ${c.language}`);
  }
  if (input.context) lines.push(`CONTEXT: ${input.context}`);
  return lines.join("\n");
}
