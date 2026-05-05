import { NextResponse } from "next/server";
import { FB_GRAPH } from "@/lib/facebook";
import { observeApiRoute } from "@/lib/observability";

export const runtime = "nodejs";

type Check = {
  ok: boolean;
  detail?: string;
};

async function handleGet() {
  const checks = {
    db: await checkSupabaseRest(),
    anthropic: checkConfigured("ANTHROPIC_API_KEY"),
    facebook: await checkFacebookGraph(),
  };

  const ok = Object.values(checks).every((check) => check.ok);

  return NextResponse.json(
    {
      ok,
      checks,
      at: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}

async function checkSupabaseRest(): Promise<Check> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { ok: false, detail: "missing_supabase_env" };

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
      headers: { apikey: key },
      cache: "no-store",
    });
    return {
      ok: res.status < 500,
      detail: `status_${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : "supabase_unreachable",
    };
  }
}

function checkConfigured(name: string): Check {
  return process.env[name]
    ? { ok: true, detail: "configured" }
    : { ok: false, detail: `missing_${name.toLowerCase()}` };
}

async function checkFacebookGraph(): Promise<Check> {
  if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
    return { ok: false, detail: "missing_facebook_env" };
  }

  try {
    const res = await fetch(FB_GRAPH, { cache: "no-store" });
    return {
      ok: res.status < 500,
      detail: `status_${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : "facebook_unreachable",
    };
  }
}

export const GET = observeApiRoute("/api/health", handleGet);
