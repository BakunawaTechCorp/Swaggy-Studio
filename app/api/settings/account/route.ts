import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USERNAME_RE = /^[a-z0-9_]{3,24}$/i;

function trimToNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: settings } = await supabase
    .from("user_settings")
    .select("first_name, last_name, username, credits_balance, unlimited_credits, is_master")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    email: user.email ?? null,
    email_confirmed: Boolean(user.email_confirmed_at),
    first_name: settings?.first_name ?? null,
    last_name: settings?.last_name ?? null,
    username: settings?.username ?? null,
    credits_balance: settings?.credits_balance ?? 0,
    unlimited_credits: Boolean(settings?.unlimited_credits),
    is_master: Boolean(settings?.is_master),
    user_id: user.id,
    member_since: user.created_at ?? null,
  });
}

export async function PATCH(request: Request) {
  const blocked = requireSameOrigin(request);
  if (blocked) return blocked;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const firstName = trimToNull(body.first_name);
  const lastName = trimToNull(body.last_name);
  const username = trimToNull(body.username);
  const email = trimToNull(body.email);

  if (firstName && firstName.length > 60) {
    return NextResponse.json({ error: "first_name_too_long" }, { status: 400 });
  }
  if (lastName && lastName.length > 60) {
    return NextResponse.json({ error: "last_name_too_long" }, { status: 400 });
  }
  if (username && !USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: "invalid_username", message: "Use 3–24 letters, numbers, or underscores." },
      { status: 400 }
    );
  }

  // Username uniqueness pre-check (case-insensitive). The DB unique index is
  // the source of truth — this just gives a friendlier error.
  if (username) {
    const { data: clash } = await supabase
      .from("user_settings")
      .select("user_id")
      .ilike("username", username)
      .neq("user_id", user.id)
      .maybeSingle();
    if (clash) {
      return NextResponse.json(
        { error: "username_taken", message: "That username is already in use." },
        { status: 409 }
      );
    }
  }

  const { error: upsertErr } = await supabase
    .from("user_settings")
    .upsert(
      {
        user_id: user.id,
        first_name: firstName,
        last_name: lastName,
        username,
      },
      { onConflict: "user_id" }
    );

  if (upsertErr) {
    if (upsertErr.code === "23505") {
      return NextResponse.json(
        { error: "username_taken", message: "That username is already in use." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "save_failed", message: upsertErr.message },
      { status: 500 }
    );
  }

  // Mirror the display name into auth user_metadata so Rail / greetings stay
  // in sync with what the user just typed.
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || null;
  await supabase.auth.updateUser({
    data: { full_name: fullName, username },
  });

  let emailUpdate: { pending?: boolean; message?: string } | undefined;
  if (email && email !== user.email) {
    const { error: emailErr } = await supabase.auth.updateUser({ email });
    if (emailErr) {
      return NextResponse.json(
        { error: "email_update_failed", message: emailErr.message },
        { status: 400 }
      );
    }
    emailUpdate = {
      pending: true,
      message: "Confirmation email sent. Check your inbox to finish the change.",
    };
  }

  return NextResponse.json({
    ok: true,
    first_name: firstName,
    last_name: lastName,
    username,
    email_update: emailUpdate,
  });
}
