"use client";

import { useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useToast } from "@/components/toast";
import { invalidate } from "@/lib/client-cache";
import { PressInput, type PressFormState } from "./PressInput";
import { PressPreview } from "./PressPreview";

export type PressResult = {
  format: "newswire";
  headline: string;
  subhead: string | null;
  dateline_city: string;
  dateline_date: string;
  lede: string;
  body_paragraphs: string[];
  quote: { text: string; attribution: string } | null;
  boilerplate: string;
  contact: { name: string; email: string; phone?: string };
  end_marker: string;
  markdown: string;
  plain_text: string;
};

const DEFAULT_FORM: PressFormState = {
  brief: "",
  company_name: "",
  subhead_hint: "",
  dateline_city: "",
  dateline_date: new Date().toISOString().slice(0, 10),
  include_quote: true,
  spokesperson: "",
  spokesperson_title: "Founder",
  boilerplate: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  model: "claude-sonnet-4-7",
};

export function PressTool() {
  const { show } = useToast();
  const [form, setForm] = useState<PressFormState>(DEFAULT_FORM);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<PressResult | null>(null);

  async function handleGenerate() {
    if (!form.brief.trim())
      return show("Add a brief about what you're announcing.", "error");
    if (!form.company_name.trim())
      return show("Company name is required.", "error");
    if (!form.dateline_city.trim())
      return show("Dateline city is required.", "error");
    if (!form.contact_name.trim())
      return show("Contact name is required.", "error");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)) {
      return show("Valid contact email is required.", "error");
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/tools/press", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.reason || err?.error || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as PressResult;
      setResult(json);

      invalidate("/api/credits/balance");
      window.dispatchEvent(new Event("credits:changed"));

      // Auto-save to library, best effort.
      void fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "press_release",
          title: json.headline.slice(0, 200),
          payload: json,
          metadata: {
            company: form.company_name,
            dateline_city: form.dateline_city,
            model: form.model,
          },
        }),
      })
        .then((r) =>
          r.ok ? show("Saved to Library.", "success") : undefined
        )
        .catch(() => undefined);
    } catch (err) {
      console.error("[press]", err);
      const msg =
        err instanceof Error ? err.message : "Couldn't generate. Try again.";
      show(msg, "error");
    } finally {
      setGenerating(false);
    }
  }

  if (result) {
    return (
      <main className="canvas">
        <div className="press-back-row">
          <button
            type="button"
            className="btn-link"
            onClick={() => setResult(null)}
          >
            <ArrowLeft size={14} /> Edit fields
          </button>
          <button
            type="button"
            className="btn-link"
            onClick={handleGenerate}
            disabled={generating}
          >
            <RefreshCw size={14} className={generating ? "spin" : ""} />{" "}
            Regenerate
          </button>
        </div>
        <PressPreview result={result} />
      </main>
    );
  }

  return (
    <main className="canvas">
      <PressInput
        form={form}
        onChange={setForm}
        onGenerate={handleGenerate}
        generating={generating}
      />
    </main>
  );
}
