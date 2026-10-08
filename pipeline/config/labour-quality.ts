// Job quality: what kind of jobs people hold (occupation, education) and how well they
// match (over-qualification, involuntary part-time). INE EPA quarterly tables 65314
// (occupation, CNO-11, from 2011) and 65116 (education, CNED-2014, from 2014); Eurostat
// LFS annual series for EU comparison. Verified on 2026-10-08.

import type { Localized } from "../../lib/schema";
import { combine, type IndicatorDef } from "../lib/define";
import { eurostatMulti, ineSeries, type Point } from "../lib/sources";

const L = (es: string, en: string, ca: string): Localized => ({ es, en, ca });

/** CNO-11 major groups (= ISCO-08 major groups), national total, both sexes, thousands. */
export const OCCUPATIONS = [
  { group: "1", code: "EPA400757", skill: "high", label: L("Directores y gerentes", "Managers", "Directors i gerents") },
  { group: "2", code: "EPA400771", skill: "high", label: L("Profesionales científicos e intelectuales", "Professionals", "Professionals científics i intel·lectuals") },
  { group: "3", code: "EPA400795", skill: "high", label: L("Técnicos y profesionales de apoyo", "Technicians and associate professionals", "Tècnics i professionals de suport") },
  { group: "4", code: "EPA400815", skill: "medium", label: L("Empleados de oficina", "Clerical support workers", "Empleats d'oficina") },
  { group: "5", code: "EPA400831", skill: "medium", label: L("Restauración, servicios personales, protección y ventas", "Service and sales workers", "Restauració, serveis personals, protecció i vendes") },
  { group: "6", code: "EPA400319", skill: "medium", label: L("Agricultura, ganadería y pesca (cualificados)", "Skilled agricultural, forestry and fishery workers", "Agricultura, ramaderia i pesca (qualificats)") },
  { group: "7", code: "EPA400331", skill: "medium", label: L("Oficios cualificados de industria y construcción", "Craft and related trades workers", "Oficis qualificats d'indústria i construcció") },
  { group: "8", code: "EPA400353", skill: "medium", label: L("Operadores de maquinaria y montadores", "Plant and machine operators, and assemblers", "Operadors de maquinària i muntadors") },
  { group: "9", code: "EPA400367", skill: "elementary", label: L("Ocupaciones elementales", "Elementary occupations", "Ocupacions elementals") },
  { group: "0", code: "EPA400389", skill: "military", label: L("Ocupaciones militares", "Armed forces occupations", "Ocupacions militars") },
] as const;

const OCC_NOTE = L(
  "Clasificación Nacional de Ocupaciones (CNO-11), equivalente a la internacional ISCO-08. Serie desde 2011. Datos trimestrales sin desestacionalizar.",
  "Spanish occupation classification CNO-11, equivalent to the international ISCO-08. Series since 2011. Quarterly, not seasonally adjusted.",
  "Classificació Nacional d'Ocupacions (CNO-11), equivalent a la internacional ISCO-08. Sèrie des del 2011. Dades trimestrals sense desestacionalitzar.",
);

const total = ineSeries({ code: "EPA400755", tableId: "65314", scale: "1E3" });
const occ = Object.fromEntries(OCCUPATIONS.map((o) => [o.group, ineSeries({ code: o.code, tableId: "65314", scale: "1E3" })]));

/** Sum of several series period by period, as a share of a total (%). */
function shareOf(parts: Point[][], whole: Point[]) {
  const sum = parts.slice(1).reduce((acc, p) => combine(acc, p, (a, b) => a + b), parts[0]);
  return combine(sum, whole, (a, b) => (a / b) * 100).map((p) => ({ ...p, from: 0 }));
}

const SPAIN_EU = (dataset: string, sourceId: string, datasetLabel: string, filters: Record<string, string>) =>
  eurostatMulti({ sourceId, dataset, filters, by: "geo", values: ["ES", "EU27_2020"], datasetLabel });

const overq = SPAIN_EU("lfsa_eoqgan", "eurostat-lfsa-eoqgan-es-eu", "Over-qualification rates (LFS)", {
  sex: "T",
  age: "Y20-64",
  citizen: "TOTAL",
  unit: "PC",
});
const invPt = SPAIN_EU("lfsa_eppgai", "eurostat-lfsa-eppgai-es-eu", "Involuntary part-time employment as % of part-time employment (LFS)", {
  sex: "T",
  age: "Y20-64",
  unit: "PC",
});

