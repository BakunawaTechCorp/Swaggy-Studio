"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      }
    );

    if (err) {
      setError(err.message);
      setSubmitting(false);
      return;
    }

    setSent(true);
    setSubmitting(false);
  }

  if (sent) {
    return (
      <div className="flex w-full flex-col gap-3 text-center">
        <p className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-200">
          Check <span className="font-medium">{email}</span> for a reset link.
          It expires in 1 hour.
        </p>
        <p className="text-xs text-white/50">
          Didn&apos;t get it? Check spam, or try again in a minute.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-3">
      {error && (
        <p className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-200">
          {error}
        </p>
      )}

      <p className="text-center text-sm text-white/60">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      <input
        type="email"
        autoComplete="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-11 w-full rounded-[10px] border border-white/10 bg-black/30 px-4 text-sm text-white placeholder:text-white/30 focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
      />

      <button
        type="submit"
        disabled={submitting}
        className="mt-1 h-11 w-full rounded-full text-[14px] font-medium text-white transition-all duration-300 ease-out hover:-translate-y-px hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(135deg, #7b2ff7 0%, #f059c0 100%)",
        }}
      >
        {submitting ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
