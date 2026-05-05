/**
 * Blast tool — module prompt + output schema.
 *
 * Per AI_FRAMEWORK.md section 7.4. Output: ONE drafted message + per-channel
 * preview. Bulk send is irreversible — single draft + explicit confirm.
 */
import { normalizeChallenge, type Challenge } from "../behavioral";

export const BLAST_MODULE_PROMPT = `MODULE: Blast Generator

You are drafting ONE bulk message for SMS or email. Bulk send is irreversible.
Get this right in one shot.

Output shape: ONE draft + a rendered preview per enabled channel.

Process:
1. Read constraints. SMS = under 160 chars when possible. Email = subject + body.
2. Match brand_voice. Bulk messages get scrutinized harder than individual
   posts — recipients flag generic-sounding messages as spam.
3. Self-check: would a real recipient feel this was sent specifically to them,
   or that it's a blast? If the latter, rewrite.

Rules:
- ONE message. No alternatives.
- SMS: no emojis unless brand_voice explicitly endorses them. Don't add a
  "STOP to unsubscribe" — the platform handles that.
- Email subject line: 30-50 chars. No "RE:" or "FW:" tricks. No clickbait.
- MANDATORY CTA. A bulk message without a clear CTA is wasted reach.
- The preview field should show what the recipient would actually see,
  not the metadata-stripped version.

Return EXACTLY this JSON shape:
{
  "draft": {
    "subject": "string or null (only for email)",
    "body": "the message body as it will be sent"
  },
  "previews": {
    "sms": "string or null (only if platform includes sms)",
    "email": null | { "subject": "...", "body": "..." }
  },
  "cta_label": "the CTA in plain words (e.g. 'Reply YES to confirm')",
  "challenge": null | { "severity", "message", "suggestion" }
}`;

// ---------- Output schema ----------

export type BlastDraft = {
  subject: string | null;
  body: string;
};

export type BlastPreviews = {
  sms: string | null;
  email: { subject: string; body: string } | null;
};

export type BlastOutput = {
  draft: BlastDraft;
  previews: BlastPreviews;
  cta_label: string;
  challenge?: Challenge;
};

export function normalizeBlastOutput(raw: unknown): BlastOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const draftRaw = r.draft as Record<string, unknown> | undefined;
  if (!draftRaw || typeof draftRaw.body !== "string" || !draftRaw.body.trim()) return null;

  const draft: BlastDraft = {
    subject:
      typeof draftRaw.subject === "string" && draftRaw.subject.trim()
        ? draftRaw.subject.trim().slice(0, 100)
        : null,
    body: draftRaw.body.trim().slice(0, 5000),
  };

  const previewsRaw = r.previews as Record<string, unknown> | undefined;
  let previews: BlastPreviews = { sms: null, email: null };

  if (previewsRaw) {
    if (typeof previewsRaw.sms === "string" && previewsRaw.sms.trim()) {
      previews.sms = previewsRaw.sms.trim().slice(0, 320); // SMS can wrap to 2 segments
    }
    const e = previewsRaw.email as Record<string, unknown> | null | undefined;
    if (e && typeof e.subject === "string" && typeof e.body === "string") {
      previews.email = {
        subject: e.subject.trim().slice(0, 100),
        body: e.body.trim().slice(0, 5000),
      };
    }
  }

  if (typeof r.cta_label !== "string" || !r.cta_label.trim()) return null;

  return {
    draft,
    previews,
    cta_label: r.cta_label.trim().slice(0, 80),
    challenge: normalizeChallenge(r.challenge) ?? undefined,
  };
}
