"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import {
  ChevronDown,
  Plus,
  Sparkles,
  X,
  Zap,
  Check,
  Cpu,
  SlidersHorizontal,
} from "lucide-react";
import type { ActiveModelId } from "@/lib/credits/costs";

export const MAX_REF_IMAGES = 10;
export type RefImage = { id: string; url: string; file: File };

export type AdvancedOptions = {
  audience: string;
  tone: string;
  avoid: string;
  language: "auto" | "english" | "tagalog" | "taglish" | "bisaya";
  platform: "auto" | "instagram" | "facebook" | "tiktok" | "twitter" | "linkedin";
};

export type PostType =
  | "auto"
  | "feed"
  | "story"
  | "reel"
  | "carousel"
  | "cover";

export type ConnectedAccount = {
  id: string;
  provider: string;
  display_name: string | null;
};

// Internal mode (kept for backend compatibility).
export type CreateMode =
  | "auto"
  | "quick_post"
  | "campaign"
  | "critique"
  | "image_only";

// User-facing intent.
export type Intent =
  | "not_sure"
  | "create_content"
  | "run_campaign"
  | "analyze"
  | "generate_image";

export const INTENT_TO_MODE: Record<Intent, CreateMode> = {
  not_sure: "auto",
  create_content: "quick_post",
  run_campaign: "campaign",
  analyze: "critique",
  generate_image: "image_only",
};

const INTENTS: { id: Intent; label: string; sub: string }[] = [
  { id: "create_content", label: "Create Content", sub: "post + caption" },
  { id: "run_campaign", label: "Run Campaign", sub: "multi-touch plan" },
  { id: "analyze", label: "Analyze", sub: "critique a draft" },
  { id: "generate_image", label: "Generate Image", sub: "visual only" },
  { id: "not_sure", label: "Not Sure", sub: "let AI choose" },
];

// Compact labels for the inline footer dropdown.
const INTENT_DROPDOWN_LABELS: Record<Intent, string> = {
  not_sure: "Auto",
  create_content: "Image + caption",
  generate_image: "Image only",
  run_campaign: "Campaign plan",
  analyze: "Critique a draft",
};

const PROVIDER_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  twitter: "Twitter / X",
  linkedin: "LinkedIn",
  gmail: "Gmail",
  twilio: "Twilio SMS",
};

const POST_TYPES: { id: PostType; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "feed", label: "Feed" },
  { id: "story", label: "Story" },
  { id: "reel", label: "Reel" },
  { id: "carousel", label: "Carousel" },
  { id: "cover", label: "Cover" },
];

const MODEL_OPTIONS: {
  id: ActiveModelId;
  label: string;
  sub: string;
  credits: string;
}[] = [
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku",
    sub: "Fast — good for drafts",
    credits: "~1 credit",
  },
  {
    id: "claude-sonnet-4-7",
    label: "Claude Sonnet",
    sub: "Pro — best quality",
    credits: "~4 credits",
  },
];

const SLASH_COMMANDS: { cmd: string; insert: string; hint: string }[] = [
  { cmd: "/audience", insert: "Audience: ", hint: "describe who it's for" },
  { cmd: "/tone", insert: "Tone: ", hint: "describe the voice" },
  { cmd: "/goal", insert: "Goal: ", hint: "what should this drive?" },
  { cmd: "/format", insert: "Format: ", hint: "feed, reel, carousel, story" },
];

// ---------- Smart inference (lightweight, client-only) ----------

type Inferred = {
  audience: string | null;
  tone: string | null;
  platform: AdvancedOptions["platform"] | null;
};

