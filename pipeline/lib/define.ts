// Indicator definitions: what each published series is, where it comes from and how
// it is computed. The transform step turns these into data/indicators/{id}.json.

import type { Frequency, Localized, Unit } from "../../lib/schema";
import type { Topic } from "../../lib/topics";
import type { Point, Resource } from "./sources";

type BaseDef = {
  id: string;
  topic: Topic;
  unit: Unit;
  frequency: Frequency;
  decimals: number;
  yZero: boolean;
  label: Localized;
  note?: Localized;
  periodRef?: "period" | "start";
  /** Plain description of the calculation, shown on the methodology page. */
  method: string;
};

/** A point tagged with the index of the resource it came from (for per-observation sources). */
export type SourcedPoint = Point & { from: number };

/** Several raw resources combined into one series, e.g. final data spliced with a newer estimate. */
export type CombinedDef = BaseDef & {
  resources: Resource[];
  formula?: string;
  combine(inputs: Point[][]): SourcedPoint[];
};

export type PrimaryDef = BaseDef & {
  resource: Resource;
  /** Optional selection/rescaling of the raw points (e.g. drop pre-2000, convert units). */
  map?: (points: Point[]) => Point[];
};

export type DerivedDef = BaseDef & {
  inputs: string[];
  formula: string;
  compute(inputs: Point[][]): Point[];
};

export type IndicatorDef = PrimaryDef | CombinedDef | DerivedDef;

export function isDerived(def: IndicatorDef): def is DerivedDef {
  return "inputs" in def;
}

export function isCombined(def: IndicatorDef): def is CombinedDef {
  return "resources" in def;
}

export function resourcesOf(def: IndicatorDef): Resource[] {
  if (isDerived(def)) return [];
  return isCombined(def) ? def.resources : [def.resource];
}

/**
 * Final annual data, extended with later years from a provisional source.
 * Years already covered by `final` are never taken from `extension`.
 */
export function splice(final: Point[], extension: Point[]): SourcedPoint[] {
  const lastFinal = final.reduce((m, p) => (p.period > m ? p.period : m), "");
  return [
    ...final.map((p) => ({ ...p, from: 0 })),
    ...extension.filter((p) => p.period > lastFinal).map((p) => ({ ...p, status: "provisional" as const, from: 1 })),
  ];
}

/** December values of a monthly year-to-date series, as annual totals ("2025-12" → "2025"). */
export function decemberAsAnnual(points: Point[]): Point[] {
  return points.filter((p) => p.period.endsWith("-12")).map((p) => ({ ...p, period: p.period.slice(0, 4) }));
}

/** Combines two series period by period; periods missing in either are skipped. */
export function combine(a: Point[], b: Point[], fn: (x: number, y: number) => number): Point[] {
  const byPeriod = new Map(b.map((p) => [p.period, p]));
  const out: Point[] = [];
  for (const p of a) {
    const q = byPeriod.get(p.period);
    if (!q) continue;
    out.push({
      period: p.period,
      value: fn(p.value, q.value),
      status: p.status === "provisional" || q.status === "provisional" ? "provisional" : "final",
    });
  }
  return out;
}

export const since = (year: number) => (points: Point[]) => points.filter((p) => Number(p.period.slice(0, 4)) >= year);

export const scale = (factor: number) => (points: Point[]) => points.map((p) => ({ ...p, value: p.value * factor }));

/**
 * Observed series continued by an official projection: projection years after the last
 * observation are appended with status "forecast". `from` is the index of the projection
 * resource (for per-observation sources).
 */
export function spliceProjection(observed: (Point | SourcedPoint)[], projection: Point[], from = 1): SourcedPoint[] {
  const lastObserved = observed.reduce((m, p) => (p.period > m ? p.period : m), "");
  return [
    ...observed.map((p) => ({ ...p, from: "from" in p ? p.from : 0 })),
    ...projection.filter((p) => p.period > lastObserved).map((p) => ({ ...p, status: "forecast" as const, from })),
  ];
}
