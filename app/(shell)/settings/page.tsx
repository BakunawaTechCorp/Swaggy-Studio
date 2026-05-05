import { ConnectionsView } from "../connections/ConnectionsView";

export default function SettingsPage() {
  return (
    <main className="canvas">
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-subtitle">
          Manage your connected accounts and workspace preferences.
        </p>
      </div>

      <section className="settings-section">
        <h2 className="settings-section-title">Connected accounts</h2>
        <p className="settings-section-sub">
          Link the social accounts you publish to.
        </p>
        <ConnectionsView />
      </section>
    </main>
  );
}
