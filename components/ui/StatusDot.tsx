type StatusDotTone = "posted" | "scheduled" | "draft" | "error";

type StatusDotProps = {
  tone?: StatusDotTone;
  className?: string;
};

const tones: Record<StatusDotTone, string> = {
  posted: "bg-success shadow-[0_0_8px_rgba(52,211,153,0.6)]",
  scheduled: "bg-brand-cyan shadow-[0_0_8px_rgba(103,232,249,0.6)]",
  draft: "bg-text-muted",
  error: "bg-error shadow-[0_0_8px_rgba(248,113,113,0.55)]",
};

export function StatusDot({ tone = "draft", className }: StatusDotProps) {
  return <span className={["inline-block h-2 w-2 rounded-full", tones[tone], className].filter(Boolean).join(" ")} />;
}
