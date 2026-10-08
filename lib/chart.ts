// Server-side chart rendering with Observable Plot. Charts are emitted as static SVG
// (no chart library shipped to the browser); a small client component adds hover.

import * as Plot from "@observablehq/plot";
import { parseHTML } from "linkedom";
import { periodStart } from "./format";

const { document } = parseHTML("<!doctype html><html><body></body></html>");

export type ChartSeries = {
  key: string;
  label: string;
  /** CSS custom property holding the series colour, e.g. "var(--series-1)". */
  color: string;
  /** Forecast points are drawn as a dashed continuation of the observed line. */
  points: { period: string; value: number; forecast?: boolean }[];
};

export type ChartEventMarker = { n: number; date: string };

export type HoverPoint = {
  x: number;
  periodLabel: string;
  values: { key: string; label: string; y: number; text: string; color: string }[];
};

export type RenderedChart = {
  svg: string;
  width: number;
  height: number;
  marginTop: number;
  marginBottom: number;
  hover: HoverPoint[];
};

export type LineChartInput = {
  series: ChartSeries[];
  events?: ChartEventMarker[];
  yZero: boolean;
  tick: (v: number) => string;
  valueText: (v: number) => string;
  periodText: (period: string) => string;
  width?: number;
  height?: number;
};

const CHAR_PX = 7; // approximate glyph width at 12px system-ui

