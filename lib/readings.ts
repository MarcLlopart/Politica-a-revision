// Readings: how an indicator's latest change compares with a fixed reference (the CPI over
// the same span, its own value a year earlier, or an official reference value), and whether
// that is favourable or unfavourable by a rule declared below. The rules are the same for
// every period and every government; the methodology page lists them all. Indicators without
// a rule (spending shares, demography, migration…) show only the direction of their change,
// without a rating.

import { DASHBOARD } from "./dashboard";
import { getIndicator } from "./data";
import { comparisonStart, latest } from "./indicators";
import type { Indicator } from "./schema";
import type { Topic } from "./topics";

export type Better = "up" | "down";

export type ReadingRule =
  /** A price or an income: its change compared with the CPI's over the same span. */
  | { kind: "vsCpi"; better: Better }
  /** A change already net of inflation (real GDP growth): favourable when positive. */
  | { kind: "sign"; better: Better }
  /** The indicator's own change, over the last year and since the window start. */
  | { kind: "change"; better: Better }
  /** Compared with an official reference value. */
  | { kind: "reference"; ref: ReferenceId };

/** Official reference values. `tolerance` is the band counted as "close to" the value. */
export const REFERENCES = {
  // ECB monetary policy strategy (2021): symmetric 2% target for euro-area HICP inflation.
  "ecb-inflation-target": { value: 2, better: "near", tolerance: 0.5 },
  // Treaty on the Functioning of the EU, Protocol 12: deficit 3% and debt 60% of GDP.
  "eu-deficit-limit": { value: -3, better: "up", tolerance: 0 },
  "eu-debt-reference": { value: 60, better: "down", tolerance: 0 },
} as const;
export type ReferenceId = keyof typeof REFERENCES;

/**
 * Prices are favourable when they rise less than the CPI, incomes when they rise more;
 * employment up, unemployment and temporary contracts down; public finances against EU
 * reference values and by their own change. Listed on the methodology page in this order.
 */
