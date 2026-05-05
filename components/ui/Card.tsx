import type { HTMLAttributes } from "react";

type CardVariant = "surface" | "elevated" | "gradient";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
};

const variants: Record<CardVariant, string> = {
  surface: "rounded-xl border border-border bg-bg-card",
  elevated: "rounded-lg border border-border-subtle bg-bg-elevated",
  gradient: "rounded-xl bg-brand-gradient",
};

export function Card({ variant = "surface", className, ...props }: CardProps) {
  return (
    <div
      className={[
        "transition hover:-translate-y-0.5 hover:border-brand-purple",
        variants[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
