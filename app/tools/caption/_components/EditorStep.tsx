import type { Variant } from "../_lib/types";
import { Spinner } from "./Spinner";

export function EditorStep({
  variant,
  caption,
  setCaption,
  onBack,
  onHappy,
  generating,
}: {
  variant: Variant | null;
  caption: string;
  setCaption: (v: string) => void;
  onBack: () => void;
  onHappy: () => void;
  generating: boolean;
}) {
  return (
    <div className="mx-auto max-w-xl">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 text-sm text-white/50 transition hover:text-white"
      >
        ← Pick a different caption
      </button>

      {variant && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider">
          {variant.hook_type && (
            <span className="rounded-full bg-brand-purple/20 px-2 py-0.5 text-brand-purple">
              {variant.hook_type}
            </span>
          )}
          {variant.tone && (
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-white/50">
              {variant.tone}
            </span>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-white/50">
          Tweak the caption
        </label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={8}
          placeholder="Your caption…"
          className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm leading-relaxed text-white placeholder:text-white/30 focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
        />
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onHappy}
          disabled={generating || !caption.trim()}
          className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
        >
          {generating ? (
            <>
              <Spinner /> Working…
            </>
          ) : (
            <>Preview post →</>
          )}
        </button>
      </div>
    </div>
  );
}
