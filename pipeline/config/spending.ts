// Public spending by function (COFOG, Eurostat gov_10a_exp, general government S13) and
// what finances it (taxes and social contributions, other revenue, borrowing).
// Verified on 2026-10-08: latest complete year 2024.

import type { Localized } from "../../lib/schema";
import type { IndicatorDef } from "../lib/define";
import { eurostat, eurostatMulti, type Point } from "../lib/sources";

const L = (es: string, en: string, ca: string): Localized => ({ es, en, ca });

/** COFOG functions shown. GF1002 sits inside GF10 and GF0107 inside GF01. */
export const FUNCTIONS = [
  { code: "GF07", slug: "health", label: L("Sanidad", "Health", "Sanitat") },
  { code: "GF09", slug: "education", label: L("Educación", "Education", "Educació") },
  { code: "GF1002", slug: "old-age", label: L("Vejez (sobre todo pensiones)", "Old age (mostly pensions)", "Vellesa (sobretot pensions)") },
  { code: "GF10", slug: "social-protection", label: L("Protección social (total)", "Social protection (total)", "Protecció social (total)") },
  { code: "GF02", slug: "defence", label: L("Defensa", "Defence", "Defensa") },
  { code: "GF0107", slug: "debt-interest", label: L("Operaciones de deuda pública (sobre todo intereses)", "Public debt transactions (mostly interest)", "Operacions de deute públic (sobretot interessos)") },
  { code: "GF01", slug: "general-services", label: L("Servicios públicos generales (total)", "General public services (total)", "Serveis públics generals (total)") },
  { code: "GF03", slug: "public-order", label: L("Orden público y seguridad", "Public order and safety", "Ordre públic i seguretat") },
  { code: "GF04", slug: "economic-affairs", label: L("Asuntos económicos", "Economic affairs", "Afers econòmics") },
  { code: "GF05", slug: "environment", label: L("Protección del medio ambiente", "Environmental protection", "Protecció del medi ambient") },
  { code: "GF06", slug: "housing-community", label: L("Vivienda y servicios comunitarios", "Housing and community amenities", "Habitatge i serveis comunitaris") },
  { code: "GF08", slug: "culture", label: L("Cultura, ocio y religión", "Recreation, culture and religion", "Cultura, lleure i religió") },
] as const;

const COFOG_NOTE = L(
  "Gasto de todas las administraciones públicas (Estado, comunidades autónomas, entidades locales y Seguridad Social) según la clasificación funcional COFOG. El último año completo es 2024.",
  "Spending by all levels of government (central, regional, local and Social Security) by function (COFOG classification). The latest complete year is 2024.",
  "Despesa de totes les administracions públiques (Estat, comunitats autònomes, ens locals i Seguretat Social) segons la classificació funcional COFOG. L'últim any complet és el 2024.",
);

const codes = ["TOTAL", ...FUNCTIONS.map((f) => f.code)];
const pcGdp = eurostatMulti({
  sourceId: "eurostat-gov-10a-exp-pc-gdp-es",
  dataset: "gov_10a_exp",
  filters: { geo: "ES", sector: "S13", na_item: "TE", unit: "PC_GDP" },
  by: "cofog99",
  values: FUNCTIONS.map((f) => f.code),
  datasetLabel: "General government expenditure by function (COFOG), % of GDP",
});
const mioEur = eurostatMulti({
  sourceId: "eurostat-gov-10a-exp-mio-eur-es",
  dataset: "gov_10a_exp",
  filters: { geo: "ES", sector: "S13", na_item: "TE", unit: "MIO_EUR" },
  by: "cofog99",
  values: codes,
  datasetLabel: "General government expenditure by function (COFOG), million euros",
});

const toEur = (points: Point[]) => points.map((p) => ({ ...p, value: p.value * 1e6 }));

const byYear = (points: Point[]) => new Map(points.map((p) => [p.period, p]));

