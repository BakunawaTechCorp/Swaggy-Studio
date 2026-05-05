"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { JoestarMascot } from "@/components/joestar-mascot";
import { getCostLabel, type ActiveModelId } from "@/lib/credits/costs";
import { MAX_REF_IMAGES } from "../_lib/constants";
import type { PlatformId, PostTypeId, RefImage } from "../_lib/types";
import { PlatformPicker } from "./PlatformPicker";
import { ModelPicker } from "./ModelPicker";
import { IntentFields, type IntentState } from "./IntentFields";

export function PromptStep({
  prompt,
  setPrompt,
  platform,
  setPlatform,
  postType,
  setPostType,
  refImages,
  onAddImages,
  onRemoveImage,
  onBack,
  onGenerate,
  model,
  setModel,
  variantCount,
  intent,
  setIntent,
  creditBalance,
}: {
  prompt: string;
  setPrompt: (v: string) => void;
  platform: PlatformId;
  setPlatform: (v: PlatformId) => void;
  postType: PostTypeId;
  setPostType: (v: PostTypeId) => void;
  refImages: RefImage[];
  onAddImages: (files: FileList | File[]) => void;
  onRemoveImage: (id: string) => void;
  onBack: () => void;
  onGenerate: () => void;
  model: ActiveModelId;
  setModel: (m: ActiveModelId) => void;
  variantCount: 1 | 2 | 3 | 4;
  intent: IntentState;
  setIntent: (i: IntentState) => void;
  creditBalance?: number | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) {
      onAddImages(e.dataTransfer.files);
    }
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) {
      onAddImages(e.target.files);
      e.target.value = "";
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 text-sm text-white/50 transition hover:text-white"
      >
        ← Back to home
      </button>

      <div className="flex justify-center">
        <JoestarMascot
          absolute={false}
          staticTip={{
            title: "✦ Joestar says",
            body: "I'll write captions for your post. Drop a photo (optional) and tell me what it's about — I'll give you a few angles to pick from.",
          }}
        />
      </div>

      {/* CARD 1 — INTENT */}
      <section className="form-card">
        <header className="form-card-head">
          <h2 className="form-card-title">What do you want this post to achieve?</h2>
          <p className="form-card-sub">Tell me the goal and the audience — the captions follow.</p>
        </header>

        <div className="ifield">
          <div className="ifield-label">
            <span>Post context</span>
            <span className="ifield-optional">describe what this is about</span>
          </div>
          <textarea
            autoFocus
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Launching Frigga, a charmed-life lifestyle line. Inviting people to follow our page."
            rows={3}
            maxLength={500}
            className="form-textarea"
          />
          <div className="form-counter">{prompt.length}/500</div>
        </div>

        <PlatformPicker
          platform={platform}
          setPlatform={setPlatform}
          postType={postType}
          setPostType={setPostType}
        />
      </section>

      {/* CARD 2 — CREATIVE DIRECTION */}
      <section className="form-card">
        <header className="form-card-head">
          <h2 className="form-card-title">How should it sound?</h2>
          <p className="form-card-sub">Pick a goal and a tone. The rest is optional.</p>
        </header>
        <IntentFields value={intent} onChange={setIntent} />
      </section>

      {/* CARD 3 — AI POWER */}
      <section className="form-card">
        <header className="form-card-head">
          <h2 className="form-card-title">AI power level</h2>
          <p className="form-card-sub">More power = more polish. More credits.</p>
        </header>
        <ModelPicker value={model} onChange={setModel} />
      </section>

      {/* CARD 4 — PHOTO */}
      <section className="form-card form-card-quiet">
        <header className="form-card-head">
          <h2 className="form-card-title">Got a photo? <span className="form-optional-tag">optional</span></h2>
          <p className="form-card-sub">Captions work with or without one.</p>
        </header>
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center transition ${
            dragging
              ? "border-brand-purple bg-brand-purple/10"
              : "border-white/15 bg-black/20 hover:border-white/30"
          }`}
        >
          <p className="text-sm text-white/70">
            Drop a photo here <span className="text-white/40">or click to choose</span>
          </p>
          <p className="mt-1 text-[10px] text-white/30">
            Up to {MAX_REF_IMAGES} · PNG, JPG, or WebP · 10 MB max each
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={onInputChange}
          />
        </div>

        {refImages.length > 0 && (
          <ul className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6">
            {refImages.map((img) => (
              <li
                key={img.id}
                className="group relative aspect-square overflow-hidden rounded-lg border border-white/10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => onRemoveImage(img.id)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[10px] text-white opacity-0 transition group-hover:opacity-100"
                  aria-label="Remove reference image"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* STICKY CTA */}
      <div className="cta-footer">
        <button
          type="button"
          onClick={onGenerate}
          disabled={!prompt.trim() || !intent.goal || !intent.tone}
          className="cta-button"
        >
          <span className="cta-button-main">
            ✨ Generate {variantCount} high-performing caption{variantCount === 1 ? "" : "s"}
          </span>
          <span className="cta-button-sub">
            Uses {getCostLabel("caption", model)}
            {typeof creditBalance === "number" && (
              <span className="cta-balance">· {creditBalance.toLocaleString()} left</span>
            )}
            {creditBalance == null && <span className="cta-balance">· ∞ left</span>}
          </span>
        </button>
        {(!prompt.trim() || !intent.goal || !intent.tone) && (
          <p className="cta-hint">
            {!prompt.trim()
              ? "Describe what the post is about to continue."
              : !intent.goal
              ? "Pick a goal."
              : "Pick a tone."}
          </p>
        )}
      </div>
    </div>
  );
}
