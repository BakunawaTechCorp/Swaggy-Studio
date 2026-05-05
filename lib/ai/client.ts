/**
 * Shared Anthropic client wrapper.
 *
 * Every AI tool calls `runAiTool()` from here — never imports Anthropic SDK
 * directly. This is the place to:
 *   - Centralize model selection
 *   - Enforce JSON-only output
 *   - Handle one-retry-on-malformed-JSON
 *   - Apply latency budgets
 *   - Log calls (when ai_call_log table lands in Phase 4.5)
 */
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_FOUNDATION } from "./system";
import { renderInputForModel, type AiInput } from "./schemas/input";

// Model selection per AI_FRAMEWORK.md section 9.1
export const MODEL_FOR_TOOL = {
  caption: "claude-haiku-4-5",
  blast: "claude-haiku-4-5",
  image: "claude-sonnet-4-7",
  campaign: "claude-sonnet-4-7",
} as const;

export type ToolKey = keyof typeof MODEL_FOR_TOOL;

// Map internal model ids to actual Anthropic API model strings.
// Keep in sync with app/api/tools/caption/route.ts ANTHROPIC_MODEL_MAP.
const ANTHROPIC_MODEL_MAP: Record<string, string> = {
  "claude-haiku-4-5": "claude-haiku-4-5",
  "claude-sonnet-4-7": "claude-sonnet-4-5-20250929",
};

// Latency budgets in ms — used as soft warnings, not hard cutoffs.
export const LATENCY_BUDGET_MS = {
  caption: 4000,
  blast: 4000,
  image: 12000,
  campaign: 8000,
} as const;

export type RunAiOptions = {
  tool: ToolKey;
  modulePrompt: string;
  input: AiInput;
  /**
   * Whether to attach reference images as image blocks (vision mode).
   * Required for caption with photo, image generation prompt-writing.
   */
  includeImages?: boolean;
  /**
   * Override max_tokens. Defaults: caption/blast 600, image/campaign 1500.
   */
  maxTokens?: number;
};

export type RunAiResult<T> =
  | { ok: true; data: T; latencyMs: number; model: string }
  | { ok: false; error: RunAiError; latencyMs: number };

export type RunAiError =
  | { kind: "missing_api_key" }
  | { kind: "model_error"; status: number; message: string }
  | { kind: "malformed_json"; raw: string }
  | { kind: "timeout" }
  | { kind: "content_blocked" };

const DEFAULT_MAX_TOKENS: Record<ToolKey, number> = {
  caption: 600,
  blast: 600,
  image: 1500,
  campaign: 1500,
};

/**
 * Run a single AI tool call. Returns parsed JSON or a structured error.
 *
 * The flow:
 *   1. Compose system = SYSTEM_FOUNDATION + modulePrompt
 *   2. Compose user = renderInputForModel(input) [+ images if includeImages]
 *   3. Call model
 *   4. Try to parse JSON
 *   5. If malformed, retry ONCE with a stricter reminder
 *   6. Return parsed or error
 */
export async function runAiTool<T = unknown>(
  options: RunAiOptions
): Promise<RunAiResult<T>> {
  const { tool, modulePrompt, input, includeImages = false, maxTokens } = options;
  const internalModel = MODEL_FOR_TOOL[tool];
  const model = ANTHROPIC_MODEL_MAP[internalModel] ?? internalModel;
  const max_tokens = maxTokens ?? DEFAULT_MAX_TOKENS[tool];
  const start = Date.now();

  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: { kind: "missing_api_key" }, latencyMs: 0 };
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const system = `${SYSTEM_FOUNDATION}\n\n---\n\n${modulePrompt}`;

  const userText = renderInputForModel(input);

  const userContent: Anthropic.Messages.ContentBlockParam[] = [];

  if (includeImages && input.reference_images && input.reference_images.length > 0) {
    for (const url of input.reference_images.slice(0, 3)) {
      userContent.push({
        type: "image",
        source: { type: "url", url },
      });
    }
  }

  userContent.push({
    type: "text",
    text: `${userText}\n\nReturn ONLY the JSON object specified by the module instructions. No prose, no code fences.`,
  });

  async function callOnce(retryHint?: string): Promise<RunAiResult<T>> {
    try {
      const message = await anthropic.messages.create({
        model,
        max_tokens,
        system,
        messages: [
          {
            role: "user",
            content: retryHint
              ? [
                  ...userContent,
                  {
                    type: "text",
                    text: `\n\nIMPORTANT: ${retryHint}`,
                  },
                ]
              : userContent,
          },
        ],
      });

      const firstText = message.content.find(
        (block): block is Anthropic.TextBlock => block.type === "text"
      );

      if (!firstText) {
        return {
          ok: false,
          error: { kind: "malformed_json", raw: "" },
          latencyMs: Date.now() - start,
        };
      }

      const parsed = extractJson<T>(firstText.text);
      if (parsed == null) {
        return {
          ok: false,
          error: { kind: "malformed_json", raw: firstText.text.slice(0, 500) },
          latencyMs: Date.now() - start,
        };
      }

      return {
        ok: true,
        data: parsed,
        latencyMs: Date.now() - start,
        model,
      };
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        // Detect content policy refusals (best-effort heuristic).
        if (err.status === 400 && /refusal|policy|content/i.test(err.message ?? "")) {
          return {
            ok: false,
            error: { kind: "content_blocked" },
            latencyMs: Date.now() - start,
          };
        }
        return {
          ok: false,
          error: {
            kind: "model_error",
            status: err.status ?? 500,
            message: err.message ?? "upstream error",
          },
          latencyMs: Date.now() - start,
        };
      }
      console.error(`[ai.client] unexpected error in ${tool}`, err);
      return {
        ok: false,
        error: { kind: "model_error", status: 500, message: "unexpected" },
        latencyMs: Date.now() - start,
      };
    }
  }

  // First attempt.
  let result = await callOnce();

  // One retry on malformed JSON only. Other errors don't retry (timeout/auth/policy).
  if (!result.ok && result.error.kind === "malformed_json") {
    result = await callOnce(
      "Your previous response was not valid JSON. Return ONLY a parseable JSON object — no markdown fences, no preamble."
    );
  }

  return result;
}

/**
 * Robust JSON extraction. Handles:
 *  - Plain JSON
 *  - JSON wrapped in ```json fences
 *  - JSON with leading/trailing prose (best-effort: pulls first {...} block)
 */
function extractJson<T>(text: string): T | null {
  const trimmed = text.trim();

  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1] : trimmed;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    // fallthrough
  }

  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(candidate.slice(first, last + 1)) as T;
    } catch {
      return null;
    }
  }
  return null;
}
