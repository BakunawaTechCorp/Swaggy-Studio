import type { HTMLAttributes } from "react";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-lg bg-white/[0.04] before:absolute before:inset-0 before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
