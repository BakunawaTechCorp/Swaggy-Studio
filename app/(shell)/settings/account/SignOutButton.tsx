"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [working, setWorking] = useState(false);

  async function onClick() {
    if (working) return;
    setWorking(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={working}
      className="btn-ghost"
      style={{ borderColor: "rgba(248, 113, 113, 0.4)", color: "#fca5a5" }}
    >
      {working ? "Signing out…" : "Sign out"}
    </button>
  );
}
