import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountForm } from "./AccountForm";
import { SignOutButton } from "./SignOutButton";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/settings/account");

  const { data: settings } = await supabase
    .from("user_settings")
    .select(
      "first_name, last_name, username, credits_balance, unlimited_credits, is_master"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const memberSince = new Date(user.created_at ?? Date.now()).toLocaleDateString(
    undefined,
    { year: "numeric", month: "long", day: "numeric" }
  );

  return (
    <main className="canvas">
      <div className="settings-header">
        <h1 className="settings-title">Account</h1>
        <p className="settings-subtitle">Update your profile and sign-in details.</p>
      </div>

      <section className="settings-section">
        <AccountForm
          initial={{
            email: user.email ?? "",
            email_confirmed: Boolean(user.email_confirmed_at),
            first_name: settings?.first_name ?? "",
            last_name: settings?.last_name ?? "",
            username: settings?.username ?? "",
          }}
        />
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Account info</h2>
        <div className="acct-meta">
          <div className="acct-meta-row">
            <span className="acct-meta-label">User ID</span>
            <span className="acct-meta-value mono">{user.id}</span>
          </div>
          <div className="acct-meta-row">
            <span className="acct-meta-label">Member since</span>
            <span className="acct-meta-value">{memberSince}</span>
          </div>
          <div className="acct-meta-row">
            <span className="acct-meta-label">Credits</span>
            <span className="acct-meta-value">
              {settings?.unlimited_credits
                ? "Unlimited"
                : `${settings?.credits_balance ?? 0} credits`}
            </span>
          </div>
          {settings?.is_master && (
            <div className="acct-meta-row">
              <span className="acct-meta-label">Plan</span>
              <span className="acct-meta-value">Master account</span>
            </div>
          )}
        </div>
      </section>

      <section className="settings-section">
        <SignOutButton />
      </section>
    </main>
  );
}
