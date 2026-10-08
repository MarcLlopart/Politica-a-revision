// Salaries in more detail: by sex and age (INE wage structure survey), in real terms
// (deflated with INE's CPI annual average), monthly wages of the main job (EPA deciles),
// the unadjusted gender pay gap, and the minimum wage set each year by Real Decreto.
// Codes verified on 2026-10-08.

import type { Localized } from "../../lib/schema";
import { boeDecrees, boeNumber } from "../lib/boe";
import { combine, type IndicatorDef } from "../lib/define";
import { ineSeries, type Point } from "../lib/sources";

const L = (es: string, en: string, ca: string): Localized => ({ es, en, ca });
const MEN = L("Hombres", "Men", "Homes");
const WOMEN = L("Mujeres", "Women", "Dones");

const EAES_NOTE = L(
  "Ganancia bruta anual por trabajador (industria, construcción y servicios), Encuesta Anual de Estructura Salarial del INE. Incluye jornada parcial.",
  "Gross annual earnings per employee (industry, construction and services), INE Annual Wage Structure Survey. Includes part-time work.",
  "Guany brut anual per treballador (indústria, construcció i serveis), Enquesta Anual d'Estructura Salarial de l'INE. Inclou jornada parcial.",
);

const eaes = (id: string, code: string, label: Localized, method: string, table = "28191"): IndicatorDef => ({
  id,
  topic: "income",
  unit: "eur",
  frequency: "A",
  decimals: 0,
  yZero: true,
  label,
  note: EAES_NOTE,
  method: `${method}, as published by INE (Encuesta Anual de Estructura Salarial, table ${table}).`,
  resource: ineSeries({ code, tableId: table }),
});

/** Nominal values in constant euros of the CPI's latest year: value × CPI(last) / CPI(year). */
function deflate([nominal, cpi]: Point[][]) {
  const last = cpi.reduce((a, b) => (b.period > a.period ? b : a));
  return combine(nominal, cpi, (v, i) => (v * last.value) / i);
}

const SMI_DECREES = [
  { period: "2016", boeId: "BOE-A-2015-14273", title: "Real Decreto 1171/2015, salario mínimo interprofesional para 2016" },
  { period: "2017", boeId: "BOE-A-2016-12598", title: "Real Decreto 742/2016, salario mínimo interprofesional para 2017" },
  { period: "2018", boeId: "BOE-A-2017-15848", title: "Real Decreto 1077/2017, salario mínimo interprofesional para 2018" },
  { period: "2019", boeId: "BOE-A-2018-17773", title: "Real Decreto 1462/2018, salario mínimo interprofesional para 2019" },
  { period: "2020", boeId: "BOE-A-2020-1652", title: "Real Decreto 231/2020, salario mínimo interprofesional para 2020" },
  { period: "2021", boeId: "BOE-A-2021-15770", title: "Real Decreto 817/2021, salario mínimo interprofesional para 2021 (desde el 1 de septiembre)" },
  { period: "2022", boeId: "BOE-A-2022-2851", title: "Real Decreto 152/2022, salario mínimo interprofesional para 2022" },
  { period: "2023", boeId: "BOE-A-2023-3982", title: "Real Decreto 99/2023, salario mínimo interprofesional para 2023" },
  { period: "2024", boeId: "BOE-A-2024-2251", title: "Real Decreto 145/2024, salario mínimo interprofesional para 2024" },
  { period: "2025", boeId: "BOE-A-2025-2576", title: "Real Decreto 87/2025, salario mínimo interprofesional para 2025" },
  { period: "2026", boeId: "BOE-A-2026-3815", title: "Real Decreto 126/2026, salario mínimo interprofesional para 2026" },
];

const cpiAnnual = ineSeries({ code: "IPC318623", tableId: "76144" });

// CNO-11 major groups in the 2018 and 2022 Wage Structure Survey (table 36891): full-time
// hourly pay of women and men. Group 6 (skilled agricultural workers) is suppressed for women.
const OCCUPATION_PAY: [string, number, number, string, string, string][] = [
  ["all", 88340, 88307, "Todas las ocupaciones", "All occupations", "Totes les ocupacions"],
  ["1", 88339, 88306, "Directores y gerentes", "Managers", "Directors i gerents"],
  ["2", 88338, 88305, "Técnicos y profesionales científicos e intelectuales", "Professionals", "Tècnics i professionals científics i intel·lectuals"],
  ["3", 88337, 88304, "Técnicos y profesionales de apoyo", "Technicians and associate professionals", "Tècnics i professionals de suport"],
  ["4", 88336, 88303, "Empleados contables, administrativos y de oficina", "Clerical support workers", "Empleats comptables, administratius i d'oficina"],
  ["5", 88335, 88302, "Restauración, servicios personales, protección y ventas", "Services and sales workers", "Restauració, serveis personals, protecció i venda"],
  ["7", 88333, 88300, "Artesanos y trabajadores cualificados de industria y construcción", "Craft and related trades workers", "Artesans i treballadors qualificats de la indústria i la construcció"],
  ["8", 88332, 88299, "Operadores de instalaciones y maquinaria, y montadores", "Plant and machine operators and assemblers", "Operadors d'instal·lacions i maquinària, i muntadors"],
  ["9", 88331, 88298, "Ocupaciones elementales", "Elementary occupations", "Ocupacions elementals"],
];

