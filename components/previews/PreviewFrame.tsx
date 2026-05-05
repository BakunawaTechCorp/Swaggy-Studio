import type { ReactNode } from "react";

type PreviewFrameProps = {
  platform: string;
  postType: string;
  imageUrl: string | null;
  caption: string;
  tags?: string;
  pageName?: string;
  children?: ReactNode;
};

export function PreviewFrame({
  platform,
  postType,
  imageUrl,
  caption,
  pageName = "Your page",
}: PreviewFrameProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">
        {platform} · {postType}
      </div>
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt="Post preview"
          className="mb-3 w-full rounded-lg object-cover"
        />
      )}
      <p className="mb-2 text-xs text-white/60">{pageName}</p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">
        {caption}
      </p>
    </div>
  );
}
