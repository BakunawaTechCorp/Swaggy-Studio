"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setInfo(null);
    setSubmitting(true);
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback`
            : undefined,
      },
    });
    if (err) {
      setError(err.message);
      setSubmitting(false);
      return;
    }
    // If email confirmation is required, session will be null.
    if (!data.session) {
      setInfo("Check your email to confirm your account, then sign in.");
      setSubmitting(false);
      return;
    }
    router.push("/home");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-3">
      {error && (
        <p className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-200">
          {error}
        </p>
      )}
      {info && (
        <p className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-200">
          {info}
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
        autoComplete="new-password"
        required
        minLength={6}
        placeholder="Password (min 6 chars)"
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
        {submitting ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
