import { JoestarMascot } from "@/components/joestar-mascot";
import type { PlatformId } from "../_lib/types";
import { labelForPlatform } from "../_lib/utils";

export function SuccessStep({
  platform,
  postedUrl,
  onAnother,
}: {
  platform: PlatformId;
  postedUrl: string | null;
  onAnother: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white"
        style={{
          background: "linear-gradient(135deg, #34d399 0%, #10b981 100%)",
        }}
      >
        ✓
      </div>
      <h2 className="mt-4 font-serif text-3xl">Posted.</h2>
      <p className="mt-1 text-sm text-white/60">
        Live on {labelForPlatform(platform)}.
      </p>
      <div className="mt-8">
        <JoestarMascot
          absolute={false}
          size={40}
          staticTip={{
            title: "✦ Joestar says",
            body: "That post is live. Time to check those DMs.",
          }}
        />
      </div>
      <div className="mt-8 flex flex-col items-stretch gap-2 w-full max-w-xs">
        <button
          type="button"
          onClick={onAnother}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.02]"
        >
          Make another post
        </button>
        {postedUrl && (
          <a
            href={postedUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/25 hover:text-white"
          >
            View on Facebook →
          </a>
        )}
      </div>
    </div>
  );
}
