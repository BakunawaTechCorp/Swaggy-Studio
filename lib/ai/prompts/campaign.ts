/**
 * Campaign tool — module prompt + output schema.
 *
 * Per AI_FRAMEWORK.md section 7.3. The one tool where 3 strategic options
 * earn their place — campaign decisions have downstream cost (platforms,
 * budget, messaging) so giving the user a real choice with reasoning
 * matters.
 */
import {
  normalizeChallenge,
  normalizeConfidence,
  type Challenge,
  type Confidence,
} from "../behavioral";

export const CAMPAIGN_MODULE_PROMPT = `MODULE: Campaign Generator

You are designing a marketing campaign as 3 strategic options.

Output shape: 3 STRATEGICALLY different angles.
- SAFE: brand-aligned, low risk, predictable outcome
- ENGAGEMENT: optimized for shares/comments, medium risk
- BOLD: experimental, high ceiling, real downside risk

Each option must include:
- big_idea: the campaign's hook (one sentence)
- arc: 3-4 phases with names + one-line description each
- channels: which platforms + why
- budget_tier: "low" | "medium" | "high" relative to user's inputs
- confidence: structured factors (1-5)
- risk: specific honest description of the failure mode

Rules:
- The 3 options must be STRATEGICALLY different. Different mechanic, not
  the same idea in three tones.
- "Safe" doesn't mean boring. It means the user's existing audience would
  predictably engage.
- "Bold" must include the failure mode honestly. Example: "This will
  divide your audience — about 30% will be alienated. The other 70% will
  love it and tell their friends."
- If the user's input is too thin to design 3 distinct options (no product
  details, no audience signal), return a "challenge" with severity "warning"
  asking for more input, AND return your best 3 options with low confidence.
  Don't refuse — provide what you can.

Return EXACTLY this JSON shape:
{
  "options": [
    {
      "id": "safe",
      "big_idea": "one sentence",
      "arc": [
        { "name": "Tease", "description": "one line" },
        { "name": "Reveal", "description": "one line" },
        { "name": "Drive", "description": "one line" }
      ],
      "channels": [
        { "platform": "instagram", "why": "one line" },
        { "platform": "facebook", "why": "one line" }
      ],
      "budget_tier": "low" | "medium" | "high",
      "confidence": { "factors": { "hook_strength": 1-5, "cta_clarity": 1-5, "audience_fit": 1-5, "platform_fit": 1-5 } },
      "risk": "specific honest sentence about what could fail"
    },
    { "id": "engagement", ... same shape },
    { "id": "bold", ... same shape }
  ],
  "challenge": null | { "severity", "message", "suggestion" }
}`;

// ---------- Output schema ----------

export type CampaignAngle = "safe" | "engagement" | "bold";

export type ArcPhase = {
  name: string;
  description: string;
};

export type ChannelChoice = {
  platform: string;
  why: string;
};

export type BudgetTier = "low" | "medium" | "high";

export type CampaignOption = {
  id: CampaignAngle;
  big_idea: string;
  arc: ArcPhase[];
  channels: ChannelChoice[];
  budget_tier: BudgetTier;
  confidence: Confidence;
  risk: string;
};

export type CampaignOutput = {
  options: [CampaignOption, CampaignOption, CampaignOption];
  challenge?: Challenge;
};

const VALID_TIERS = new Set<BudgetTier>(["low", "medium", "high"]);
const VALID_ANGLES = new Set<CampaignAngle>(["safe", "engagement", "bold"]);

function normalizeArcPhase(raw: unknown): ArcPhase | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== "string" || typeof r.description !== "string") return null;
  return {
    name: r.name.trim().slice(0, 40),
    description: r.description.trim().slice(0, 200),
  };
}

function normalizeChannel(raw: unknown): ChannelChoice | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.platform !== "string" || typeof r.why !== "string") return null;
  return {
    platform: r.platform.trim().toLowerCase().slice(0, 30),
    why: r.why.trim().slice(0, 200),
  };
}

function normalizeOption(raw: unknown, expectedId: CampaignAngle): CampaignOption | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  // We accept the model's id but coerce to expected if missing/wrong.
  const id =
    typeof r.id === "string" && VALID_ANGLES.has(r.id as CampaignAngle)
      ? (r.id as CampaignAngle)
      : expectedId;

  if (typeof r.big_idea !== "string" || !r.big_idea.trim()) return null;
  if (typeof r.risk !== "string" || !r.risk.trim()) return null;

  const arcRaw = Array.isArray(r.arc) ? r.arc : [];
  const arc = arcRaw
    .map(normalizeArcPhase)
    .filter((p): p is ArcPhase => p != null)
    .slice(0, 6);
  if (arc.length < 2) return null;

  const channelsRaw = Array.isArray(r.channels) ? r.channels : [];
  const channels = channelsRaw
    .map(normalizeChannel)
    .filter((c): c is ChannelChoice => c != null)
    .slice(0, 6);
  if (channels.length < 1) return null;

  const tier = r.budget_tier;
  if (typeof tier !== "string" || !VALID_TIERS.has(tier as BudgetTier)) return null;

  const confidence = normalizeConfidence(r.confidence);
  if (!confidence) return null;

  return {
    id,
    big_idea: r.big_idea.trim().slice(0, 280),
    arc,
    channels,
    budget_tier: tier as BudgetTier,
    confidence,
    risk: r.risk.trim().slice(0, 280),
  };
}

export function normalizeCampaignOutput(raw: unknown): CampaignOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  if (!Array.isArray(r.options) || r.options.length < 3) return null;

  const safe = normalizeOption(r.options[0], "safe");
  const engagement = normalizeOption(r.options[1], "engagement");
  const bold = normalizeOption(r.options[2], "bold");

  if (!safe || !engagement || !bold) return null;

  return {
    options: [safe, engagement, bold],
    challenge: normalizeChallenge(r.challenge) ?? undefined,
  };
}
