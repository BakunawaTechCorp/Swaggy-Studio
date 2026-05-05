"use client";

import { useState } from "react";
import { useToast } from "@/components/toast";
import { DEFAULT_MODEL, DEFAULT_IMAGE_MODEL } from "@/lib/credits/costs";

type View =
  | "prompt"
  | "generating"
  | "strategies"
  | "picked"
  | "ad-image-loading"
  | "ad-image-pick"
  | "ad-caption-loading"
  | "ad-done";
type Goal = "awareness" | "engagement" | "conversion";
type Tone = "professional" | "playful" | "bold" | "premium" | "friendly";
type Channel = "facebook" | "instagram" | "tiktok" | "all";
type Budget = "test" | "standard" | "push";

const GOALS: { id: Goal; label: string }[] = [
  { id: "awareness", label: "Awareness" },
  { id: "engagement", label: "Engagement" },
  { id: "conversion", label: "Conversion" },
];
const TONES: { id: Tone; label: string }[] = [
  { id: "professional", label: "Professional" },
  { id: "playful", label: "Playful" },
  { id: "bold", label: "Bold" },
  { id: "premium", label: "Premium" },
  { id: "friendly", label: "Friendly" },
];
const CHANNELS: { id: Channel; label: string }[] = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "all", label: "All channels" },
];
const BUDGETS: { id: Budget; label: string; sub: string }[] = [
  { id: "test", label: "Quiet test", sub: "Validate cheaply" },
  { id: "standard", label: "Standard", sub: "Balanced spend" },
  { id: "push", label: "Bold push", sub: "Heavy promotion" },
];

type Strategy = {
  id: string;
  flavor: "Safe" | "Engagement" | "Bold";
  title: string;
  hook: string;
  body: string;
  cta: string;
  score: number;
  reasoning: string;
  arc: { name: string; description: string }[];
  channels: { platform: string; why: string }[];
  budgetTier: "low" | "medium" | "high";
};

type ApiOption = {
  id: "safe" | "engagement" | "bold";
  big_idea: string;
  arc: { name: string; description: string }[];
  channels: { platform: string; why: string }[];
  budget_tier: "low" | "medium" | "high";
  confidence: { factors: Record<string, number> };
  risk: string;
};

function confidenceScore(c: ApiOption["confidence"]): number {
  const factors = Object.values(c.factors ?? {}).filter(
    (n): n is number => typeof n === "number",
  );
  if (factors.length === 0) return 70;
  const avg = factors.reduce((a, b) => a + b, 0) / factors.length;
  return Math.round((avg / 5) * 100);
}

function adaptOption(o: ApiOption): Strategy {
  const flavor: Strategy["flavor"] =
    o.id === "safe" ? "Safe" : o.id === "engagement" ? "Engagement" : "Bold";
  const firstChannel = o.channels[0]?.platform ?? "social";
  return {
    id: o.id,
    flavor,
    title: o.big_idea.split(/[.?!]/)[0].slice(0, 80) || o.big_idea.slice(0, 80),
    hook: o.big_idea,
    body: o.arc.map((p) => `${p.name}: ${p.description}`).join(" → "),
    cta: `Run on ${firstChannel}`,
    score: confidenceScore(o.confidence),
    reasoning: o.risk,
    arc: o.arc,
    channels: o.channels,
    budgetTier: o.budget_tier,
  };
}

function errorMessage(code?: string): string {
  switch (code) {
    case "insufficient_credits":
      return "Out of credits — top up to keep generating.";
    case "ai_unavailable":
      return "Couldn't reach the AI right now. Try again.";
    case "service_unavailable":
      return "Service temporarily unavailable. Try again.";
    case "unauthorized":
      return "Please sign in again.";
    case "missing_field":
      return "Add a campaign brief and try again.";
    case "malformed_response":
      return "AI returned an unexpected response. Try regenerating.";
    default:
      return "Generation failed. Try again.";
  }
}