export const LABOUR_QUALITY: IndicatorDef[] = [
  ...OCCUPATIONS.map(
    (o): IndicatorDef => ({
      id: `employed-occupation-${o.group}`,
      topic: "labour",
      unit: "persons",
      frequency: "Q",
      decimals: 0,
      yZero: true,
      label: o.label,
      note: OCC_NOTE,
      method: `Employed people in CNO-11 major group ${o.group}, national total, both sexes, as published by INE (EPA, table 65314), thousands converted to persons.`,
      resource: occ[o.group],
    }),
  ),
  {
    id: "share-high-skill-occupations",
    topic: "labour",
    unit: "percent",
    frequency: "Q",
    decimals: 1,
    yZero: true,
    label: L(
      "Directivos, profesionales y técnicos (grupos 1–3)",
      "Managers, professionals and technicians (groups 1–3)",
      "Directius, professionals i tècnics (grups 1–3)",
    ),
    note: OCC_NOTE,
    method: "Employed in CNO-11 major groups 1, 2 and 3 (the ISCO-08 groups with the highest skill levels) as a share of all employed (INE EPA, table 65314).",
    formula: "(group 1 + group 2 + group 3) / total employed × 100",
    resources: [occ["1"], occ["2"], occ["3"], total],
    combine: ([a, b, c, all]) => shareOf([a, b, c], all),
  },
  {
    id: "share-elementary-occupations",
    topic: "labour",
    unit: "percent",
    frequency: "Q",
    decimals: 1,
    yZero: true,
    label: L("Ocupaciones elementales (grupo 9)", "Elementary occupations (group 9)", "Ocupacions elementals (grup 9)"),
    note: OCC_NOTE,
    method: "Employed in CNO-11 major group 9 (elementary occupations, the lowest ISCO-08 skill level) as a share of all employed (INE EPA, table 65314).",
    formula: "group 9 / total employed × 100",
    resources: [occ["9"], total],
    combine: ([nine, all]) => shareOf([nine], all),
  },
  {
    id: "share-employed-tertiary",
    topic: "labour",
    unit: "percent",
    frequency: "Q",
    decimals: 1,
    yZero: true,
    label: L(
      "Ocupados con educación superior",
      "Employed people with higher education",
      "Ocupats amb educació superior",
    ),
    note: L(
      "Educación superior: universidad y formación profesional de grado superior (CNED-2014). Serie desde 2014.",
      "Higher education: university and higher vocational training (CNED-2014). Series since 2014.",
      "Educació superior: universitat i formació professional de grau superior (CNED-2014). Sèrie des del 2014.",
    ),
    method: "Employed people whose highest completed level is higher education, as a share of all employed (INE EPA, table 65116).",
    formula: "employed with higher education / total employed × 100",
    resources: [
      ineSeries({ code: "EPA396614", tableId: "65116", scale: "1E3" }),
      ineSeries({ code: "EPA396607", tableId: "65116", scale: "1E3" }),
    ],
    combine: ([higher, all]) => shareOf([higher], all),
  },
  {
    id: "overqualification-es",
    topic: "labour",
    unit: "percent",
    frequency: "A",
    decimals: 1,
    yZero: true,
    label: L("España", "Spain", "Espanya"),
    note: L(
      "Ocupados de 20 a 64 años con educación superior que trabajan en ocupaciones que no la requieren (grupos 4 a 9), en porcentaje de todos los ocupados con educación superior.",
      "Employed people aged 20–64 with higher education working in occupations that do not require it (groups 4 to 9), as a share of all employed people with higher education.",
      "Ocupats de 20 a 64 anys amb educació superior que treballen en ocupacions que no la requereixen (grups 4 a 9), en percentatge de tots els ocupats amb educació superior.",
    ),
    method: "Over-qualification rate, Eurostat lfsa_eoqgan (EU Labour Force Survey), Spain, both sexes, 20–64.",
    resource: overq.series("ES"),
  },
  {
    id: "overqualification-eu",
    topic: "labour",
    unit: "percent",
    frequency: "A",
    decimals: 1,
    yZero: true,
    label: L("Media UE-27", "EU-27 average", "Mitjana UE-27"),
    method: "Over-qualification rate, Eurostat lfsa_eoqgan (EU Labour Force Survey), EU-27, both sexes, 20–64.",
    resource: overq.series("EU27_2020"),
  },
  {
    id: "involuntary-part-time-es",
    topic: "labour",
    unit: "percent",
    frequency: "A",
    decimals: 1,
    yZero: true,
    label: L("España", "Spain", "Espanya"),
    note: L(
      "Personas que trabajan a tiempo parcial porque no encuentran un empleo a jornada completa, en porcentaje de todo el empleo a tiempo parcial (20 a 64 años).",
      "People working part-time because they could not find a full-time job, as a share of all part-time employment (aged 20–64).",
      "Persones que treballen a temps parcial perquè no troben una feina a jornada completa, en percentatge de tota l'ocupació a temps parcial (20 a 64 anys).",
    ),
    method: "Involuntary part-time employment as % of total part-time employment, Eurostat lfsa_eppgai (EU Labour Force Survey), Spain, both sexes, 20–64.",
    resource: invPt.series("ES"),
  },
  {
    id: "involuntary-part-time-eu",
    topic: "labour",
    unit: "percent",
    frequency: "A",
    decimals: 1,
    yZero: true,
    label: L("Media UE-27", "EU-27 average", "Mitjana UE-27"),
    method: "Involuntary part-time employment as % of total part-time employment, Eurostat lfsa_eppgai, EU-27, both sexes, 20–64.",
    resource: invPt.series("EU27_2020"),
  },
];
