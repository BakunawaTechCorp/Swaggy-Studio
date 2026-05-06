import { NextResponse } from "next/server";
import { getAdminSupabase, getCurrentRole } from "@/lib/auth/role-server";
import { isAdminRole, type UserRole } from "@/lib/auth/role";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminUserRow = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  credits_balance: number;
  unlimited_credits: boolean;
};

export async function GET() {
  const me = await getCurrentRole();
  if (!me || !isAdminRole(me.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = getAdminSupabase();

  // Page through Supabase auth users. The free tier returns up to 50 / page.
  // For now we cap at 1000 users which is plenty for this app.
  const all: Array<{
    id: string;
    email?: string | null;
    created_at?: string | null;
    last_sign_in_at?: string | null;
  }> = [];
  let page = 1;
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) {
      return NextResponse.json(
        { error: "list_failed", message: error.message },
        { status: 500 }
      );
    }
    all.push(...data.users);
    if (data.users.length < 100) break;
    page += 1;
  }

  const ids = all.map((u) => u.id);
  const { data: settings } = await admin
    .from("user_settings")
    .select(
      "user_id, role, first_name, last_name, username, credits_balance, unlimited_credits"
    )
    .in("user_id", ids);

  const byId = new Map(
    (settings ?? []).map((s) => [s.user_id as string, s])
  );

  const rows: AdminUserRow[] = all.map((u) => {
    const s = byId.get(u.id);
    return {
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at ?? null,
      last_sign_in_at: u.last_sign_in_at ?? null,
      role: (s?.role as UserRole) ?? "free",
      first_name: (s?.first_name as string | null) ?? null,
      last_name: (s?.last_name as string | null) ?? null,
      username: (s?.username as string | null) ?? null,
      credits_balance: (s?.credits_balance as number) ?? 0,
      unlimited_credits: Boolean(s?.unlimited_credits),
    };
  });

  rows.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));

  return NextResponse.json({ users: rows, me });
}
