// Distribution definitions: bracketed counts (and amounts, when published) from which the
// transform computes mean, percentiles, the most common range and shares above thresholds.

import { mean, modalBracket, modalRange, quantile, shareAbove, type Bracket } from "../../lib/distribution";
import type { DistributionPeriod, Localized, Source } from "../../lib/schema";
import type { Topic } from "../../lib/topics";
import type { Resource } from "./sources";

export type DistributionInput = {
  period: string;
  brackets: Bracket[];
  source: Source;
  /** Further raw files used for this period (e.g. a second table with part of the amounts). */
  extraSources?: Source[];
  /** Official mean for the same population and period, if published separately. */
  publishedMean?: { value: number; source: Source };
};

export type StatKey = "mean" | "p10" | "p25" | "median" | "p75" | "p90" | "p95" | "p99";

export type DistributionDef = {
  id: string;
  topic: Topic;
  /** Euros per year, per month, or a stock (wealth). */
  amountPer: "year" | "month" | "total";
  periodRef?: "period" | "start";
  label: Localized;
  population: Localized;
  note?: Localized;
  method: string;
  /** Amounts that programmes commonly use as cut-offs; the share above each is published. */
  thresholds: number[];
  /**
   * "Most common": densest range over equal-width bins (fine brackets), the densest
   * published bracket (medium brackets), or none when brackets are too wide to tell.
   */
  mode: { binWidth: number } | "bracket" | "none";
  /** Upper bounds used to group many narrow brackets for the bar chart; omit to show all. */
  displayEdges?: number[];
  /** Statistics also published as yearly indicators (for trend charts and CSV). */
  indicators?: { stat: StatKey; id: string; label: Localized }[];
  /** Downloaded by pipeline:fetch (omit when another definition already fetches the file). */
  resources?: Resource[];
  load(): DistributionInput[];
};

export function buildPeriod(def: DistributionDef, input: DistributionInput): DistributionPeriod {
  const b = input.brackets;
  const total = b.reduce((s, x) => s + x.count, 0);
  const q = (p: number) => quantile(b, p);
  const m = input.publishedMean
    ? { ...mean(b, input.publishedMean.value), sourceId: input.publishedMean.source.id }
    : mean(b);
  return {
    period: input.period,
    sourceId: input.source.id,
    extraSourceIds: (input.extraSources ?? []).map((x) => x.id),
    total,
    brackets: b,
    stats: {
      mean: m,
      p10: q(0.1),
      p25: q(0.25),
      median: q(0.5),
      p75: q(0.75),
      p90: q(0.9),
      p95: q(0.95),
      p99: q(0.99),
      mode: def.mode === "none" ? null : def.mode === "bracket" ? modalBracket(b) : modalRange(b, def.mode.binWidth),
    },
    thresholds: def.thresholds.map((amount) => {
      const share = shareAbove(b, amount);
      return { amount, shareAbove: share, countAbove: share === null ? null : Math.round(share * total) };
    }),
  };
}
