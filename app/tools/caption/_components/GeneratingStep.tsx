"use client";

import { useEffect, useState } from "react";
import { truncate } from "../_lib/utils";

const STAGES = [
  "Reading the brief…",
  "Picking 4 different angles…",
  "Drafting hooks…",
  "Polishing for voice and rhythm…",
  "Almost there…",
];

export function GeneratingStep({ prompt }: { prompt: string }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStage((s) => (s + 1) % STAGES.length);
    }, 1400);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="generating-screen">
      <div className="generating-orb">
        <span className="generating-orb-spark">✦</span>
      </div>

      <h2 className="generating-title">Writing your captions</h2>
      <p className="generating-stage" key={stage}>{STAGES[stage]}</p>

      {prompt && (
        <p className="generating-brief">
          Brief: <span>&ldquo;{truncate(prompt, 90)}&rdquo;</span>
        </p>
      )}

      <ul className="generating-skeletons">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="generating-skeleton" style={{ animationDelay: `${i * 0.15}s` }}>
            <span className="generating-skeleton-badge" />
            <span className="generating-skeleton-line" />
            <span className="generating-skeleton-line short" />
          </li>
        ))}
      </ul>

      <p className="generating-foot">This usually takes 4-12 seconds depending on AI power level.</p>
    </div>
  );
}