const PAY_RATIO_NOTE = L(
  "Salario por hora de las mujeres a jornada completa en % del de los hombres a jornada completa del mismo gran grupo de ocupación (100 = igual). Compara ocupaciones parecidas, no puestos idénticos: un gran grupo incluye puestos distintos (por ejemplo, dirección general y jefatura de departamento). Encuesta cuatrienal de Estructura Salarial (2018 y 2022). La cifra de todas las ocupaciones es más alta que la de cada grupo porque las mujeres a jornada completa están más a menudo en grupos mejor pagados.",
  "Full-time women's hourly pay as a % of full-time men's in the same major occupation group (100 = equal). It compares similar occupations, not identical jobs: a major group includes different jobs (for example, chief executives and department heads). Four-yearly Structure of Earnings Survey (2018 and 2022). The figure for all occupations is higher than each group's because women working full time are more often in better-paid groups.",
  "Salari per hora de les dones a jornada completa en % del dels homes a jornada completa del mateix gran grup d'ocupació (100 = igual). Compara ocupacions semblants, no llocs idèntics: un gran grup inclou llocs diferents (per exemple, direcció general i cap de departament). Enquesta quadriennal d'Estructura Salarial (2018 i 2022). La xifra de totes les ocupacions és més alta que la de cada grup perquè les dones a jornada completa són més sovint en grups més ben pagats.",
);

const GAP_NOTE = L(
  "Diferencia entre la ganancia media por hora de hombres y mujeres, en % de la de los hombres, entre quienes trabajan a jornada completa o a tiempo parcial. Sin ajustar: no compara puestos iguales.",
  "Difference between men's and women's average hourly earnings, as a % of men's, among people working full time or part time. Unadjusted: it does not compare like jobs.",
  "Diferència entre el guany mitjà per hora d'homes i dones, en % del dels homes, entre qui treballa a jornada completa o a temps parcial. Sense ajustar: no compara llocs iguals.",
);

