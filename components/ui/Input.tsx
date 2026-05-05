import { forwardRef, type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={[
        "w-full rounded-md border border-border bg-bg-elevated px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  )
);
Input.displayName = "Input";
