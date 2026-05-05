"use client";

import { useMemo } from "react";
import { JoestarMascot } from "@/components/joestar-mascot";
import { SwaggyLogo } from "@/components/logo";
import { createClient } from "@/lib/supabase/client";

export function TopBar() {
  return (
    <header
      className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center justify-between border-b px-4 backdrop-blur md:px-6"
      style={{
        backgroundColor: "rgba(15, 11, 42, 0.85)",
        borderColor: "#2a1f5e",
      }}
    >
      <SwaggyLogo size={28} />
      <SignOutButton />
    </header>
  );
}

function SignOutButton() {
  const supabase = useMemo(() => createClient(), []);
  return (
    <button
      type="button"
      onClick={async () => {
        await supabase.auth.signOut();
        window.location.href = "/login";
      }}
      className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/25 hover:text-white"
    >
      Sign out
    </button>
  );
}

export function MobileGate() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center md:hidden">
      <JoestarMascot
        absolute={false}
        staticTip={{
          title: "✦ Joestar says",
          body: "Swaggy Studio works best on desktop. Open it on your laptop for the full experience.",
        }}
      />
    </div>
  );
}
