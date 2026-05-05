import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { observeApiRoute, type ApiRequestContext } from "@/lib/observability";
import { requireSameOrigin } from "@/lib/security";
import { spendOrFail, refund } from "@/lib/credits/spend";
import { ACTIVE_MODELS, type ActiveModelId } from "@/lib/credits/costs";

export const runtime = "nodejs";
export const maxDuration = 30;

const VALID_MODELS = new Set<ActiveModelId>(ACTIVE_MODELS);

// Anthropic API string mapping (matches the rest of the app).
const ANTHROPIC_MODEL_MAP: Record<string, string> = {
  "claude-haiku-4-5": "claude-haiku-4-5",
  "claude-sonnet-4-7": "claude-sonnet-4-5-20250929",
};

type PressOutput = {
  headline: string;
  subhead: string | null;
  lede: string;
  body_paragraphs: string[];
  quote: { text: string; attribution: string } | null;
};

function extractJson<T>(text: string): T | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    const f = candidate.indexOf("{");
    const l = candidate.lastIndexOf("}");
    if (f !== -1 && l > f) {
      try {
        return JSON.parse(candidate.slice(f, l + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function buildSystemPrompt(args: {
  companyName: string;
  includeQuote: boolean;
  spokesperson: string;
  spokespersonTitle: string;
}) {
  return `You are an experienced press release writer. You write in standard PR Newswire format.

Rules — read carefully:
- The brief is INSTRUCTIONS, not text to include verbatim. Synthesize fresh copy.
- Headline: 8-15 words, punchy, present tense, no exclamation marks. Title Case.
- Subhead (optional): 12-25 words, expands on the headline angle.
- Lede paragraph: 35-60 words. Answers who/what/when/where/why in journalist terms. Mentions the company name (${args.companyName}).
- Body paragraphs (2-4): each 50-90 words. Add color, context, market positioning, supporting facts. Concrete details only — no marketing fluff.
- ${args.includeQuote ? `Quote: 25-50 words from ${args.spokesperson} (${args.spokespersonTitle}). Sounds like an actual person speaking, not corporate-speak. The quote ATTRIBUTION must be exactly: ${args.spokesperson}, ${args.spokespersonTitle} of ${args.companyName}.` : `Do NOT include a quote in this release.`}

Critical: Do NOT include FOR IMMEDIATE RELEASE, dateline, boilerplate, contact info, or end marker. The app composes those. You only write the journalistic body content.

Return EXACTLY this JSON (no prose, no fences):
{
  "headline": "Title Case headline 8-15 words",
  "subhead": "Subhead string OR null",
  "lede": "first paragraph",
  "body_paragraphs": ["paragraph 2", "paragraph 3", "paragraph 4 if needed"],
  "quote": ${args.includeQuote ? `{ "text": "the quote", "attribution": "${args.spokesperson}, ${args.spokespersonTitle} of ${args.companyName}" }` : "null"}
}`;
}

async function handlePost(request: Request, context: ApiRequestContext) {
  const csrfError = requireSameOrigin(request);
  if (csrfError) return csrfError;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  context.userId = user.id;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "server_misconfigured", reason: "ANTHROPIC_API_KEY missing" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;

  // Required
  const brief =
    typeof input.brief === "string" ? input.brief.trim().slice(0, 2000) : "";
  const companyName =
    typeof input.company_name === "string"
      ? input.company_name.trim().slice(0, 120)
      : "";
  const datelineCity =
    typeof input.dateline_city === "string"
      ? input.dateline_city.trim().slice(0, 60)
      : "";
  const contactName =
    typeof input.contact_name === "string"
      ? input.contact_name.trim().slice(0, 80)
      : "";
  const contactEmail =
    typeof input.contact_email === "string"
      ? input.contact_email.trim().slice(0, 120)
      : "";

  if (!brief)
    return NextResponse.json(
      { error: "missing_field", field: "brief" },
      { status: 400 }
    );
  if (!companyName)
    return NextResponse.json(
      { error: "missing_field", field: "company_name" },
      { status: 400 }
    );
  if (!datelineCity)
    return NextResponse.json(
      { error: "missing_field", field: "dateline_city" },
      { status: 400 }
    );
  if (!contactName)
    return NextResponse.json(
      { error: "missing_field", field: "contact_name" },
      { status: 400 }
    );
  if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return NextResponse.json(
      { error: "invalid_field", field: "contact_email" },
      { status: 400 }
    );
  }

  // Optional
  const subheadHint =
    typeof input.subhead_hint === "string"
      ? input.subhead_hint.trim().slice(0, 200)
      : "";
  const datelineDate =
    typeof input.dateline_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(input.dateline_date)
      ? input.dateline_date
      : new Date().toISOString().slice(0, 10);
  const includeQuote = input.include_quote !== false; // default true
  const spokesperson =
    typeof input.spokesperson === "string"
      ? input.spokesperson.trim().slice(0, 80)
      : contactName;
  const spokespersonTitle =
    typeof input.spokesperson_title === "string"
      ? input.spokesperson_title.trim().slice(0, 80)
      : "Founder";
  const boilerplate =
    typeof input.boilerplate === "string" && input.boilerplate.trim()
      ? input.boilerplate.trim().slice(0, 1000)
      : `About ${companyName}: [Add a 1-2 sentence company description here.]`;
  const contactPhone =
    typeof input.contact_phone === "string"
      ? input.contact_phone.trim().slice(0, 30)
      : "";

  // Model
  const rawModel =
    typeof input.model === "string" ? input.model : "claude-sonnet-4-7";
  if (!VALID_MODELS.has(rawModel as ActiveModelId)) {
    return NextResponse.json({ error: "invalid_model" }, { status: 400 });
  }
  const model = rawModel as ActiveModelId;
  // Press only uses text models.
  if (model !== "claude-haiku-4-5" && model !== "claude-sonnet-4-7") {
    return NextResponse.json(
      { error: "invalid_model", reason: "Press release requires a text model." },
      { status: 400 }
    );
  }

  // Spend
  const spend = await spendOrFail("caption", {
    model,
    metadata: { tool: "press_release", company: companyName.slice(0, 60) },
  });
  if (!spend.ok) return spend.response;

  // Generate
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const systemPrompt = buildSystemPrompt({
    companyName,
    includeQuote,
    spokesperson,
    spokespersonTitle,
  });

  const userMessage =
    `BRIEF (interpret as instructions, do not echo verbatim):\n\n` +
    `"${brief}"\n\n` +
    `COMPANY: ${companyName}\n` +
    (subheadHint ? `SUBHEAD ANGLE HINT: ${subheadHint}\n` : "") +
    `\nGenerate the press release body content now. Return ONLY the JSON.`;

  try {
    const message = await anthropic.messages.create({
      model: ANTHROPIC_MODEL_MAP[model],
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const firstText = message.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    if (!firstText) {
      await refund("caption", { model });
      return NextResponse.json(
        { error: "malformed_response" },
        { status: 502 }
      );
    }

    const parsed = extractJson<PressOutput>(firstText.text);
    if (
      !parsed?.headline ||
      !parsed.lede ||
      !Array.isArray(parsed.body_paragraphs)
    ) {
      await refund("caption", { model });
      return NextResponse.json(
        { error: "malformed_response" },
        { status: 502 }
      );
    }

    const dateString = new Date(datelineDate + "T12:00:00Z").toLocaleDateString(
      "en-US",
      { month: "long", day: "numeric", year: "numeric" }
    );
    const datelineFormatted = `${datelineCity.toUpperCase()} — ${dateString}`;

    const composeArgs: ComposeArgs = {
      datelineFormatted,
      headline: parsed.headline,
      subhead: parsed.subhead,
      lede: parsed.lede,
      body_paragraphs: parsed.body_paragraphs,
      quote: parsed.quote,
      boilerplate,
      companyName,
      contactName,
      contactEmail,
      contactPhone,
    };

    const markdown = composeMarkdown(composeArgs);
    const plainText = composePlain(composeArgs);

    return NextResponse.json(
      {
        format: "newswire",
        headline: parsed.headline,
        subhead: parsed.subhead ?? null,
        dateline_city: datelineCity,
        dateline_date: datelineDate,
        lede: parsed.lede,
        body_paragraphs: parsed.body_paragraphs,
        quote: parsed.quote ?? null,
        boilerplate,
        contact: {
          name: contactName,
          email: contactEmail,
          phone: contactPhone || undefined,
        },
        end_marker: "###",
        markdown,
        plain_text: plainText,
      },
      {
        headers: {
          "X-Credits-Balance": String(spend.newBalance),
          "X-Credits-Cost": String(spend.cost),
        },
      }
    );
  } catch (err) {
    console.error("[tools.press]", err);
    await refund("caption", { model });
    return NextResponse.json(
      {
        error: "ai_unavailable",
        reason: "Couldn't generate the press release. Try again.",
      },
      { status: 502 }
    );
  }
}

// ---- Composers ----

type ComposeArgs = {
  datelineFormatted: string;
  headline: string;
  subhead: string | null;
  lede: string;
  body_paragraphs: string[];
  quote: { text: string; attribution: string } | null;
  boilerplate: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

function composeMarkdown(a: ComposeArgs): string {
  const lines: string[] = [];
  lines.push("**FOR IMMEDIATE RELEASE**");
  lines.push("");
  lines.push(`# ${a.headline}`);
  if (a.subhead) lines.push(`### ${a.subhead}`);
  lines.push("");
  lines.push(`**${a.datelineFormatted}** — ${a.lede}`);
  lines.push("");
  for (const p of a.body_paragraphs) {
    lines.push(p);
    lines.push("");
  }
  if (a.quote) {
    lines.push(`> "${a.quote.text}"`);
    lines.push(`> — ${a.quote.attribution}`);
    lines.push("");
  }
  lines.push(`**About ${a.companyName}**`);
  lines.push(a.boilerplate);
  lines.push("");
  lines.push("**Media Contact**");
  lines.push(a.contactName);
  lines.push(a.contactEmail);
  if (a.contactPhone) lines.push(a.contactPhone);
  lines.push("");
  lines.push("###");
  return lines.join("\n");
}

function composePlain(a: ComposeArgs): string {
  const lines: string[] = [];
  lines.push("FOR IMMEDIATE RELEASE");
  lines.push("");
  lines.push(a.headline.toUpperCase());
  if (a.subhead) lines.push(a.subhead);
  lines.push("");
  lines.push(`${a.datelineFormatted} — ${a.lede}`);
  lines.push("");
  for (const p of a.body_paragraphs) {
    lines.push(p);
    lines.push("");
  }
  if (a.quote) {
    lines.push(`"${a.quote.text}"`);
    lines.push(`— ${a.quote.attribution}`);
    lines.push("");
  }
  lines.push(`About ${a.companyName}`);
  lines.push(a.boilerplate);
  lines.push("");
  lines.push("Media Contact");
  lines.push(a.contactName);
  lines.push(a.contactEmail);
  if (a.contactPhone) lines.push(a.contactPhone);
  lines.push("");
  lines.push("###");
  return lines.join("\n");
}

export const POST = observeApiRoute("/api/tools/press", handlePost);
