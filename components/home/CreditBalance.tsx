"use client";

import { useEffect, useState, useCallback } from "react";
import { Sparkles, Zap } from "lucide-react";
import { useToast } from "@/components/toast";
import { cachedFetchJson, invalidate } from "@/lib/client-cache";

type BalanceState = {
  balance: number;
  unlimited: boolean;
  isMaster: boolean;
} | null;

export function CreditBalance() {
  const { show } = useToast();
  const [state, setState] = useState<BalanceState>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (force = false) => {
    try {
      const json = await cachedFetchJson<BalanceState>(
        "/api/credits/balance",
        { force }
      );
      setState(json);
    } catch (err) {
      console.error("[credit-balance] fetch failed", err);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Listen for the X-Credits-Balance header from any tool API call so we
    // refresh without polling. The hook below dispatches a custom event after
    // each tool completes — see useCreditAware().
    const handler = () => {
      invalidate("/api/credits/balance");
      void refresh(true);
    };
    window.addEventListener("credits:changed", handler);
    return () => window.removeEventListener("credits:changed", handler);
  }, [refresh]);

  async function handleTopup() {
    const raw = window.prompt("How many credits to add?", "100");
    if (!raw) return;
    const amount = Math.floor(Number(raw));
    if (!Number.isFinite(amount) || amount < 10) {
      show("Enter a number ≥ 10.", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/credits/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
      show(`+${amount} credits added.`, "success");
      invalidate("/api/credits/balance");
      await refresh(true);
    } catch (err) {
      show("Top-up failed.", "error");
      console.error("[credit-balance] topup failed", err);
    } finally {
      setLoading(false);
    }
  }

  if (!state) {
    return <div className="pill" aria-label="Loading credits">…</div>;
  }

  if (state.unlimited) {
    return (
      <div className="pill" title="Master account — unlimited credits">
        <Sparkles size={14} />
        <span>Unlimited</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="pill"
      onClick={handleTopup}
      disabled={loading}
      title="Click to top up"
    >
      <Zap size={14} />
      <span>{state.balance.toLocaleString()} credits</span>
      <span className="pill-divider">·</span>
      <span className="pill-action">Top up</span>
    </button>
  );
}
