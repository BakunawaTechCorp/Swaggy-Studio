"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/toast";

type Connection = {
  id: string;
  provider: string;
  display_name: string | null;
  created_at: string;
};

type ProviderCard = {
  provider: string;
  name: string;
  description: string;
  status: "live" | "soon";
};

const PROVIDERS: ProviderCard[] = [
  { provider: "facebook", name: "Facebook", description: "Post to Pages", status: "live" },
  { provider: "instagram", name: "Instagram", description: "Coming soon", status: "soon" },
  { provider: "tiktok", name: "TikTok", description: "Coming soon", status: "soon" },
  { provider: "twitter", name: "Twitter / X", description: "Coming soon", status: "soon" },
  { provider: "linkedin", name: "LinkedIn", description: "Coming soon", status: "soon" },
  { provider: "gmail", name: "Gmail", description: "For email blasts — coming soon", status: "soon" },
  { provider: "twilio", name: "Twilio SMS", description: "For SMS blasts — coming soon", status: "soon" },
];

export function ConnectionsView() {
  const { show } = useToast();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const res = await fetch("/api/connections", { cache: "no-store" });
      const data = await res.json();
      setConnections(data.connections ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const fb = params.get("fb");
      if (fb === "connected") show("Facebook connected.", "success");
      if (fb === "error") show("Facebook connection failed.", "error");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDisconnect(id: string) {
    if (!window.confirm("Disconnect this account?")) return;
    const res = await fetch(`/api/connections/${id}`, { method: "DELETE" });
    if (res.ok) {
      show("Disconnected.", "success");
      refresh();
    } else {
      show("Couldn't disconnect.", "error");
    }
  }

  return (
    <main className="canvas">
      <a href="/home" className="back-link">← Back to home</a>
      <div className="topbar">
        <div className="greeting">Connections</div>
      </div>
      <div className="section-title">
        <div>
          <h2>Linked <span className="italic">accounts</span></h2>
          <p>Plug in the channels you publish to. One credit balance funds them all.</p>
        </div>
      </div>
      <div className="quickstart-grid">
        {PROVIDERS.map((p) => {
          const live = connections.find((c) => c.provider === p.provider);
          return (
            <div key={p.provider} className={`quickstart-card ${p.status === "soon" ? "is-soon" : ""}`}>
              <div className="quickstart-content">
                <div className="quickstart-title">{p.name}</div>
                <div className="quickstart-sub">
                  {live
                    ? `Connected · ${live.display_name ?? p.name}`
                    : p.status === "soon"
                    ? p.description
                    : "Not connected"}
                </div>
                <div className="quickstart-cost" style={{ marginTop: 12 }}>
                  {p.status === "soon" ? (
                    <button type="button" className="btn" disabled>
                      Coming soon
                    </button>
                  ) : live ? (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => handleDisconnect(live.id)}
                    >
                      Disconnect
                    </button>
                  ) : (
                    <a href="/api/auth/facebook" className="btn">
                      Connect
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {loading && <p style={{ opacity: 0.6, marginTop: 24 }}>Loading…</p>}
      <footer className="canvas-footer">Swaggy Studio · v1.0</footer>
    </main>
  );
}
