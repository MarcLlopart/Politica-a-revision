"use client";

import { Children, useId, useState, type ReactNode } from "react";

/**
 * A range input that shows one of several pre-rendered panels (one per stop). All panels are
 * rendered on the server; only the visible one changes. Without JavaScript the first shows.
 */
export function YearSlider({ stops, label, children }: { stops: string[]; label: string; children: ReactNode }) {
  const [index, setIndex] = useState(0);
  const id = useId();
  const panels = Children.toArray(children);
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}: <output htmlFor={id}>{stops[index]}</output>
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={stops.length - 1}
        step={1}
        value={index}
        aria-valuetext={stops[index]}
        onChange={(e) => setIndex(Number(e.target.value))}
        className="mt-2 block h-6 w-full max-w-md cursor-pointer accent-[var(--series-1)]"
      />
      <ol className="mt-1 flex max-w-md justify-between text-xs text-[var(--ink-2)]" aria-hidden="true">
        {stops.map((s, i) => (
          <li key={s} className={i === index ? "font-semibold text-[var(--ink)]" : undefined}>
            {s}
          </li>
        ))}
      </ol>
      {panels.map((panel, i) => (
        <div key={i} hidden={i !== index}>
          {panel}
        </div>
      ))}
    </div>
  );
}
