import type { HTMLAttributes } from "react";

type BadgeTone = "default" | "success" | "warning" | "danger";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

const tones: Record<BadgeTone, string> = {
  default: "border-white/10 bg-white/5 text-text-tertiary",
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
  danger: "border-error/25 bg-error/10 text-error",
};

export function Badge({ tone = "default", className, ...props }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-micro font-semibold uppercase tracking-wider",
        tones[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
