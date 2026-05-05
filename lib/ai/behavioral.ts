/**
 * Behavioral layer types — confidence scoring + challenges.
 *
 * Per AI_FRAMEWORK.md section 2. Used by tools that need to surface choice
 * (Image, Campaign). Caption and Blast hide these.
 */

export type ConfidenceLevel = "high" | "medium" | "low";

export type ConfidenceFactors = {
  hook_strength: 1 | 2 | 3 | 4 | 5;
  cta_clarity: 1 | 2 | 3 | 4 | 5;
  audience_fit: 1 | 2 | 3 | 4 | 5;
  platform_fit: 1 | 2 | 3 | 4 | 5;
};

export type Confidence = {
  level: ConfidenceLevel;
  factors: ConfidenceFactors;
  caveats?: string[];
};

/**
 * Compute level from factors. Used as a final guard — even if the model
 * returns a level, we recompute to enforce consistency.
 */
export function computeConfidenceLevel(factors: ConfidenceFactors): ConfidenceLevel {
  const avg =
    (factors.hook_strength + factors.cta_clarity + factors.audience_fit + factors.platform_fit) /
    4;
  if (avg >= 4.0) return "high";
  if (avg >= 3.0) return "medium";
  return "low";
}

/**
 * Validate and normalize a Confidence object returned by the model.
 * Returns null if invalid (caller should drop the field rather than fail).
 */
export function normalizeConfidence(raw: unknown): Confidence | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const f = r.factors as Record<string, unknown> | undefined;
  if (!f) return null;

  const clamp = (n: unknown): 1 | 2 | 3 | 4 | 5 => {
    const v = Math.round(Number(n));
    if (!Number.isFinite(v)) return 3;
    return Math.max(1, Math.min(5, v)) as 1 | 2 | 3 | 4 | 5;
  };

  const factors: ConfidenceFactors = {
    hook_strength: clamp(f.hook_strength),
    cta_clarity: clamp(f.cta_clarity),
    audience_fit: clamp(f.audience_fit),
    platform_fit: clamp(f.platform_fit),
  };

  const caveats = Array.isArray(r.caveats)
    ? (r.caveats as unknown[]).filter((c): c is string => typeof c === "string").slice(0, 3)
    : undefined;

  return {
    level: computeConfidenceLevel(factors),
    factors,
    caveats,
  };
}

// ---------- Challenge ----------

export type ChallengeSeverity = "info" | "warning";

export type Challenge = {
  severity: ChallengeSeverity;
  message: string;
  suggestion: string;
};

export function normalizeChallenge(raw: unknown): Challenge | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.message !== "string" || typeof r.suggestion !== "string") return null;
  const severity: ChallengeSeverity = r.severity === "warning" ? "warning" : "info";
  return {
    severity,
    message: r.message.trim().slice(0, 240),
    suggestion: r.suggestion.trim().slice(0, 240),
  };
}
