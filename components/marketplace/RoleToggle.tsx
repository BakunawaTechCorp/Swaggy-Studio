"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Megaphone, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/toast";
import type { ActiveMode, ProfileBundle } from "@/lib/marketplace/types";

export function RoleToggle() {
  const router = useRouter();
  const { show } = useToast();
  const [bundle, setBundle] = useState<ProfileBundle | null>(null);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/marketplace/profile", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as ProfileBundle;
      setBundle(json);
    } catch (err) {
      console.error("[role-toggle] fetch failed", err);
    }
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("profile:changed", handler);
    return () => window.removeEventListener("profile:changed", handler);
  }, [refresh]);

  async function switchTo(mode: ActiveMode) {
    if (switching || !bundle) return;
    if (mode === bundle.active_mode) {
      setOpen(false);
      return;
    }

    // If they don't have a profile in the target role yet, redirect to onboarding.
    const hasProfile = mode === "brand" ? Boolean(bundle.brand) : Boolean(bundle.partner);
    if (!hasProfile) {
      setOpen(false);
      router.push(`/onboarding/role/${mode}`);
      return;
    }

    setSwitching(true);
    try {
      const res = await fetch("/api/marketplace/profile/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err?.error === "missing_profile") {
          router.push(`/onboarding/role/${mode}`);
          return;
        }
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
      window.dispatchEvent(new Event("profile:changed"));
      show(`Switched to ${mode === "brand" ? "Brand" : "Partner"} mode.`, "success");
      router.refresh();
      await refresh();
    } catch (err) {
      console.error("[role-toggle] switch failed", err);
      show("Couldn't switch modes.", "error");
    } finally {
      setSwitching(false);
      setOpen(false);
    }
  }

  if (!bundle) {
    return <div className="pill" aria-label="Loading mode">…</div>;
  }

  const mode = bundle.active_mode;
  const hasBrand = Boolean(bundle.brand);
  const hasPartner = Boolean(bundle.partner);

  const Icon = mode === "brand" ? Megaphone : Briefcase;
  const label = mode === "brand" ? "Brand mode" : "Partner mode";

  return (
    <div className="role-toggle-wrap">
      <button
        type="button"
        className="pill role-toggle-pill"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={switching}
      >
        <Icon size={14} />
        <span>{label}</span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <div
          className="role-toggle-menu"
          role="menu"
          onMouseLeave={() => setOpen(false)}
        >
          <button
            type="button"
            className={`role-toggle-item ${mode === "brand" ? "active" : ""}`}
            onClick={() => switchTo("brand")}
            disabled={switching}
            role="menuitem"
          >
            <Megaphone size={14} />
            <div>
              <div className="role-toggle-item-title">Brand mode</div>
              <div className="role-toggle-item-sub">
                {hasBrand ? "Post gigs, manage campaigns" : "Set up brand profile →"}
              </div>
            </div>
          </button>

          <button
            type="button"
            className={`role-toggle-item ${mode === "partner" ? "active" : ""}`}
            onClick={() => switchTo("partner")}
            disabled={switching}
            role="menuitem"
          >
            <Briefcase size={14} />
            <div>
              <div className="role-toggle-item-title">Partner mode</div>
              <div className="role-toggle-item-sub">
                {hasPartner ? "Browse & apply to gigs" : "Set up partner profile →"}
              </div>
            </div>
          </button>

          <div className="role-toggle-footer">
            <Link href={`/onboarding/role/${mode}?edit=1`}>Manage profiles</Link>
          </div>
        </div>
      )}
    </div>
  );
}
