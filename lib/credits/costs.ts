/**
 * Credit cost configuration — single source of truth.
 * Costs vary by (tool, model). Tier tags ride alongside the model name.
 */

export const ACTIVE_MODELS = [
  "claude-haiku-4-5",
  "claude-sonnet-4-7",
  "imagen-4-fast",
  "imagen-4",
] as const;
export type ActiveModelId = (typeof ACTIVE_MODELS)[number];

export const COMING_SOON_MODELS = ["openai-gpt-4o", "google-gemini-pro"] as const;
export type ComingSoonModelId = (typeof COMING_SOON_MODELS)[number];

export type ModelId = ActiveModelId | ComingSoonModelId;

export type ModelTier = "Fast" | "Balanced" | "Pro";

export type ModelMeta = {
  id: ModelId;
  label: string;
  provider: "Anthropic" | "OpenAI" | "Google";
  tier: ModelTier;
  tagline: string;
  active: boolean;
};

export const MODELS: Record<ModelId, ModelMeta> = {
  "claude-haiku-4-5": {
    id: "claude-haiku-4-5",
    label: "Claude Haiku",
    provider: "Anthropic",
    tier: "Fast",
    tagline: "Quick drafts, low credit cost",
    active: true,
  },
  "claude-sonnet-4-7": {
    id: "claude-sonnet-4-7",
    label: "Claude Sonnet",
    provider: "Anthropic",
    tier: "Pro",
    tagline: "Best quality and reasoning",
    active: true,
  },
  "imagen-4-fast": {
    id: "imagen-4-fast",
    label: "Imagen 4 Fast",
    provider: "Google",
    tier: "Fast",
    tagline: "Quick image drafts (~7s)",
    active: true,
  },
  "imagen-4": {
    id: "imagen-4",
    label: "Imagen 4",
    provider: "Google",
    tier: "Pro",
    tagline: "Higher quality images (~12s)",
    active: true,
  },
  "openai-gpt-4o": {
    id: "openai-gpt-4o",
    label: "GPT-4o",
    provider: "OpenAI",
    tier: "Balanced",
    tagline: "Coming soon",
    active: false,
  },
  "google-gemini-pro": {
    id: "google-gemini-pro",
    label: "Gemini Pro",
    provider: "Google",
    tier: "Balanced",
    tagline: "Coming soon",
    active: false,
  },
};

export type ToolName =
  | "caption"
  | "image"
  | "campaign"
  | "blast"
  | "blast_per_recipient"
  | "projects";

const BASE_COSTS: Record<ToolName, number> = {
  caption: 1,
  image: 2,
  campaign: 10,
  blast: 0,
  blast_per_recipient: 1,
  projects: 0,
};

const MODEL_MULTIPLIER: Record<ActiveModelId, number> = {
  "claude-haiku-4-5": 1,
  "claude-sonnet-4-7": 3,
  "imagen-4-fast": 1,
  "imagen-4": 2.5,
};

export function getCost(
  tool: ToolName,
  model?: ActiveModelId,
  multiplier = 1
): number {
  const base = BASE_COSTS[tool] ?? 0;
  if (base === 0) return 0;
  const modelMult = model ? MODEL_MULTIPLIER[model] : 1;
  return Math.ceil(base * modelMult * multiplier);
}

export function getCostLabel(tool: ToolName, model?: ActiveModelId): string {
  const c = getCost(tool, model);
  if (c === 0) return "free";
  if (tool === "blast_per_recipient") return `${c}/recipient`;
  return `${c} credit${c === 1 ? "" : "s"}`;
}

/**
 * Total cost for image generation: per-variant cost × variant count.
 * Returns 0 if model isn't an Imagen model.
 */
export function getImageCost(model: ActiveModelId, variantCount: number): number {
  if (model !== "imagen-4-fast" && model !== "imagen-4") return 0;
  return getCost("image", model, variantCount);
}

export const DEFAULT_MODEL: ActiveModelId = "claude-haiku-4-5";
export const DEFAULT_IMAGE_MODEL: ActiveModelId = "imagen-4-fast";

export const CREDIT_COSTS = {
  caption: getCost("caption", DEFAULT_MODEL),
  image: getCost("image", DEFAULT_IMAGE_MODEL),
  campaign: getCost("campaign", DEFAULT_MODEL),
  blast: getCost("blast"),
  blast_per_recipient: getCost("blast_per_recipient"),
  projects: 0,
} as const;
