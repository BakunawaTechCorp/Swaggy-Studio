"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  GOALS,
  TONES,
  AUDIENCES,
  HOOK_STYLES,
  EMOTIONS,
  LENGTHS,
  type GoalId,
  type ToneId,
  type AudienceId,
  type HookStyleId,
  type EmotionId,
  type LengthId,
} from "@/lib/ai/intent";

export type IntentState = {
  goal?: GoalId;
  tone?: ToneId;
  audience?: AudienceId;
  hook_style?: HookStyleId;
  emotion?: EmotionId;
  length?: LengthId;
  include_cta?: boolean;
  include_emojis?: boolean;
};

type Props = {
  value: IntentState;
  onChange: (next: IntentState) => void;
};

// 4 user-facing primary goals (the rest live in advanced)
const PRIMARY_GOALS = GOALS.filter((g) =>
  ["engagement", "awareness", "follower_growth", "conversion"].includes(g.id)
);
// Top 4 tones surfaced as pills; the rest behind advanced
const PRIMARY_TONES = TONES.filter((t) =>
  ["playful", "bold", "premium", "friendly"].includes(t.id)
);
// Top 4 emotions surfaced as pills
const PRIMARY_EMOTIONS = EMOTIONS.filter((e) =>
  ["excite", "curiosity", "trust", "urgency"].includes(e.id)
);

const SUGGESTIONS: Record<string, { tone: ToneId; emotion: EmotionId; hook: HookStyleId; copy: string }> = {
  engagement: {
    tone: "bold",
    emotion: "curiosity",
    hook: "question",
    copy: "Bold tone + curiosity hook tests strongest for engagement.",
  },
  awareness: {
    tone: "friendly",
    emotion: "inspire",
    hook: "storytelling",
    copy: "Story hooks travel furthest on awareness posts.",
  },
  follower_growth: {
    tone: "premium",
    emotion: "trust",
    hook: "value_first",
    copy: "Lead with brand identity. Premium tone + value-first hook tested best.",
  },
  conversion: {
    tone: "bold",
    emotion: "urgency",
    hook: "direct_cta",
    copy: "Direct CTA hook + urgency converts hardest.",
  },
};

export function IntentFields({ value, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  const update = <K extends keyof IntentState>(key: K, v: IntentState[K]) =>
    onChange({ ...value, [key]: v });

  const suggestion = value.goal ? SUGGESTIONS[value.goal] : null;
  const applySuggestion = () => {
    if (!suggestion) return;
    onChange({
      ...value,
      tone: suggestion.tone,
      emotion: suggestion.emotion,
      hook_style: suggestion.hook,
    });
  };

  return (
    <>
      {/* GOAL — pill row */}
      <div className="ifield">
        <div className="ifield-label">
          <span>Goal</span>
          <span className="ifield-required">required</span>
        </div>
        <div className="pill-row">
          {PRIMARY_GOALS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => update("goal", g.id as GoalId)}
              className={`pill ${value.goal === g.id ? "pill-active" : ""}`}
              title={g.desc}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* TONE — pill row */}
      <div className="ifield">
        <div className="ifield-label">
          <span>Tone</span>
          <span className="ifield-required">required</span>
        </div>
        <div className="pill-row">
          {PRIMARY_TONES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => update("tone", t.id as ToneId)}
              className={`pill ${value.tone === t.id ? "pill-active" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* SMART GUIDANCE banner */}
      {suggestion && (
        <div className="guidance-banner">
          <span className="guidance-icon">✦</span>
          <span className="guidance-text">
            <strong>Joestar suggests:</strong> {suggestion.copy}
          </span>
          <button
            type="button"
            className="guidance-apply"
            onClick={applySuggestion}
          >
            Apply
          </button>
        </div>
      )}

      {/* EMOTION — pill row, optional */}
      <div className="ifield">
        <div className="ifield-label">
          <span>Emotion</span>
          <span className="ifield-optional">optional</span>
        </div>
        <div className="pill-row">
          {PRIMARY_EMOTIONS.map((em) => (
            <button
              key={em.id}
              type="button"
              onClick={() =>
                update(
                  "emotion",
                  value.emotion === em.id ? undefined : (em.id as EmotionId)
                )
              }
              className={`pill ${value.emotion === em.id ? "pill-active" : ""}`}
            >
              {em.label}
            </button>
          ))}
        </div>
      </div>

      {/* HOOK STYLE — pill row, optional */}
      <div className="ifield">
        <div className="ifield-label">
          <span>Hook style</span>
          <span className="ifield-optional">optional</span>
        </div>
        <div className="pill-row">
          {HOOK_STYLES.slice(0, 4).map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() =>
                update(
                  "hook_style",
                  value.hook_style === h.id ? undefined : (h.id as HookStyleId)
                )
              }
              className={`pill ${value.hook_style === h.id ? "pill-active" : ""}`}
              title={h.desc}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="intent-disclosure"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <ChevronDown size={14} className={expanded ? "rot-180" : ""} />
        <span>{expanded ? "Hide advanced" : "Advanced settings"}</span>
      </button>

      {expanded && (
        <div className="intent-advanced">
          <div className="intent-row">
            <div className="intent-field">
              <label className="caption-field-label">AUDIENCE</label>
              <select
                value={value.audience ?? ""}
                onChange={(e) =>
                  update(
                    "audience",
                    (e.target.value || undefined) as AudienceId | undefined
                  )
                }
                className="caption-select"
              >
                <option value="">Anyone</option>
                {AUDIENCES.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="intent-field">
              <label className="caption-field-label">LENGTH</label>
              <select
                value={value.length ?? ""}
                onChange={(e) =>
                  update(
                    "length",
                    (e.target.value || undefined) as LengthId | undefined
                  )
                }
                className="caption-select"
              >
                <option value="">Auto</option>
                {LENGTHS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="intent-toggles">
            <label className="intent-toggle">
              <input
                type="checkbox"
                checked={value.include_cta ?? false}
                onChange={(e) => update("include_cta", e.target.checked)}
              />
              <span>Include CTA</span>
            </label>
            <label className="intent-toggle">
              <input
                type="checkbox"
                checked={value.include_emojis ?? false}
                onChange={(e) => update("include_emojis", e.target.checked)}
              />
              <span>Include emojis</span>
            </label>
          </div>
        </div>
      )}
    </>
  );
}