export const READING_RULES: Record<string, ReadingRule | ReadingRule[]> = {
  "gdp-growth-quarterly": { kind: "sign", better: "up" },
  "gdp-growth-annual": { kind: "sign", better: "up" },
  "gdp-per-capita": { kind: "vsCpi", better: "up" },
  "cpi-inflation-monthly": { kind: "reference", ref: "ecb-inflation-target" },
  "deficit-gdp": [
    { kind: "reference", ref: "eu-deficit-limit" },
    { kind: "change", better: "up" },
  ],
  "debt-gdp-quarterly": [
    { kind: "reference", ref: "eu-debt-reference" },
    { kind: "change", better: "down" },
  ],
  "debt-gdp": [
    { kind: "reference", ref: "eu-debt-reference" },
    { kind: "change", better: "down" },
  ],
  "cpi-food-yoy": { kind: "vsCpi", better: "down" },
  "cpi-electricity-yoy": { kind: "vsCpi", better: "down" },
  "cpi-natural-gas-yoy": { kind: "vsCpi", better: "down" },
  "cpi-diesel-yoy": { kind: "vsCpi", better: "down" },
  "cpi-petrol-yoy": { kind: "vsCpi", better: "down" },
  "ends-meet-great-difficulty": { kind: "change", better: "down" },
  "ends-meet-difficulty": { kind: "change", better: "down" },
  "unexpected-expenses": { kind: "change", better: "down" },
  "home-not-warm": { kind: "change", better: "down" },
  "utility-arrears": { kind: "change", better: "down" },
  "housing-overburden-total": { kind: "change", better: "down" },
  "housing-overburden-renters": { kind: "change", better: "down" },
  "housing-overburden-mortgage": { kind: "change", better: "down" },
  "house-prices": { kind: "vsCpi", better: "down" },
  "rent-cpi": { kind: "vsCpi", better: "down" },
  "rent-index": { kind: "vsCpi", better: "down" },
  "price-to-income": { kind: "change", better: "down" },
  "dwellings-completed-12m": { kind: "change", better: "up" },
  "protected-dwellings": { kind: "change", better: "up" },
  "pension-average-retirement": { kind: "vsCpi", better: "up" },
  "minimum-wage-monthly": { kind: "vsCpi", better: "up" },
  "median-salary": { kind: "vsCpi", better: "up" },
  "wage-p10": { kind: "vsCpi", better: "up" },
  "wage-p50": { kind: "vsCpi", better: "up" },
  "wage-mean": { kind: "vsCpi", better: "up" },
  "wage-p90": { kind: "vsCpi", better: "up" },
  "wage-p50-men": { kind: "vsCpi", better: "up" },
  "wage-p50-women": { kind: "vsCpi", better: "up" },
  "epa-wage-p10": { kind: "vsCpi", better: "up" },
  "epa-wage-p50": { kind: "vsCpi", better: "up" },
  "epa-wage-p90": { kind: "vsCpi", better: "up" },
  "irpf-income-p50": { kind: "vsCpi", better: "up" },
  "irpf-income-p90": { kind: "vsCpi", better: "up" },
  "irpf-income-p99": { kind: "vsCpi", better: "up" },
  "wage-earners-p50": { kind: "vsCpi", better: "up" },
  "wage-earners-p90": { kind: "vsCpi", better: "up" },
  "wage-earners-p99": { kind: "vsCpi", better: "up" },
  "household-income-p50": { kind: "vsCpi", better: "up" },
  "household-income-p90": { kind: "vsCpi", better: "up" },
  "household-income-p99": { kind: "vsCpi", better: "up" },
  "unemployment-rate": { kind: "change", better: "down" },
  "unemployment-rate-men": { kind: "change", better: "down" },
  "unemployment-rate-women": { kind: "change", better: "down" },
  "youth-unemployment-rate": { kind: "change", better: "down" },
  "temporary-contract-share": { kind: "change", better: "down" },
  "involuntary-part-time-es": { kind: "change", better: "down" },
  "overqualification-es": { kind: "change", better: "down" },
  "share-elementary-occupations": { kind: "change", better: "down" },
  employed: { kind: "change", better: "up" },
  "ss-affiliates": { kind: "change", better: "up" },
  "activity-rate": { kind: "change", better: "up" },
  "share-high-skill-occupations": { kind: "change", better: "up" },
  "share-employed-tertiary": { kind: "change", better: "up" },
  "affiliates-per-pension": { kind: "change", better: "up" },
  "life-expectancy": { kind: "change", better: "up" },
  "life-expectancy-65": { kind: "change", better: "up" },
  "crime-rate": { kind: "change", better: "down" },
  "crime-rate-excl-online-fraud": { kind: "change", better: "down" },
  "homicide-rate": { kind: "change", better: "down" },
  "violent-robbery-rate": { kind: "change", better: "down" },
  "home-burglary-rate": { kind: "change", better: "down" },
  "perceived-crime-area": { kind: "change", better: "down" },
};

export function rulesOf(id: string): ReadingRule[] {
  const r = READING_RULES[id];
  return r === undefined ? [] : Array.isArray(r) ? r : [r];
}

/** Indicators that repeat another one at a different frequency; counted once in topic tallies. */
const SAME_AS: Record<string, string> = { "debt-gdp": "debt-gdp-quarterly", "gdp-growth-annual": "gdp-growth-quarterly" };

export type Tone = "favourable" | "unfavourable" | "neutral";

/** Differences smaller than this (percentage points, or % in real terms) read as "in line". */
export const IN_LINE_BAND = 0.5;

/** `rated: false` = no rule; the reading only shows which way the indicator moved. */
export type Reading = { tone: Tone; rated: boolean } & (
  | { kind: "vsCpiRate"; period: string; value: number; cpi: number; diff: number }
  | { kind: "vsCpiLevel"; from: string; to: string; nominal: number; cpi: number; real: number; cpiTo?: string }
  | { kind: "sign"; period: string; value: number }
  | { kind: "change"; from: string; to: string; change: number; mode: "pp" | "pct" | "abs"; flat: boolean }
  | { kind: "reference"; ref: ReferenceId; period: string; value: number; diff: number; position: "above" | "below" | "near" }
);

const shiftYear = (period: string, years: number) => `${Number(period.slice(0, 4)) + years}${period.slice(4)}`;

