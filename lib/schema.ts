// Zod schemas for every data file in /data and /methodology.
// The build runs scripts/validate-data.ts, which parses all files with these
// schemas and cross-checks references; any value without a source fails the build.

import { z } from "zod";
import { LOCALES } from "./locales";
import { TOPICS } from "./topics";

const nonEmpty = z.string().trim().min(1);

export const LocaleSchema = z.enum(LOCALES);

/** A string in every launch locale. Missing translations fail validation. */
export const Localized = z.object({ es: nonEmpty, en: nonEmpty, ca: nonEmpty });
export type Localized = z.infer<typeof Localized>;

export const TopicSchema = z.enum(TOPICS);

export const Slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "kebab-case id");

/** "2024" (annual), "2024-Q2" (quarterly) or "2024-07" (monthly). */
export const Period = z.string().regex(/^\d{4}(-Q[1-4]|-(0[1-9]|1[0-2]))?$/, "period");

export const Frequency = z.enum(["A", "Q", "M"]);
export type Frequency = z.infer<typeof Frequency>;

export const Unit = z.enum([
  "percent", // a rate, e.g. unemployment rate (value 9.87 = 9.87%)
  "percent_change", // a growth rate, e.g. annual CPI change
  "percent_gdp", // share of GDP
  "persons",
  "eur", // euros (not thousands or millions)
  "index",
  "ratio",
  "years",
  "children_per_woman",
  "count", // a number of events, e.g. offences known to the police
  "per_1000", // per 1,000 inhabitants
  "per_100k", // per 100,000 inhabitants
  "dwellings",
  "pensions",
]);
export type Unit = z.infer<typeof Unit>;

export const Sha256 = z.string().regex(/^sha256:[0-9a-f]{64}$/);

export const Source = z.object({
  id: Slug,
  publisher: nonEmpty,
  dataset: nonEmpty,
  tableId: z.string().optional(),
  seriesCode: z.string().optional(),
  /** Human-facing page for the table or dataset. */
  url: z.url(),
  /** Exact URL the raw file was downloaded from. */
  apiUrl: z.url(),
  retrievedAt: z.iso.date(),
  /** Repo-relative path of the raw downloaded file. */
  rawPath: nonEmpty,
  fileHash: Sha256,
  licence: nonEmpty,
  attribution: nonEmpty,
  notes: z.string().optional(),
});
export type Source = z.infer<typeof Source>;

export const Observation = z.object({
  period: Period,
  value: z.number().finite(),
  sourceId: Slug,
  /** "forecast": a projection published by the source (IMF, European Commission…), not an observation. */
  status: z.enum(["final", "provisional", "forecast"]).default("final"),
  note: z.string().optional(),
});
export type Observation = z.infer<typeof Observation>;

export const Calculation = z.object({
  /** Plain description of how the published value was obtained from the raw file. */
  method: nonEmpty,
  /** Formula when the value is derived from other series, e.g. "births − deaths". */
  formula: z.string().optional(),
  /** Indicator ids this one is computed from. */
  inputs: z.array(Slug).default([]),
  /** Further raw files used in the calculation besides each observation's own source. */
  extraSourceIds: z.array(Slug).default([]),
});

export const Indicator = z
  .object({
    id: Slug,
    topic: TopicSchema,
    unit: Unit,
    frequency: Frequency,
    decimals: z.int().min(0).max(4),
    label: Localized,
    /** Caveats shown under the chart (series breaks, provisional data). */
    note: Localized.optional(),
    /** Whether the chart's value axis starts at zero. */
    yZero: z.boolean(),
    /**
     * "period": a flow or average over the period (births in 2024, unemployment in Q2).
     * "start": a stock on the first day of the period (population on 1 July 2026).
     */
    periodRef: z.enum(["period", "start"]).default("period"),
    calculation: Calculation,
    observations: z.array(Observation).min(1),
  })
  .superRefine((ind, ctx) => {
    const seen = new Set<string>();
    for (const o of ind.observations) {
      if (seen.has(o.period)) {
        ctx.addIssue({ code: "custom", message: `duplicate period ${o.period}` });
      }
      seen.add(o.period);
      const ok =
        (ind.frequency === "A" && /^\d{4}$/.test(o.period)) ||
        (ind.frequency === "Q" && /^\d{4}-Q[1-4]$/.test(o.period)) ||
        (ind.frequency === "M" && /^\d{4}-\d{2}$/.test(o.period));
      if (!ok) {
        ctx.addIssue({ code: "custom", message: `period ${o.period} does not match frequency ${ind.frequency}` });
      }
    }
  });