function inferFromBrief(text: string): Inferred {
  const t = text.toLowerCase();
  let audience: string | null = null;
  if (/\bgen[\s-]?z\b/.test(t)) audience = "Gen Z";
  else if (/\bmillennials?\b/.test(t)) audience = "Millennials";
  else if (/\bgen[\s-]?x\b/.test(t)) audience = "Gen X";
  else if (/\bboomers?\b/.test(t)) audience = "Boomers";
  else if (/\b(teens?|teenagers?)\b/.test(t)) audience = "Teens";

  if (/\b(philippines?|filipinos?|filipino|pinoy|ph)\b/.test(t)) {
    audience = audience ? `${audience} Philippines` : "Philippines";
  } else if (/\b(usa?|united states|america|americans?)\b/.test(t)) {
    audience = audience ? `${audience} US` : "US";
  } else if (/\b(uk|britain|british|england)\b/.test(t)) {
    audience = audience ? `${audience} UK` : "UK";
  }

  let tone: string | null = null;
  if (/\b(luxury|premium|high[\s-]?end|elevated)\b/.test(t)) tone = "premium";
  else if (/\b(playful|fun|cheeky|quirky)\b/.test(t)) tone = "playful";
  else if (/\b(casual|chill|relaxed|laid[\s-]?back)\b/.test(t)) tone = "casual";
  else if (/\b(professional|formal|corporate)\b/.test(t)) tone = "professional";
  else if (/\b(warm|friendly|welcoming)\b/.test(t)) tone = "warm";
  else if (/\b(witty|smart|clever)\b/.test(t)) tone = "witty";

  let platform: AdvancedOptions["platform"] | null = null;
  if (/\btiktok\b/.test(t)) platform = "tiktok";
  else if (/\binstagram|insta\b|\bigtv|reels?\b/.test(t)) platform = "instagram";
  else if (/\bfacebook|fb\b/.test(t)) platform = "facebook";
  else if (/\b(twitter|x\.com|tweet)\b/.test(t)) platform = "twitter";
  else if (/\blinkedin\b/.test(t)) platform = "linkedin";

  return { audience, tone, platform };
}

// ---------- Component ----------

type Props = {
  brief: string;
  onChange: (s: string) => void;
  onGenerate: () => void;
  generating: boolean;
  intent: Intent;
  onIntentChange: (i: Intent) => void;
  advanced: AdvancedOptions;
  onAdvancedChange: (a: AdvancedOptions) => void;
  model: ActiveModelId;
  onModelChange: (m: ActiveModelId) => void;
  firstName?: string;

  refImages: RefImage[];
  onAddRefImages: (files: FileList | File[]) => void;
  onRemoveRefImage: (id: string) => void;

  accounts: ConnectedAccount[];
  selectedAccountId: string;
  onSelectedAccount: (id: string) => void;

  postType: PostType;
  onPostType: (t: PostType) => void;

  steps?: ProgressStep[];
};

export type ProgressStep = {
  id: string;
  status: "running" | "done" | "failed";
  title: string;
  note?: string;
  startedAt: number;
  endedAt?: number;
};

