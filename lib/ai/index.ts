/**
 * Public surface of the AI framework. Tools import from here, never from
 * sub-paths.
 */
export { SYSTEM_FOUNDATION } from "./system";
export {
  runAiTool,
  MODEL_FOR_TOOL,
  LATENCY_BUDGET_MS,
  type ToolKey,
  type RunAiResult,
  type RunAiError,
} from "./client";
export {
  validateAiInput,
  renderInputForModel,
  type AiInput,
  type ContentType,
  type Platform,
  type Objective,
  type Language,
  type BrandVoice,
  type Constraints,
} from "./schemas/input";
export {
  computeConfidenceLevel,
  normalizeConfidence,
  normalizeChallenge,
  type Confidence,
  type ConfidenceFactors,
  type ConfidenceLevel,
  type Challenge,
  type ChallengeSeverity,
} from "./behavioral";
export {
  CAPTION_MODULE_PROMPT,
  normalizeCaptionOutput,
  type CaptionOutput,
} from "./prompts/caption";
export {
  IMAGE_MODULE_PROMPT,
  normalizeImageOutput,
  type ImageOutput,
  type ImageVariant,
  type AspectRatio,
} from "./prompts/image";
export {
  CAMPAIGN_MODULE_PROMPT,
  normalizeCampaignOutput,
  type CampaignOutput,
  type CampaignOption,
  type CampaignAngle,
  type BudgetTier,
} from "./prompts/campaign";
export {
  BLAST_MODULE_PROMPT,
  normalizeBlastOutput,
  type BlastOutput,
  type BlastDraft,
  type BlastPreviews,
} from "./prompts/blast";
