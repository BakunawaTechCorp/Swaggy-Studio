"use client";

import Link from "next/link";
import { useEffect, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { cachedFetchJson } from "@/lib/client-cache";

type Connection = {
  id: string;
  provider: string;
  display_name: string | null;
  created_at: string;
};

const PROVIDER_LABELS: Record<string, { mark: string; markClass: string; sub: string }> = {
  facebook: { mark: "f", markClass: "facebook-mark", sub: "Facebook Page" },
  instagram: { mark: "IG", markClass: "instagram-mark", sub: "Instagram Business" },
  tiktok: { mark: "♪", markClass: "tiktok-mark", sub: "TikTok" },
  twitter: { mark: "X", markClass: "twitter-mark", sub: "Twitter / X" },
  linkedin: { mark: "in", markClass: "linkedin-mark", sub: "LinkedIn" },
  gmail: { mark: "@", markClass: "gmail-mark", sub: "Gmail" },
  twilio: { mark: "SMS", markClass: "twilio-mark", sub: "Twilio SMS" },
};

export function Sidebar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [connections, setConnections] = useState<Connection[]>([]);

  useEffect(() => {
    let cancelled = false;
    cachedFetchJson<{ connections?: Connection[] }>("/api/connections")
      .then((data) => {
        if (!cancelled) setConnections(data.connections ?? []);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function submitSearch(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/connections?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">My Studio</div>
      </div>
      <input
        className="sidebar-search"
        placeholder="Search…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={submitSearch}
      />

      <section className="sidebar-section">
        <div className="sidebar-section-title">
          <span>Connected</span>
          <Link href="/connections">All -&gt;</Link>
        </div>
        <div className="recent-list">
          {connections.length === 0 && (
            <Link href="/connections" className="recent-item">
              <div className="platform-mark">+</div>
              <div className="recent-meta">
                <div className="recent-meta-title">Connect an account</div>
                <div className="recent-meta-sub">Facebook, Instagram, more</div>
              </div>
            </Link>
          )}
          {connections.map((c) => {
            const meta = PROVIDER_LABELS[c.provider] ?? {
              mark: "?",
              markClass: "",
              sub: c.provider,
            };
            return (
              <Link key={c.id} href="/connections" className="recent-item">
                <div className={`platform-mark ${meta.markClass}`}>{meta.mark}</div>
                <div className="recent-meta">
                  <div className="recent-meta-title">{c.display_name ?? meta.sub}</div>
                  <div className="recent-meta-sub">{meta.sub}</div>
                </div>
                <div className="recent-status status-posted" />
              </Link>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