function monthsOf(period: string): string[] {
  const year = period.slice(0, 4);
  const mm = (m: number) => `${year}-${String(m).padStart(2, "0")}`;
  if (period.includes("-Q")) {
    const q = Number(period.slice(-1));
    return [1, 2, 3].map((k) => mm((q - 1) * 3 + k));
  }
  if (period.length === 7) return [period];
  return Array.from({ length: 12 }, (_, i) => mm(i + 1));
}

let cpiCache: { monthly: Map<string, number>; annual: Map<string, number> } | undefined;

/**
 * CPI levels: INE's monthly and annual-average indices. Months published only as a flash
 * estimate (annual rate, no index yet) are the index a year earlier × (1 + rate).
 */
function cpi() {
  if (cpiCache) return cpiCache;
  const monthly = new Map(getIndicator("cpi-index-monthly").observations.map((o) => [o.period, o.value]));
  for (const o of getIndicator("cpi-inflation-monthly").observations) {
    const yearAgo = monthly.get(shiftYear(o.period, -1));
    if (!monthly.has(o.period) && yearAgo !== undefined) monthly.set(o.period, yearAgo * (1 + o.value / 100));
  }
  const annual = new Map(getIndicator("cpi-index-annual").observations.map((o) => [o.period, o.value]));
  cpiCache = { monthly, annual };
  return cpiCache;
}

/** Average CPI over some months, or null if any is missing. */
function cpiAverage(months: string[]): number | null {
  const { monthly } = cpi();
  if (months.some((m) => !monthly.has(m))) return null;
  return months.reduce((sum, m) => sum + monthly.get(m)!, 0) / months.length;
}

/**
 * CPI(to) / CPI(from) for two periods of the same frequency (quarters and years as averages).
 * A year still in progress is compared month for month with the same months of the base
 * year; `cpiTo` names the last month used.
 */
export function cpiRatio(from: string, to: string): { ratio: number; cpiTo?: string } | null {
  const { monthly, annual } = cpi();
  if (to.length === 4 && annual.has(from) && annual.has(to)) return { ratio: annual.get(to)! / annual.get(from)! };
  const months = to.length === 4 ? monthsOf(to).filter((m) => monthly.has(m)) : monthsOf(to);
  const base = to.length === 4 ? months.map((m) => `${from}${m.slice(4)}`) : monthsOf(from);
  const [a, b] = [cpiAverage(months), cpiAverage(base)];
  if (months.length === 0 || a === null || b === null) return null;
  return months.length < monthsOf(to).length ? { ratio: a / b, cpiTo: months.at(-1) } : { ratio: a / b };
}

/** CPI annual rate for a period: INE's published rate for months and years, else from the index. */
function cpiAnnualRate(period: string): number | null {
  if (!period.includes("-Q")) {
    const id = period.length === 7 ? "cpi-inflation-monthly" : "cpi-inflation-annual";
    const published = getIndicator(id).observations.find((o) => o.period === period);
    if (published) return published.value;
  }
  const r = cpiRatio(shiftYear(period, -1), period);
  return r && !r.cpiTo ? (r.ratio - 1) * 100 : null;
}

export const toneOf = (delta: number, better: Better, band: number): Tone =>
  Math.abs(delta) < band ? "neutral" : (delta > 0) === (better === "up") ? "favourable" : "unfavourable";

/** Change mode by unit: percentage points for rates, % for counts, own unit otherwise. */
function changeMode(ind: Indicator): "pp" | "pct" | "abs" {
  if (ind.unit === "percent" || ind.unit === "percent_gdp") return "pp";
  if (["years", "ratio", "children_per_woman", "per_1000", "per_100k"].includes(ind.unit)) return "abs";
  return "pct";
}

/**
 * Smallest change that counts as a change: 0.1 pp for rates, 0.5 pp for shares of GDP (large,
 * often revised ratios), 0.1% for counts and amounts, the published precision otherwise.
 */
function changeBand(ind: Indicator, mode: "pp" | "pct" | "abs"): number {
  if (mode === "abs") return 0.5 * 10 ** -ind.decimals;
  return ind.unit === "percent_gdp" ? IN_LINE_BAND : 0.1;
}

/**
 * Readings for an indicator's latest observed value. Spans: a year earlier (same quarter or
 * month) and the window start; `longOnly` keeps just the window start (multi-series cards).
 * Indicators without a rule get unrated direction readings (none for growth rates).
 */
