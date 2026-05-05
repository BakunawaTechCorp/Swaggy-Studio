"use client";

import { useEffect, useState } from "react";
import {
  MessageSquare,
  Image as ImageIcon,
  Megaphone,
  Newspaper,
  Trash2,
  Copy,
  X,
} from "lucide-react";
import { useToast } from "@/components/toast";
import type {
  LibraryItem,
  CaptionPayload,
  ImagePayload,
  CampaignPayload,
  PressReleasePayload,
} from "@/lib/library/types";

const KIND_ICON = {
  caption: MessageSquare,
  image: ImageIcon,
  campaign: Megaphone,
  press_release: Newspaper,
} as const;

const KIND_LABEL = {
  caption: "Caption",
  image: "Image",
  campaign: "Campaign",
  press_release: "Press Release",
} as const;

export function LibraryView() {
  const { show } = useToast();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LibraryItem | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/library", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { items?: LibraryItem[] };
      setItems(json.items ?? []);
    } catch (err) {
      console.error("[library.view]", err);
      show("Couldn't load your library.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this saved item?")) return;
    try {
      const res = await fetch(`/api/library/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (selected?.id === id) setSelected(null);
      show("Deleted.", "success");
    } catch {
      show("Couldn't delete.", "error");
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(
      () => show("Copied to clipboard.", "success"),
      () => show("Couldn't copy.", "error"),
    );
  }

  return (
    <>
      <div className="library-header">
        <h1>
          Your <span className="italic">work</span>
        </h1>
        <p>Everything you&apos;ve saved across Caption, Image, and Campaign.</p>
      </div>

      {loading && <div className="library-empty">Loading…</div>}

      {!loading && items.length === 0 && (
        <div className="library-empty">
          <p>Nothing saved yet.</p>
          <p className="muted">
            When you click &ldquo;Use this&rdquo; on a generation, it lands here.
          </p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <ul className="library-list">
          {items.map((item) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <li
                key={item.id}
                className="library-item"
                onClick={() => setSelected(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(item);
                  }
                }}
              >
                <div className={`library-item-icon kind-${item.kind}`}>
                  <Icon size={18} />
                </div>
                {item.thumbnail_url && item.kind === "image" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.thumbnail_url}
                    alt=""
                    className="library-thumb"
                  />
                )}
                <div className="library-item-body">
                  <div className="library-item-title">{item.title}</div>
                  <div className="library-item-meta">
                    <span>{KIND_LABEL[item.kind]}</span>
                    <span>·</span>
                    <span>
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="library-item-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDelete(item.id);
                  }}
                  aria-label="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <div
          className="library-modal-backdrop"
          onClick={() => setSelected(null)}
        >
          <div
            className="library-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="library-modal-close"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="library-modal-header">
              <span className={`library-kind-tag kind-${selected.kind}`}>
                {KIND_LABEL[selected.kind]}
              </span>
              <span className="library-modal-date">
                {new Date(selected.created_at).toLocaleString()}
              </span>
            </div>

            <LibraryDetail item={selected} onCopy={copyToClipboard} />

            <div className="library-modal-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => void handleDelete(selected.id)}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function LibraryDetail({
  item,
  onCopy,
}: {
  item: LibraryItem;
  onCopy: (text: string) => void;
}) {
  if (item.kind === "caption") {
    const p = item.payload as CaptionPayload;
    return (
      <div className="library-detail">
        <div className="library-detail-caption">{p.caption}</div>
        {p.reasoning && (
          <div className="library-detail-reasoning">{p.reasoning}</div>
        )}
        <div className="library-detail-meta">
          {p.platform && <span>{p.platform}</span>}
          {p.tone && <span>· {p.tone}</span>}
          {p.hook_type && <span>· {p.hook_type}</span>}
          {typeof p.score === "number" && <span>· {p.score}/100 match</span>}
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => onCopy(p.caption)}
        >
          <Copy size={14} /> Copy caption
        </button>
      </div>
    );
  }

  if (item.kind === "image") {
    const p = item.payload as ImagePayload;
    return (
      <div className="library-detail">
        {p.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.image_url}
            alt={p.rationale ?? ""}
            className="library-detail-image"
          />
        )}
        {p.rationale && (
          <p className="library-detail-rationale">{p.rationale}</p>
        )}
        {p.accompanying_caption && (
          <div className="library-detail-caption">{p.accompanying_caption}</div>
        )}
        <button
          type="button"
          className="btn-primary"
          onClick={() => onCopy(p.image_url)}
        >
          <Copy size={14} /> Copy image URL
        </button>
      </div>
    );
  }

  if (item.kind === "campaign") {
    const p = item.payload as CampaignPayload;
    return (
      <div className="library-detail">
        <h3 className="library-detail-bigidea">{p.big_idea}</h3>
        {p.arc && p.arc.length > 0 && (
          <div className="library-detail-arc">
            {p.arc.map((phase, i) => (
              <div key={i} className="library-detail-arc-phase">
                <strong>{phase.name}</strong>: {phase.description}
              </div>
            ))}
          </div>
        )}
        {p.risk && (
          <div className="library-detail-risk">
            <strong>Risk:</strong> {p.risk}
          </div>
        )}
        <button
          type="button"
          className="btn-primary"
          onClick={() => onCopy(JSON.stringify(p, null, 2))}
        >
          <Copy size={14} /> Copy as JSON
        </button>
      </div>
    );
  }

  if (item.kind === "press_release") {
    const p = item.payload as PressReleasePayload;
    return (
      <div className="library-detail">
        <h3 className="library-detail-bigidea">{p.headline}</h3>
        {p.subhead && (
          <p style={{ fontStyle: "italic", opacity: 0.75, margin: "4px 0 12px" }}>
            {p.subhead}
          </p>
        )}
        <pre className="press-markdown-block" style={{ maxHeight: 360 }}>
          {p.markdown}
        </pre>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onCopy(p.markdown)}
          >
            <Copy size={14} /> Copy Markdown
          </button>
          <button
            type="button"
            className="btn-ghost-sm"
            onClick={() => onCopy(p.plain_text)}
          >
            <Copy size={12} /> Copy plain text
          </button>
        </div>
      </div>
    );
  }

  return null;
}
