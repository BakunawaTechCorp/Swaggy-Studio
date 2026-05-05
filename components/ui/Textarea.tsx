import { forwardRef, type TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  prompt?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, prompt = false, ...props }, ref) => (
    <textarea
      ref={ref}
      className={[
        "w-full resize-none border text-text-primary placeholder:text-text-muted outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20",
        prompt
          ? "rounded-xl border-border bg-bg-card p-5 text-base"
          : "rounded-md border-border bg-bg-elevated px-3.5 py-2.5 text-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