export function readingsFor(ind: Indicator, longOnly = false): Reading[] {
  const rules = rulesOf(ind.id);
  if (rules.length > 0) return rules.flatMap((rule) => ruleReadings(ind, rule, longOnly));
  return ind.unit === "percent_change" ? [] : changeReadings(ind, null, longOnly);
}

function ruleReadings(ind: Indicator, rule: ReadingRule, longOnly: boolean): Reading[] {
  const last = latest(ind);
  if (rule.kind === "sign") {
    return [{ kind: "sign", period: last.period, value: last.value, rated: true, tone: toneOf(last.value, rule.better, 0.05) }];
  }
  if (rule.kind === "reference") {
    const ref = REFERENCES[rule.ref];
    const diff = last.value - ref.value;
    // At the reference value itself counts as within it (deficit of exactly 3%, debt of 60%).
    const position = Math.abs(diff) <= ref.tolerance && ref.better === "near" ? "near" : diff > 0 || (diff === 0 && ref.better === "up") ? "above" : "below";
    const tone: Tone = position === "near" || position === (ref.better === "up" ? "above" : "below") ? "favourable" : "unfavourable";
    return [{ kind: "reference", ref: rule.ref, period: last.period, value: last.value, diff, position, rated: true, tone }];
  }
  if (rule.kind === "vsCpi" && ind.unit === "percent_change") {
    const cpiRate = cpiAnnualRate(last.period);
    if (cpiRate === null) return [];
    const diff = last.value - cpiRate;
    return [{ kind: "vsCpiRate", period: last.period, value: last.value, cpi: cpiRate, diff, rated: true, tone: toneOf(diff, rule.better, IN_LINE_BAND) }];
  }
  if (rule.kind === "vsCpi") {
    return spans(ind, longOnly).flatMap(({ from, start }): Reading[] => {
      const r = cpiRatio(from, last.period);
      if (!r) return [];
      const nominal = (last.value / start - 1) * 100;
      const real = ((1 + nominal / 100) / r.ratio - 1) * 100;
      const tone = toneOf(real, rule.better, IN_LINE_BAND);
      return [{ kind: "vsCpiLevel", from, to: last.period, nominal, cpi: (r.ratio - 1) * 100, real, cpiTo: r.cpiTo, rated: true, tone }];
    });
  }
  return changeReadings(ind, rule.better, longOnly);
}

/** Comparison points: a year earlier and the window start, where observed. */
function spans(ind: Indicator, longOnly: boolean): { from: string; start: number }[] {
  const observed = ind.observations.filter((o) => o.status !== "forecast");
  const last = latest(ind);
  const at = (p: string) => observed.find((o) => o.period === p);
  return [shiftYear(last.period, -1), comparisonStart(ind).period]
    .filter((p, i, all) => all.indexOf(p) === i && p < last.period && at(p))
    .slice(longOnly ? -1 : 0)
    .map((from) => ({ from, start: at(from)!.value }));
}

/** The indicator's own change; rated when `better` is given, otherwise direction only. */
function changeReadings(ind: Indicator, better: Better | null, longOnly: boolean): Reading[] {
  const last = latest(ind);
  const mode = changeMode(ind);
  const band = changeBand(ind, mode);
  return spans(ind, longOnly).map(({ from, start }): Reading => {
    const change = mode === "pct" ? (last.value / start - 1) * 100 : last.value - start;
    const tone = better ? toneOf(change, better, band) : "neutral";
    return { kind: "change", from, to: last.period, change, mode, rated: better !== null, tone, flat: Math.abs(change) < band };
  });
}

export type Tally = Record<Tone, number>;

/**
 * Every rated mark on a topic page, from the window start (one per rule and indicator;
 * repeated indicators counted once). Shown on the home page with the topic's headline.
 */
export function topicTally(topic: Topic): Tally {
  const ids = [...new Set(DASHBOARD[topic].flatMap((card) => card.indicators))].filter((id) => !SAME_AS[id] && rulesOf(id).length > 0);
  const tally: Tally = { favourable: 0, unfavourable: 0, neutral: 0 };
  for (const id of ids) {
    const ind = getIndicator(id);
    if (ind.observations.filter((o) => o.status !== "forecast").length <= 1) continue;
    for (const r of readingsFor(ind, true)) tally[r.tone]++;
  }
  return tally;
}
