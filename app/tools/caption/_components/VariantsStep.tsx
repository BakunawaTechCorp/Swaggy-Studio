import type { Variant } from "../_lib/types";

const GOAL_LABEL: Record<string, string> = {
  awareness: "awareness",
  engagement: "engagement",
  conversion: "conversion",
  follower_growth: "follower growth",
  loyalty: "loyalty",
};

function scoreClass(score?: number): string {
  if (score == null) return "";
  if (score >= 85) return "score-high";
  if (score >= 65) return "score-mid";
  return "score-low";
}

export function VariantsStep({
  variants,
  onPick,
  onBack,
  onRegenerate,
  bestPick,
  goal,
}: {
  variants: Variant[];
  onPick: (id: string) => void;
  onBack: () => void;
  onRegenerate: () => void;
  bestPick: { id: string; reason?: string } | null;
  goal?: string;
}) {
  const bestIndex =
    bestPick != null ? variants.findIndex((v) => v.id === bestPick.id) : -1;
  const goalLabel = goal ? GOAL_LABEL[goal] ?? goal : null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-white/50 transition hover:text-white"
        >
          ← Edit prompt
        </button>
        <button
          type="button"
          onClick={onRegenerate}
          className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/25 hover:text-white"
        >
          ↻ Regenerate
        </button>
      </div>

      <h2 className="mt-4 font-serif text-2xl">Pick a caption.</h2>
      <p className="mt-1 text-sm text-white/60">
        Sorted by Claude&rsquo;s confidence in fit for your{" "}
        {goalLabel ? <strong className="text-white/85">{goalLabel}</strong> : "goal"}.
        Scores are self-assessed, not performance predictions.
      </p>

      {bestPick && bestIndex >= 0 && (
        <div className="joestar-pick">
          <div className="joestar-pick-head">
            <span className="joestar-pick-icon">✦</span>
            <div>
              <div className="joestar-pick-title">
                Joestar&rsquo;s pick: Option {bestIndex + 1} — best match for {goalLabel ?? "your goal"}
              </div>
              {bestPick.reason && (
                <div className="joestar-pick-reason">{bestPick.reason}</div>
              )}
            </div>
            <button
              type="button"
              className="joestar-pick-cta"
              onClick={() => onPick(bestPick.id)}
            >
              Use this →
            </button>
          </div>
        </div>
      )}

      <ul className="mt-4 flex flex-col gap-3">
        {variants
          .map((v, i) => ({ v, originalIndex: i }))
          .sort((a, b) => {
            const aBest = a.v.id === bestPick?.id ? 1 : 0;
            const bBest = b.v.id === bestPick?.id ? 1 : 0;
            if (aBest !== bBest) return bBest - aBest;
            return (b.v.score ?? 0) - (a.v.score ?? 0);
          })
          .map(({ v, originalIndex }) => {
          const isBest = v.id === bestPick?.id;
          return (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => onPick(v.id)}
                className={`group block w-full rounded-2xl border p-4 text-left transition hover:bg-white/[0.05] hover:shadow-glow ${
                  isBest
                    ? "border-brand-purple/60 bg-brand-purple/[0.06]"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider">
                  <span className="rounded-full bg-black/40 px-2 py-0.5 text-white/60">
                    Option {originalIndex + 1}
                  </span>
                  {v.hook_type && (
                    <span className="rounded-full bg-brand-purple/20 px-2 py-0.5 text-brand-purple">
                      {v.hook_type}
                    </span>
                  )}
                  {v.tone && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-white/50">
                      {v.tone}
                    </span>
                  )}
                  {isBest && (
                    <span className="rounded-full bg-gradient-to-r from-brand-purple to-brand-pink px-2 py-0.5 text-white">
                      Recommended
                    </span>
                  )}
                  {typeof v.score === "number" && (
                    <span
                      className={`score-badge ${scoreClass(v.score)}`}
                      title="Claude's self-assessed fit for your goal — not a real-world performance prediction"
                    >
                      {v.score}/100 match
                    </span>
                  )}
                </div>

                <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">
                  {v.caption}
                </p>

                {typeof v.score === "number" && (
                  <div className="score-bar">
                    <div
                      className={`score-bar-fill ${scoreClass(v.score)}`}
                      style={{ width: `${v.score}%` }}
                    />
                  </div>
                )}

                {v.reasoning && (
                  <p className="mt-2 text-xs italic text-white/45">{v.reasoning}</p>
                )}
                <div className="mt-3 text-xs font-medium text-white/40 opacity-0 transition group-hover:opacity-100">
                  Use this caption →
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
