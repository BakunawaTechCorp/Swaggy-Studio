"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useToast } from "@/components/toast";
import {
  NICHES,
  PARTNER_TYPES,
  REGIONS,
  type PartnerProfile,
} from "@/lib/marketplace/types";

type Props = {
  initial?: PartnerProfile | null;
  onSaved?: (profile: PartnerProfile) => void;
};

export function PartnerProfileForm({ initial, onSaved }: Props) {
  const router = useRouter();
  const { show } = useToast();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    display_name: initial?.display_name ?? "",
    partner_type: initial?.partner_type ?? "blogger",
    bio: initial?.bio ?? "",
    niches: new Set<string>(initial?.niches ?? []),
    region: initial?.region ?? "",
    audience_size: initial?.audience_size ?? null as number | null,
    primary_outlet: initial?.primary_outlet ?? "",
    outlet_url: initial?.outlet_url ?? "",
    portfolio_links: initial?.portfolio_links ?? [],
    rate_card_min: initial?.rate_card_min ?? null as number | null,
    rate_card_max: initial?.rate_card_max ?? null as number | null,
    keywords: initial?.keywords ?? [],
  });

  const [newKeyword, setNewKeyword] = useState("");
  const [newPortfolio, setNewPortfolio] = useState("");

  function toggleNiche(niche: string) {
    setForm((f) => {
      const next = new Set(f.niches);
      if (next.has(niche)) next.delete(niche);
      else next.add(niche);
      return { ...f, niches: next };
    });
  }

  function addKeyword() {
    const k = newKeyword.trim().toLowerCase();
    if (!k || form.keywords.includes(k) || form.keywords.length >= 20) return;
    setForm((f) => ({ ...f, keywords: [...f.keywords, k] }));
    setNewKeyword("");
  }

  function removeKeyword(k: string) {
    setForm((f) => ({ ...f, keywords: f.keywords.filter((x) => x !== k) }));
  }

  function addPortfolio() {
    const url = newPortfolio.trim();
    if (!url || form.portfolio_links.includes(url) || form.portfolio_links.length >= 10) return;
    setForm((f) => ({ ...f, portfolio_links: [...f.portfolio_links, url] }));
    setNewPortfolio("");
  }

  function removePortfolio(url: string) {
    setForm((f) => ({
      ...f,
      portfolio_links: f.portfolio_links.filter((x) => x !== url),
    }));
  }

  async function handleSubmit() {
    if (!form.display_name.trim()) {
      show("Display name is required.", "error");
      return;
    }
    if (form.rate_card_min != null && form.rate_card_max != null && form.rate_card_min > form.rate_card_max) {
      show("Min rate can't exceed max rate.", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/marketplace/partner-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          niches: Array.from(form.niches),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { profile: PartnerProfile };
      show("Partner profile saved.", "success");
      window.dispatchEvent(new Event("profile:changed"));
      onSaved?.(json.profile);

      if (!initial) {
        await fetch("/api/marketplace/profile/mode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "partner" }),
        }).catch(() => undefined);
        router.push("/home");
        router.refresh();
      }
    } catch (err) {
      console.error("[partner-profile-form] save failed", err);
      show("Couldn't save. Try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="profile-form"
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <div className="form-row">
        <label htmlFor="display_name">Display name *</label>
        <input
          id="display_name"
          type="text"
          maxLength={80}
          value={form.display_name}
          onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          placeholder="Your name or outlet"
          required
        />
      </div>

      <div className="form-row">
        <label htmlFor="partner_type">I am a *</label>
        <select
          id="partner_type"
          value={form.partner_type}
          onChange={(e) =>
            setForm({ ...form, partner_type: e.target.value as PartnerProfile["partner_type"] })
          }
        >
          {PARTNER_TYPES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <label htmlFor="bio">Bio</label>
        <textarea
          id="bio"
          rows={4}
          maxLength={2000}
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          placeholder="Tell brands what you cover and why they should pick you."
        />
        <small className="form-hint">{form.bio.length}/2000</small>
      </div>

      <div className="form-row">
        <label>Niches (pick all that apply)</label>
        <div className="chip-grid">
          {NICHES.map((niche) => (
            <button
              key={niche}
              type="button"
              className={`chip ${form.niches.has(niche) ? "chip-active" : ""}`}
              onClick={() => toggleNiche(niche)}
            >
              {niche}
            </button>
          ))}
        </div>
        <small className="form-hint">{form.niches.size} selected</small>
      </div>

      <div className="form-row form-row-split">
        <div>
          <label htmlFor="region">Region</label>
          <select
            id="region"
            value={form.region ?? ""}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
          >
            <option value="">Select a region…</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="audience_size">Audience size</label>
          <input
            id="audience_size"
            type="number"
            min={0}
            value={form.audience_size ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                audience_size: e.target.value === "" ? null : Math.max(0, parseInt(e.target.value, 10) || 0),
              })
            }
            placeholder="e.g. 12500"
          />
        </div>
      </div>

      <div className="form-row form-row-split">
        <div>
          <label htmlFor="primary_outlet">Primary outlet</label>
          <input
            id="primary_outlet"
            type="text"
            value={form.primary_outlet}
            onChange={(e) => setForm({ ...form, primary_outlet: e.target.value })}
            placeholder="Instagram / Blog name / TikTok"
          />
        </div>
        <div>
          <label htmlFor="outlet_url">Main link</label>
          <input
            id="outlet_url"
            type="url"
            value={form.outlet_url}
            onChange={(e) => setForm({ ...form, outlet_url: e.target.value })}
            placeholder="https://"
          />
        </div>
      </div>

      <div className="form-row form-row-split">
        <div>
          <label htmlFor="rate_card_min">Min rate (PHP)</label>
          <input
            id="rate_card_min"
            type="number"
            min={0}
            value={form.rate_card_min ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                rate_card_min: e.target.value === "" ? null : Math.max(0, parseInt(e.target.value, 10) || 0),
              })
            }
            placeholder="e.g. 2000"
          />
        </div>
        <div>
          <label htmlFor="rate_card_max">Max rate (PHP)</label>
          <input
            id="rate_card_max"
            type="number"
            min={0}
            value={form.rate_card_max ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                rate_card_max: e.target.value === "" ? null : Math.max(0, parseInt(e.target.value, 10) || 0),
              })
            }
            placeholder="e.g. 8000"
          />
        </div>
      </div>

      <div className="form-row">
        <label>Portfolio links</label>
        <div className="chip-row">
          {form.portfolio_links.map((url) => (
            <span key={url} className="chip chip-tag">
              {url.replace(/^https?:\/\//, "").slice(0, 40)}
              <button
                type="button"
                onClick={() => removePortfolio(url)}
                aria-label={`Remove ${url}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="form-row-inline">
          <input
            type="url"
            value={newPortfolio}
            onChange={(e) => setNewPortfolio(e.target.value)}
            placeholder="https://yourpost.example.com"
          />
          <button type="button" className="btn btn-ghost" onClick={addPortfolio}>
            Add
          </button>
        </div>
      </div>

      <div className="form-row">
        <label>Keywords (free-text — what brands might search)</label>
        <div className="chip-row">
          {form.keywords.map((k) => (
            <span key={k} className="chip chip-tag">
              {k}
              <button type="button" onClick={() => removeKeyword(k)} aria-label={`Remove ${k}`}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="form-row-inline">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addKeyword();
              }
            }}
            placeholder="streetwear, sustainability, korean food…"
          />
          <button type="button" className="btn btn-ghost" onClick={addKeyword}>
            Add
          </button>
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : initial ? "Save changes" : "Create partner profile"}
        </button>
      </div>
    </form>
  );
}