export function CreateInput({
  brief,
  onChange,
  onGenerate,
  generating,
  intent,
  onIntentChange,
  advanced,
  onAdvancedChange,
  model,
  onModelChange,
  firstName,
  refImages,
  onAddRefImages,
  onRemoveRefImage,
  accounts,
  selectedAccountId,
  onSelectedAccount,
  postType,
  onPostType,
  steps = [],
}: Props) {
  const [showRefine, setShowRefine] = useState(false);
  const [showSlash, setShowSlash] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [advancedFocus, setAdvancedFocus] = useState<
    "audience" | "tone" | "platform" | null
  >(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 360)}px`;
  }, [brief]);

  // Focus the requested advanced field when the modal opens.
  useEffect(() => {
    if (showRefine && advancedFocus) {
      const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(
        `[data-adv="${advancedFocus}"]`
      );
      el?.focus();
      setAdvancedFocus(null);
    }
  }, [showRefine, advancedFocus]);

  function onFiles(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      onAddRefImages(e.target.files);
      e.target.value = "";
    }
  }

  // Slash command popover: open when last token starts with "/".
  function handleBriefChange(value: string) {
    onChange(value);
    const tail = value.slice(0, value.length).split(/\s/).pop() ?? "";
    setShowSlash(tail.startsWith("/") && tail.length <= 12);
  }

  function applySlash(insert: string) {
    const value = brief;
    const tokens = value.split(/(\s+)/);
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (tokens[i].startsWith("/")) {
        tokens[i] = insert;
        break;
      }
    }
    const next = tokens.join("");
    onChange(next);
    setShowSlash(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function onTextareaKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape" && showSlash) {
      e.preventDefault();
      setShowSlash(false);
      return;
    }
    if (
      e.key === "Enter" &&
      (e.metaKey || e.ctrlKey) &&
      brief.trim() &&
      !generating
    ) {
      e.preventDefault();
      onGenerate();
    }
  }

  const inferred = useMemo(() => inferFromBrief(brief), [brief]);
  const hasInference =
    !!inferred.audience || !!inferred.tone || !!inferred.platform;

  const canAddMore = refImages.length < MAX_REF_IMAGES;
  const greeting = firstName ? `Hi ${firstName},` : "Hello,";
  const activeModel = MODEL_OPTIONS.find((m) => m.id === model) ?? MODEL_OPTIONS[1];

  function applySuggestion(kind: "audience" | "tone" | "platform") {
    const next = { ...advanced };
    if (kind === "audience" && inferred.audience) next.audience = inferred.audience;
    if (kind === "tone" && inferred.tone) next.tone = inferred.tone;
    if (kind === "platform" && inferred.platform) next.platform = inferred.platform;
    onAdvancedChange(next);
    setShowRefine(true);
    setAdvancedFocus(kind);
  }

  // Count of non-default advanced overrides (badge on the Refine button).
  const refineCount =
    (intent !== "not_sure" ? 1 : 0) +
    (advanced.audience.trim() ? 1 : 0) +
    (advanced.tone.trim() ? 1 : 0) +
    (advanced.avoid.trim() ? 1 : 0) +
    (advanced.platform !== "auto" ? 1 : 0) +
    (advanced.language !== "auto" ? 1 : 0) +
    (postType !== "auto" ? 1 : 0);

  return (
    <div className="hero-shell">
      <div className="hero-greeting">
        <p className="hero-greeting-line">{greeting}</p>
        <h1 className="hero-greeting-q">
          What do you want to <span className="italic">create</span>?
        </h1>
      </div>

      {/* HERO INPUT */}
      <div className="hero-input">
        <div className="hero-account-bar">
          <AccountDropdown
            accounts={accounts}
            selectedAccountId={selectedAccountId}
            onSelect={onSelectedAccount}
            disabled={generating}
          />
        </div>

        <textarea
          ref={textareaRef}
          className="hero-textarea"
          placeholder="What do you want to create? (e.g. Launch a fitness brand targeting Gen Z in the Philippines)"
          value={brief}
          onChange={(e) => handleBriefChange(e.target.value)}
          rows={2}
          maxLength={2000}
          disabled={generating}
          onKeyDown={onTextareaKey}
        />

        {showSlash && (
          <div className="slash-popover" role="listbox">
            <div className="slash-hint">Insert a structured hint</div>
            {SLASH_COMMANDS.map((s) => (
              <button
                type="button"
                key={s.cmd}
                className="slash-item"
                onClick={() => applySlash(s.insert)}
              >
                <span className="slash-cmd">{s.cmd}</span>
                <span className="slash-desc">{s.hint}</span>
              </button>
            ))}
          </div>
        )}

        {refImages.length > 0 && (
          <div className="hero-refimg-row">
            {refImages.map((r) => (
              <div key={r.id} className="hero-refimg-thumb">
                <img src={r.url} alt="reference" />
                <button
                  type="button"
                  className="hero-refimg-remove"
                  onClick={() => onRemoveRefImage(r.id)}
                  disabled={generating}
                  aria-label="Remove image"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="hero-input-foot">
          <div className="hero-input-foot-left">
            <button
              type="button"
              className="hero-icon-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={generating || !canAddMore}
              title={
                canAddMore
                  ? `Add reference image (${refImages.length}/${MAX_REF_IMAGES})`
                  : `Up to ${MAX_REF_IMAGES} images`
              }
              aria-label="Add reference image"
            >
              <Plus size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={onFiles}
            />
            <select
              className="hero-intent-select"
              value={intent}
              onChange={(e) => onIntentChange(e.target.value as Intent)}
              disabled={generating}
              aria-label="What to make"
              title="What to make"
            >
              {INTENTS.map((i) => (
                <option key={i.id} value={i.id}>
                  {INTENT_DROPDOWN_LABELS[i.id]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="hero-refine-btn"
              onClick={() => setShowRefine(true)}
              disabled={generating}
              title="Refine output"
            >
              <SlidersHorizontal size={12} />
              <span>Refine</span>
              {refineCount > 0 && (
                <span className="hero-refine-badge">{refineCount}</span>
              )}
            </button>
            {brief.length > 0 && (
              <span className="hero-charcount">{brief.length}/2000</span>
            )}
          </div>

          <div className="hero-input-foot-right">
            <button
              type="button"
              className="hero-model-chip"
              onClick={() => setShowModelModal(true)}
              disabled={generating}
              title="Change model"
            >
              <Cpu size={12} />
              <span>{activeModel.label}</span>
              <span className="muted">· {activeModel.credits}</span>
            </button>
            <button
              type="button"
              className="hero-generate-btn"
              onClick={onGenerate}
              disabled={generating || !brief.trim()}
            >
              <Sparkles size={16} />
              {generating ? "Generating…" : "Generate"}
            </button>
          </div>
        </div>
      </div>

      {/* SMART SUGGESTIONS */}
      {hasInference && !generating && (
        <div className="smart-suggestions">
          <span className="smart-suggestions-label">Suggested:</span>
          {inferred.audience && (
            <button
              type="button"
              className="smart-chip"
              onClick={() => applySuggestion("audience")}
            >
              <Zap size={11} /> {inferred.audience}
            </button>
          )}
          {inferred.platform && (
            <button
              type="button"
              className="smart-chip"
              onClick={() => applySuggestion("platform")}
            >
              <Zap size={11} /> {capitalize(inferred.platform)}
            </button>
          )}
          {inferred.tone && (
            <button
              type="button"
              className="smart-chip"
              onClick={() => applySuggestion("tone")}
            >
              <Zap size={11} /> {capitalize(inferred.tone)}
            </button>
          )}
        </div>
      )}

      {generating && <ProgressTranscript steps={steps} />}

      {showRefine && (
        <RefineModal
          advanced={advanced}
          onAdvancedChange={onAdvancedChange}
          postType={postType}
          onPostType={onPostType}
          onClose={() => setShowRefine(false)}
        />
      )}

      {showModelModal && (
        <ModelModal
          model={model}
          onSelect={(m) => {
            onModelChange(m);
            setShowModelModal(false);
          }}
          onClose={() => setShowModelModal(false)}
        />
      )}
    </div>
  );
}

// ---------- Refine modal ----------

function RefineModal({
  advanced,
  onAdvancedChange,
  postType,
  onPostType,
  onClose,
}: {
  advanced: AdvancedOptions;
  onAdvancedChange: (a: AdvancedOptions) => void;
  postType: PostType;
  onPostType: (t: PostType) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="model-modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="refine-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Refine output"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="model-modal-head">
          <h3>Refine output</h3>
          <button
            type="button"
            className="hero-icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="refine-modal-body">
          <RefineGroup title="Audience & Positioning">
            <RefineField label="Target Audience">
              <input
                data-adv="audience"
                type="text"
                placeholder="e.g. Filipino fitness enthusiasts 25–35"
                value={advanced.audience}
                onChange={(e) =>
                  onAdvancedChange({ ...advanced, audience: e.target.value })
                }
                maxLength={400}
              />
            </RefineField>
            <RefineField label="Platform">
              <select
                data-adv="platform"
                value={advanced.platform}
                onChange={(e) =>
                  onAdvancedChange({
                    ...advanced,
                    platform: e.target.value as AdvancedOptions["platform"],
                  })
                }
              >
                <option value="auto">Auto-detect</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="tiktok">TikTok</option>
                <option value="twitter">Twitter / X</option>
                <option value="linkedin">LinkedIn</option>
              </select>
            </RefineField>
            <RefineField label="Post Format">
              <select
                value={postType}
                onChange={(e) => onPostType(e.target.value as PostType)}
              >
                {POST_TYPES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </RefineField>
          </RefineGroup>

          <RefineGroup title="Style & Voice">
            <RefineField label="Tone">
              <input
                data-adv="tone"
                type="text"
                placeholder="e.g. warm, witty, premium"
                value={advanced.tone}
                onChange={(e) =>
                  onAdvancedChange({ ...advanced, tone: e.target.value })
                }
                maxLength={200}
              />
            </RefineField>
            <RefineField label="Avoid">
              <input
                type="text"
                placeholder="e.g. emojis, hard-sell, hashtags"
                value={advanced.avoid}
                onChange={(e) =>
                  onAdvancedChange({ ...advanced, avoid: e.target.value })
                }
                maxLength={200}
              />
            </RefineField>
          </RefineGroup>

          <RefineGroup title="Technical">
            <RefineField label="Language">
              <select
                value={advanced.language}
                onChange={(e) =>
                  onAdvancedChange({
                    ...advanced,
                    language: e.target.value as AdvancedOptions["language"],
                  })
                }
              >
                <option value="auto">Auto</option>
                <option value="english">English</option>
                <option value="tagalog">Tagalog</option>
                <option value="taglish">Taglish</option>
                <option value="bisaya">Bisaya</option>
              </select>
            </RefineField>
          </RefineGroup>
        </div>

        <div className="refine-modal-foot">
          <button type="button" className="hero-generate-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Account dropdown ----------

const PROVIDER_VISUAL: Record<
  string,
  { mark: string; gradient: string }
> = {
  facebook: { mark: "f", gradient: "linear-gradient(135deg, #1877f2, #4267b2)" },
  instagram: {
    mark: "Ig",
    gradient: "linear-gradient(135deg, #f58529, #dd2a7b 50%, #515bd4)",
  },
  tiktok: { mark: "♪", gradient: "linear-gradient(135deg, #25f4ee, #fe2c55)" },
  twitter: { mark: "X", gradient: "linear-gradient(135deg, #1d1d1f, #4a4a4f)" },
  linkedin: { mark: "in", gradient: "linear-gradient(135deg, #0a66c2, #004c8c)" },
  gmail: { mark: "@", gradient: "linear-gradient(135deg, #ea4335, #fbbc04)" },
  twilio: { mark: "T", gradient: "linear-gradient(135deg, #f22f46, #b1132e)" },
};

function AccountDropdown({
  accounts,
  selectedAccountId,
  onSelect,
  disabled,
}: {
  accounts: ConnectedAccount[];
  selectedAccountId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = accounts.find((a) => a.id === selectedAccountId) ?? null;
  const triggerLabel = selected
    ? PROVIDER_LABELS[selected.provider] ?? selected.provider
    : "All accounts";
  const triggerSub = selected?.display_name ?? null;
  const triggerVis = selected ? PROVIDER_VISUAL[selected.provider] : null;

  return (
    <div className="acct-dd" ref={wrapRef}>
      <button
        type="button"
        className={`acct-dd-trigger ${open ? "is-open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Select an account you want to create the content for"
      >
        {triggerVis ? (
          <span className="acct-dd-mark" style={{ background: triggerVis.gradient }}>
            {triggerVis.mark}
          </span>
        ) : (
          <span className="acct-dd-mark acct-dd-mark-all">All</span>
        )}
        <span className="acct-dd-trigger-text">
          <span className="acct-dd-trigger-label">{triggerLabel}</span>
          {triggerSub && (
            <span className="acct-dd-trigger-sub">{triggerSub}</span>
          )}
        </span>
        <ChevronDown size={12} className="acct-dd-chev" />
      </button>

      {open && (
        <div className="acct-dd-menu" role="listbox">
          <button
            type="button"
            className={`acct-dd-item ${!selectedAccountId ? "is-active" : ""}`}
            onClick={() => {
              onSelect("");
              setOpen(false);
            }}
            role="option"
            aria-selected={!selectedAccountId}
          >
            <span className="acct-dd-mark acct-dd-mark-all">All</span>
            <span className="acct-dd-item-text">
              <span className="acct-dd-item-label">All accounts</span>
              <span className="acct-dd-item-sub">Let AI pick the platform</span>
            </span>
            {!selectedAccountId && <Check size={13} className="acct-dd-check" />}
          </button>

          {accounts.map((a) => {
            const vis =
              PROVIDER_VISUAL[a.provider] ?? {
                mark: "·",
                gradient: "linear-gradient(135deg, #555, #333)",
              };
            const label = PROVIDER_LABELS[a.provider] ?? a.provider;
            const active = selectedAccountId === a.id;
            return (
              <button
                type="button"
                key={a.id}
                className={`acct-dd-item ${active ? "is-active" : ""}`}
                onClick={() => {
                  onSelect(a.id);
                  setOpen(false);
                }}
                role="option"
                aria-selected={active}
              >
                <span
                  className="acct-dd-mark"
                  style={{ background: vis.gradient }}
                >
                  {vis.mark}
                </span>
                <span className="acct-dd-item-text">
                  <span className="acct-dd-item-label">{label}</span>
                  {a.display_name && (
                    <span className="acct-dd-item-sub">{a.display_name}</span>
                  )}
                </span>
                {active && <Check size={13} className="acct-dd-check" />}
              </button>
            );
          })}

          <div className="acct-dd-sep" />
          <a className="acct-dd-connect" href="/connections">
            <Plus size={13} />
            <span>Connect a new account</span>
          </a>
        </div>
      )}
    </div>
  );
}

