// Read-side helpers over indicator observations (windowing, headline, comparison point).

import type { Indicator, Observation } from "./schema";

/** First year shown in the dashboard window (brief: 2018–2025 + latest). */
export const WINDOW_START_YEAR = 2018;

export function windowed(ind: Indicator, fromYear = WINDOW_START_YEAR): Observation[] {
  return ind.observations.filter((o) => Number(o.period.slice(0, 4)) >= fromYear);
}

/** Latest observed value (forecasts excluded). */
export function latest(ind: Indicator): Observation {
  const observed = ind.observations.filter((o) => o.status !== "forecast");
  return observed[observed.length - 1] ?? ind.observations[ind.observations.length - 1];
}

/** Forecast values published by the source, in order. */
export function forecasts(ind: Indicator): Observation[] {
  return ind.observations.filter((o) => o.status === "forecast");
}

/**
 * The comparison point for the summary sentence: the same quarter or month in the
 * window's first year, so seasonal series are compared like with like.
 */
export function comparisonStart(ind: Indicator, fromYear = WINDOW_START_YEAR): Observation {
  const last = latest(ind);
  const suffix = last.period.slice(4); // "", "-Q2" or "-07"
  const same = ind.observations.find((o) => o.period === `${fromYear}${suffix}`);
  return same ?? windowed(ind, fromYear).find((o) => o.status !== "forecast") ?? ind.observations[0];
}

export function sourceIdsOf(ind: Indicator, extra: Indicator[] = []): string[] {
  const ids = new Set<string>();
  for (const i of [ind, ...extra]) for (const o of windowed(i)) ids.add(o.sourceId);
  return [...ids].sort();
}
