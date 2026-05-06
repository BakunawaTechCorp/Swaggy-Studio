import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/auth/role-server";
import { isAdminRole } from "@/lib/auth/role";
import { UserList } from "./UserList";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await getCurrentRole();
  if (!me) redirect("/login?redirectTo=/settings/users");
  if (!isAdminRole(me.role)) {
    return (
      <main className="canvas">
        <Link href="/settings" className="back-link">← Back to Settings</Link>
        <div className="settings-header">
          <h1 className="settings-title">User Management</h1>
          <p className="settings-subtitle">
            You don&apos;t have permission to view this page.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="canvas">
      <Link href="/settings" className="back-link">← Back to Settings</Link>
      <div className="settings-header">
        <h1 className="settings-title">User Management</h1>
        <p className="settings-subtitle">
          {me.role === "master"
            ? "Master controls. You can manage every account, assign roles, and remove users."
            : "Admin controls. You can manage non-master accounts."}
        </p>
      </div>
      <section className="settings-section">
        <UserList myRole={me.role} myUserId={me.user_id} />
      </section>
    </main>
  );
}
