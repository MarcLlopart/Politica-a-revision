// Officially published percentiles (no interpolation): INE wage structure survey,
// Eurostat EU-SILC household income, Banco de España household wealth (EFF).
// Identifiers verified on 2026-10-08.

import type { Localized } from "../../lib/schema";
import type { IndicatorDef } from "../lib/define";
import { eurostat, file, ineSeries, type Point } from "../lib/sources";

const P = (es: string, en: string, ca: string): Localized => ({ es, en, ca });

// ---------------------------------------------------------------- INE wages (EAES)

const EAES_NOTE = P(
  "Ganancia bruta anual por trabajador, ambos sexos (industria, construcción y servicios). Euros corrientes. Encuesta Anual de Estructura Salarial del INE.",
  "Gross annual earnings per employee, both sexes (industry, construction and services). Current euros. INE Annual Wage Structure Survey.",
  "Guany brut anual per treballador, tots dos sexes (indústria, construcció i serveis). Euros corrents. Enquesta Anual d'Estructura Salarial de l'INE.",
);

const eaes = (id: string, code: string, label: Localized, stat: string): IndicatorDef => ({
  id,
  topic: "income",
  unit: "eur",
  frequency: "A",
  decimals: 0,
  yZero: true,
  label,
  note: EAES_NOTE,
  method: `${stat} of gross annual earnings per employee, as published by INE (Encuesta Anual de Estructura Salarial, table 28191).`,
  resource: ineSeries({ code, tableId: "28191" }),
});

// ---------------------------------------------------------------- Eurostat EU-SILC income

const SILC_NOTE = P(
  "Renta neta disponible equivalente por persona: renta del hogar tras impuestos y transferencias dividida por las unidades de consumo (1 primer adulto, 0,5 otros mayores de 13, 0,3 menores de 14). El año es el de la encuesta; la renta es del año anterior.",
  "Equivalised net disposable income per person: household income after taxes and transfers divided by consumption units (1 for the first adult, 0.5 for others aged 14+, 0.3 under 14). The year is the survey year; incomes refer to the previous year.",
  "Renda neta disponible equivalent per persona: renda de la llar després d'impostos i transferències dividida per les unitats de consum (1 primer adult, 0,5 altres de 14 anys o més, 0,3 menors de 14). L'any és el de l'enquesta; la renda és de l'any anterior.",
);

const silcQuantile = (id: string, quantile: string, label: Localized): IndicatorDef => ({
  id,
  topic: "income",
  unit: "eur",
  frequency: "A",
  decimals: 0,
  yZero: true,
  label,
  note: SILC_NOTE,
  method: `Top cut-off of quantile ${quantile} of equivalised net disposable income, Eurostat ilc_di01 (EU-SILC), Spain.`,
  resource: eurostat({
    sourceId: `eurostat-ilc-di01-${quantile.toLowerCase()}-es`,
    dataset: "ilc_di01",
    filters: { geo: "ES", statinfo: "TC", unit: "EUR", quant_inc: quantile },
    datasetLabel: "Distribution of income by quantiles (EU-SILC)",
  }),
});

// ---------------------------------------------------------------- Banco de España EFF wealth

const EFF_STATS: Record<string, { index: number; label: string }> = {
  mean: { index: 0, label: "MEDIA" },
  p25: { index: 8, label: "PERCENTIL 25" },
  p50: { index: 9, label: "MEDIANA" },
  p75: { index: 10, label: "PERCENTIL 75" },
  p90: { index: 11, label: "PERCENTIL 90" },
};

/** EFF download: one statistic of household net wealth, all waves (thousand euros → euros). */
function effParse(expected: string) {
  return (body: Buffer): Record<string, Point[]> => {
    const lines = body.toString("utf8").trim().split(/\r?\n/);
    const header = lines[0].split(",");
    const col = (name: string) => header.indexOf(name);
    if (col("estadistico") === -1 || col("ola") === -1 || col("valor") === -1) throw new Error("EFF: unexpected CSV header");
    const points: Point[] = [];
    for (const line of lines.slice(1)) {
      const cells = line.split(",");
      if (cells[col("elemento")] !== "RIQUEZA NETA" || cells[col("desglose")] !== "TODOS LOS HOGARES") continue;
      // The download addresses statistics by position; check it returned the one we asked for.
      if (cells[col("estadistico")] !== expected) throw new Error(`EFF: got ${cells[col("estadistico")]}, expected ${expected}`);
      points.push({ period: cells[col("ola")], value: Number(cells[col("valor")]) * 1000, status: "final" });
    }
    if (points.length === 0) throw new Error("EFF: no rows");
    return { values: points };
  };
}

