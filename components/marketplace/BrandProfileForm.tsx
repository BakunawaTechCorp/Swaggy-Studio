"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import type { BrandProfile } from "@/lib/marketplace/types";

const INDUSTRIES = [
  "fashion",
  "beauty",
  "food",
  "tech",
  "travel",
  "lifestyle",
  "health",
  "finance",
  "education",
  "entertainment",
  "other",
];

type Props = {
  initial?: BrandProfile | null;
  onSaved?: (profile: BrandProfile) => void;
};

export function BrandProfileForm({ initial, onSaved }: Props) {
  const router = useRouter();
  const { show } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: initial?.company_name ?? "",
    website: initial?.website ?? "",
    industry: initial?.industry ?? "",
    description: initial?.description ?? "",
    contact_email: initial?.contact_email ?? "",
    logo_url: initial?.logo_url ?? "",
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit() {
    if (!form.company_name.trim()) {
      show("Company name is required.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/marketplace/brand-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { profile: BrandProfile };
      show("Brand profile saved.", "success");
      window.dispatchEvent(new Event("profile:changed"));
      onSaved?.(json.profile);

      // If this was a fresh create, switch to brand mode and bounce home.
      if (!initial) {
        await fetch("/api/marketplace/profile/mode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "brand" }),
        }).catch(() => undefined);
        router.push("/home");
        router.refresh();
      }
    } catch (err) {
      console.error("[brand-profile-form] save failed", err);
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
        <label htmlFor="company_name">Company name *</label>
        <input
          id="company_name"
          type="text"
          maxLength={120}
          value={form.company_name}
          onChange={(e) => update("company_name", e.target.value)}
          placeholder="Acme Corp"
          required
        />
      </div>

      <div className="form-row">
        <label htmlFor="industry">Industry</label>
        <select
          id="industry"
          value={form.industry}
          onChange={(e) => update("industry", e.target.value)}
        >
          <option value="">Select an industry…</option>
          {INDUSTRIES.map((ind) => (
            <option key={ind} value={ind}>
              {ind.charAt(0).toUpperCase() + ind.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          type="url"
          value={form.website}
          onChange={(e) => update("website", e.target.value)}
          placeholder="https://"
        />
      </div>

      <div className="form-row">
        <label htmlFor="contact_email">Contact email</label>
        <input
          id="contact_email"
          type="email"
          value={form.contact_email}
          onChange={(e) => update("contact_email", e.target.value)}
          placeholder="hello@yourbrand.com"
        />
      </div>

      <div className="form-row">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          maxLength={2000}
          rows={4}
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="A short pitch about your brand. What you make, who you serve."
        />
        <small className="form-hint">{form.description.length}/2000</small>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : initial ? "Save changes" : "Create brand profile"}
        </button>
      </div>
    </form>
  );
}
