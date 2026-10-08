// Which indicators appear on each topic page, in order. A card with several indicators
// draws them on one chart (same unit); its title comes from messages `cards.{id}`.
// Topic headline (home page) = the first card, which is the first indicator listed for
// that topic in the project brief §4. This rule is stated on the methodology page.

import type { Topic } from "./topics";

export type CardDef = { id: string; indicators: string[] };

const one = (id: string): CardDef => ({ id, indicators: [id] });

export const DASHBOARD: Record<Topic, CardDef[]> = {
  economy: [
    one("gdp-growth-quarterly"),
    { id: "gdp-growth-forecasts", indicators: ["gdp-growth-annual", "forecast-gdp-growth-ec", "forecast-gdp-growth-imf"] },
    one("gdp-per-capita"),
    one("cpi-inflation-monthly"),
    one("unemployment-rate"),
    one("employed"),
  ],
  "cost-of-living": [
    one("cpi-food-yoy"),
    { id: "prices-vs-incomes", indicators: ["prices-2018", "minimum-wage-2018", "median-wage-2018", "household-income-2018"] },
    { id: "energy-prices", indicators: ["cpi-electricity-yoy", "cpi-natural-gas-yoy", "cpi-diesel-yoy", "cpi-petrol-yoy"] },
    { id: "ends-meet", indicators: ["ends-meet-great-difficulty", "ends-meet-difficulty"] },
    one("unexpected-expenses"),
    one("home-not-warm"),
    one("utility-arrears"),
    { id: "housing-overburden", indicators: ["housing-overburden-total", "housing-overburden-renters", "housing-overburden-mortgage"] },
  ],
  "public-finances": [
    one("tax-revenue-gdp"),
    { id: "revenue-by-tax", indicators: ["revenue-irpf", "revenue-iva", "revenue-sociedades"] },
    one("deficit-gdp"),
    { id: "deficit-forecasts", indicators: ["deficit-gdp", "forecast-balance-ec", "forecast-balance-imf"] },
    one("debt-gdp-quarterly"),
    one("debt-eur-quarterly"),
    { id: "debt-forecasts", indicators: ["debt-gdp", "forecast-debt-ec", "forecast-debt-imf"] },
  ],
  "public-spending": [
    { id: "spending-vs-revenue", indicators: ["spending-total-gdp", "revenue-total-gdp"] },
    { id: "spending-forecasts", indicators: ["spending-total-gdp", "forecast-expenditure-ec", "forecast-expenditure-imf"] },
    { id: "revenue-forecasts", indicators: ["revenue-total-gdp", "forecast-revenue-ec", "forecast-revenue-imf"] },
    one("spending-old-age-gdp"),
    one("spending-health-gdp"),
    one("spending-education-gdp"),
    { id: "defence-cofog-nato", indicators: ["defence-cofog-gdp", "defence-nato-gdp"] },
    one("spending-debt-interest-gdp"),
    one("spending-public-order-gdp"),
    one("spending-economic-affairs-gdp"),
    { id: "pension-projections", indicators: ["projection-pensions-airef", "projection-pensions-ageing-report"] },
    { id: "health-projections", indicators: ["projection-health-airef", "projection-health-ageing-report"] },
    { id: "education-projections", indicators: ["projection-education-airef", "projection-education-ageing-report"] },
    { id: "ltc-projections", indicators: ["projection-ltc-airef", "projection-ltc-ageing-report"] },
    {
      id: "spending-per-person",
      indicators: ["spending-old-age-per-person", "spending-health-per-person", "spending-education-per-person", "spending-defence-per-person"],
    },
  ],
  housing: [
    one("house-prices"),
    one("rent-cpi"),
    one("rent-index"),
    one("dwellings-completed-12m"),
    one("protected-dwellings"),
    one("price-to-income"),
    one("households-renting"),
  ],
  pensions: [
    one("pensions-count"),
    one("pension-average-retirement"),
    one("pension-median-retirement"),
    one("pension-payroll"),
    one("affiliates-per-pension"),
    one("pension-spending-gdp"),
    { id: "pension-projections", indicators: ["projection-pensions-airef", "projection-pensions-ageing-report"] },
    one("pensioners"),
    { id: "births-deaths-projection", indicators: ["births-with-projection", "deaths-with-projection"] },
    one("life-expectancy-65"),
    one("projected-share-65-plus"),
    one("social-security-balance-gdp"),
  ],
  labour: [
    one("activity-rate"),
    { id: "unemployment-by-sex", indicators: ["unemployment-rate-men", "unemployment-rate-women"] },
    one("youth-unemployment-rate"),
    one("temporary-contract-share"),
    one("median-salary"),
    one("ss-affiliates"),
    { id: "occupation-skill-shares", indicators: ["share-high-skill-occupations", "share-elementary-occupations"] },
    one("share-employed-tertiary"),
    { id: "overqualification", indicators: ["overqualification-es", "overqualification-eu"] },
    { id: "involuntary-part-time", indicators: ["involuntary-part-time-es", "involuntary-part-time-eu"] },
  ],
  income: [
    { id: "irpf-percentiles", indicators: ["irpf-income-p50", "irpf-income-p90", "irpf-income-p99"] },
    { id: "wage-earners-percentiles", indicators: ["wage-earners-p50", "wage-earners-p90", "wage-earners-p99"] },
    { id: "wage-percentiles-ine", indicators: ["wage-p10", "wage-p50", "wage-mean", "wage-p90"] },
    { id: "household-income-percentiles", indicators: ["household-income-p50", "household-income-p90", "household-income-p99"] },
    { id: "household-wealth-percentiles", indicators: ["household-wealth-p50", "household-wealth-mean", "household-wealth-p90"] },
    { id: "wages-by-sex", indicators: ["wage-p50-men", "wage-p50-women"] },
    { id: "wage-real", indicators: ["wage-p50", "wage-p50-real"] },
    { id: "epa-monthly-wages", indicators: ["epa-wage-p10", "epa-wage-p50", "epa-wage-p90"] },
    one("minimum-wage-monthly"),
  ],
  demographics: [
    one("population"),
    one("share-65-plus"),
    one("dependency-ratio"),
    one("median-age"),
    one("projected-share-65-plus"),
  ],
  "births-deaths": [
    one("births"),
    one("deaths"),
    one("natural-change"),
    { id: "births-deaths-monthly", indicators: ["births-monthly", "deaths-monthly"] },
    { id: "births-deaths-projection", indicators: ["births-with-projection", "deaths-with-projection"] },
    { id: "births-by-mother-origin", indicators: ["share-births-mother-born-abroad", "share-births-mother-foreign"] },
    { id: "births-by-mother-nationality", indicators: ["births-mother-spanish", "births-mother-foreign"] },
    one("fertility-rate"),
    one("life-expectancy"),
    one("life-expectancy-65"),
  ],
  immigration: [
    { id: "immigration", indicators: ["immigration-emcr", "immigration-em"] },
    one("foreign-born-population"),
    one("foreign-nationality-population"),
    { id: "net-migration", indicators: ["net-migration-emcr", "net-migration-em"] },
    one("foreign-affiliates"),
  ],
  emigration: [
    { id: "emigration", indicators: ["emigration-emcr", "emigration-em"] },
    { id: "emigration-by-nationality", indicators: ["emigration-spanish-emcr", "emigration-foreign-emcr"] },
    one("spaniards-abroad"),
  ],
  safety: [
    { id: "crime-rate", indicators: ["crime-rate", "crime-rate-excl-online-fraud"] },
    one("homicide-rate"),
    { id: "robbery-burglary", indicators: ["violent-robbery-rate", "home-burglary-rate"] },
    one("sexual-offences-rate"),
    one("online-fraud-rate"),
    one("perceived-crime-area"),
  ],
};