export type Indicator = z.infer<typeof Indicator>;

export const ContextEvent = z.object({
  id: Slug,
  date: z.iso.date(),
  label: Localized,
  topics: z.array(TopicSchema).min(1),
  sourceUrl: z.url(),
});
export const ContextEvents = z.array(ContextEvent);
export type ContextEvent = z.infer<typeof ContextEvent>;

export const ProgramEdition = z.object({
  edition: Slug, // e.g. "2023-general"
  electionDate: z.iso.date(),
  status: z.enum(["pending", "archived"]),
  url: z.url().optional(),
  waybackUrl: z.url().optional(),
  localPath: z.string().optional(),
  fileHash: Sha256.optional(),
  retrievedAt: z.iso.date().optional(),
  languages: z.array(z.string()).default([]),
});

export const Party = z.object({
  id: Slug,
  acronym: nonEmpty,
  name: nonEmpty,
  /** List names voters saw on the ballot, where they differed by constituency. */
  ballotNames: z.array(nonEmpty).min(1),
  seats2023: z.int().min(1),
  /** Used only on the party chip, never in assessment semantics. */
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  programEditions: z.array(ProgramEdition),
  notes: Localized.optional(),
});
export type Party = z.infer<typeof Party>;

export const PartiesFile = z.object({
  election: z.object({
    name: Localized,
    date: z.iso.date(),
    totalSeats: z.int(),
    sourceUrl: z.url(),
    sourceLabel: nonEmpty,
  }),
  inclusionRule: Localized,
  orderRule: Localized,
  parties: z.array(Party),
});
export type PartiesFile = z.infer<typeof PartiesFile>;

export const ProposalType = z.enum(["fiscal_cost", "revenue", "quantified_target", "regulatory", "non_measurable"]);

export const Proposal = z.object({
  id: Slug,
  partyId: Slug,
  edition: Slug,
  topic: z.array(TopicSchema).min(1),
  type: ProposalType,
  quote: z.object({
    text: nonEmpty,
    lang: z.string().min(2),
    page: z.int().min(1),
    sourceId: Slug,
  }),
  translation: Localized.partial().optional(),
  partyCosting: z.object({ amountEUR: z.number().optional(), text: nonEmpty }).optional(),
  status: z.enum(["draft", "reviewed", "published"]),
  reviewedBy: z.array(nonEmpty).default([]),
});
export type Proposal = z.infer<typeof Proposal>;

export const Assessment = z.object({
  proposalId: Slug,
  rubricVersion: nonEmpty,
  restatement: Localized,
  baseline: z.object({ indicatorId: Slug, value: z.number(), period: Period }),
  required: z.object({
    value: z.number(),
    unit: nonEmpty,
    perYear: z.number().optional(),
    pctGDP: z.number().optional(),
  }),
  benchmarks: z.object({ spainBest4y: z.number().optional(), eu27Best4y: z.number().optional() }),
  funding: z.enum(["yes", "partial", "no", "na"]),
  independentEstimates: z.array(z.object({ sourceId: Slug, text: nonEmpty })),
  band: z.enum(["consistent", "ambitious", "unprecedented", "not_assessable"]),
  costNotCovered: z.boolean(),
  confidence: z.enum(["high", "medium", "low"]),
  confidenceNote: Localized.optional(),
  /** For proposals aimed at a group defined by an amount: who is above it. */
  populationAffected: z
    .object({ distributionId: Slug, period: Period, threshold: z.number(), shareAbove: z.number(), countAbove: z.number() })
    .optional(),
  calculation: z.object({
    formula: nonEmpty,
    inputs: z.array(z.object({ name: nonEmpty, value: z.number(), sourceId: Slug })),
  }),
});
export type Assessment = z.infer<typeof Assessment>;

export const Correction = z.object({
  date: z.iso.date(),
  scope: z.enum(["indicator", "proposal", "assessment", "party", "site", "methodology"]),
  ids: z.array(z.string()).default([]),
  what: Localized,
  why: Localized,
  commit: z.string().optional(),
});
export const Corrections = z.array(Correction);
export type Correction = z.infer<typeof Correction>;

const Band = z.object({ id: z.enum(["consistent", "ambitious", "unprecedented", "not_assessable"]), rule: nonEmpty });

