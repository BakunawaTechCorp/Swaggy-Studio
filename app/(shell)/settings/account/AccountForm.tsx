"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";

type Initial = {
  email: string;
  email_confirmed: boolean;
  first_name: string;
  last_name: string;
  username: string;
};

export function AccountForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const { show } = useToast();

  const [firstName, setFirstName] = useState(initial.first_name);
  const [lastName, setLastName] = useState(initial.last_name);
  const [username, setUsername] = useState(initial.username);
  const [email, setEmail] = useState(initial.email);
  const [saving, setSaving] = useState(false);

  const dirty =
    firstName.trim() !== initial.first_name ||
    lastName.trim() !== initial.last_name ||
    username.trim() !== initial.username ||
    email.trim() !== initial.email;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || !dirty) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          username,
          email,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        email_update?: { pending?: boolean; message?: string };
      };
      if (!res.ok) {
        show(data.message ?? data.error ?? "Couldn't save. Please try again.", "error");
        return;
      }
      show(
        data.email_update?.pending
          ? (data.email_update.message ?? "Saved. Confirm your new email.")
          : "Profile updated.",
        "success"
      );
      // Refresh server data + nudge the rail to re-fetch profile.
      window.dispatchEvent(new Event("profile:changed"));
      router.refresh();
    } catch {
      show("Network error. Could not reach the server.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="acct-form" onSubmit={onSubmit}>
      <div className="acct-form-grid">
        <label className="acct-field">
          <span className="acct-field-label">First name</span>
          <input
            className="acct-input"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Jane"
            maxLength={60}
            disabled={saving}
          />
        </label>
        <label className="acct-field">
          <span className="acct-field-label">Last name</span>
          <input
            className="acct-input"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Doe"
            maxLength={60}
            disabled={saving}
          />
        </label>
      </div>

      <label className="acct-field">
        <span className="acct-field-label">Username</span>
        <input
          className="acct-input"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="janedoe"
          maxLength={24}
          autoComplete="username"
          disabled={saving}
        />
        <span className="acct-field-hint">
          3–24 characters. Letters, numbers, and underscores.
        </span>
      </label>

      <label className="acct-field">
        <span className="acct-field-label">
          Email
          {!initial.email_confirmed && initial.email && (
            <span className="acct-field-badge">Unverified</span>
          )}
        </span>
        <input
          className="acct-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          disabled={saving}
        />
        <span className="acct-field-hint">
          Changing your email will send a confirmation link to the new address.
        </span>
      </label>

      <div className="acct-form-foot">
        <button
          type="submit"
          className="btn-primary"
          disabled={saving || !dirty}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {dirty && !saving && (
          <span className="acct-dirty-hint">Unsaved changes</span>
        )}
      </div>
    </form>
  );
}
