"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2, Search } from "lucide-react";
import { useToast } from "@/components/toast";
import { ALL_ROLES, ROLE_LABEL, type UserRole } from "@/lib/auth/role";

type AdminUser = {
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

type Props = {
  myRole: UserRole;
  myUserId: string;
};

const ROLE_BADGE_CLASS: Record<UserRole, string> = {
  master: "role-badge role-master",
  admin: "role-badge role-admin",
  premium: "role-badge role-premium",
  trial: "role-badge role-trial",
  free: "role-badge role-free",
};

export function UserList({ myRole, myUserId }: Props) {
  const { show } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { users: AdminUser[] };
      setUsers(json.users);
    } catch {
      show("Couldn't load users.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function changeRole(target: AdminUser, role: UserRole) {
    if (role === target.role) return;
    setSavingId(target.id);
    try {
      const res = await fetch(`/api/admin/users/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        show(json.message ?? json.error ?? "Couldn't update role.", "error");
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, role } : u))
      );
      show(`Role set to ${ROLE_LABEL[role]}.`, "success");
    } catch {
      show("Network error.", "error");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteUser(target: AdminUser) {
    setSavingId(target.id);
    try {
      const res = await fetch(`/api/admin/users/${target.id}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        show(json.message ?? json.error ?? "Couldn't delete user.", "error");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== target.id));
      show(`Deleted ${target.email ?? "user"}.`, "success");
    } catch {
      show("Network error.", "error");
    } finally {
      setSavingId(null);
      setConfirmDeleteId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const hay = [
        u.email,
        u.username,
        u.first_name,
        u.last_name,
        u.role,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [users, filter]);

  if (loading) {
    return <p className="muted">Loading users…</p>;
  }

  return (
    <div className="user-mgmt">
      <div className="user-mgmt-toolbar">
        <div className="user-mgmt-search">
          <Search size={14} />
          <input
            type="search"
            placeholder="Search email, username, name…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <span className="muted user-mgmt-count">
          {filtered.length} of {users.length}
        </span>
      </div>

      <div className="user-mgmt-list">
        {filtered.map((u) => {
          const isSelf = u.id === myUserId;
          const isMasterRow = u.role === "master";
          const canChangeRole =
            !isSelf &&
            (myRole === "master" || (!isMasterRow && myRole === "admin"));
          const canDelete =
            !isSelf &&
            (myRole === "master" || (!isMasterRow && myRole === "admin"));

          const fullName =
            [u.first_name, u.last_name].filter(Boolean).join(" ") || null;

          return (
            <div key={u.id} className="user-row">
              <div className="user-row-main">
                <div className="user-row-id">
                  <div className="user-row-email">
                    {u.email ?? "—"}
                    {isSelf && <span className="user-row-self">(you)</span>}
                  </div>
                  <div className="user-row-sub">
                    {fullName && <span>{fullName}</span>}
                    {u.username && <span>@{u.username}</span>}
                    <span className="muted">
                      {u.unlimited_credits
                        ? "Unlimited credits"
                        : `${u.credits_balance} credits`}
                    </span>
                    {u.last_sign_in_at && (
                      <span className="muted">
                        last seen {formatRelative(u.last_sign_in_at)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="user-row-actions">
                <span className={ROLE_BADGE_CLASS[u.role]}>
                  {ROLE_LABEL[u.role]}
                </span>

                {canChangeRole ? (
                  <select
                    className="user-role-select"
                    value={u.role}
                    onChange={(e) =>
                      changeRole(u, e.target.value as UserRole)
                    }
                    disabled={savingId === u.id}
                  >
                    {ALL_ROLES.map((r) => {
                      // Admins can't grant master.
                      if (r === "master" && myRole !== "master") return null;
                      return (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <span className="muted user-role-locked">
                    {isSelf ? "Self" : "Locked"}
                  </span>
                )}

                {canDelete && (
                  <button
                    type="button"
                    className="btn-icon-danger"
                    title="Delete user"
                    disabled={savingId === u.id}
                    onClick={() => setConfirmDeleteId(u.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {confirmDeleteId === u.id && (
                <div className="user-row-confirm">
                  <span>
                    Permanently delete <strong>{u.email}</strong>? This
                    removes their account, library, and credits.
                  </span>
                  <div className="user-row-confirm-actions">
                    <button
                      type="button"
                      className="btn-ghost-sm"
                      onClick={() => setConfirmDeleteId(null)}
                      disabled={savingId === u.id}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-danger-sm"
                      onClick={() => deleteUser(u)}
                      disabled={savingId === u.id}
                    >
                      {savingId === u.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="muted">No users match.</p>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
