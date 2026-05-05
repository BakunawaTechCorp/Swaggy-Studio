import type { ButtonHTMLAttributes, ReactNode } from "react";

type ToolChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  icon?: ReactNode;
};

export function ToolChip({ active = false, icon, className, children, type = "button", ...props }: ToolChipProps) {
  return (
    <button
      type={type}
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:bg-bg-overlay hover:text-text-primary",
        active
          ? "border-brand-purple bg-brand-purple/20 text-text-primary"
          : "border-border bg-bg-elevated text-text-secondary",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
