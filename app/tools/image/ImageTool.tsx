"use client";

import { useState, type FormEvent } from "react";
import { useToast } from "@/components/toast";
import { ModelPicker } from "@/components/ai/ModelPicker";
import {
  VariantCountPicker,
  type VariantCount,
} from "@/components/ai/VariantCountPicker";
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_MODEL,
  getImageCost,
  type ActiveModelId,
} from "@/lib/credits/costs";

type View = "prompt" | "generating" | "variants" | "captioning" | "done";
type Goal = "awareness" | "engagement" | "conversion";
type Style = "modern" | "playful" | "luxury" | "minimalist";
type Mood = "warm" | "bold" | "cool" | "dreamy";

const GOALS: { id: Goal; label: string }[] = [
  { id: "engagement", label: "Engagement" },
  { id: "awareness", label: "Awareness" },
  { id: "conversion", label: "Conversion" },
];
const STYLES: { id: Style; label: string }[] = [
  { id: "modern", label: "Modern" },
  { id: "playful", label: "Playful" },
  { id: "luxury", label: "Luxury" },
  { id: "minimalist", label: "Minimalist" },
];
const MOODS: { id: Mood; label: string }[] = [
  { id: "warm", label: "Warm" },
  { id: "bold", label: "Bold" },
  { id: "cool", label: "Cool" },
  { id: "dreamy", label: "Dreamy" },
];
const ASPECTS = [
  { id: "1:1", label: "Square (1:1)" },
  { id: "4:5", label: "Portrait (4:5)" },
  { id: "9:16", label: "Story (9:16)" },
  { id: "16:9", label: "Landscape (16:9)" },
] as const;

type ApiImage = { base64: string; mimeType: string };
type ApiVariant = {
  id: string;
  label: string;
  rationale: string;
  aspect_ratio: string;
  confidence: { factors: Record<string, number> };
  image: ApiImage | null;
  error: string | null;
};

type LocalVariant = ApiVariant & { score: number };

function confidenceScore(c: ApiVariant["confidence"]): number {
  const factors = Object.values(c?.factors ?? {}).filter(
    (n): n is number => typeof n === "number",
  );
  if (factors.length === 0) return 70;
  const avg = factors.reduce((a, b) => a + b, 0) / factors.length;
  return Math.round((avg / 5) * 100);
}

function errorMessage(code?: string): string {
  switch (code) {
    case "insufficient_credits":
      return "Out of credits — top up to keep generating.";
    case "ai_unavailable":
    case "image_generation_failed":
      return "Couldn't generate images right now. Try again.";
    case "service_unavailable":
      return "Service temporarily unavailable. Try again.";
    case "unauthorized":
      return "Please sign in again.";
    case "missing_field":
      return "Add a description and try again.";
    case "malformed_prompts":
      return "AI returned an unexpected response. Try regenerating.";
    case "server_misconfigured":
      return "Server is missing API keys. Check .env.local.";
    default:
      return "Generation failed. Try again.";
  }
}

