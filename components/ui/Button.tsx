import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "yellow" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand-gradient text-white shadow-glow-purple hover:shadow-glow-purple",
  yellow: "bg-yellow-pink-gradient text-bg-base shadow-glow-yellow hover:shadow-glow-yellow",
  secondary: "border border-border bg-bg-elevated text-text-primary hover:bg-bg-overlay hover:border-border-strong",
  ghost: "border border-border bg-transparent text-text-primary hover:bg-bg-elevated hover:border-border-strong",
  danger: "border border-error/30 bg-error/10 text-error hover:bg-error/15",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-[18px] py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", leftIcon, rightIcon, children, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0",
        variants[variant],
        sizes[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  )
);
Button.displayName = "Button";
