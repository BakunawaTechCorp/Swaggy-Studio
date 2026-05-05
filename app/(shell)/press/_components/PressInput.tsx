"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, SlidersHorizontal, X, Cpu } from "lucide-react";
import { type ActiveModelId } from "@/lib/credits/costs";

export type PressFormState = {
  brief: string;
  company_name: string;
  subhead_hint: string;
  dateline_city: string;
  dateline_date: string;
  include_quote: boolean;
  spokesperson: string;
  spokesperson_title: string;
  boilerplate: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  model: ActiveModelId;
};

const MODEL_LABELS: Record<ActiveModelId, { label: string; credits: string }> = {
  "claude-haiku-4-5": { label: "Claude Haiku", credits: "~1 credit" },
  "claude-sonnet-4-7": { label: "Claude Sonnet", credits: "~3 credits" },
  "imagen-4-fast": { label: "Imagen 4 Fast", credits: "" },
  "imagen-4": { label: "Imagen 4", credits: "" },
};

type Props = {
  form: PressFormState;
  onChange: (f: PressFormState) => void;
  onGenerate: () => void;
  generating: boolean;
};

export function PressInput({ form, onChange, onGenerate, generating }: Props) {
  const [showRefine, setShowRefine] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 480)}px`;
  }, [form.brief]);

  // Required fields that the user still has to fill in.
  const missing = {
    company: !form.company_name.trim(),
    city: !form.dateline_city.trim(),
    contactName: !form.contact_name.trim(),
    contactEmail: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email),
  };
  const missingCount = Object.values(missing).filter(Boolean).length;

  // Optional refine count (filled fields beyond the required minimum).
  const optionalCount =
    (form.subhead_hint.trim() ? 1 : 0) +
    (form.boilerplate.trim() ? 1 : 0) +
    (form.contact_phone.trim() ? 1 : 0) +
    (form.spokesperson.trim() ? 1 : 0) +
    (form.spokesperson_title.trim() && form.spokesperson_title !== "Founder" ? 1 : 0) +
    (!form.include_quote ? 1 : 0);

  const refineBadgeColor = missingCount > 0 ? "danger" : "ok";
  const refineBadgeCount = missingCount > 0 ? missingCount : optionalCount;

  const activeModel = MODEL_LABELS[form.model];

  return (
    <div className="hero-shell">
      <div className="hero-greeting">
        <p className="hero-greeting-line">Press release</p>
        <h1 className="hero-greeting-q">
          What&apos;s your <span className="italic">news</span>?
        </h1>
      </div>

      <div className="hero-input">
        <textarea
          ref={taRef}
          className="hero-textarea"
          placeholder="What are you announcing? (e.g. Frigga Charmed Life launches its first sustainable activewear collection, designed for Filipino women 25-35, available exclusively online starting April 15.)"
          value={form.brief}
          onChange={(e) => onChange({ ...form, brief: e.target.value })}
          rows={2}
          maxLength={2000}
          disabled={generating}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              (e.metaKey || e.ctrlKey) &&
              form.brief.trim() &&
              !generating
            ) {
              e.preventDefault();
              onGenerate();
            }
          }}
        />

        <div className="hero-input-foot">
          <div className="hero-input-foot-left">
            <button
              type="button"
              className="hero-refine-btn"
              onClick={() => setShowRefine(true)}
              disabled={generating}
              title={
                missingCount > 0
                  ? "Fill in company, dateline city, and media contact"
                  : "Refine"
              }
            >
              <SlidersHorizontal size={12} />
              <span>Details</span>
              {refineBadgeCount > 0 && (
                <span
                  className={`hero-refine-badge ${
                    refineBadgeColor === "danger" ? "is-danger" : ""
                  }`}
                >
                  {refineBadgeCount}
                </span>
              )}
            </button>
            {form.brief.length > 0 && (
              <span className="hero-charcount">{form.brief.length}/2000</span>
            )}
          </div>

          <div className="hero-input-foot-right">
            <button
              type="button"
              className="hero-model-chip"
              onClick={() => setShowRefine(true)}
              disabled={generating}
              title="Change model"
            >
              <Cpu size={12} />
              <span>{activeModel.label}</span>
              {activeModel.credits && (
                <span className="muted">· {activeModel.credits}</span>
              )}
            </button>
            <button
              type="button"
              className="hero-generate-btn"
              onClick={onGenerate}
              disabled={generating || !form.brief.trim()}
            >
              <Sparkles size={16} />
              {generating ? "Writing…" : "Generate"}
            </button>
          </div>
        </div>
      </div>

      <p className="hero-subtext">
        {missingCount > 0
          ? "Add company, dateline, and media contact in Details before generating."
          : "Standard PR Newswire format. Auto-saves to your Library."}
      </p>

      {showRefine && (
        <PressRefineModal
          form={form}
          onChange={onChange}
          onClose={() => setShowRefine(false)}
        />
      )}
    </div>
  );
}

// ---------- Refine modal ----------

function PressRefineModal({
  form,
  onChange,
  onClose,
}: {
  form: PressFormState;
  onChange: (f: PressFormState) => void;
  onClose: () => void;
}) {
  const update = <K extends keyof PressFormState>(
    k: K,
    v: PressFormState[K]
  ) => onChange({ ...form, [k]: v });

  return (
    <div className="model-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="refine-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Press release details"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="model-modal-head">
          <h3>Press release details</h3>
          <button
            type="button"
            className="hero-icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="refine-modal-body">
          <RefineGroup title="Company">
            <RefineField label="Company name *">
              <input
                type="text"
                maxLength={120}
                placeholder="e.g. Frigga Charmed Life"
                value={form.company_name}
                onChange={(e) => update("company_name", e.target.value)}
                required
              />
            </RefineField>
            <RefineField label="Dateline city *">
              <input
                type="text"
                maxLength={60}
                placeholder="e.g. Manila"
                value={form.dateline_city}
                onChange={(e) => update("dateline_city", e.target.value)}
                required
              />
            </RefineField>
            <RefineField label="Date">
              <input
                type="date"
                value={form.dateline_date}
                onChange={(e) => update("dateline_date", e.target.value)}
              />
            </RefineField>
            <RefineField label="Subhead angle (optional)">
              <input
                type="text"
                maxLength={200}
                placeholder="e.g. focus on local manufacturing, founder's story"
                value={form.subhead_hint}
                onChange={(e) => update("subhead_hint", e.target.value)}
              />
            </RefineField>
            <RefineField label="Boilerplate (About paragraph)">
              <textarea
                rows={2}
                maxLength={1000}
                placeholder="1-2 sentences about your company"
                value={form.boilerplate}
                onChange={(e) => update("boilerplate", e.target.value)}
              />
            </RefineField>
          </RefineGroup>

          <RefineGroup title="Quote">
            <label className="press-toggle" style={{ marginBottom: 0 }}>
              <input
                type="checkbox"
                checked={form.include_quote}
                onChange={(e) => update("include_quote", e.target.checked)}
              />
              <span>Include a quote from a spokesperson</span>
            </label>
            {form.include_quote && (
              <>
                <RefineField label="Spokesperson name">
                  <input
                    type="text"
                    maxLength={80}
                    placeholder="Defaults to contact name"
                    value={form.spokesperson}
                    onChange={(e) => update("spokesperson", e.target.value)}
                  />
                </RefineField>
                <RefineField label="Title">
                  <input
                    type="text"
                    maxLength={80}
                    placeholder="e.g. Founder, CEO"
                    value={form.spokesperson_title}
                    onChange={(e) =>
                      update("spokesperson_title", e.target.value)
                    }
                  />
                </RefineField>
              </>
            )}
          </RefineGroup>

          <RefineGroup title="Media contact">
            <RefineField label="Contact name *">
              <input
                type="text"
                maxLength={80}
                value={form.contact_name}
                onChange={(e) => update("contact_name", e.target.value)}
                required
              />
            </RefineField>
            <RefineField label="Email *">
              <input
                type="email"
                maxLength={120}
                value={form.contact_email}
                onChange={(e) => update("contact_email", e.target.value)}
                required
              />
            </RefineField>
            <RefineField label="Phone (optional)">
              <input
                type="tel"
                maxLength={30}
                value={form.contact_phone}
                onChange={(e) => update("contact_phone", e.target.value)}
              />
            </RefineField>
          </RefineGroup>

          <RefineGroup title="Model">
            <RefineField label="Text model">
              <select
                value={form.model}
                onChange={(e) =>
                  update("model", e.target.value as ActiveModelId)
                }
              >
                <option value="claude-haiku-4-5">Fast — Claude Haiku</option>
                <option value="claude-sonnet-4-7">
                  Pro — Claude Sonnet (recommended)
                </option>
              </select>
            </RefineField>
          </RefineGroup>
        </div>

        <div className="refine-modal-foot">
          <button type="button" className="hero-generate-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function RefineGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="refine-group">
      <div className="refine-group-title">{title}</div>
      <div className="refine-group-grid">{children}</div>
    </div>
  );
}

function RefineField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="refine-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