const EFF_NOTE = P(
  "Riqueza neta del hogar (activos menos deudas, sin vehículos). Encuesta Financiera de las Familias, una ola cada 2–3 años. Banco de España expresa todas las olas en euros de la última (2024).",
  "Household net wealth (assets minus debts, excluding vehicles). Survey of Household Finances, one wave every 2–3 years. Banco de España expresses all waves in euros of the latest wave (2024).",
  "Riquesa neta de la llar (actius menys deutes, sense vehicles). Enquesta Financera de les Famílies, una onada cada 2–3 anys. El Banco de España expressa totes les onades en euros de l'última (2024).",
);

const eff = (stat: keyof typeof EFF_STATS, label: Localized): IndicatorDef => {
  const s = EFF_STATS[stat];
  return {
    id: `household-wealth-${stat}`,
    topic: "income",
    unit: "eur",
    frequency: "A",
    decimals: 0,
    yZero: true,
    label,
    note: EFF_NOTE,
    method: `${s.label} of household net wealth, Banco de España Encuesta Financiera de las Familias (EFF download tool, statistic index ${s.index}), thousand euros converted to euros.`,
    resource: file({
      sourceId: `bde-eff-net-wealth-${stat}`,
      group: "bde",
      filename: `eff-net-wealth-${stat}.csv`,
      url: `https://app.bde.es/efs_www/eff_download_csv?concept=[0]&variable=[0]&statistic=[${s.index}]&population=[0]&category=[0]&rows=[0]&lang=ES&select_all=False`,
      humanUrl: "https://app.bde.es/efs_www/download?lang=ES",
      publisher: "Banco de España",
      dataset: "Encuesta Financiera de las Familias (EFF): riqueza neta de los hogares",
      licence: "Reuse permitted with attribution (Banco de España legal notice)",
      attribution: "Fuente: Banco de España, Encuesta Financiera de las Familias",
      parse: effParse(s.label),
    }).series("values"),
  };
};

export const INCOME: IndicatorDef[] = [
  eaes("wage-p10", "EAES740", P("P10", "P10", "P10"), "10th percentile"),
  eaes("wage-p25", "EAES739", P("P25", "P25", "P25"), "25th percentile (lower quartile)"),
  // Same series as "median-salary" (labour topic), labelled for percentile charts.
  eaes("wage-p50", "EAES738", P("Mediana (P50)", "Median (P50)", "Mediana (P50)"), "Median"),
  eaes("wage-p75", "EAES737", P("P75", "P75", "P75"), "75th percentile (upper quartile)"),
  eaes("wage-p90", "EAES736", P("P90", "P90", "P90"), "90th percentile"),
  eaes("wage-mean", "EAES741", P("Media", "Average", "Mitjana"), "Mean"),

  silcQuantile("household-income-p10", "D1", P("P10", "P10", "P10")),
  silcQuantile("household-income-p25", "Q1", P("P25", "P25", "P25")),
  silcQuantile("household-income-p50", "D5", P("Mediana (P50)", "Median (P50)", "Mediana (P50)")),
  silcQuantile("household-income-p75", "Q3", P("P75", "P75", "P75")),
  silcQuantile("household-income-p90", "D9", P("P90", "P90", "P90")),
  silcQuantile("household-income-p95", "P95", P("P95", "P95", "P95")),
  silcQuantile("household-income-p99", "P99", P("P99", "P99", "P99")),
  {
    id: "household-income-mean",
    topic: "income",
    unit: "eur",
    frequency: "A",
    decimals: 0,
    yZero: true,
    label: P("Media", "Average", "Mitjana"),
    note: SILC_NOTE,
    method: "Mean equivalised net disposable income, Eurostat ilc_di03 (EU-SILC), Spain, all ages, both sexes.",
    resource: eurostat({
      sourceId: "eurostat-ilc-di03-mean-es",
      dataset: "ilc_di03",
      filters: { geo: "ES", age: "TOTAL", sex: "T", unit: "EUR", statinfo: "MEAN_EI" },
      datasetLabel: "Mean and median income by age and sex (EU-SILC)",
    }),
  },

  eff("mean", P("Media", "Average", "Mitjana")),
  eff("p25", P("P25", "P25", "P25")),
  eff("p50", P("Mediana (P50)", "Median (P50)", "Mediana (P50)")),
  eff("p75", P("P75", "P75", "P75")),
  eff("p90", P("P90", "P90", "P90")),
];
