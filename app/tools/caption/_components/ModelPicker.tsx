"use client";

// Re-export shared picker so caption pages keep working.
import { ModelPicker as Shared } from "@/components/ai/ModelPicker";
import type { ActiveModelId } from "@/lib/credits/costs";

export function ModelPicker({
  value,
  onChange,
}: {
  value: ActiveModelId;
  onChange: (m: ActiveModelId) => void;
}) {
  return <Shared value={value} onChange={onChange} tool="caption" />;
}