/** € per person in constant euros of the deflator's latest year: amount / population × D_last / D_year. */
function perPersonReal([amount, population, deflator]: Point[][]) {
  const pop = byYear(population);
  const def = byYear(deflator);
  const lastDef = deflator.reduce((a, b) => (b.period > a.period ? b : a));
  return amount.flatMap((p) => {
    const n = pop.get(p.period);
    const d = def.get(p.period);
    if (!n || !d) return [];
    const provisional = [p, n, d].some((x) => x.status === "provisional");
    return [{ period: p.period, value: (p.value / n.value) * (lastDef.value / d.value), status: provisional ? ("provisional" as const) : ("final" as const) }];
  });
}

export const SPENDING: IndicatorDef[] = [
  {
    id: "spending-total-gdp",
    topic: "public-spending",
    unit: "percent_gdp",
    frequency: "A",
    decimals: 1,
    yZero: true,
    label: L("Gasto público total", "Total public spending", "Despesa pública total"),
    method: "Total general government expenditure, % of GDP, Eurostat gov_10a_main (TE, S13). Same total as COFOG, but published one year earlier.",
    resource: eurostat({
      sourceId: "eurostat-gov-10a-main-te-pc-gdp-es",
      dataset: "gov_10a_main",
      filters: { geo: "ES", unit: "PC_GDP", sector: "S13", na_item: "TE" },
      datasetLabel: "Government revenue, expenditure and main aggregates",
    }),
  },
  {
    id: "revenue-total-gdp",
    topic: "public-spending",
    unit: "percent_gdp",
    frequency: "A",
    decimals: 1,
    yZero: true,
    label: L("Ingresos públicos totales", "Total public revenue", "Ingressos públics totals"),
    method: "Total general government revenue, % of GDP, Eurostat gov_10a_main (TR, S13).",
    resource: eurostat({
      sourceId: "eurostat-gov-10a-main-tr-pc-gdp-es",
      dataset: "gov_10a_main",
      filters: { geo: "ES", unit: "PC_GDP", sector: "S13", na_item: "TR" },
      datasetLabel: "Government revenue, expenditure and main aggregates",
    }),
  },
  ...FUNCTIONS.map(
    (f): IndicatorDef => ({
      id: `spending-${f.slug}-gdp`,
      topic: "public-spending",
      unit: "percent_gdp",
      frequency: "A",
      decimals: 1,
      yZero: true,
      label: f.label,
      note: COFOG_NOTE,
      method: `General government expenditure on COFOG ${f.code}, % of GDP, Eurostat gov_10a_exp (S13, TE).`,
      resource: pcGdp.series(f.code),
    }),
  ),
  {
    id: "spending-total-eur",
    topic: "public-spending",
    unit: "eur",
    frequency: "A",
    decimals: 0,
    yZero: true,
    label: L("Gasto público total (euros)", "Total public spending (euros)", "Despesa pública total (euros)"),
    note: COFOG_NOTE,
    method: "Total general government expenditure, million euros converted to euros, Eurostat gov_10a_exp (COFOG TOTAL, S13, TE).",
    resource: mioEur.series("TOTAL"),
    map: toEur,
  },
  ...FUNCTIONS.map(
    (f): IndicatorDef => ({
      id: `spending-${f.slug}-eur`,
      topic: "public-spending",
      unit: "eur",
      frequency: "A",
      decimals: 0,
      yZero: true,
      label: f.label,
      note: COFOG_NOTE,
      method: `General government expenditure on COFOG ${f.code}, million euros converted to euros, Eurostat gov_10a_exp (S13, TE).`,
      resource: mioEur.series(f.code),
      map: toEur,
    }),
  ),
  {
    id: "revenue-total-eur",
    topic: "public-spending",
    unit: "eur",
    frequency: "A",
    decimals: 0,
    yZero: true,
    label: L("Ingresos públicos totales (euros)", "Total public revenue (euros)", "Ingressos públics totals (euros)"),
    method: "Total general government revenue, million euros converted to euros, Eurostat gov_10a_main (TR, S13).",
    resource: eurostat({
      sourceId: "eurostat-gov-10a-main-tr-mio-eur-es",
      dataset: "gov_10a_main",
      filters: { geo: "ES", unit: "MIO_EUR", sector: "S13", na_item: "TR" },
      datasetLabel: "Government revenue, expenditure and main aggregates",
    }),
    map: toEur,
  },
  {
    id: "taxes-contributions-eur",
    topic: "public-spending",
    unit: "eur",
    frequency: "A",
    decimals: 0,
    yZero: true,
    label: L("Impuestos y cotizaciones sociales (euros)", "Taxes and social contributions (euros)", "Impostos i cotitzacions socials (euros)"),
    method: "Taxes and net social contributions received by general government (D2+D5+D91+D61 minus amounts assessed but unlikely to be collected), million euros converted to euros, Eurostat gov_10a_taxag (S13).",
    resource: eurostat({
      sourceId: "eurostat-gov-10a-taxag-mio-eur-s13-es",
      dataset: "gov_10a_taxag",
      filters: { geo: "ES", unit: "MIO_EUR", sector: "S13", na_item: "D2_D5_D91_D61_M_D995" },
      datasetLabel: "Main national accounts tax aggregates",
    }),
    map: toEur,
  },
  {
    id: "population-annual",
    topic: "public-spending",
    unit: "persons",
    frequency: "A",
    decimals: 0,
    yZero: false,
    label: L("Población (media anual, cuentas nacionales)", "Population (annual average, national accounts)", "Població (mitjana anual, comptes nacionals)"),
    method: "Total population, annual average, national accounts concept, Eurostat nama_10_pe (POP_NC), thousand persons converted to persons.",
    resource: eurostat({
      sourceId: "eurostat-nama-10-pe-pop-es",
      dataset: "nama_10_pe",
      filters: { geo: "ES", unit: "THS_PER", na_item: "POP_NC" },
      datasetLabel: "Population and employment (national accounts)",
    }),
    map: (points) => points.map((p) => ({ ...p, value: p.value * 1000 })),
  },
  {
    id: "gdp-deflator",
    topic: "public-spending",
    unit: "index",
    frequency: "A",
    decimals: 1,
    yZero: false,
    label: L("Deflactor del PIB (2015 = 100)", "GDP deflator (2015 = 100)", "Deflactor del PIB (2015 = 100)"),
    method: "GDP price index (implicit deflator), 2015 = 100, Eurostat nama_10_gdp (B1GQ, PD15_EUR).",
    resource: eurostat({
      sourceId: "eurostat-nama-10-gdp-deflator-es",
      dataset: "nama_10_gdp",
      filters: { geo: "ES", unit: "PD15_EUR", na_item: "B1GQ" },
      datasetLabel: "GDP and main components: price index",
    }),
  },
  ...(["health", "education", "old-age", "defence"] as const).map((slug): IndicatorDef => {
    const f = FUNCTIONS.find((x) => x.slug === slug)!;
    return {
      id: `spending-${slug}-per-person`,
      topic: "public-spending",
      unit: "eur",
      frequency: "A",
      decimals: 0,
      yZero: true,
      label: f.label,
      note: L(
        "Euros por habitante, a precios del último año disponible (deflactados con el deflactor del PIB).",
        "Euros per person, at prices of the latest year available (adjusted with the GDP deflator).",
        "Euros per habitant, a preus de l'últim any disponible (deflactats amb el deflactor del PIB).",
      ),
      method: `Spending on COFOG ${f.code} divided by population, in constant prices of the latest year using the GDP deflator.`,
      inputs: [`spending-${slug}-eur`, "population-annual", "gdp-deflator"],
      formula: "spending / population × deflator(latest year) / deflator(year)",
      compute: perPersonReal,
    };
  }),
];
