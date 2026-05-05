"use client";

import { useState } from "react";
import { defaultScheduleLocal, localToIso } from "../_lib/utils";

export function ScheduleModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (iso: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState(() => defaultScheduleLocal());
  const [saving, setSaving] = useState(false);

  async function confirm() {
    const iso = localToIso(value);
    if (!iso) return;
    setSaving(true);
    try {
      await onConfirm(iso);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-xl">Schedule this post</h3>
        <p className="mt-1 text-xs text-white/50">
          Pick when it should go live.
        </p>
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-4 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:border-white/25 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={saving}
            className="rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow disabled:opacity-60"
          >
            {saving ? "Scheduling…" : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
