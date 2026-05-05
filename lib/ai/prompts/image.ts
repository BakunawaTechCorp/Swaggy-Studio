/**
 * Image tool — module prompt + output schema.
 *
 * Per AI_FRAMEWORK.md section 7.2. Claude does NOT generate images. Claude
 * generates the IMAGE PROMPTS that get sent to a downstream image API
 * (Imagen / Gemini Flash Image / DALL-E / Replicate).
 *
 * Output shape: 1-4 meaningfully-different visual directions.
 */
import {
  normalizeChallenge,
  normalizeConfidence,
  type Challenge,
  type Confidence,
} from "../behavioral";

export type VariantCount = 1 | 2 | 3 | 4;

export function buildImageModulePrompt(variantCount: VariantCount): string {
  const ids = ["a", "b", "c", "d"].slice(0, variantCount).map((i) => `"${i}"`).join(", ");
  return `MODULE: Image Generator (Prompt Writer)

You are NOT generating images. You generate prompts that will be sent to an image generation API.

Output: ${variantCount} distinct visual direction${variantCount === 1 ? "" : "s"}.

Each variant must be MEANINGFULLY different — different composition, mood, or visual metaphor. Not minor color swaps.

Process:
1. Read brand_voice and target_audience.
2. If reference_images are provided, use them as STYLE anchors (not subject anchors). Match palette, mood, framing.
3. Generate ${variantCount} meaningfully-different visual direction${variantCount === 1 ? "" : "s"}:
${
  variantCount === 1
    ? "   - One brand-safe, well-composed interpretation."
    : variantCount === 2
      ? "   - Variant A: brand-safe interpretation\n   - Variant B: visually distinctive interpretation (more memorable, slight creative risk)"
      : "   - Span the range: at least one brand-safe, at least one visually distinctive."
}

Rules:
- Each image_prompt: 60-120 words. Too short = generic. Too long = internal contradictions.
- Specify aspect ratio matching the platform (instagram feed = 4:5, story/reel = 9:16, twitter = 16:9, square = 1:1).
- No copyrighted characters, branded IP, or recognizable real people.
- If brand_voice mentions specific colors/aesthetics, weave them in.

Return EXACTLY this JSON shape:
{
  "variants": [
    {
      "id": "a",
      "label": "3-5 word label",
      "image_prompt": "the full prompt sent to the image API (60-120 words)",
      "rationale": "2-3 sentences explaining what this leans into and why",
      "aspect_ratio": "1:1" | "4:5" | "9:16" | "16:9",
      "confidence": {
        "factors": {
          "hook_strength": 1-5,
          "cta_clarity": 1-5,
          "audience_fit": 1-5,
          "platform_fit": 1-5
        },
        "caveats": ["optional honest disclaimers"]
      }
    }
    // exactly ${variantCount} item${variantCount === 1 ? "" : "s"}, ids: ${ids}
  ],
  "challenge": null | { "severity": "info" | "warning", "message": "...", "suggestion": "..." }
}`;
}

// Keep the eager constant as the 2-variant default for any old callers.
export const IMAGE_MODULE_PROMPT = buildImageModulePrompt(2);

// ---------- Output schema ----------

export type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9";
export type VariantLetter = "a" | "b" | "c" | "d";

export type ImageVariant = {
  id: VariantLetter;
  label: string;
  image_prompt: string;
  rationale: string;
  aspect_ratio: AspectRatio;
  confidence: Confidence;
};

export type ImageOutput = {
  variants: ImageVariant[];
  challenge?: Challenge;
};

const VALID_RATIOS = new Set<AspectRatio>(["1:1", "4:5", "9:16", "16:9"]);
const LETTERS: VariantLetter[] = ["a", "b", "c", "d"];

function normalizeVariant(raw: unknown, fallbackId: VariantLetter): ImageVariant | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  if (typeof r.label !== "string" || typeof r.image_prompt !== "string") return null;
  if (typeof r.rationale !== "string") return null;

  const ratio = r.aspect_ratio;
  if (typeof ratio !== "string" || !VALID_RATIOS.has(ratio as AspectRatio)) {
    return null;
  }

  const confidence = normalizeConfidence(r.confidence);
  if (!confidence) return null;

  const id =
    typeof r.id === "string" && (LETTERS as string[]).includes(r.id)
      ? (r.id as VariantLetter)
      : fallbackId;

  return {
    id,
    label: r.label.trim().slice(0, 60),
    image_prompt: r.image_prompt.trim().slice(0, 1500),
    rationale: r.rationale.trim().slice(0, 400),
    aspect_ratio: ratio as AspectRatio,
    confidence,
  };
}

export function normalizeImageOutput(raw: unknown): ImageOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  if (!Array.isArray(r.variants) || r.variants.length < 1) return null;

  const max = Math.min(r.variants.length, 4);
  const variants: ImageVariant[] = [];
  for (let i = 0; i < max; i++) {
    const v = normalizeVariant(r.variants[i], LETTERS[i]);
    if (v) variants.push(v);
  }
  if (variants.length === 0) return null;

  return {
    variants,
    challenge: normalizeChallenge(r.challenge) ?? undefined,
  };
}