// ---------- Progress transcript ----------

function ProgressTranscript({ steps }: { steps: ProgressStep[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  if (steps.length === 0) {
    return (
      <div className="progress-transcript">
        <div className="progress-step is-running">
          <span className="progress-dot" />
          <div className="progress-body">
            <div className="progress-title">Starting…</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="progress-transcript">
      {steps.map((s) => {
        const elapsed =
          s.endedAt !== undefined
            ? s.endedAt - s.startedAt
            : now - s.startedAt;
        return (
          <div key={s.id} className={`progress-step is-${s.status}`}>
            <span className="progress-dot" aria-hidden>
              {s.status === "done" ? "✓" : s.status === "failed" ? "✕" : ""}
            </span>
            <div className="progress-body">
              <div className="progress-title">
                <span>{s.title}</span>
                <span className="progress-elapsed">
                  {(elapsed / 1000).toFixed(1)}s
                </span>
              </div>
              {s.note && <div className="progress-note">{s.note}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Tiny helpers ----------

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function RefineGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="refine-group">
      <div className="refine-group-title">{title}</div>
      <div className="refine-group-grid">{children}</div>
    </div>
  );
}

function RefineField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="refine-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ModelModal({
  model,
  onSelect,
  onClose,
}: {
  model: ActiveModelId;
  onSelect: (m: ActiveModelId) => void;
  onClose: () => void;
}) {
  return (
    <div className="model-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="model-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="model-modal-head">
          <h3>Choose a model</h3>
          <button
            type="button"
            className="hero-icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
        <p className="muted model-modal-sub">
          Cost varies per generation type. Ranges shown are typical.
        </p>
        <div className="model-modal-list">
          {MODEL_OPTIONS.map((m) => (
            <button
              type="button"
              key={m.id}
              className={`model-option ${model === m.id ? "is-active" : ""}`}
              onClick={() => onSelect(m.id)}
            >
              <div className="model-option-row">
                <strong>{m.label}</strong>
                {model === m.id && <Check size={14} />}
              </div>
              <div className="muted">{m.sub}</div>
              <div className="model-option-credits">{m.credits} per generation</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
