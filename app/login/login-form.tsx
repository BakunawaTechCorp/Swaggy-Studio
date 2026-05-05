"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSafeRedirectPath } from "@/lib/redirects";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (err) {
      setError(err.message);
      setSubmitting(false);
      return;
    }
    router.push(getSafeRedirectPath(searchParams.get("redirectTo")));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-3">
      {error && (
        <p className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-200">
          {error}
        </p>
      )}

      <input
        type="email"
        autoComplete="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-11 w-full rounded-[10px] border border-white/10 bg-black/30 px-4 text-sm text-white placeholder:text-white/30 focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
      />
      <input
        type="password"
        autoComplete="current-password"
        required
        minLength={6}
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
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
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