export function renderLineChart(input: LineChartInput): RenderedChart {
  // Rendered once and scaled by CSS: ~0.8× on a 360px phone, capped at 28rem on desktop.
  const width = input.width ?? 360;
  const height = input.height ?? 220;
  const events = input.events ?? [];
  const marginTop = events.length > 0 ? 24 : 12;
  const marginBottom = 28;

  const all = input.series.flatMap((s) => s.points.map((p) => p.value));
  const min = Math.min(...all, ...(input.yZero ? [0] : []));
  const max = Math.max(...all, ...(input.yZero ? [0] : []));
  const marginLeft = Math.max(input.tick(min).length, input.tick(max).length) * CHAR_PX + 12;
  const endLabels = input.series.map((s) => {
    // Forecast series are labelled at the end of the forecast; observed ones at the latest value.
    const observed = s.points.filter((p) => !p.forecast);
    const last = s.points.some((p) => p.forecast) ? s.points[s.points.length - 1] : (observed[observed.length - 1] ?? s.points[s.points.length - 1]);
    return { ...last, date: periodStart(last.period), text: input.valueText(last.value), color: s.color };
  });
  const marginRight = Math.max(...endLabels.map((l) => l.text.length)) * CHAR_PX + 14;
  // End labels that would overlap are dropped (the legend and hover readout still identify the
  // series); nudging them apart would detach them from their lines.
  const yApprox = (v: number) => ((max - v) / (max - min || 1)) * (height - marginTop - marginBottom);
  const keptLabels = endLabels.filter((l, i) => endLabels.every((o, j) => j >= i || Math.abs(yApprox(o.value) - yApprox(l.value)) >= 16));

  const rows = input.series.flatMap((s) =>
    s.points.map((p) => ({ key: s.key, date: periodStart(p.period), value: p.value, color: s.color, forecast: p.forecast ?? false })),
  );
  const firstDate = Math.min(...rows.map((r) => +r.date));
  const lastDate = Math.max(...rows.map((r) => +r.date));
  const eventRows = events
    .map((e) => ({ ...e, date: new Date(`${e.date}T00:00:00Z`) }))
    .filter((e) => +e.date >= firstDate && +e.date <= lastDate);
  const crossesZero = min <= 0 && max >= 0;

  const plot = Plot.plot({
    document,
    width,
    height,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    style: { fontSize: "12px", overflow: "visible" },
    x: { type: "utc", label: null, ticks: 4, tickFormat: "%Y" },
    y: { label: null, grid: true, nice: true, zero: input.yZero, ticks: 4, tickFormat: input.tick },
    marks: [
      crossesZero ? Plot.ruleY([0], { stroke: "var(--axis)" }) : null,
      Plot.ruleX(eventRows, { x: "date", stroke: "var(--event)", strokeWidth: 1 }),
      Plot.text(eventRows, {
        x: "date",
        text: (d: { n: number }) => String(d.n),
        frameAnchor: "top",
        dy: -12,
        fill: "var(--ink-2)",
        fontWeight: 600,
      }),
      ...input.series.flatMap((s) => {
        const own = rows.filter((r) => r.key === s.key);
        const observed = own.filter((r) => !r.forecast);
        // The dashed forecast starts at the last observed point so the two segments join.
        const projected = [...observed.slice(-1), ...own.filter((r) => r.forecast)];
        const line = { x: "date", y: "value", stroke: s.color, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
        return [
          Plot.lineY(observed, line),
          projected.length > 1 ? Plot.lineY(projected, { ...line, strokeDasharray: "4 4" }) : null,
        ];
      }),
      Plot.dot(endLabels, { x: "date", y: "value", r: 4, fill: (d: { color: string }) => d.color, stroke: "var(--surface)", strokeWidth: 2 }),
      Plot.text(keptLabels, { x: "date", y: "value", text: "text", dx: 8, textAnchor: "start", fill: "var(--ink)", fontWeight: 600 }),
    ],
  });

  const xScale = plot.scale("x")!;
  const yScale = plot.scale("y")!;
  const periods = [...new Set(input.series.flatMap((s) => s.points.map((p) => p.period)))].sort();
  const hover: HoverPoint[] = periods.map((period) => ({
    x: round1(xScale.apply(periodStart(period)) as number),
    periodLabel: input.periodText(period),
    values: input.series.flatMap((s) => {
      const p = s.points.find((q) => q.period === period);
      return p
        ? [{ key: s.key, label: s.label, y: round1(yScale.apply(p.value) as number), text: input.valueText(p.value), color: s.color }]
        : [];
    }),
  }));

  // The wrapper carries the accessible name and the data table carries the values, so the
  // SVG itself is hidden from assistive technology (Plot's per-group aria-labels removed).
  for (const el of plot.querySelectorAll("[aria-label]")) el.removeAttribute("aria-label");
  plot.setAttribute("aria-hidden", "true");
  return { svg: plot.outerHTML, width, height, marginTop, marginBottom, hover };
}

export function renderSparkline(points: { period: string; value: number }[], width = 120, height = 36): string {
  const rows = points.map((p) => ({ date: periodStart(p.period), value: p.value }));
  const last = rows[rows.length - 1];
  const plot = Plot.plot({
    document,
    width,
    height,
    margin: 5,
    axis: null,
    style: { overflow: "visible" },
    x: { type: "utc" },
    marks: [
      Plot.lineY(rows, { x: "date", y: "value", stroke: "var(--spark)", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }),
      Plot.dot([last], { x: "date", y: "value", r: 3.5, fill: "var(--series-1)", stroke: "var(--surface)", strokeWidth: 1.5 }),
    ],
  });
  for (const el of plot.querySelectorAll("[aria-label]")) el.removeAttribute("aria-label");
  plot.setAttribute("aria-hidden", "true");
  return plot.outerHTML;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export type BarRow = { label: string; share: number; text: string };

/**
 * Horizontal bars, one colour, value at the bar end. Short category labels sit on the left;
 * with `labelsAbove`, each label sits above its bar so long labels fit on narrow screens.
 */
export function renderBarChart(rows: BarRow[], opts: { width?: number; labelsAbove?: boolean } = {}): string {
  const width = opts.width ?? 360;
  const above = opts.labelsAbove ?? false;
  const step = above ? 40 : 26;
  const labelWidth = above ? 4 : Math.max(...rows.map((r) => r.label.length)) * CHAR_PX + 10;
  const textWidth = Math.max(...rows.map((r) => r.text.length)) * CHAR_PX + 12;
  const height = rows.length * step + (above ? 4 : 8);
  const plot = Plot.plot({
    document,
    width,
    height,
    marginTop: 4,
    marginBottom: 4,
    marginLeft: labelWidth,
    marginRight: textWidth,
    style: { fontSize: "12px", overflow: "visible" },
    // Bars can be negative (e.g. a change); the domain always includes 0.
    x: { axis: null, domain: [Math.min(0, ...rows.map((r) => r.share)), Math.max(0, ...rows.map((r) => r.share))] },
    y: above
      ? { axis: null, domain: rows.map((r) => r.label), paddingInner: 0.55, paddingOuter: 0, align: 1 }
      : { domain: rows.map((r) => r.label), label: null, tickSize: 0, padding: 0.25 },
    marks: [
      Plot.barX(rows, { y: "label", x: "share", fill: "var(--series-1)", rx: 2 }),
      Plot.ruleX([0], { stroke: "var(--axis)" }),
      Plot.text(rows, { y: "label", x: (d: BarRow) => Math.max(0, d.share), text: "text", dx: 6, textAnchor: "start", fill: "var(--ink)" }),
      above
        ? Plot.text(rows, { y: "label", x: Math.min(0, ...rows.map((r) => r.share)), text: "label", dy: -18, textAnchor: "start", fill: "var(--ink-2)" })
        : null,
    ],
  });
  for (const el of plot.querySelectorAll("[aria-label]")) el.removeAttribute("aria-label");
  plot.setAttribute("aria-hidden", "true");
  return plot.outerHTML;
}