export function CampaignTool() {
  const { show } = useToast();
  const [view, setView] = useState<View>("prompt");
  const [prompt, setPrompt] = useState("");
  const [goal, setGoal] = useState<Goal>("conversion");
  const [tone, setTone] = useState<Tone>("bold");
  const [channel, setChannel] = useState<Channel>("instagram");
  const [budget, setBudget] = useState<Budget>("standard");
  const [audience, setAudience] = useState("");
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [picked, setPicked] = useState<Strategy | null>(null);

  type AdImageVariant = {
    id: string;
    label: string;
    rationale: string;
    score: number;
    image: { base64: string; mimeType: string } | null;
    error: string | null;
  };
  const [adImages, setAdImages] = useState<AdImageVariant[]>([]);
  const [adPickedImage, setAdPickedImage] = useState<AdImageVariant | null>(null);
  const [adImageUrl, setAdImageUrl] = useState<string | null>(null);
  const [adCaption, setAdCaption] = useState<string | null>(null);
  const [savingAd, setSavingAd] = useState(false);

  function inferStyleMood(t: Tone, b: Budget): { style: string; mood: string } {
    const style =
      t === "premium" ? "luxury" : t === "playful" ? "playful" : t === "professional" ? "minimalist" : "modern";
    const mood = b === "push" ? "bold" : b === "test" ? "cool" : t === "premium" ? "warm" : "bold";
    return { style, mood };
  }

  function pickStrategy(s: Strategy) {
    setPicked(s);
    setView("picked");
    void fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "campaign",
        title: s.hook?.slice(0, 80) || s.title || "Campaign strategy",
        payload: {
          id: s.id,
          big_idea: s.hook,
          arc: s.arc,
          channels: s.channels,
          budget_tier: s.budgetTier,
          risk: s.reasoning,
          score: s.score,
          brief: prompt,
        },
        metadata: { goal, channel, tone, budget, audience },
      }),
    })
      .then((r) => {
        if (r.ok) show("Strategy saved to Library.", "success");
      })
      .catch(() => undefined);
  }

  async function makeTheAd() {
    if (!picked) return;
    setView("ad-image-loading");
    const { style, mood } = inferStyleMood(tone, budget);
    const description = `Ad creative for: ${picked.hook} The visual should evoke ${picked.flavor.toLowerCase()} energy and support the campaign arc (${picked.arc.map((a) => a.name).join(" → ")}). Visual style: ${style}. Mood: ${mood}.${audience ? ` Audience: ${audience}.` : ""}`;
    try {
      const res = await fetch("/api/tools/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: DEFAULT_IMAGE_MODEL,
          variant_count: 2,
          description,
          audience,
          aspect_ratio: channel === "tiktok" ? "9:16" : "1:1",
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
        setView("picked");
        return;
      }
      type ApiVariant = {
        id: string;
        label: string;
        rationale: string;
        confidence: { factors: Record<string, number> };
        image: { base64: string; mimeType: string } | null;
        error: string | null;
      };
      const data = (await res.json()) as { variants?: ApiVariant[] };
      if (!Array.isArray(data.variants) || data.variants.length === 0) {
        show("AI returned no images. Try again.", "error");
        setView("picked");
        return;
      }
      const local: AdImageVariant[] = data.variants.map((v) => {
        const factors = Object.values(v.confidence?.factors ?? {}).filter(
          (n): n is number => typeof n === "number",
        );
        const score = factors.length === 0
          ? 70
          : Math.round((factors.reduce((a, b) => a + b, 0) / factors.length / 5) * 100);
        return {
          id: v.id,
          label: v.label,
          rationale: v.rationale,
          image: v.image,
          error: v.error,
          score,
        };
      });
      setAdImages(local);
      setView("ad-image-pick");
    } catch {
      show("Network error generating ad image.", "error");
      setView("picked");
    }
  }

  async function pickAdImage(v: AdImageVariant) {
    if (!v.image || !picked) return;
    setAdPickedImage(v);
    setSavingAd(true);
    try {
      const saveRes = await fetch("/api/tools/image/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64: v.image.base64,
          mimeType: v.image.mimeType,
        }),
      });
      if (!saveRes.ok) {
        show("Couldn't save image. Check storage bucket.", "error");
        setSavingAd(false);
        return;
      }
      const { url } = (await saveRes.json()) as { url: string };
      setAdImageUrl(url);
      setSavingAd(false);

      void fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "image",
          title: v.label || picked.title.slice(0, 80) || "Ad creative",
          payload: {
            image_url: url,
            rationale: v.rationale,
            aspect_ratio: channel === "tiktok" ? "9:16" : "1:1",
          },
          thumbnail_url: url,
          metadata: {
            from: "campaign",
            strategy: picked.id,
            goal,
            channel,
            tone,
          },
        }),
      }).catch(() => undefined);

      setView("ad-caption-loading");

      const captionRes = await fetch("/api/tools/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Ad caption for this campaign strategy: "${picked.hook}". The campaign is "${picked.title}". Make it punchy, on-brand for a ${tone} tone, and end with a CTA appropriate for ${channel === "all" ? "social" : channel}.`,
          language: "english",
          model: DEFAULT_MODEL,
          variant_count: 1,
          platform: channel === "all" ? "instagram" : channel,
          post_type: "feed",
          goal,
          tone,
          audience: audience || undefined,
          photo_url: url,
        }),
      });
      if (!captionRes.ok) {
        const err = (await captionRes.json().catch(() => ({}))) as { error?: string };
        show(errorMessage(err.error), "error");
        setView("ad-image-pick");
        return;
      }
      const capData = (await captionRes.json()) as {
        variants?: { caption?: string }[];
      };
      const cap = capData.variants?.[0]?.caption?.trim();
      if (!cap) {
        show("AI returned no caption. Try regenerating.", "error");
        setView("ad-image-pick");
        return;
      }
      setAdCaption(cap);

      void fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "caption",
          title: cap.slice(0, 80),
          payload: {
            caption: cap,
            tone,
            platform: channel === "all" ? "instagram" : channel,
          },
          thumbnail_url: url,
          metadata: {
            from: "campaign",
            strategy: picked.id,
            goal,
            channel,
          },
        }),
      }).catch(() => undefined);

      setView("ad-done");
    } catch {
      show("Network error.", "error");
      setSavingAd(false);
      setView("ad-image-pick");
    }
  }

  async function generate() {
    if (!prompt.trim()) {
      show("Describe the campaign first.", "error");
      return;
    }
    setView("generating");
    try {
      const res = await fetch("/api/tools/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          brief: prompt,
          audience,
          channel: channel === "all" ? "instagram" : channel,
          goal,
          tone,
          budget,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        show(errorMessage(err.error), "error");
        setView("prompt");
        return;
      }
      const data = (await res.json()) as { options?: ApiOption[] };
      if (!Array.isArray(data.options) || data.options.length < 1) {
        show(errorMessage("malformed_response"), "error");
        setView("prompt");
        return;
      }
      setStrategies(data.options.map(adaptOption));
      setView("strategies");
    } catch {
      show("Network error. Try again.", "error");
      setView("prompt");
    }
  }

  if (view === "prompt") {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <section className="form-card">
          <header className="form-card-head">
            <h2 className="form-card-title">What&rsquo;s the campaign?</h2>
            <p className="form-card-sub">The brief, the audience, and where it runs.</p>
          </header>
          <div className="ifield">
            <div className="ifield-label"><span>Brief</span><span className="ifield-required">required</span></div>
            <textarea
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="e.g. Launch our spring drop to returning customers, emphasize limited stock and free shipping over $50."
              className="form-textarea"
            />
            <div className="form-counter">{prompt.length}/600</div>
          </div>
          <div className="ifield">
            <div className="ifield-label"><span>Audience</span><span className="ifield-optional">optional</span></div>
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. women 25–34 who bought last spring"
              className="form-textarea"
              style={{ height: 44, padding: "10px 14px" }}
            />
          </div>
          <div className="ifield">
            <div className="ifield-label"><span>Channel</span><span className="ifield-required">required</span></div>
            <div className="pill-row">
              {CHANNELS.map((c) => (
                <button key={c.id} type="button" onClick={() => setChannel(c.id)}
                  className={`pill ${channel === c.id ? "pill-active" : ""}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="form-card">
          <header className="form-card-head">
            <h2 className="form-card-title">Strategy direction</h2>
            <p className="form-card-sub">Goal, tone, and how aggressive the spend feels.</p>
          </header>
          <div className="ifield">
            <div className="ifield-label"><span>Goal</span><span className="ifield-required">required</span></div>
            <div className="pill-row">
              {GOALS.map((g) => (
                <button key={g.id} type="button" onClick={() => setGoal(g.id)}
                  className={`pill ${goal === g.id ? "pill-active" : ""}`}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <div className="ifield">
            <div className="ifield-label"><span>Tone</span><span className="ifield-required">required</span></div>
            <div className="pill-row">
              {TONES.map((t) => (
                <button key={t.id} type="button" onClick={() => setTone(t.id)}
                  className={`pill ${tone === t.id ? "pill-active" : ""}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="ifield">
            <div className="ifield-label"><span>Budget feel</span><span className="ifield-required">required</span></div>
            <div className="pill-row">
              {BUDGETS.map((b) => (
                <button key={b.id} type="button" onClick={() => setBudget(b.id)}
                  className={`pill ${budget === b.id ? "pill-active" : ""}`}
                  title={b.sub}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="cta-footer">
          <button type="button" className="cta-button" onClick={generate} disabled={!prompt.trim()}>
            <span className="cta-button-main">✨ Generate 3 ad strategies</span>
            <span className="cta-button-sub">5 credits · {channel === "all" ? "all channels" : channel} · {budget} budget</span>
          </button>
        </div>
      </div>
    );
  }

  if (view === "generating") {
    return (
      <div className="generating-screen">
        <div className="generating-orb"><span className="generating-orb-spark">✦</span></div>
        <h2 className="generating-title">Drafting strategies</h2>
        <p className="generating-stage">Safe / Engagement / Bold — for {goal} on {channel === "all" ? "all channels" : channel}…</p>
        <p className="generating-brief">&ldquo;{prompt.slice(0, 100)}{prompt.length > 100 ? "…" : ""}&rdquo;</p>
        <ul className="generating-skeletons" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <li key={i} className="generating-skeleton" style={{ height: 220, animationDelay: `${i * 0.18}s` }} />
          ))}
        </ul>
      </div>
    );
  }

  if (view === "strategies") {
    const sorted = [...strategies].sort((a, b) => b.score - a.score);
    const best = sorted[0];
    return (
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <button type="button" onClick={() => setView("prompt")} className="text-sm text-white/50 hover:text-white">← Edit brief</button>
          <button type="button" onClick={generate} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70">↻ Regenerate</button>
        </div>
        <h2 className="font-serif text-2xl">Pick a strategy.</h2>
        <p className="mt-1 text-sm text-white/60">
          Best match for <strong className="text-white/85">{GOALS.find((g) => g.id === goal)?.label}</strong> on {channel === "all" ? "all channels" : channel}. Scores are Claude&rsquo;s self-assessed fit, not performance predictions.
        </p>

        {best && (
          <div className="joestar-pick" style={{ marginTop: 18 }}>
            <div className="joestar-pick-head">
              <span className="joestar-pick-icon">✦</span>
              <div>
                <div className="joestar-pick-title">Joestar&rsquo;s pick: {best.flavor}</div>
                <div className="joestar-pick-reason">{best.reasoning}</div>
              </div>
              <button type="button" className="joestar-pick-cta" onClick={() => pickStrategy(best)}>Use this →</button>
            </div>
          </div>
        )}

        <div className="strategy-grid" style={{ marginTop: 16 }}>
          {sorted.map((s) => {
            const isBest = s.id === best?.id;
            const tone = s.score >= 85 ? "score-high" : s.score >= 65 ? "score-mid" : "score-low";
            return (
              <button key={s.id} type="button" className="strategy-card"
                style={{ outline: isBest ? "2px solid #a48cff" : "none", outlineOffset: 2, position: "relative" }}
                onClick={() => pickStrategy(s)}>
                <span
                  className={`score-badge ${tone}`}
                  style={{ position: "absolute", right: 12, top: 12 }}
                  title="Claude's self-assessed fit for your goal — not a real-world performance prediction"
                >
                  {s.score}/100 match
                </span>
                <span className={`strategy-flavor strategy-flavor-${s.flavor.toLowerCase()}`}>{s.flavor}</span>
                <h3 className="strategy-title">{s.title}</h3>
                <p className="strategy-hook">{s.hook}</p>
                <p className="strategy-body">{s.body}</p>
                <span className="strategy-cta">CTA: {s.cta}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (view === "picked" && picked) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="strategy-card strategy-card-active">
          <span className={`strategy-flavor strategy-flavor-${picked.flavor.toLowerCase()}`}>{picked.flavor}</span>
          <h3 className="strategy-title">{picked.title}</h3>
          <p className="strategy-hook">{picked.hook}</p>
          <p className="strategy-body">{picked.body}</p>
          <span className="strategy-cta">CTA: {picked.cta}</span>
        </div>
        <div className="cta-footer" style={{ marginTop: 18 }}>
          <button type="button" className="cta-button" onClick={makeTheAd}>
            <span className="cta-button-main">✨ Make the ad creative</span>
            <span className="cta-button-sub">
              Generates 2 image variants + a caption from this strategy · 5 credits
            </span>
          </button>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center" }}>
          <button type="button" className="btn-ghost" onClick={() => setView("strategies")}>
            ← Pick a different angle
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() =>
              show("Strategy saved. Make the ad above when you're ready.", "success")
            }
          >
            Save strategy only
          </button>
        </div>
      </div>
    );
  }

  if (view === "ad-image-loading" && picked) {
    return (
      <div className="generating-screen">
        <div className="generating-orb">
          <span className="generating-orb-spark">✦</span>
        </div>
        <h2 className="generating-title">Building your ad creative</h2>
        <p className="generating-stage">
          Composing 2 visuals for the {picked.flavor} angle…
        </p>
        <p className="generating-brief">&ldquo;{picked.hook.slice(0, 120)}&rdquo;</p>
        <ul
          className="generating-skeletons"
          style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}
        >
          {[0, 1].map((i) => (
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

  if (view === "ad-image-pick" && picked) {
    const sorted = [...adImages].sort((a, b) => b.score - a.score);
    return (
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <button
          type="button"
          onClick={() => setView("picked")}
          className="text-sm text-white/50 hover:text-white"
          style={{ marginBottom: 12 }}
        >
          ← Back to strategy
        </button>
        <h2 className="font-serif text-2xl">Pick the visual.</h2>
        <p className="mt-1 text-sm text-white/60">
          Built for the <strong className="text-white/85">{picked.flavor}</strong> angle. Pick one
          and I&rsquo;ll write a matching caption.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 12,
            marginTop: 16,
          }}
        >
          {sorted.map((v) => {
            const tone =
              v.score >= 85 ? "score-high" : v.score >= 65 ? "score-mid" : "score-low";
            if (!v.image) {
              return (
                <div key={v.id} className="image-result-card">
                  <div className="image-result-failed">
                    Generation failed ({v.error ?? "unknown"}). Credits refunded.
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
                onClick={() => pickAdImage(v)}
                disabled={savingAd}
                className="image-result-card"
              >
                <img
                  src={`data:${v.image.mimeType};base64,${v.image.base64}`}
                  alt={v.label}
                />
                <span
                  className={`score-badge ${tone}`}
                  style={{ position: "absolute", right: 10, top: 10 }}
                  title="Claude's self-assessed fit for your goal"
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

  if (view === "ad-caption-loading") {
    return (
      <div className="generating-screen">
        <div className="generating-orb">
          <span className="generating-orb-spark">✦</span>
        </div>
        <h2 className="generating-title">Writing the caption</h2>
        <p className="generating-stage">
          Matching the visual to the {picked?.flavor.toLowerCase()} angle…
        </p>
      </div>
    );
  }

  if (view === "ad-done" && picked && adImageUrl && adCaption) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <h2 className="font-serif text-2xl" style={{ textAlign: "center" }}>
          Your ad is ready.
        </h2>
        <p
          className="mt-1 text-sm text-white/60"
          style={{ textAlign: "center" }}
        >
          {picked.flavor} angle · {channel === "all" ? "all channels" : channel}
        </p>
        <div className="image-pair-final" style={{ marginTop: 18 }}>
          <img src={adImageUrl} alt={adPickedImage?.label ?? "Ad creative"} />
        </div>
        <div className="form-card" style={{ marginTop: 16 }}>
          <div className="ifield-label"><span>Caption</span></div>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "rgba(245,243,255,0.92)",
              whiteSpace: "pre-wrap",
            }}
          >
            {adCaption}
          </p>
        </div>
        <div className="form-card" style={{ marginTop: 12 }}>
          <div className="ifield-label"><span>Strategy</span></div>
          <p style={{ fontSize: 12, color: "rgba(245,243,255,0.65)" }}>
            <strong className="text-white/85">{picked.title}</strong> — {picked.hook}
          </p>
        </div>
        <div
          style={{
            marginTop: 18,
            display: "flex",
            gap: 8,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setAdCaption(null);
              setAdImageUrl(null);
              setAdPickedImage(null);
              setAdImages([]);
              setView("strategies");
            }}
          >
            ← Different angle
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              navigator.clipboard?.writeText(adImageUrl);
              show("Image URL copied.", "success");
            }}
          >
            Copy image URL
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              navigator.clipboard?.writeText(adCaption);
              show("Caption copied.", "success");
            }}
          >
            Copy caption
          </button>
        </div>
      </div>
    );
  }

  return null;
}