export const Rubric = z.object({
  version: nonEmpty,
  status: z.enum(["proposed", "frozen", "superseded"]),
  frozenAt: z.iso.date().nullable(),
  appliesToTypes: z.array(ProposalType),
  bands: z.array(Band),
  costNotCovered: z.object({ thresholdPctGDP: z.number(), fundingValues: z.array(z.enum(["yes", "partial", "no", "na"])), rule: nonEmpty }),
  window: z.record(z.string(), z.unknown()),
  changeMetric: z.record(z.string(), z.unknown()),
  benchmarks: z.record(z.string(), z.unknown()),
  funding: z.record(z.string(), nonEmpty),
  confidence: z.record(z.string(), nonEmpty),
  blinding: z.record(z.string(), z.unknown()),
  populationAffected: z.object({ rule: nonEmpty, noMatch: nonEmpty }),
});
export type Rubric = z.infer<typeof Rubric>;

// ---------------------------------------------------------------- Distributions

const StatSchema = z.object({
  value: z.number().nullable(),
  /** Set when only a lower bound is known (open top bracket without amounts). */
  atLeast: z.number().optional(),
  method: z.enum(["published", "exact", "linear", "pareto"]),
  /** Source of a published value, when it differs from the brackets' source. */
  sourceId: Slug.optional(),
});
export type StatValue = z.infer<typeof StatSchema>;

export const DistributionPeriod = z.object({
  period: Period,
  sourceId: Slug,
  /** Further raw files used for this period (e.g. the savings-base table for IRPF amounts). */
  extraSourceIds: z.array(Slug).default([]),
  total: z.number().positive(),
  brackets: z
    .array(z.object({ lower: z.number(), upper: z.number().nullable(), count: z.number().nonnegative(), amount: z.number().optional() }))
    .min(2),
  stats: z.object({
    mean: StatSchema,
    p10: StatSchema,
    p25: StatSchema,
    median: StatSchema,
    p75: StatSchema,
    p90: StatSchema,
    p95: StatSchema,
    p99: StatSchema,
    mode: z.object({ lower: z.number(), upper: z.number(), share: z.number() }).nullable(),
  }),
  thresholds: z.array(z.object({ amount: z.number(), shareAbove: z.number().nullable(), countAbove: z.number().nullable() })),
});
export type DistributionPeriod = z.infer<typeof DistributionPeriod>;

export const Distribution = z.object({
  id: Slug,
  topic: TopicSchema,
  /** Amounts are euros per year, per month, or a stock (wealth). */
  amountPer: z.enum(["year", "month", "total"]),
  periodRef: z.enum(["period", "start"]).default("period"),
  label: Localized,
  /** Who is counted, e.g. "contributory retirement pensions". */
  population: Localized,
  note: Localized.optional(),
  /** Upper bounds used to group brackets in the bar chart (absent: show every bracket). */
  displayEdges: z.array(z.number()).optional(),
  calculation: Calculation,
  periods: z.array(DistributionPeriod).min(1),
});
export type Distribution = z.infer<typeof Distribution>;

// ---------------------------------------------------------------- Figures from documents

/**
 * A figure that only exists inside a document (report, study, law): transcribed by hand,
 * with the archived document and the exact location. Independent estimates (Fedea, AIReF,
 * Banco de España…) are labelled as such and never mixed with official series.
 */
export const Estimate = z.object({
  id: Slug,
  topic: TopicSchema,
  kind: z.enum(["official", "independent", "legal"]),
  label: Localized,
  value: z.number(),
  unit: Unit,
  /** Free text period, e.g. "2025" or "31 Dec 2025". */
  period: nonEmpty,
  definition: Localized,
  publisher: nonEmpty,
  document: z.object({
    title: nonEmpty,
    url: z.url(),
    /** Page, table or article where the figure appears. */
    location: nonEmpty,
    localPath: z.string().optional(),
    fileHash: Sha256.optional(),
    retrievedAt: z.iso.date().optional(),
  }),
  transcribedBy: nonEmpty,
  checkedBy: z.array(nonEmpty).default([]),
});
export type Estimate = z.infer<typeof Estimate>;

/** Population by sex and single year of age (index 0–99, then 100 and over) for a few dates. */
export const Pyramid = z.object({
  id: Slug,
  label: Localized,
  note: Localized.optional(),
  calculation: Calculation,
  years: z
    .array(
      z.object({
        period: Period,
        status: z.enum(["final", "provisional", "forecast"]),
        sourceId: Slug,
        men: z.array(z.number().nonnegative()).length(101),
        women: z.array(z.number().nonnegative()).length(101),
      }),
    )
    .min(1),
});
export type Pyramid = z.infer<typeof Pyramid>;
