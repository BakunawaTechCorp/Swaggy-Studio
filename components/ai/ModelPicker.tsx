"use client";

import { useState } from "react";
import { ChevronDown, Lock, Zap, Brain, Target } from "lucide-react";
import {
  MODELS,
  ACTIVE_MODELS,
  getCost,
  type ActiveModelId,
  type ModelTier,
  type ToolName,
} from "@/lib/credits/costs";

type ToolKey = "caption" | "image" | "campaign";

const TOOL_MODELS: Record<ToolKey, ActiveModelId[]> = {
  caption: ["claude-haiku-4-5", "claude-sonnet-4-7"],
  campaign: ["claude-haiku-4-5", "claude-sonnet-4-7"],
  image: ["imagen-4-fast", "imagen-4"],
};

type Tier = {
  tier: ModelTier;
  icon: typeof Zap;
  label: string;
  desc: string;
  modelId: ActiveModelId | null;
  recommended?: boolean;
};

const TEXT_TIERS: Tier[] = [
  {
    tier: "Fast",
    icon: Zap,
    label: "Fast",
    desc: "Quick first drafts",
    modelId: "claude-haiku-4-5",
  },
  {
    tier: "Balanced",
    icon: Brain,
    label: "Balanced",
    desc: "Best for most posts",
    modelId: null,
    recommended: true,
  },
  {
    tier: "Pro",
    icon: Target,
    label: "Pro",
    desc: "Polished, on-brand voice",
    modelId: "claude-sonnet-4-7",
  },
];

const IMAGE_TIERS: Tier[] = [
  {
    tier: "Fast",
    icon: Zap,
    label: "Fast",
    desc: "Quick image drafts (~7s)",
    modelId: "imagen-4-fast",
    recommended: true,
  },
  {
    tier: "Pro",
    icon: Target,
    label: "Pro",
    desc: "Higher quality (~12s)",
    modelId: "imagen-4",
  },
];

export function ModelPicker({
  value,
  onChange,
  tool,
}: {
  value: ActiveModelId;
  onChange: (m: ActiveModelId) => void;
  tool: ToolKey;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const tiers = tool === "image" ? IMAGE_TIERS : TEXT_TIERS;
  const allowedIds = TOOL_MODELS[tool];
  const costTool: ToolName = tool;

  return (
    <div className="ai-power">
      <div className="tier-row">
        {tiers.map((t) => {
          const active = t.modelId !== null;
          const selected = active && t.modelId === value;
          const cost = active ? getCost(costTool, t.modelId!) : null;
          const Icon = t.icon;
          return (
            <button
              key={t.tier}
              type="button"
              disabled={!active}
              className={`tier-card ${selected ? "tier-card-selected" : ""} ${
                !active ? "tier-card-disabled" : ""
              }`}
              onClick={() => active && onChange(t.modelId!)}
            >
              {t.recommended && (
                <span className="tier-recommended">Recommended</span>
              )}
              <div className="tier-card-head">
                <Icon size={18} />
                <span className="tier-card-name">{t.label}</span>
                {!active && <Lock size={12} className="tier-card-lock" />}
              </div>
              <div className="tier-card-desc">
                {active ? t.desc : "Coming soon"}
              </div>
              <div className="tier-card-cost">
                {cost === null
                  ? "—"
                  : `${cost} credit${cost === 1 ? "" : "s"}${tool === "image" ? "/image" : ""}`}
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="intent-disclosure"
        onClick={() => setAdvancedOpen((o) => !o)}
        aria-expanded={advancedOpen}
      >
        <ChevronDown size={14} className={advancedOpen ? "rot-180" : ""} />
        <span>
          {advancedOpen ? "Hide model details" : "Advanced — pick exact model"}
        </span>
      </button>
      {advancedOpen && (
        <div className="model-list">
          {ACTIVE_MODELS.filter((id) => allowedIds.includes(id)).map((id) => {
            const m = MODELS[id];
            const selected = id === value;
            return (
              <button
                key={id}
                type="button"
                className={`model-list-item ${selected ? "is-selected" : ""}`}
                onClick={() => onChange(id)}
              >
                <span className="model-list-name">{m.label}</span>
                <span className="model-list-provider">{m.provider}</span>
                <span className={`tier-tag tier-${m.tier.toLowerCase()}`}>
                  {m.tier}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
