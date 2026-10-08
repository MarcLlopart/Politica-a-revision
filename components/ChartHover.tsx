"use client";

// Hover/keyboard layer over a server-rendered SVG chart. The SVG itself is static;
// this only draws a crosshair and a readout. Values are also in the "View data" table.

import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { HoverPoint } from "@/lib/chart";

type Props = {
  svg: string;
  width: number;
  height: number;
  marginTop: number;
  marginBottom: number;
  hover: HoverPoint[];
  label: string;
  hint: string;
};

export function ChartHover({ svg, width, height, marginTop, marginBottom, hover, label, hint }: Props) {
  const [index, setIndex] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const hintId = useId();

  function nearest(clientX: number): number | null {
    const el = ref.current;
    if (!el || hover.length === 0) return null;
    const rect = el.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * width;
    let best = 0;
    for (let i = 1; i < hover.length; i++) {
      if (Math.abs(hover[i].x - x) < Math.abs(hover[best].x - x)) best = i;
    }
    return best;
  }

  function onKey(e: KeyboardEvent) {
    if (hover.length === 0) return;
    const keys: Record<string, (i: number) => number> = {
      ArrowRight: (i) => Math.min(hover.length - 1, i + 1),
      ArrowLeft: (i) => Math.max(0, i - 1),
      Home: () => 0,
      End: () => hover.length - 1,
    };
    const move = keys[e.key];
    if (!move) return;
    e.preventDefault();
    setIndex((i) => move(i ?? hover.length - 1));
  }

  const point = index === null ? null : hover[index];
  const leftPct = point ? (point.x / width) * 100 : 0;

  return (
    <div
      ref={ref}
      className="chart relative outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] rounded"
      tabIndex={0}
      role="group"
      aria-label={label}
      aria-describedby={hintId}
      onPointerMove={(e: PointerEvent) => setIndex(nearest(e.clientX))}
      onPointerLeave={() => setIndex(null)}
      onBlur={() => setIndex(null)}
      onKeyDown={onKey}
    >
      <span id={hintId} className="sr-only">
        {hint}
      </span>
      <div dangerouslySetInnerHTML={{ __html: svg }} />
      {point && (
        <>
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <line x1={point.x} x2={point.x} y1={marginTop} y2={height - marginBottom} stroke="var(--ink-2)" strokeWidth={1} />
            {point.values.map((v) => (
              <circle key={v.key} cx={point.x} cy={v.y} r={4.5} fill={v.color} stroke="var(--surface)" strokeWidth={2} />
            ))}
          </svg>
          <div
            className="tooltip pointer-events-none absolute top-0 z-10"
            style={{
              left: `${leftPct}%`,
              transform: `translateX(${leftPct > 60 ? "calc(-100% - 10px)" : "10px"})`,
            }}
          >
            <div className="text-xs text-[var(--ink-2)]">{point.periodLabel}</div>
            {point.values.map((v) => (
              <div key={v.key} className="flex items-center gap-2">
                {point.values.length > 1 && (
                  <span className="inline-block h-0.5 w-3 rounded" style={{ background: v.color }} aria-hidden="true" />
                )}
                <strong className="text-sm">{v.text}</strong>
                {point.values.length > 1 && <span className="text-xs text-[var(--ink-2)]">{v.label}</span>}
              </div>
            ))}
          </div>
        </>
      )}
      <div className="sr-only" aria-live="polite">
        {point ? `${point.periodLabel}: ${point.values.map((v) => `${v.label} ${v.text}`).join(", ")}` : ""}
      </div>
    </div>
  );
}
