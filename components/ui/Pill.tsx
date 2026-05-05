import type { HTMLAttributes, ReactNode } from "react";

type PillTone = "yellow" | "cyan" | "success" | "muted";

type PillProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: PillTone;
  dot?: boolean;
  icon?: ReactNode;
};

const tones: Record<PillTone, string> = {
  yellow: "border-brand-yellow/25 bg-brand-yellow/10 text-brand-yellow",
  cyan: "border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan",
  success: "border-success/25 bg-success/10 text-success",
  muted: "border-white/10 bg-white/5 text-text-tertiary",
};

const dotTones: Record<PillTone, string> = {
  yellow: "bg-brand-yellow",
  cyan: "bg-brand-cyan",
  success: "bg-success",
  muted: "bg-text-muted",
};

export function Pill({ tone = "yellow", dot = true, icon, className, children, ...props }: PillProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium",
        tones[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full shadow-[0_0_8px_currentColor] ${dotTones[tone]}`} />}
      {icon}
      {children}
    </span>
  );
}
