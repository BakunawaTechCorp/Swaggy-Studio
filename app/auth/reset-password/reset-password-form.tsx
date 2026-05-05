"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Supabase exchanges the recovery link's hash for a session on mount.
  // Until that's confirmed, we don't know if the user got here legitimately.
  const [ready, setReady] = useState(false);
  const [validLink, setValidLink] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // The recovery link sets a session via URL fragment. The client picks it
    // up automatically. Listen for the PASSWORD_RECOVERY event OR confirm a
    // session exists.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setValidLink(true);
        setReady(true);
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setValidLink(true);
      setReady(true);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });

    if (err) {
      setError(err.message);
      setSubmitting(false);
      return;
    }

    setDone(true);
    setSubmitting(false);
    setTimeout(() => {
      router.push("/create");
      router.refresh();
    }, 1500);
  }

  if (!ready) {
    return (
      <div className="flex w-full flex-col gap-3">
        <div className="h-11 w-full animate-pulse rounded-[10px] bg-white/5" />
        <div className="h-11 w-full animate-pulse rounded-[10px] bg-white/5" />
        <div className="h-11 w-full animate-pulse rounded-full bg-white/5" />
      </div>
    );
  }

  if (!validLink) {
    return (
      <p className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-4 text-center text-sm text-red-200">
        This reset link is invalid or has expired. Request a new one from the
        forgot-password page.
      </p>
    );
  }

  if (done) {
    return (
      <p className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-4 text-center text-sm text-emerald-200">
        Password updated. Redirecting…
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-3">
      {error && (
        <p className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-200">
          {error}
        </p>
      )}

      <input
        type="password"
        autoComplete="new-password"
        required
        minLength={6}
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="h-11 w-full rounded-[10px] border border-white/10 bg-black/30 px-4 text-sm text-white placeholder:text-white/30 focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
      />
      <input
        type="password"
        autoComplete="new-password"
        required
        minLength={6}
        placeholder="Confirm new password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
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
        {submitting ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
