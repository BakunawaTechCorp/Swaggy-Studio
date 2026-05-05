"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Bookmark,
  Compass,
  FileText,
  Newspaper,
  Settings,
  Sparkles,
  User,
  type LucideIcon,
} from "lucide-react";
import { SwaggyLogo } from "@/components/logo";
import { cachedFetchJson, invalidate } from "@/lib/client-cache";
import type { ProfileBundle } from "@/lib/marketplace/types";

type NavItem = { href: string; label: string; icon: LucideIcon };

const BRAND_ITEMS: NavItem[] = [
  { href: "/create", label: "Create", icon: Sparkles },
  { href: "/press", label: "Press", icon: Newspaper },
  { href: "/library", label: "Library", icon: Bookmark },
];

const PARTNER_ITEMS: NavItem[] = [
  { href: "/tools/projects", label: "Browse Gigs", icon: Compass },
  { href: "/applications", label: "Applications", icon: FileText },
  { href: "/onboarding/role/partner?edit=1", label: "Profile", icon: User },
];

export function Rail() {
  const pathname = usePathname();
  const [bundle, setBundle] = useState<ProfileBundle | null>(null);

  const refresh = useCallback(async (force = false) => {
    try {
      const data = await cachedFetchJson<ProfileBundle>(
        "/api/marketplace/profile",
        { force }
      );
      setBundle(data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const handler = () => {
      invalidate("/api/marketplace/profile");
      void refresh(true);
    };
    window.addEventListener("profile:changed", handler);
    return () => window.removeEventListener("profile:changed", handler);
  }, [refresh]);

  async function refreshAppCache() {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
  }

  const items = bundle?.active_mode === "partner" ? PARTNER_ITEMS : BRAND_ITEMS;

  return (
    <aside className="rail">
      <Link
        href="/create"
        className="rail-logo float"
        title="Swaggy Studio"
        onClick={refreshAppCache}
      >
        <SwaggyLogo size={46} priority />
      </Link>
      {items.map(({ href, label, icon: Icon }) => {
        const baseHref = href.split("?")[0];
        return (
          <Link
            key={href}
            href={href}
            className={`rail-item${pathname.startsWith(baseHref) ? " active" : ""}`}
            title={label}
          >
            <Icon size={22} strokeWidth={2} />
            <span>{label}</span>
          </Link>
        );
      })}
      <div className="rail-spacer" />
      <Link
        href="/settings"
        className={`rail-item${pathname.startsWith("/settings") ? " active" : ""}`}
        title="Settings"
      >
        <Settings size={22} strokeWidth={2} />
        <span>Settings</span>
      </Link>

      <div className="rail-account-group" aria-label="Accounts">
        <Link href="/settings/account" className="rail-avatar" title="Account">
          M
        </Link>
      </div>
    </aside>
  );
}