/** Distribution cards (who is in which amount range) shown on each topic page, in order. */
export const DISTRIBUTION_CARDS: Partial<Record<Topic, string[]>> = {
  pensions: ["retirement-pensions"],
  income: ["irpf-income", "wage-earners", "wage-earners-men", "wage-earners-women", "pensioners", "wealth-tax-filers"],
};

export type StatColumn = "mean" | "median" | "mode" | "p90" | "p99";

/**
 * Rows of the "who is who" comparison on the income topic: each population with its mean,
 * median, most common amount, P90 and P99. Rows come either from a bracketed distribution
 * (estimated where marked ≈) or from officially published statistics (indicator ids).
 */
export type PercentileRow =
  | { id: string; distribution: string }
  | { id: string; indicators: Partial<Record<StatColumn, string>>; per: "year" | "month" | "total" };

export const PERCENTILE_TABLE: PercentileRow[] = [
  { id: "irpf", distribution: "irpf-income" },
  { id: "wage-earners", distribution: "wage-earners" },
  { id: "wage-earners-men", distribution: "wage-earners-men" },
  { id: "wage-earners-women", distribution: "wage-earners-women" },
  { id: "employees-ine", indicators: { mean: "wage-mean", median: "wage-p50", p90: "wage-p90" }, per: "year" },
  {
    id: "household-income",
    indicators: { mean: "household-income-mean", median: "household-income-p50", p90: "household-income-p90", p99: "household-income-p99" },
    per: "year",
  },
  { id: "pensioners", distribution: "pensioners" },
  { id: "retirement-pensions", distribution: "retirement-pensions" },
  { id: "household-wealth", indicators: { mean: "household-wealth-mean", median: "household-wealth-p50", p90: "household-wealth-p90" }, per: "total" },
  { id: "wealth-tax", distribution: "wealth-tax-filers" },
];