export const SALARIES: IndicatorDef[] = [
  ...OCCUPATION_PAY.flatMap(([g, women, men, es, en, ca]): IndicatorDef[] => {
    const base = { topic: "income" as const, unit: "eur" as const, frequency: "A" as const, decimals: 2, yZero: true };
    const what = g === "all" ? "all occupations" : `CNO-11 major group ${g}`;
    return [
      {
        ...base,
        id: `wage-hourly-ft-women-occ-${g}`,
        label: L(`${es}: mujeres`, `${en}: women`, `${ca}: dones`),
        method: `Hourly pay of women working full time, ${what}, INE Structure of Earnings Survey (table 36891).`,
        resource: ineSeries({ code: `EAES${women}`, tableId: "36891" }),
      },
      {
        ...base,
        id: `wage-hourly-ft-men-occ-${g}`,
        label: L(`${es}: hombres`, `${en}: men`, `${ca}: homes`),
        method: `Hourly pay of men working full time, ${what}, INE Structure of Earnings Survey (table 36891).`,
        resource: ineSeries({ code: `EAES${men}`, tableId: "36891" }),
      },
      {
        id: `pay-ratio-occ-${g}`,
        topic: "income",
        unit: "percent",
        frequency: "A",
        decimals: 1,
        yZero: true,
        label: L(es, en, ca),
        note: PAY_RATIO_NOTE,
        method: `Full-time hourly pay of women ÷ men × 100, ${what}, INE Structure of Earnings Survey (table 36891).`,
        inputs: [`wage-hourly-ft-women-occ-${g}`, `wage-hourly-ft-men-occ-${g}`],
        formula: "women's hourly pay ÷ men's hourly pay × 100 (full time, same group)",
        compute: ([w, m]) => combine(w, m, (x, y) => (x / y) * 100),
      },
    ];
  }),
  {
    id: "gender-pay-gap-full-time",
    topic: "income",
    unit: "percent",
    frequency: "A",
    decimals: 1,
    yZero: true,
    label: L("Sin ajustar: jornada completa", "Unadjusted: full time", "Sense ajustar: jornada completa"),
    note: GAP_NOTE,
    method: "Unadjusted gender pay gap in hourly earnings, full-time employees, as published by INE (Mujeres y Hombres en España, table 10891; Eurostat earn_gr_gpgr2wt).",
    resource: ineSeries({ code: "MYH9027", tableId: "10891" }),
  },
  {
    id: "gender-pay-gap-part-time",
    topic: "income",
    unit: "percent",
    frequency: "A",
    decimals: 1,
    yZero: true,
    label: L("Sin ajustar: tiempo parcial", "Unadjusted: part time", "Sense ajustar: temps parcial"),
    note: GAP_NOTE,
    method: "Unadjusted gender pay gap in hourly earnings, part-time employees, as published by INE (Mujeres y Hombres en España, table 10891; Eurostat earn_gr_gpgr2wt).",
    resource: ineSeries({ code: "MYH9026", tableId: "10891" }),
  },
  {
    id: "part-time-share-women",
    topic: "income",
    unit: "percent",
    frequency: "A",
    decimals: 1,
    yZero: true,
    label: L("Mujeres", "Women", "Dones"),
    method: "Women working part time as a % of employed women, as published by INE (Mujeres y Hombres en España, table 10896, from the EPA).",
    resource: ineSeries({ code: "MYH8181", tableId: "10896" }),
  },
  {
    id: "part-time-share-men",
    topic: "income",
    unit: "percent",
    frequency: "A",
    decimals: 1,
    yZero: true,
    label: L("Hombres", "Men", "Homes"),
    method: "Men working part time as a % of employed men, as published by INE (Mujeres y Hombres en España, table 10896, from the EPA).",
    resource: ineSeries({ code: "MYH8183", tableId: "10896" }),
  },
  eaes("wage-p50-men", "EAES522", MEN, "Median gross annual earnings, men"),
  eaes("wage-p50-women", "EAES630", WOMEN, "Median gross annual earnings, women"),
  eaes("wage-mean-men", "EAES525", MEN, "Mean gross annual earnings, men"),
  eaes("wage-mean-women", "EAES633", WOMEN, "Mean gross annual earnings, women"),
  eaes("wage-mean-age-under-25", "EAES1624", L("Menos de 25 años", "Under 25", "Menys de 25 anys"), "Mean gross annual earnings, under 25, both sexes", "28201"),
  eaes("wage-mean-age-25-34", "EAES1588", L("De 25 a 34 años", "25–34", "De 25 a 34 anys"), "Mean gross annual earnings, aged 25–34, both sexes", "28201"),
  eaes("wage-mean-age-35-44", "EAES1570", L("De 35 a 44 años", "35–44", "De 35 a 44 anys"), "Mean gross annual earnings, aged 35–44, both sexes", "28201"),
  eaes("wage-mean-age-45-54", "EAES1552", L("De 45 a 54 años", "45–54", "De 45 a 54 anys"), "Mean gross annual earnings, aged 45–54, both sexes", "28201"),
  eaes("wage-mean-age-55-plus", "EAES1606", L("55 años o más", "55 and over", "55 anys o més"), "Mean gross annual earnings, aged 55 and over, both sexes", "28201"),
  {
    id: "cpi-index-annual",
    topic: "economy",
    unit: "index",
    frequency: "A",
    decimals: 1,
    yZero: false,
    label: L("IPC, media anual (2025 = 100)", "CPI, annual average (2025 = 100)", "IPC, mitjana anual (2025 = 100)"),
    method: "General Consumer Price Index, annual average, base 2025 = 100, as published by INE (table 76144).",
    resource: cpiAnnual,
  },
  {
    id: "cpi-index-monthly",
    topic: "economy",
    unit: "index",
    frequency: "M",
    decimals: 1,
    yZero: false,
    label: L("IPC, índice general (2025 = 100)", "CPI, general index (2025 = 100)", "IPC, índex general (2025 = 100)"),
    method: "General Consumer Price Index, monthly, base 2025 = 100, as published by INE (table 76125).",
    resource: ineSeries({ code: "IPC290751", tableId: "76125" }),
  },
  {
    id: "wage-p50-real",
    topic: "income",
    unit: "eur",
    frequency: "A",
    decimals: 0,
    yZero: true,
    label: L("Mediana, a precios constantes", "Median, at constant prices", "Mediana, a preus constants"),
    note: L(
      "Euros del último año del IPC disponible: cada año se ajusta por la inflación acumulada hasta entonces.",
      "Euros of the latest CPI year: each year is adjusted for the inflation since then.",
      "Euros de l'últim any de l'IPC disponible: cada any s'ajusta per la inflació acumulada fins aleshores.",
    ),
    method: "INE median gross annual earnings (EAES738) multiplied by CPI(latest year) / CPI(year), using the INE CPI annual average index.",
    inputs: ["wage-p50", "cpi-index-annual"],
    formula: "median wage × CPI(latest year) / CPI(year)",
    compute: deflate,
  },
  {
    id: "wage-mean-real",
    topic: "income",
    unit: "eur",
    frequency: "A",
    decimals: 0,
    yZero: true,
    label: L("Media, a precios constantes", "Average, at constant prices", "Mitjana, a preus constants"),
    method: "INE mean gross annual earnings (EAES741) multiplied by CPI(latest year) / CPI(year), using the INE CPI annual average index.",
    inputs: ["wage-mean", "cpi-index-annual"],
    formula: "mean wage × CPI(latest year) / CPI(year)",
    compute: deflate,
  },
  ...(
    [
      ["epa-wage-p10", "EPA710405", "P10"],
      ["epa-wage-p50", "EPA710413", "Mediana (P50)|Median (P50)|Mediana (P50)"],
      ["epa-wage-p90", "EPA710421", "P90"],
    ] as const
  ).map(([id, code, label]): IndicatorDef => {
    const [es, en, ca] = label.includes("|") ? label.split("|") : [label, label, label];
    return {
      id,
      topic: "income",
      unit: "eur",
      frequency: "A",
      decimals: 0,
      yZero: true,
      label: L(es, en, ca),
      note: L(
        "Salario bruto mensual del empleo principal de los asalariados (EPA, tabla de deciles). Los límites de decil son percentiles: el inferior del decil 2 es el P10, el del 6 la mediana y el del 10 el P90.",
        "Gross monthly wage of employees' main job (EPA decile table). Decile limits are percentiles: the lower limit of decile 2 is P10, of decile 6 the median, of decile 10 P90.",
        "Salari brut mensual de la feina principal dels assalariats (EPA, taula de decils). Els límits de decil són percentils: l'inferior del decil 2 és el P10, el del 6 la mediana i el del 10 el P90.",
      ),
      method: `Lower limit of a wage decile of the main job (gross monthly), as published by INE (EPA, 'Decil de salarios del empleo principal', table 66252, series ${code}).`,
      resource: ineSeries({ code, tableId: "66252" }),
    };
  }),
  {
    id: "gender-pay-gap",
    topic: "income",
    unit: "percent",
    frequency: "A",
    decimals: 1,
    yZero: true,
    label: L("Sin ajustar: todas las personas asalariadas", "Unadjusted: all employees", "Sense ajustar: totes les persones assalariades"),
    note: L(
      "Diferencia entre la ganancia media por hora de todos los hombres y todas las mujeres asalariados, en % de la de los hombres. No compara el mismo trabajo: incluye diferencias de ocupación, sector, jornada, experiencia y empresa. Es el indicador oficial de la UE (Objetivo de Desarrollo Sostenible 5).",
      "Difference between the average hourly earnings of all men and all women employees, as a % of men's. It does not compare the same job: it includes differences in occupation, sector, working time, experience and employer. It is the EU's official indicator (Sustainable Development Goal 5).",
      "Diferència entre el guany mitjà per hora de tots els homes i totes les dones assalariats, en % del dels homes. No compara la mateixa feina: inclou diferències d'ocupació, sector, jornada, experiència i empresa. És l'indicador oficial de la UE (Objectiu de Desenvolupament Sostenible 5).",
    ),
    method: "Unadjusted gender pay gap in hourly earnings (sections B–S except O), as published by INE (Mujeres y Hombres en España, table 10892, identical to Eurostat sdg_05_20).",
    resource: ineSeries({ code: "MYH9049", tableId: "10892" }),
  },
  {
    id: "minimum-wage-monthly",
    topic: "income",
    unit: "eur",
    frequency: "A",
    decimals: 2,
    yZero: true,
    label: L("Salario mínimo interprofesional (al mes, 14 pagas)", "Minimum wage (per month, 14 payments)", "Salari mínim interprofessional (al mes, 14 pagues)"),
    note: L(
      "Cuantía fijada por real decreto para cada año. En 2021 fue de 950 € hasta agosto y de 965 € desde septiembre; se muestra la segunda.",
      "Amount set by royal decree for each year. In 2021 it was €950 until August and €965 from September; the latter is shown.",
      "Quantia fixada per reial decret per a cada any. El 2021 va ser de 950 € fins a l'agost i de 965 € des del setembre; es mostra la segona.",
    ),
    method: "Monthly amount in article 1 of each year's Real Decreto on the salario mínimo interprofesional, read from the official BOE XML.",
    resource: boeDecrees({
      key: "smi",
      decrees: SMI_DECREES,
      extract: (t) => {
        const m = t.match(/queda fijado en [\d.,]+ euros\/día o ([\d\s.,]+?) euros\/mes/);
        if (!m) throw new Error("SMI: monthly amount not found in decree text");
        return boeNumber(m[1]);
      },
    }),
  },
];
