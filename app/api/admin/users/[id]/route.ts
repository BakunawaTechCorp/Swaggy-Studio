import { NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/security";
import { getAdminSupabase, getCurrentRole } from "@/lib/auth/role-server";
import { isAdminRole, isValidRole, type UserRole } from "@/lib/auth/role";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MASTER_EMAIL = "bakunawatechcorp@gmail.com";

async function authorize() {
  const me = await getCurrentRole();
  if (!me || !isAdminRole(me.role)) {
    return {
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
      me: null,
    };
  }
  return { response: null, me };
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const blocked = requireSameOrigin(request);
  if (blocked) return blocked;

  const { response, me } = await authorize();
  if (response) return response;

  const targetId = params.id;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const newRole = body.role;
  if (!isValidRole(newRole)) {
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });
  }

  const admin = getAdminSupabase();

  // Look up the target's current role + email so we can enforce hierarchy.
  const { data: targetUser } = await admin.auth.admin.getUserById(targetId);
  if (!targetUser?.user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }
  const targetEmail = targetUser.user.email?.toLowerCase() ?? null;

  const { data: targetSettings } = await admin
    .from("user_settings")
    .select("role")
    .eq("user_id", targetId)
    .maybeSingle();
  const targetRole = (targetSettings?.role as UserRole) ?? "free";

  // Hard rule: nobody (not even master) can demote the bootstrap master
  // through this API. Prevents accidental lockout.
  if (targetEmail === MASTER_EMAIL && newRole !== "master") {
    return NextResponse.json(
      { error: "cannot_demote_master", message: "The bootstrap master role is locked." },
      { status: 403 }
    );
  }

  // Only the master can promote anyone TO master, and only the master can
  // change another master's role.
  if (newRole === "master" && me!.role !== "master") {
    return NextResponse.json(
      { error: "master_only", message: "Only the master can grant master role." },
      { status: 403 }
    );
  }
  if (targetRole === "master" && me!.role !== "master") {
    return NextResponse.json(
      { error: "master_only", message: "Only the master can change a master's role." },
      { status: 403 }
    );
  }

  const isMasterRole = newRole === "master";
  const { error } = await admin
    .from("user_settings")
    .upsert(
      {
        user_id: targetId,
        role: newRole,
        is_master: isMasterRole,
        unlimited_credits: isMasterRole ? true : undefined,
      },
      { onConflict: "user_id" }
    );

  if (error) {
    return NextResponse.json(
      { error: "update_failed", message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, role: newRole });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const blocked = requireSameOrigin(request);
  if (blocked) return blocked;

  const { response, me } = await authorize();
  if (response) return response;

  const targetId = params.id;
  const admin = getAdminSupabase();

  // Prevent deleting yourself or the master.
  if (targetId === me!.user_id) {
    return NextResponse.json(
      { error: "cannot_delete_self" },
      { status: 400 }
    );
  }

  const { data: targetUser } = await admin.auth.admin.getUserById(targetId);
  if (!targetUser?.user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }
  const targetEmail = targetUser.user.email?.toLowerCase() ?? null;
  if (targetEmail === MASTER_EMAIL) {
    return NextResponse.json(
      { error: "cannot_delete_master" },
      { status: 403 }
    );
  }

  const { data: targetSettings } = await admin
    .from("user_settings")
    .select("role")
    .eq("user_id", targetId)
    .maybeSingle();
  const targetRole = (targetSettings?.role as UserRole) ?? "free";

  // Only the master can delete other masters.
  if (targetRole === "master" && me!.role !== "master") {
    return NextResponse.json(
      { error: "master_only" },
      { status: 403 }
    );
  }

  const { error } = await admin.auth.admin.deleteUser(targetId);
  if (error) {
    return NextResponse.json(
      { error: "delete_failed", message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
