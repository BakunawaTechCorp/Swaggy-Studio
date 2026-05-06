import Link from "next/link";
import { Shield, User as UserIcon, Link2 } from "lucide-react";
import { getCurrentRole } from "@/lib/auth/role-server";
import { isAdminRole, ROLE_LABEL } from "@/lib/auth/role";
import { ConnectionsView } from "../connections/ConnectionsView";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await getCurrentRole();
  const showAdmin = me ? isAdminRole(me.role) : false;

  return (
    <main className="canvas">
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-subtitle">
          Manage your account, connected services, and workspace preferences.
        </p>
      </div>

      <section className="settings-section">
        <div className="settings-tile-grid">
          <Link href="/settings/account" className="settings-tile">
            <div className="settings-tile-icon">
              <UserIcon size={18} />
            </div>
            <div>
              <div className="settings-tile-title">Account</div>
              <div className="settings-tile-sub">
                Profile, email, and password
              </div>
            </div>
            {me && (
              <span className={`role-badge role-${me.role}`}>
                {ROLE_LABEL[me.role]}
              </span>
            )}
          </Link>

          {showAdmin && (
            <Link href="/settings/users" className="settings-tile">
              <div className="settings-tile-icon">
                <Shield size={18} />
              </div>
              <div>
                <div className="settings-tile-title">User Management</div>
                <div className="settings-tile-sub">
                  View, assign roles, remove users
                </div>
              </div>
              <span className="role-badge role-admin">Admin</span>
            </Link>
          )}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">
          <Link2 size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
          Connected accounts
        </h2>
        <p className="settings-section-sub">
          Link the social accounts you publish to.
        </p>
        <ConnectionsView />
      </section>
    </main>
  );
}
