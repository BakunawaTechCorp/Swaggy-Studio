"use client";

import { useState, type ReactNode } from "react";
import { Copy, Save, Sparkles, Wand2 } from "lucide-react";
import { useToast } from "@/components/toast";
import type { CreateResult } from "./CreateTool";

type Props = {
  result: CreateResult;
  brief: string;
};

type ImageVariant = NonNullable<CreateResult["image_variants"]>[number];
type CampaignOption = NonNullable<CreateResult["campaign"]>["options"][number];
type CaptionData = NonNullable<CreateResult["caption"]>;

export function CreateOutput({ result, brief }: Props) {
  // Critique mode short-circuits everything else.
  if (result.mode === "critique" && result.critique) {
    return <CritiqueView critique={result.critique} />;
  }
  return <GenerationView result={result} brief={brief} />;
}

function GenerationView({ result, brief }: Props) {
  const { show } = useToast();
  const plan = result.plan!;
  const campaign = result.campaign;

  // Local mutable copies so refines update in place without rebuilding the page.
  const [caption, setCaption] = useState<CaptionData | null>(
    result.caption ?? null
  );
  const [variants, setVariants] = useState<ImageVariant[]>(
    result.image_variants ?? []
  );

  const [pickedImageIdx, setPickedImageIdx] = useState<number | null>(null);
  const [savingImage, setSavingImage] = useState(false);

  const [imageFeedback, setImageFeedback] = useState("");
  const [refiningImage, setRefiningImage] = useState(false);

  const [captionFeedback, setCaptionFeedback] = useState("");
  const [refiningCaption, setRefiningCaption] = useState(false);

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(
      () => show(`${label} copied.`, "success"),
      () => show("Couldn't copy.", "error")
    );
  }

  async function pickImage(idx: number) {
    const v = variants[idx];
    if (!v?.image) return;
    setSavingImage(true);
    try {
      const res = await fetch("/api/tools/image/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64: v.image.base64, mimeType: v.image.mimeType }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { url: string };
      setPickedImageIdx(idx);

      void fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "image",
          title: v.label || brief.slice(0, 80),
          payload: {
            image_url: json.url,
            prompt: v.image_prompt,
            rationale: v.rationale,
            aspect_ratio: v.aspect_ratio,
            accompanying_caption: caption?.caption,
          },
          thumbnail_url: json.url,
          metadata: { from: "create", brief, plan },
        }),
      }).catch(() => undefined);

      show("Image saved to Library.", "success");
    } catch {
      show("Couldn't save the image.", "error");
    } finally {
      setSavingImage(false);
    }
  }

  function saveCaption() {
    if (!caption) return;
    void fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "caption",
        title: caption.caption.slice(0, 80),
        payload: {
          caption: caption.caption,
          hook_type: "",
          tone: plan.inferred_tone,
          reasoning: caption.reasoning,
          platform: plan.inferred_platform,
        },
        metadata: { from: "create", brief, plan },
      }),
    }).then(
      (res) =>
        res.ok
          ? show("Caption saved to Library.", "success")
          : show("Couldn't save.", "error"),
      () => show("Couldn't save.", "error")
    );
  }

  function saveCampaign(option: CampaignOption) {
    void fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "campaign",
        title: option.big_idea?.slice(0, 80) || "Campaign",
        payload: { ...option, brief },
        metadata: { from: "create", plan },
      }),
    }).then(
      (res) =>
        res.ok
          ? show("Campaign saved to Library.", "success")
          : show("Couldn't save.", "error"),
      () => show("Couldn't save.", "error")
    );
  }

  // ---------- Refines ----------

  // Default the image-refine target to the picked card, otherwise the first
  // card with a successful render.
  function targetImageIdx(): number | null {
    if (pickedImageIdx !== null) return pickedImageIdx;
    const i = variants.findIndex((v) => v.image);
    return i === -1 ? null : i;
  }

  async function regenerateImage() {
    const idx = targetImageIdx();
    if (idx === null) return;
    const target = variants[idx];
    if (!target) return;
    if (!imageFeedback.trim()) {
      show("Tell Joestar what to change.", "error");
      return;
    }
    setRefiningImage(true);
    try {
      const res = await fetch("/api/tools/create/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "image",
          brief,
          platform: plan.inferred_platform,
          audience: plan.inferred_audience,
          tone: plan.inferred_tone,
          originalPrompt: target.image_prompt,
          aspectRatio: target.aspect_ratio,
          feedback: imageFeedback.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.reason || err?.error || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as {
        image: {
          label: string;
          rationale: string;
          image_prompt: string;
          aspect_ratio: string;
          image: { base64: string; mimeType: string };
        };
      };
      setVariants((prev) => {
        const next = prev.slice();
        next[idx] = {
          id: target.id,
          label: json.image.label,
          rationale: json.image.rationale,
          aspect_ratio: json.image.aspect_ratio,
          image_prompt: json.image.image_prompt,
          image: json.image.image,
        };
        return next;
      });
      // Picking is invalidated — the user needs to re-pick if they want to save.
      setPickedImageIdx(null);
      setImageFeedback("");
      show("Image refreshed. Pick again to save.", "success");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Couldn't regenerate the image.";
      show(msg, "error");
    } finally {
      setRefiningImage(false);
    }
  }

  async function regenerateCaption(feedbackOverride?: string) {
    if (!caption) return;
    const fb = (feedbackOverride ?? captionFeedback).trim();
    if (!fb) {
      show("Tell Joestar what to change.", "error");
      return;
    }
    setRefiningCaption(true);
    try {
      const res = await fetch("/api/tools/create/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "caption",
          brief,
          platform: plan.inferred_platform,
          audience: plan.inferred_audience,
          goal: plan.inferred_goal,
          tone: plan.inferred_tone,
          originalCaption: caption.caption,
          feedback: fb,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.reason || err?.error || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as {
        caption: { caption: string; reasoning: string };
      };
      setCaption(json.caption);
      setCaptionFeedback("");
      show("Caption rewritten.", "success");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Couldn't rewrite the caption.";
      show(msg, "error");
    } finally {
      setRefiningCaption(false);
    }
  }

  return (
    <div className="create-output">
      <div className="create-output-header">
        <h2>
          <span className="italic">Here&apos;s</span> what I made.
        </h2>
        <p className="muted">{plan.reasoning}</p>
      </div>

      {variants.length > 0 && (
        <section className="create-section">
          <h3 className="create-section-title">Pick an image</h3>
          <div className="create-image-grid">
            {variants.map((v, idx) => (
              <button
                type="button"
                key={`${v.id}-${idx}`}
                className={`create-image-card ${
                  pickedImageIdx === idx ? "is-picked" : ""
                }`}
                onClick={() => pickImage(idx)}
                disabled={savingImage || refiningImage || !v.image}
              >
                {v.image ? (
                  <img
                    src={`data:${v.image.mimeType};base64,${v.image.base64}`}
                    alt={v.label}
                    className="create-image"
                  />
                ) : (
                  <div className="create-image-failed">Image failed</div>
                )}
                <div className="create-image-label">{v.label}</div>
                <div className="create-image-rationale">{v.rationale}</div>
              </button>
            ))}
          </div>

          <JoestarRefine
            kind="image"
            value={imageFeedback}
            onChange={setImageFeedback}
            onSubmit={regenerateImage}
            busy={refiningImage}
            hint={
              pickedImageIdx !== null
                ? "Refining the image you picked."
                : "Refining the first image. Pick one to target a specific variant."
            }
            placeholder="e.g. warmer lighting, more empty space on the left, less product focus, softer mood…"
            disabled={targetImageIdx() === null}
          />
        </section>
      )}

      {caption && (
        <section className="create-section">
          <div className="create-section-row">
            <h3 className="create-section-title">Caption</h3>
            <div className="create-section-actions">
              <button
                type="button"
                className="btn-ghost-sm"
                onClick={() => copy(caption.caption, "Caption")}
              >
                <Copy size={12} /> Copy
              </button>
              <button type="button" className="btn-ghost-sm" onClick={saveCaption}>
                <Save size={12} /> Save
              </button>
            </div>
          </div>
          <div className="create-caption-card">
            <div className="create-caption-text">{caption.caption}</div>
            {caption.reasoning && (
              <div className="create-caption-reasoning">{caption.reasoning}</div>
            )}
            {caption.fit_score && (
              <div className="create-caption-fit">
                <strong>{caption.fit_score.value}/100</strong>
                <span> · Claude&apos;s self-assessed fit · </span>
                <span className="muted">{caption.fit_score.reasoning}</span>
              </div>
            )}
          </div>

          <OutputRefinementBar
            busy={refiningCaption}
            onQuick={(prompt) => regenerateCaption(prompt)}
          />

          <JoestarRefine
            kind="caption"
            value={captionFeedback}
            onChange={setCaptionFeedback}
            onSubmit={regenerateCaption}
            busy={refiningCaption}
            placeholder="e.g. shorter, lead with the price, less salesy, more playful, end with a question…"
          />
        </section>
      )}

      {campaign && Array.isArray(campaign.options) && (
        <section className="create-section">
          <h3 className="create-section-title">Campaign strategies</h3>
          <div className="create-campaign-grid">
            {campaign.options.map((o) => (
              <div key={o.id} className="create-campaign-card">
                <div className="create-campaign-tag">{o.id}</div>
                <h4>{o.big_idea}</h4>
                {Array.isArray(o.arc) && (
                  <ul className="create-campaign-arc">
                    {o.arc.map((p, i) => (
                      <li key={i}>
                        <strong>{p.name}</strong>: {p.description}
                      </li>
                    ))}
                  </ul>
                )}
                {o.risk && (
                  <div className="create-campaign-risk">Risk: {o.risk}</div>
                )}
                <button
                  type="button"
                  className="btn-ghost-sm"
                  onClick={() => saveCampaign(o)}
                >
                  <Save size={12} /> Save this strategy
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------- Output refinement bar (post-generation quick fixes) ----------

const QUICK_REFINEMENTS: { label: string; prompt: string }[] = [
  { label: "Make shorter", prompt: "Make this caption noticeably shorter and tighter — about half the length, no fluff." },
  { label: "More premium", prompt: "Rewrite in a more premium, refined voice. Less salesy, more elevated." },
  { label: "Adapt for TikTok", prompt: "Rewrite for TikTok — punchy hook, conversational, short lines, no hashtags up top." },
  { label: "Add hooks", prompt: "Open with a stronger first-line hook. Curiosity, contrast, or specificity." },
];

function OutputRefinementBar({
  busy,
  onQuick,
}: {
  busy: boolean;
  onQuick: (prompt: string) => void;
}) {
  return (
    <div className="output-refine-bar">
      <span className="output-refine-bar-label">Quick refine:</span>
      {QUICK_REFINEMENTS.map((q) => (
        <button
          type="button"
          key={q.label}
          className="output-refine-chip"
          onClick={() => onQuick(q.prompt)}
          disabled={busy}
        >
          {q.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Joestar refine block ----------

function JoestarRefine(props: {
  kind: "caption" | "image";
  value: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
  busy: boolean;
  placeholder: string;
  hint?: string;
  disabled?: boolean;
}): ReactNode {
  const { kind, value, onChange, onSubmit, busy, placeholder, hint, disabled } = props;
  const headline =
    kind === "image"
      ? "Joestar — what should I change in the photo?"
      : "Joestar — what should I change in the caption?";

  return (
    <div className={`joestar-refine ${busy ? "is-busy" : ""}`}>
      <div className="joestar-refine-head">
        <div className="joestar-refine-avatar" aria-hidden>
          <Sparkles size={16} />
        </div>
        <div className="joestar-refine-headline">
          <strong>{headline}</strong>
          {hint && <span className="joestar-refine-hint">{hint}</span>}
        </div>
      </div>
      <textarea
        className="joestar-refine-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        maxLength={1000}
        disabled={busy || disabled}
      />
      <div className="joestar-refine-footer">
        <span className="joestar-refine-charcount">{value.length}/1000</span>
        <button
          type="button"
          className="btn-primary joestar-refine-submit"
          onClick={onSubmit}
          disabled={busy || disabled || !value.trim()}
        >
          <Wand2 size={14} className={busy ? "spin" : ""} />
          {busy ? (kind === "image" ? "Repainting…" : "Rewriting…") : "Regenerate"}
        </button>
      </div>
    </div>
  );
}

// ---------- Critique view ----------

type CritiqueData = NonNullable<CreateResult["critique"]>;

function CritiqueView({ critique }: { critique: CritiqueData }) {
  const c = critique;
  return (
    <div className="create-output">
      <div className="create-output-header">
        <h2>
          Here&apos;s what <span className="italic">I think</span>.
        </h2>
        <p className="muted">Honest critique of the content you pasted.</p>
      </div>

      <section className="create-section">
        <div className="critique-overall">{c.overall}</div>
        {c.fit_score && (
          <div className="critique-fit-score">
            <span className="critique-fit-value">{c.fit_score.value}/100</span>
            <span className="critique-fit-label">Claude&apos;s fit score</span>
            <p className="critique-fit-reasoning">{c.fit_score.reasoning}</p>
          </div>
        )}
      </section>

      {c.strengths?.length > 0 && (
        <section className="create-section">
          <h3 className="create-section-title">What&apos;s working</h3>
          <ul className="critique-list critique-strengths">
            {c.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      {c.weaknesses?.length > 0 && (
        <section className="create-section">
          <h3 className="create-section-title">What&apos;s weak</h3>
          <ul className="critique-list critique-weaknesses">
            {c.weaknesses.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      {c.suggestions?.length > 0 && (
        <section className="create-section">
          <h3 className="create-section-title">Try this</h3>
          <ul className="critique-list critique-suggestions">
            {c.suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      {c.structural_check && (
        <section className="create-section">
          <h3 className="create-section-title">Structural check</h3>
          <div className="critique-checks">
            <CheckRow
              label="Hook"
              pass={c.structural_check.hook_strong}
              note={c.structural_check.hook_note}
            />
            <CheckRow
              label="Specificity"
              pass={c.structural_check.specificity_present}
              note={c.structural_check.specificity_note}
            />
            <CheckRow
              label="CTA"
              pass={c.structural_check.cta_clear}
              note={c.structural_check.cta_note}
            />
            <CheckRow
              label="Voice match"
              pass={c.structural_check.voice_match}
              note={c.structural_check.voice_note}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function CheckRow({
  label,
  pass,
  note,
}: {
  label: string;
  pass: boolean;
  note: string;
}) {
  return (
    <div className={`critique-check-row ${pass ? "pass" : "fail"}`}>
      <span className="critique-check-icon">{pass ? "?" : "?"}</span>
      <div>
        <div className="critique-check-label">{label}</div>
        <div className="critique-check-note">{note}</div>
      </div>
    </div>
  );
}
