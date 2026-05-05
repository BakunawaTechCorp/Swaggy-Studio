"use client";

import { useState } from "react";
import { Copy, FileText, Type } from "lucide-react";
import { useToast } from "@/components/toast";
import type { PressResult } from "./PressTool";

type Props = { result: PressResult };

export function PressPreview({ result }: Props) {
  const { show } = useToast();
  const [view, setView] = useState<"rendered" | "markdown">("rendered");

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(
      () => show(`Copied ${label}.`, "success"),
      () => show("Couldn't copy.", "error")
    );
  }

  const dateString = new Date(
    result.dateline_date + "T12:00:00Z"
  ).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const datelineFormatted = `${result.dateline_city.toUpperCase()} — ${dateString}`;

  return (
    <div className="press-preview">
      <div className="press-preview-toolbar">
        <div className="press-view-toggle">
          <button
            type="button"
            className={`press-view-btn ${view === "rendered" ? "is-active" : ""}`}
            onClick={() => setView("rendered")}
          >
            <FileText size={14} /> Preview
          </button>
          <button
            type="button"
            className={`press-view-btn ${view === "markdown" ? "is-active" : ""}`}
            onClick={() => setView("markdown")}
          >
            <Type size={14} /> Markdown
          </button>
        </div>
        <div className="press-copy-row">
          <button
            type="button"
            className="btn-ghost-sm"
            onClick={() => copy(result.markdown, "as Markdown")}
          >
            <Copy size={12} /> Copy Markdown
          </button>
          <button
            type="button"
            className="btn-ghost-sm"
            onClick={() => copy(result.plain_text, "as plain text")}
          >
            <Copy size={12} /> Copy plain text
          </button>
        </div>
      </div>

      {view === "rendered" ? (
        <article className="press-rendered">
          <p className="press-r-immediate">
            <strong>FOR IMMEDIATE RELEASE</strong>
          </p>
          <h1 className="press-r-headline">{result.headline}</h1>
          {result.subhead && (
            <p className="press-r-subhead">{result.subhead}</p>
          )}
          <p className="press-r-lede">
            <strong>{datelineFormatted}</strong> — {result.lede}
          </p>
          {result.body_paragraphs.map((p, i) => (
            <p key={i} className="press-r-body">
              {p}
            </p>
          ))}
          {result.quote && (
            <blockquote className="press-r-quote">
              &ldquo;{result.quote.text}&rdquo;
              <footer>— {result.quote.attribution}</footer>
            </blockquote>
          )}
          <h3 className="press-r-section">About</h3>
          <p className="press-r-boilerplate">{result.boilerplate}</p>
          <h3 className="press-r-section">Media Contact</h3>
          <p className="press-r-contact">
            {result.contact.name}
            <br />
            <a href={`mailto:${result.contact.email}`}>
              {result.contact.email}
            </a>
            {result.contact.phone && (
              <>
                <br />
                {result.contact.phone}
              </>
            )}
          </p>
          <p className="press-r-end">###</p>
        </article>
      ) : (
        <pre className="press-markdown-block">{result.markdown}</pre>
      )}
    </div>
  );
}
