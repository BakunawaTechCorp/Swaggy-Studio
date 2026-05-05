import type { PlatformId, PostTypeId } from "../_lib/types";
import { PLATFORMS } from "../_lib/constants";

export function PlatformPicker({
  platform,
  setPlatform,
  postType,
  setPostType,
}: {
  platform: PlatformId;
  setPlatform: (v: PlatformId) => void;
  postType: PostTypeId;
  setPostType: (v: PostTypeId) => void;
}) {
  const currentPlatform = PLATFORMS.find((p) => p.id === platform)!;

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <Dropdown
        label="Platform"
        value={platform}
        onChange={(v) => setPlatform(v as PlatformId)}
        options={PLATFORMS.map((p) => ({ value: p.id, label: p.label }))}
      />
      <Dropdown
        label="Post type"
        value={postType}
        onChange={(v) => setPostType(v as PostTypeId)}
        options={currentPlatform.postTypes.map((t) => ({
          value: t.id,
          label: t.label,
        }))}
      />
    </div>
  );
}

function Dropdown({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-white/50">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full appearance-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='%23888' d='M5 6L0 0h10z'/></svg>\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 10px center",
          paddingRight: 28,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-bg-card text-white">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
