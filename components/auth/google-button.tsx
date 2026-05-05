"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  label?: string;
  onError?: (message: string) => void;
};

export function GoogleButton({
  label = "Continue with Google",
  onError,
}: Props) {
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();

  async function onClick() {
    setLoading(true);
    try {
      const supabase = createClient();
      const nextParam = searchParams.get("redirectTo") ?? "/create";
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextParam)}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        onError?.(prettifyGoogleError(error.message));
        setLoading(false);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Something went wrong.";
      onError?.(prettifyGoogleError(raw));
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex h-11 w-full items-center justify-center gap-3 rounded-full bg-white px-4 text-[14px] font-medium text-bg-base transition-opacity duration-300 ease-out hover:opacity-95 active:opacity-85 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <GoogleG />
      <span>{loading ? "Redirecting…" : label}</span>
    </button>
  );
}

function prettifyGoogleError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("supabase is not configured")) {
    return "Supabase isn’t set up yet: open .env.local in this project folder, paste your real Project URL and anon key from Supabase → Project Settings → API, save the file, then restart npm run dev.";
  }
  if (m.includes("failed to fetch") || m.includes("load failed")) {
    return "Can’t reach Supabase. Usually the Project URL in .env.local is wrong, still a placeholder, or you forgot to restart the dev server after saving.";
  }
  return message;
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"
      />
      <path
        fill="#34A853"
        d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"
      />
      <path
        fill="#FBBC05"
        d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"
      />
      <path
        fill="#EA4335"
        d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"
      />
    </svg>
  );
}
