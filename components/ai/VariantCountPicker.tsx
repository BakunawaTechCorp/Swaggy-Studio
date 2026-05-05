"use client";

export type VariantCount = 1 | 2 | 3 | 4;

type Props = {
  value: VariantCount;
  onChange: (n: VariantCount) => void;
  max?: VariantCount;
};

export function VariantCountPicker({ value, onChange, max = 4 }: Props) {
  const options = ([1, 2, 3, 4] as VariantCount[]).slice(0, max) as VariantCount[];
  return (
    <div className="variant-count-picker">
      <div className="variant-count-row">
        {options.map((n) => (
          <button
            key={n}
            type="button"
            className={`variant-count-pill ${value === n ? "is-active" : ""}`}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
