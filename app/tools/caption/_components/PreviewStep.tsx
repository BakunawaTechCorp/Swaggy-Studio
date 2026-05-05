import { PreviewFrame } from "@/components/previews/PreviewFrame";
import type { FinalPost } from "../_lib/types";
import { labelForPlatform } from "../_lib/utils";
import { Spinner } from "./Spinner";

export function PreviewStep({
  finalPost,
  onBack,
  onPost,
  onSchedule,
  onDownload,
  onCopy,
  posting,
  schedulingAt,
}: {
  finalPost: FinalPost;
  onBack: () => void;
  onPost: () => void;
  onSchedule: () => void;
  onDownload: () => void;
  onCopy: () => void;
  posting: boolean;
  schedulingAt: string | null;
}) {
  const hasRealImage = !!finalPost.imageUrl;

  return (
    <div className="mx-auto max-w-2xl">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 text-sm text-white/50 transition hover:text-white"
      >
        ← Edit caption
      </button>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="mx-auto w-full max-w-sm">
          {hasRealImage ? (
            <PreviewFrame
              platform={finalPost.platform}
              postType={finalPost.postType}
              imageUrl={finalPost.imageUrl}
              caption={finalPost.caption}
              tags=""
              pageName="Your page"
            />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">
                {labelForPlatform(finalPost.platform)} · {finalPost.postType}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">
                {finalPost.caption}
              </p>
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">
            Ready to publish
          </h3>
          <button
            type="button"
            onClick={onPost}
            disabled={posting}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
          >
            {posting ? (
              <>
                <Spinner /> Posting…
              </>
            ) : (
              <>Post now ↗</>
            )}
          </button>
          <button
            type="button"
            onClick={onSchedule}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/25 hover:text-white"
          >
            {schedulingAt ? `⏰ Scheduled` : "⏰ Schedule"}
          </button>
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/25 hover:text-white"
          >
            ⬇ Download image
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/25 hover:text-white"
          >
            ⧉ Copy caption
          </button>
          {finalPost.platform !== "facebook" && (
            <p className="mt-2 rounded-lg bg-white/5 p-2 text-[11px] leading-relaxed text-white/60">
              {labelForPlatform(finalPost.platform)} direct-posting is coming
              soon. You can still copy the caption and download the image.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