/**
 * Category comparisons at the latest period (bars), shown after the indicator cards.
 * `show: "change"` draws the change since the same period of the first year shown (price
 * indices); the first indicator is then the reference row and the rest are sorted.
 */
export type BarCardDef = { id: string; indicators: string[]; show?: "level" | "change" };

const CPI_GROUPS = ["food", "alcohol-tobacco", "clothing", "housing", "furnishings", "health", "transport", "communications", "recreation", "education", "restaurants", "insurance", "personal"];
const CPI_ITEMS = ["bread", "milk", "eggs", "oils", "sugar", "rent", "electricity", "gas", "diesel", "petrol"];

export const BAR_CARDS: Partial<Record<Topic, BarCardDef[]>> = {
  "cost-of-living": [
    { id: "price-change-by-group", indicators: ["cpi-index-monthly", ...CPI_GROUPS.map((g) => `cpi-group-${g}`)], show: "change" },
    { id: "price-change-items", indicators: ["cpi-index-monthly", ...CPI_ITEMS.map((g) => `cpi-item-${g}`)], show: "change" },
  ],
  income: [

    {
      id: "wages-by-age",
      indicators: ["wage-mean-age-under-25", "wage-mean-age-25-34", "wage-mean-age-35-44", "wage-mean-age-45-54", "wage-mean-age-55-plus"],
    },
  ],
};

/** Figures from documents shown on a topic page, grouped (titles in messages `estimates.groups.{id}`). */
export const ESTIMATE_GROUPS: Partial<Record<Topic, { id: string; ids: string[] }[]>> = {
  pensions: [
    { id: "pension-law-2026", ids: ["maximum-pension-2026", "minimum-retirement-pension-2026", "pension-revaluation-2026", "maximum-contribution-base-2026"] },
    {
      id: "system-finances-2025",
      ids: ["state-transfers-social-security-2025", "fedea-social-security-balance-2025", "reserve-fund-2025", "sick-leave-spending-2025"],
    },
    { id: "pension-studies", ids: ["bde-pension-return-2017", "oecd-gross-replacement-rate", "oecd-old-age-ratio-2050"] },
  ],
};

/** Contribution rates shown as a table on the pensions page. */
export const CONTRIBUTION_RATES = [
  "contribution-rate-common-contingencies-2026",
  "contribution-rate-mei-2026",
  "contribution-rate-unemployment-2026",
  "contribution-rate-training-2026",
  "contribution-rate-fogasa-2026",
];

/**
 * Official projection shown on a topic's home card, from the first to the last year of the
 * pensions slider (population projection years), so "today" and "in 20 years" match.
 */
export const HOME_OUTLOOK: Partial<Record<Topic, string>> = {
  pensions: "projection-support-ratio-ageing-report",
  demographics: "projected-share-65-plus",
};

/**
 * "Gender pay gap: the same job?" section on the income page, from the most to the least
 * comparable official measure: Eurostat's decomposition (same measured characteristics), the
 * same occupation group at full time, and the unadjusted gap.
 */
export const GENDER_PAY_GAP = {
  estimates: ["eurostat-unexplained-gender-pay-gap-2022", "eurostat-unadjusted-gender-pay-gap-2022"],
  occupation: ["pay-ratio-occ-all", ...["1", "2", "3", "4", "5", "7", "8", "9"].map((g) => `pay-ratio-occ-${g}`)],
  cards: [
    { id: "gender-pay-gap-by-working-time", indicators: ["gender-pay-gap", "gender-pay-gap-full-time", "gender-pay-gap-part-time"] },
    { id: "part-time-by-sex", indicators: ["part-time-share-women", "part-time-share-men"] },
  ] satisfies CardDef[],
};

/** Indicators drawn by special panels (pensions outlook, jobs by occupation, pensions explainer). */
const PANEL_INDICATORS = [
  ...["contributors", "pensioners", "support-ratio", "pension-contributions", "pension-balance"].map((w) => `projection-${w}-ageing-report`),
  ...["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map((g) => `employed-occupation-${g}`),
  ...["retirement", "widowhood", "disability", "orphanhood", "family"].map((c) => `pensions-count-${c}`),
];

/** Every indicator shown somewhere on a topic or home page (the methodology flags the rest). */
export function shownIndicatorIds(): Set<string> {
  return new Set([
    ...Object.values(DASHBOARD).flatMap((cards) => cards.flatMap((c) => c.indicators)),
    ...Object.values(BAR_CARDS).flatMap((cards) => (cards ?? []).flatMap((c) => c.indicators)),
    ...GENDER_PAY_GAP.occupation,
    ...GENDER_PAY_GAP.cards.flatMap((c) => c.indicators),
    ...Object.values(HOME_OUTLOOK),
    ...PANEL_INDICATORS,
  ]);
}