export function ImageTool() {
  const { show } = useToast();
  const [view, setView] = useState<View>("prompt");
  const [prompt, setPrompt] = useState("");
  const [goal, setGoal] = useState<Goal>("engagement");
  const [style, setStyle] = useState<Style>("modern");
  const [mood, setMood] = useState<Mood>("bold");
  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]["id"]>("1:1");
  const [audience, setAudience] = useState("");
  const [needCaption, setNeedCaption] = useState(true);
  const [model, setModel] = useState<ActiveModelId>(DEFAULT_IMAGE_MODEL);
  const [variantCount, setVariantCount] = useState<VariantCount>(2);

  const [variants, setVariants] = useState<LocalVariant[]>([]);
  const [picked, setPicked] = useState<LocalVariant | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [captionBrief, setCaptionBrief] = useState("");
  const [captionTone, setCaptionTone] = useState("friendly");
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [finalCaption, setFinalCaption] = useState<string | null>(null);

  const totalCost = getImageCost(model, variantCount);

  async function generate() {
    if (!prompt.trim()) {
      show("Describe the image first.", "error");
      return;
    }
    setView("generating");
    try {
      const res = await fetch("/api/tools/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          variant_count: variantCount,
          description: `${prompt}. Visual style: ${style}. Mood: ${mood}.${audience ? ` Audience: ${audience}.` : ""}`,
          audience,
          aspect_ratio: aspect,
          goal,
          tone: `${style} ${mood}`,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string;
          reason?: string;
        };
        show(err.reason ?? errorMessage(err.error), "error");
        setView("prompt");
        return;
      }
      const data = (await res.json()) as {
        variants?: ApiVariant[];
        failed_count?: number;
      };
      if (!Array.isArray(data.variants) || data.variants.length === 0) {
        show(errorMessage("malformed_prompts"), "error");
        setView("prompt");
        return;
      }
      const local: LocalVariant[] = data.variants.map((v) => ({
        ...v,
        score: confidenceScore(v.confidence),
      }));
      setVariants(local);
      if (data.failed_count && data.failed_count > 0) {
        show(
          `${data.failed_count} variant${data.failed_count === 1 ? "" : "s"} failed — refunded.`,
          "info",
        );
      }
      setView("variants");
    } catch {
      show("Network error. Try again.", "error");
      setView("prompt");
    }
  }

  async function pickVariant(v: LocalVariant) {
    if (!v.image) return;
    setPicked(v);
    setSaving(true);
    try {
      const res = await fetch("/api/tools/image/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64: v.image.base64,
          mimeType: v.image.mimeType,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string;
          reason?: string;
        };
        show(
          err.reason ??
            (err.error === "upload_failed"
              ? "Couldn't save image. Check the storage bucket exists."
              : errorMessage(err.error)),
          "error",
        );
        setSaving(false);
        return;
      }
      const { url } = (await res.json()) as { url: string };
      setSavedUrl(url);
      setSaving(false);

      void fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "image",
          title: v.label || prompt.slice(0, 80) || "Generated image",
          payload: {
            image_url: url,
            rationale: v.rationale,
            aspect_ratio: v.aspect_ratio,
          },
          thumbnail_url: url,
          metadata: { model, audience, goal, style, mood },
        }),
      })
        .then((r) => {
          if (r.ok) show("Saved to Library.", "success");
        })
        .catch(() => undefined);

      if (needCaption) {
        setCaptionBrief(prompt);
        setView("captioning");
      } else {
        setView("done");
      }
    } catch {
      show("Network error saving image.", "error");
      setSaving(false);
    }
  }

  async function generateCaption(e: FormEvent) {
    e.preventDefault();
    if (!captionBrief.trim() || generatingCaption) return;
    setGeneratingCaption(true);
    try {
      const res = await fetch("/api/tools/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: captionBrief,
          language: "english",
          model: DEFAULT_MODEL,
          variant_count: 1,
          platform: "facebook",
          post_type: "feed",
          goal,
          tone: captionTone,
          audience: audience || undefined,
          photo_url: savedUrl ?? undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        show(errorMessage(err.error), "error");
        setGeneratingCaption(false);
        return;
      }
      const data = (await res.json()) as { variants?: { caption?: string }[] };
      const cap = data.variants?.[0]?.caption?.trim();
      if (!cap) {
        show("AI returned no caption. Try regenerating.", "error");
        setGeneratingCaption(false);
        return;
      }
      setFinalCaption(cap);
      setView("done");
    } catch {
      show("Network error.", "error");
    } finally {
      setGeneratingCaption(false);
    }
  }

  function reset() {
    setView("prompt");
    setPicked(null);
    setVariants([]);
    setFinalCaption(null);
    setCaptionBrief("");
    setSavedUrl(null);
  }

  if (view === "prompt") {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <section className="form-card">
          <header className="form-card-head">
            <h2 className="form-card-title">What image do you want?</h2>
            <p className="form-card-sub">Describe it. Pick the goal, style, and mood.</p>
          </header>
          <div className="ifield">
            <div className="ifield-label">
              <span>Description</span>
              <span className="ifield-required">required</span>
            </div>
            <textarea
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="e.g. Flat-lay of pastel thrift sweaters on a cream background, soft window light."
              className="form-textarea"
            />
            <div className="form-counter">{prompt.length}/500</div>
          </div>
          <div className="ifield">
            <div className="ifield-label">
              <span>Audience</span>
              <span className="ifield-optional">optional</span>
            </div>
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. college students on a budget"
              className="form-textarea"
              style={{ height: 44, padding: "10px 14px" }}
            />
          </div>
          <div className="ifield">
            <div className="ifield-label">
              <span>Aspect ratio</span>
              <span className="ifield-required">required</span>
            </div>
            <div className="pill-row">
              {ASPECTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAspect(a.id)}
                  className={`pill ${aspect === a.id ? "pill-active" : ""}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="form-card">
          <header className="form-card-head">
            <h2 className="form-card-title">How should it feel?</h2>
            <p className="form-card-sub">Goal, visual style, and mood.</p>
          </header>
          <div className="ifield">
            <div className="ifield-label">
              <span>Goal</span>
              <span className="ifield-required">required</span>
            </div>
            <div className="pill-row">
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGoal(g.id)}
                  className={`pill ${goal === g.id ? "pill-active" : ""}`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <div className="ifield">
            <div className="ifield-label">
              <span>Style</span>
              <span className="ifield-required">required</span>
            </div>
            <div className="pill-row">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyle(s.id)}
                  className={`pill ${style === s.id ? "pill-active" : ""}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="ifield">
            <div className="ifield-label">
              <span>Mood</span>
              <span className="ifield-required">required</span>
            </div>
            <div className="pill-row">
              {MOODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMood(m.id)}
                  className={`pill ${mood === m.id ? "pill-active" : ""}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <label className="caption-toggle">
            <input
              type="checkbox"
              checked={needCaption}
              onChange={(e) => setNeedCaption(e.target.checked)}
            />
            <span>Also write a caption for the chosen image</span>
          </label>
        </section>

        <section className="form-card">
          <header className="form-card-head">
            <h2 className="form-card-title">AI Power</h2>
            <p className="form-card-sub">Pick the image model and how many variants.</p>
          </header>
          <ModelPicker tool="image" value={model} onChange={setModel} />
          <div className="ifield" style={{ marginTop: 14 }}>
            <div className="ifield-label">
              <span>Variants</span>
              <span className="ifield-optional">cost scales</span>
            </div>
            <VariantCountPicker
              value={variantCount}
              onChange={setVariantCount}
              max={4}
            />
          </div>
        </section>

        <div className="cta-footer">
          <button
            type="button"
            className="cta-button"
            onClick={generate}
            disabled={!prompt.trim()}
          >
            <span className="cta-button-main">
              ✨ Generate {variantCount} image{variantCount === 1 ? "" : "s"}
            </span>
            <span className="cta-button-sub">
              {totalCost} credit{totalCost === 1 ? "" : "s"}
              {needCaption && " + 1 for caption"}
            </span>
          </button>
        </div>
      </div>
    );
  }

  if (view === "generating") {
    const skeletonCount = variantCount;
    return (
      <div className="generating-screen">
        <div className="generating-orb">
          <span className="generating-orb-spark">✦</span>
        </div>
        <h2 className="generating-title">Composing your images</h2>
        <p className="generating-stage">
          {style} {mood} · {aspect} · {model === "imagen-4" ? "Imagen 4" : "Imagen 4 Fast"}
        </p>
        <p className="generating-brief">
          &ldquo;{prompt.slice(0, 120)}{prompt.length > 120 ? "…" : ""}&rdquo;
        </p>
        <ul
          className="generating-skeletons"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${skeletonCount > 2 ? 2 : skeletonCount}, 1fr)`,
            gap: 12,
          }}
        >
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <li
              key={i}
              className="generating-skeleton"
              style={{ aspectRatio: "1/1", animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </ul>
      </div>
    );
  }

  if (view === "variants") {
    const sorted = [...variants].sort((a, b) => b.score - a.score);
    const best = sorted.find((v) => v.image) ?? sorted[0];
    const cols = sorted.length === 1 ? 1 : 2;
    return (
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setView("prompt")}
            className="text-sm text-white/50 hover:text-white"
          >
            ← Edit brief
          </button>
          <button
            type="button"
            onClick={generate}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70"
          >
            ↻ Regenerate
          </button>
        </div>
        <h2 className="font-serif text-2xl">Pick an image.</h2>
        <p className="mt-1 text-sm text-white/60">
          Each is rated for{" "}
          <strong className="text-white/85">
            {GOALS.find((g) => g.id === goal)?.label}
          </strong>{" "}
          + {style} {mood}. Scores are Claude&rsquo;s self-assessed fit, not performance predictions.
        </p>

        {best?.image && (
          <div className="joestar-pick" style={{ marginTop: 18 }}>
            <div className="joestar-pick-head">
              <span className="joestar-pick-icon">✦</span>
              <div>
                <div className="joestar-pick-title">
                  Joestar&rsquo;s pick: {best.label}
                </div>
                <div className="joestar-pick-reason">
                  Strongest {goal} fit at {best.score}/100 match.
                </div>
              </div>
              <button
                type="button"
                className="joestar-pick-cta"
                onClick={() => pickVariant(best)}
                disabled={saving}
              >
                {saving ? "Saving…" : "Use this →"}
              </button>
            </div>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 12,
            marginTop: 16,
          }}
        >
          {sorted.map((v) => {
            const isBest = v.id === best?.id;
            const tone =
              v.score >= 85 ? "score-high" : v.score >= 65 ? "score-mid" : "score-low";
            if (!v.image) {
              return (
                <div key={v.id} className="image-result-card">
                  <div className="image-result-failed">
                    Generation failed for this variant ({v.error ?? "unknown"}). Credits refunded.
                  </div>
                  <div className="image-result-meta">
                    <span className="image-result-label">{v.label}</span>
                  </div>
                </div>
              );
            }
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => pickVariant(v)}
                disabled={saving}
                className={`image-result-card ${isBest ? "is-best" : ""}`}
              >
                <img
                  src={`data:${v.image.mimeType};base64,${v.image.base64}`}
                  alt={v.label}
                />
                <span
                  className={`score-badge ${tone}`}
                  style={{ position: "absolute", right: 10, top: 10 }}
                  title="Claude's self-assessed fit for your goal — not a real-world performance prediction"
                >
                  {v.score}/100 match
                </span>
                <div className="image-result-meta">
                  <span className="image-result-label">{v.label}</span>
                  <span className="image-result-rationale">{v.rationale}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (view === "captioning" && picked && savedUrl) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <button
          type="button"
          onClick={() => setView("variants")}
          className="text-sm text-white/50 hover:text-white"
          style={{ marginBottom: 12 }}
        >
          ← Pick a different image
        </button>
        <div className="form-card">
          <header className="form-card-head">
            <h2 className="form-card-title">Now write a caption.</h2>
            <p className="form-card-sub">
              Edit or expand the brief — I&rsquo;ll write a caption that fits the image.
            </p>
          </header>
          <div className="image-pair">
            <div
              className="image-pair-thumb"
              style={{
                background: "rgba(255,255,255,0.04)",
                overflow: "hidden",
              }}
            >
              <img
                src={savedUrl}
                alt={picked.label}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
            <div>
              <div className="image-pair-label">{picked.label}</div>
              <div className="image-pair-sub">
                {picked.score}/100 match · {style} {mood}
              </div>
            </div>
          </div>
          <form onSubmit={generateCaption}>
            <div className="ifield">
              <div className="ifield-label">
                <span>Caption brief</span>
              </div>
              <textarea
                autoFocus
                value={captionBrief}
                onChange={(e) => setCaptionBrief(e.target.value)}
                rows={3}
                className="form-textarea"
                placeholder="What should the caption say?"
              />
            </div>
            <div className="ifield">
              <div className="ifield-label">
                <span>Tone</span>
              </div>
              <div className="pill-row">
                {["playful", "bold", "premium", "friendly"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setCaptionTone(t)}
                    className={`pill ${captionTone === t ? "pill-active" : ""}`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="cta-footer" style={{ marginTop: 16 }}>
              <button
                type="submit"
                className="cta-button"
                disabled={!captionBrief.trim() || generatingCaption}
              >
                <span className="cta-button-main">
                  {generatingCaption ? "Writing…" : "✨ Write caption"}
                </span>
                <span className="cta-button-sub">Uses 1 credit</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (view === "done" && picked && savedUrl) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <h2 className="font-serif text-2xl" style={{ textAlign: "center" }}>
          Ready to post.
        </h2>
        <div className="image-pair-final">
          <img src={savedUrl} alt={picked.label} />
        </div>
        {finalCaption && (
          <div className="form-card" style={{ marginTop: 16 }}>
            <div className="ifield-label">
              <span>Caption</span>
            </div>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: "rgba(245,243,255,0.92)",
                whiteSpace: "pre-wrap",
              }}
            >
              {finalCaption}
            </p>
          </div>
        )}
        <div
          style={{
            marginTop: 18,
            display: "flex",
            gap: 8,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button type="button" className="btn-ghost" onClick={reset}>
            ← Make another
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              navigator.clipboard?.writeText(savedUrl);
              show("Image URL copied.", "success");
            }}
          >
            Copy image URL
          </button>
          {finalCaption && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                navigator.clipboard?.writeText(finalCaption);
                show("Caption copied.", "success");
              }}
            >
              Copy caption
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
