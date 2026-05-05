"use client";

import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
} from "react";

const BASE_INPUT =
  "h-11 w-full rounded-[10px] border border-[#2a1f5e] bg-[#1a1440] px-3.5 text-[14px] text-white placeholder:text-white/30 transition-colors duration-300 ease-out focus:border-brand-purple focus:outline-none focus:ring-0";

export const AuthInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function AuthInput({ className, ...rest }, ref) {
  return <input ref={ref} className={`${BASE_INPUT} ${className ?? ""}`} {...rest} />;
});

type PasswordProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordField({ className, ...rest }: PasswordProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        className={`${BASE_INPUT} pr-11 ${className ?? ""}`}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-white/40 transition-colors duration-300 ease-out hover:text-white/80"
        tabIndex={-1}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.5 10.5 0 0 1 12 19c-7 0-10-7-10-7a18.2 18.2 0 0 1 4.06-5.06" />
      <path d="M9.9 4.24A10 10 0 0 1 12 4c7 0 10 7 10 7a18.2 18.2 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
