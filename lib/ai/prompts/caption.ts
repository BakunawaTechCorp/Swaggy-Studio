/**
 * Caption tool — module prompt + output schema.
 *
 * Per AI_FRAMEWORK.md section 7.1. Output shape: ONE caption + reasoning.
 * No alternatives, no scoring (single-output tool, scoring would be noise).
 */
import { normalizeChallenge, type Challenge } from "../behavioral";

export const CAPTION_MODULE_PROMPT = `MODULE: Caption Generator

You are generating ONE caption for a single social media post.

Output shape: a single caption + brief reasoning. No alternatives.

Process:
1. Read the brand_voice fields. Match the tone exactly. Do not drift toward
   your default voice.
2. If a reference image is provided, anchor the caption to ONE specific
   detail you see (color, texture, mood, an object's relationship to another).
3. Write the caption to the constraints (length, language, CTA presence).

Rules:
- ONE caption. No "Option A / Option B." Commit to your best.
- Hook must land in the first 8 words.
- 1 emoji maximum, placed inline never decoratively. 0 emojis is fine.
- No hashtags unless constraints.require_cta is false AND objective is "awareness."
- If language is taglish/tagalog/bisaya, code-switching must feel natural,
  not performative. If you can't write naturally in that language, return
  in english and add a challenge field flagging this.

Return EXACTLY this JSON shape:
{
  "caption": "string — the caption itself",
  "reasoning": {
    "hook_choice": "1 sentence — why this opener works",
    "voice_match": "1 sentence — how this matches the requested tone"
  },
  "challenge": null | {
    "severity": "info" | "warning",
    "message": "1-2 sentences",
    "suggestion": "concrete alternative"
  }
}`;

// ---------- Output schema ----------

export type CaptionOutput = {
  caption: string;
  reasoning: {
    hook_choice: string;
    voice_match: string;
  };
  challenge?: Challenge;
};

export type CaptionRawOutput = unknown;

/**
 * Validate and normalize raw model output for the Caption tool.
 * Returns null if the shape is unusable.
 */
export function normalizeCaptionOutput(raw: CaptionRawOutput): CaptionOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  if (typeof r.caption !== "string" || !r.caption.trim()) return null;

  const reasoning = r.reasoning as Record<string, unknown> | undefined;
  const hook_choice = typeof reasoning?.hook_choice === "string" ? reasoning.hook_choice : "";
  const voice_match = typeof reasoning?.voice_match === "string" ? reasoning.voice_match : "";

  const challenge = normalizeChallenge(r.challenge) ?? undefined;

  return {
    caption: r.caption.trim(),
    reasoning: {
      hook_choice: hook_choice.trim().slice(0, 200),
      voice_match: voice_match.trim().slice(0, 200),
    },
    challenge,
  };
}
