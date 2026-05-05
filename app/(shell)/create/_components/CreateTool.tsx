"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/components/toast";
import { cachedFetchJson, invalidate } from "@/lib/client-cache";
import {
  CreateInput,
  INTENT_TO_MODE,
  MAX_REF_IMAGES,
  type AdvancedOptions,
  type ConnectedAccount,
  type Intent,
  type PostType,
  type ProgressStep,
  type RefImage,
} from "./CreateInput";
import { CreateOutput } from "./CreateOutput";
import type { ActiveModelId } from "@/lib/credits/costs";

const MAX_REF_IMAGE_BYTES = 10 * 1024 * 1024;

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r !== "string") return reject(new Error("read_failed"));
      const comma = r.indexOf(",");
      resolve(comma === -1 ? r : r.slice(comma + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}

export type CritiqueResult = {
  overall: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  structural_check: {
    hook_strong: boolean;
    hook_note: string;
    specificity_present: boolean;
    specificity_note: string;
    cta_clear: boolean;
    cta_note: string;
    voice_match: boolean;
    voice_note: string;
  };
  fit_score?: { value: number; reasoning: string };
};

export type CreateResult = {
  mode?: "critique";
  plan?: {
    wants_caption: boolean;
    wants_image: boolean;
    wants_campaign: boolean;
    inferred_platform: string;
    inferred_audience: string;
    inferred_goal: string;
    inferred_tone: string;
    reasoning: string;
  };
  caption?: {
    caption: string;
    reasoning: string;
    fit_score?: { value: number; reasoning: string };
  } | null;
  image_variants?:
    | Array<{
        id: string;
        label: string;
        rationale: string;
        aspect_ratio: string;
        image_prompt: string;
        image: { base64: string; mimeType: string } | null;
      }>
    | null;
  campaign?:
    | {
        options: Array<{
          id: string;
          big_idea: string;
          arc: Array<{ name: string; description: string }>;
          channels: Array<{ platform: string; why: string }>;
          budget_tier: "low" | "medium" | "high";
          risk: string;
        }>;
        challenge?: { severity: string; message: string; suggestion?: string };
      }
    | null;
  critique?: CritiqueResult | null;
  partial?: boolean;
};

// Until real connections exist, surface a representative set of dummy accounts
// so the picker is usable. These IDs are local-only and never sent to the
// backend as real account_id targets (the API ignores unknown IDs).
const DUMMY_ACCOUNTS: ConnectedAccount[] = [
  { id: "demo-fb", provider: "facebook", display_name: "Swaggy Studio (Demo)" },
  { id: "demo-ig", provider: "instagram", display_name: "@swaggystudio.demo" },
  { id: "demo-tt", provider: "tiktok", display_name: "@swaggystudio" },
  { id: "demo-tw", provider: "twitter", display_name: "@swaggy_demo" },
  { id: "demo-li", provider: "linkedin", display_name: "Swaggy Studio Co." },
];

const DEFAULT_ADVANCED: AdvancedOptions = {
  audience: "",
  tone: "",
  avoid: "",
  language: "auto",
  platform: "auto",
};

export function CreateTool({ firstName }: { firstName?: string }) {
  const { show } = useToast();

  const [brief, setBrief] = useState("");
  const [intent, setIntent] = useState<Intent>("not_sure");
  const [advanced, setAdvanced] = useState<AdvancedOptions>(DEFAULT_ADVANCED);
  const [model, setModel] = useState<ActiveModelId>("claude-sonnet-4-7");

  const [refImages, setRefImages] = useState<RefImage[]>([]);

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [postType, setPostType] = useState<PostType>("auto");

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [steps, setSteps] = useState<ProgressStep[]>([]);

  useEffect(() => {
    cachedFetchJson<{ connections?: ConnectedAccount[] }>(
      "/api/connections"
    )
      .then((data) => {
        const real = data.connections ?? [];
        setAccounts(real.length > 0 ? real : DUMMY_ACCOUNTS);
      })
      .catch(() => setAccounts(DUMMY_ACCOUNTS));
    return () => {
      setRefImages((prev) => {
        prev.forEach((r) => URL.revokeObjectURL(r.url));
        return [];
      });
    };
  }, []);

  const addRefImages = useCallback(
    (files: FileList | File[]) => {
      const incoming = Array.from(files);
      const accepted: RefImage[] = [];
      for (const file of incoming) {
        if (!file.type.startsWith("image/")) {
          show(`"${file.name}" is not an image.`, "error");
          continue;
        }
        if (file.size > MAX_REF_IMAGE_BYTES) {
          show(`"${file.name}" is larger than 10 MB.`, "error");
          continue;
        }
        accepted.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          url: URL.createObjectURL(file),
          file,
        });
      }
      if (!accepted.length) return;
      setRefImages((prev) => {
        const room = MAX_REF_IMAGES - prev.length;
        if (room <= 0) {
          show(`Up to ${MAX_REF_IMAGES} images.`, "error");
          accepted.forEach((a) => URL.revokeObjectURL(a.url));
          return prev;
        }
        const taken = accepted.slice(0, room);
        accepted.slice(room).forEach((d) => URL.revokeObjectURL(d.url));
        return [...prev, ...taken];
      });
    },
    [show]
  );

  const removeRefImage = useCallback((id: string) => {
    setRefImages((prev) => {
      const t = prev.find((r) => r.id === id);
      if (t) URL.revokeObjectURL(t.url);
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  async function uploadRefImages(): Promise<string[]> {
    if (refImages.length === 0) return [];
    const urls: string[] = [];
    for (const r of refImages) {
      try {
        const base64 = await fileToBase64(r.file);
        const res = await fetch("/api/tools/image/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64, mimeType: r.file.type }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { url: string };
        urls.push(json.url);
      } catch (err) {
        console.error("[create.ref-upload]", err);
      }
    }
    return urls;
  }

  function upsertStep(ev: {
    id: string;
    status: "running" | "done" | "failed";
    title: string;
    note?: string;
  }) {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === ev.id);
      const now = Date.now();
      if (idx === -1) {
        return [
          ...prev,
          {
            id: ev.id,
            status: ev.status,
            title: ev.title,
            note: ev.note,
            startedAt: now,
            endedAt: ev.status === "running" ? undefined : now,
          },
        ];
      }
      const next = prev.slice();
      next[idx] = {
        ...next[idx],
        status: ev.status,
        title: ev.title,
        note: ev.note ?? next[idx].note,
        endedAt: ev.status === "running" ? undefined : now,
      };
      return next;
    });
  }

  async function handleGenerate() {
    if (!brief.trim()) {
      show("Tell me what you want to make.", "error");
      return;
    }
    setGenerating(true);
    setSteps([]);
    setResult(null);
    try {
      const referenceImageUrls = await uploadRefImages();

      const account = accounts.find((a) => a.id === selectedAccountId) ?? null;
      const platformFromAccount =
        account &&
        ["instagram", "facebook", "tiktok", "twitter", "linkedin"].includes(
          account.provider
        )
          ? (account.provider as AdvancedOptions["platform"])
          : null;

      const advancedFinal: AdvancedOptions & { post_type?: PostType } = {
        ...advanced,
        platform:
          advanced.platform !== "auto"
            ? advanced.platform
            : platformFromAccount ?? "auto",
      };
      if (postType !== "auto") {
        advancedFinal.post_type = postType;
      }

      const res = await fetch("/api/tools/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify({
          brief: brief.trim(),
          mode: INTENT_TO_MODE[intent],
          advanced: advancedFinal,
          model,
          reference_image_urls: referenceImageUrls,
          account_id: account?.id ?? null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.reason || err?.error || `HTTP ${res.status}`);
      }

      // If the server didn't stream (older client/path), fall back to a
      // single JSON parse.
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/x-ndjson")) {
        const json = (await res.json()) as CreateResult;
        setResult(json);
      } else if (!res.body) {
        throw new Error("No response stream.");
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalResult: CreateResult | null = null;
        let streamError: string | null = null;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line) continue;
            try {
              const ev = JSON.parse(line) as
                | {
                    type: "step";
                    id: string;
                    status: "running" | "done" | "failed";
                    title: string;
                    note?: string;
                  }
                | { type: "result"; payload: CreateResult }
                | { type: "error"; reason: string };
              if (ev.type === "step") {
                upsertStep(ev);
              } else if (ev.type === "result") {
                finalResult = ev.payload;
              } else if (ev.type === "error") {
                streamError = ev.reason;
              }
            } catch {
              // ignore malformed lines
            }
          }
        }
        if (streamError) throw new Error(streamError);
        if (!finalResult) throw new Error("Stream ended without a result.");
        setResult(finalResult);
        if (finalResult.partial) {
          show(
            "Some parts couldn't be generated, but here's what worked.",
            "info"
          );
        }
      }

      invalidate("/api/credits/balance");
      window.dispatchEvent(new Event("credits:changed"));
    } catch (err) {
      console.error("[create]", err);
      const msg =
        err instanceof Error ? err.message : "Couldn't generate right now.";
      show(msg, "error");
    } finally {
      setGenerating(false);
    }
  }

  if (result) {
    return (
      <main className="canvas">
        <div className="create-back-row">
          <button
            type="button"
            className="btn-link"
            onClick={() => setResult(null)}
          >
            <ArrowLeft size={14} /> Make another
          </button>
        </div>
        <CreateOutput result={result} brief={brief} />
      </main>
    );
  }

  return (
    <main className="canvas">
      <CreateInput
        brief={brief}
        onChange={setBrief}
        onGenerate={handleGenerate}
        generating={generating}
        intent={intent}
        onIntentChange={setIntent}
        advanced={advanced}
        onAdvancedChange={setAdvanced}
        model={model}
        onModelChange={setModel}
        firstName={firstName}
        refImages={refImages}
        onAddRefImages={addRefImages}
        onRemoveRefImage={removeRefImage}
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onSelectedAccount={setSelectedAccountId}
        postType={postType}
        onPostType={setPostType}
        steps={steps}
      />
    </main>
  );
}
