import type { HTMLAttributes } from "react";

type AvatarProps = HTMLAttributes<HTMLDivElement> & {
  label: string;
};

export function Avatar({ label, className, ...props }: AvatarProps) {
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div
      className={[
        "flex h-11 w-11 items-center justify-center rounded-full border-2 border-border-strong bg-yellow-pink-gradient font-bold text-bg-base",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      title={label}
      {...props}
    >
      {initials}
    </div>
  );
}
