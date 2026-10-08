// Pensions and Social Security affiliation. Seguridad Social publishes XLSX files at
// fixed document IDs that always hold the latest edition (`?MOD=AJPERES` is required).
// Verified on 2026-10-08 against the owner's sanity values.

import { combine, type IndicatorDef } from "../lib/define";
import { sheetRows, ssAffiliates, ssAvance, ssBracketMedian, ssBracketPeriod, ssPensioners } from "../lib/parsers";
import { download } from "../lib/raw";
import { parsePx, pxMonthlySeries } from "../lib/px";
import { eurostat, file, snapshots } from "../lib/sources";

const SS_LICENCE = "Reuse permitted if not distorted, citing the source and last-update date (Seguridad Social legal notice)";
const SS_ATTRIBUTION = "Fuente: Seguridad Social";

/** Pension classes as headed in the INSS monthly report. */
const PENSION_CLASSES = [
  { slug: "retirement", column: "JUBILACIÓN", label: { es: "Jubilación", en: "Retirement", ca: "Jubilació" } },
  { slug: "widowhood", column: "VIUDEDAD", label: { es: "Viudedad", en: "Widowhood", ca: "Viduïtat" } },
  { slug: "disability", column: "INCAPACIDAD PERMANENTE", label: { es: "Incapacidad permanente", en: "Permanent disability", ca: "Incapacitat permanent" } },
  { slug: "orphanhood", column: "ORFANDAD", label: { es: "Orfandad", en: "Orphanhood", ca: "Orfandat" } },
  { slug: "family", column: "F. FAMILIAR", label: { es: "En favor de familiares", en: "In favour of relatives", ca: "A favor de familiars" } },
] as const;

const avance = file({
  sourceId: "seg-social-avance-pensiones",
  group: "seg-social",
  filename: "avance.xlsx",
  url: "https://www.seg-social.es/wps/wcm/connect/wss/d8a9c4fd-04ac-4814-9bae-6971cdb35250/avance.xlsx?MOD=AJPERES",
  humanUrl: "https://www.seg-social.es/wps/portal/wss/internet/EstadisticasPresupuestosEstudios/Estadisticas/EST23/EST24",
  publisher: "Seguridad Social (INSS)",
  dataset: "Avance mensual de pensiones contributivas",
  licence: SS_LICENCE,
  attribution: SS_ATTRIBUTION,
  notes: "Pensions in payment on day 1 of each month. Earlier years: stock on 1 December.",
  parse: (body) => ({
    count: ssAvance(sheetRows(body, "Nº Pens. Clases"), "TOTAL"),
    ...Object.fromEntries(
      PENSION_CLASSES.map((c) => [`count-${c.slug}`, ssAvance(sheetRows(body, "Nº Pens. Clases"), c.column)]),
    ),
    averageAll: ssAvance(sheetRows(body, "P. Media €"), "TOTAL"),
    averageRetirement: ssAvance(sheetRows(body, "P. Media €"), "JUBILACIÓN"),
    payroll: ssAvance(sheetRows(body, "Importe €"), "TOTAL", 1000),
  }),
});

const affiliates = file({
  sourceId: "seg-social-afiliacion-media",
  group: "seg-social",
  filename: "serie-afiliacion.xlsx",
  url: "https://www.seg-social.es/wps/wcm/connect/wss/5ccf558a-868f-48b3-b832-04fe9f524960/serie.xlsx?MOD=AJPERES",
  humanUrl: "https://www.seg-social.es/wps/portal/wss/internet/EstadisticasPresupuestosEstudios/Estadisticas/EST8/EST10/EST290/EST291",
  publisher: "Seguridad Social (TGSS)",
  dataset: "Serie de afiliación media por regímenes",
  licence: SS_LICENCE,
  attribution: SS_ATTRIBUTION,
  notes: "Sheet Hoja1, column TOTAL SISTEMA: average number of affiliates registered during the month.",
  parse: (body) => ({ total: ssAffiliates(sheetRows(body, "Hoja1")) }),
});

const foreignAffiliates = file({
  sourceId: "seg-social-afiliados-extranjeros",
  group: "seg-social",
  filename: "afiliados-extranjeros-ccaa.px",
  gzip: true,
  url: "https://w6.seg-social.es/PXWeb/Resources/PX/Databases/Afiliados%20en%20alta%20laboral/Afiliados%20Medios%20Extranjeros/3mb.Afiliados%20extranjeros%20por%20sexo,%20CCAA,%20regimen%20y%20UEnoUE.px",
  humanUrl:
    "https://w6.seg-social.es/PXWeb/pxweb/es/Afiliados%20en%20alta%20laboral/Afiliados%20en%20alta%20laboral__Afiliados%20Medios%20Extranjeros/",
  publisher: "Seguridad Social (TGSS)",
  dataset: "Afiliados medios extranjeros por sexo, CCAA, régimen y UE/no UE (PX-Web)",
  tableId: "3mb",
  licence: SS_LICENCE,
  attribution: SS_ATTRIBUTION,
  notes: "Selection: CCAA TOTAL, TOTAL REGIMEN, TOTAL SEXO, TOTAL UE Y NO UE.",
  parse: (body) => ({
    total: pxMonthlySeries(parsePx(body), "Período", {
      CCAA: "TOTAL",
      "Régimen": "TOTAL REGIMEN",
      Sexo: "TOTAL SEXO",
      UEnoUE: "TOTAL UE Y NO UE",
    }),
  }),
});

/** INSS pensions by amount bracket: only the current month is published, so months are kept as snapshots. */
export const TC_SNAPSHOT = {
  group: "seg-social",
  prefix: "TC",
  ext: "xlsx",
  sourceIdPrefix: "seg-social-tramos-cuantia",
  url: "https://www.seg-social.es/wps/wcm/connect/wss/738c06ad-d45f-40d4-8b17-e31efe433709/TC.xlsx?MOD=AJPERES",
  humanUrl: "https://www.seg-social.es/wps/portal/wss/internet/EstadisticasPresupuestosEstudios/Estadisticas/EST23/EST24",
  publisher: "Seguridad Social (INSS)",
  dataset: "Pensiones contributivas en vigor por tramos de cuantía",
  tableId: "Tramos_Total sistema",
  licence: SS_LICENCE,
  attribution: SS_ATTRIBUTION,
};

/** Monthly average retirement pension from the INSS monthly report (for the distribution's published mean). */
export const AVANCE = avance;

/** The monthly pensioners file has a new address each month; find it on its listing page. */
async function latestPensionersFile(): Promise<string> {
  const page = "https://www.seg-social.es/wps/portal/wss/internet/EstadisticasPresupuestosEstudios/Estadisticas/EST23/26bce586-014b-4c4e-9484-009cee21e271";
  const html = (await download(page)).body.toString("utf8");
  const links = [...html.matchAll(/\/wps\/wcm\/connect\/wss\/([0-9a-f-]{36})\/PTAS(\d{6})\.xlsx/g)].sort((a, b) => a[2].localeCompare(b[2]));
  const last = links.at(-1);
  if (!last) throw new Error("Pensioners file link not found on the listing page");
  return `https://www.seg-social.es/wps/wcm/connect/wss/${last[1]}/PTAS${last[2]}.xlsx?MOD=AJPERES`;
}

const pensioners = file({
  sourceId: "seg-social-pensionistas",
  group: "seg-social",
  filename: "pensionistas.xlsx",
  url: latestPensionersFile,
  humanUrl: "https://www.seg-social.es/wps/portal/wss/internet/EstadisticasPresupuestosEstudios/Estadisticas/EST23/26bce586-014b-4c4e-9484-009cee21e271",
  publisher: "Seguridad Social (INSS)",
  dataset: "Pensionistas: serie histórica de pensiones por pensionista",
  tableId: "Pnes y ptas",
  licence: SS_LICENCE,
  attribution: SS_ATTRIBUTION,
  notes: "Contributory pensions of the Social Security system; one person can receive more than one pension.",
  parse: (body) => ({ pensioners: ssPensioners(sheetRows(body, "Pnes y ptas")) }),
});

const PENSIONS_NOTE = {
  es: "Hasta 2024, un dato por año (pensiones a 1 de diciembre); desde 2025, mensual (a día 1 de cada mes).",
  en: "Up to 2024, one figure per year (pensions on 1 December); from 2025, monthly (on day 1 of each month).",
  ca: "Fins al 2024, una dada per any (pensions a 1 de desembre); des del 2025, mensual (a dia 1 de cada mes).",
};

export const PENSIONS: IndicatorDef[] = [
  {
    id: "pensions-count",
    topic: "pensions",
    unit: "pensions",
    frequency: "M",
    decimals: 0,
    yZero: false,
    periodRef: "start",
    label: { es: "Pensiones contributivas en vigor", en: "Contributory pensions in payment", ca: "Pensions contributives en vigor" },
    note: PENSIONS_NOTE,
    method: "Number of contributory pensions in payment (all classes), Seguridad Social monthly pensions report.",
    resource: avance.series("count"),
  },
  ...PENSION_CLASSES.map(
    (c): IndicatorDef => ({
      id: `pensions-count-${c.slug}`,
      topic: "pensions",
      unit: "pensions",
      frequency: "M",
      decimals: 0,
      yZero: true,
      periodRef: "start",
      label: c.label,
      note: PENSIONS_NOTE,
      method: `Number of contributory pensions in payment of class '${c.column}', Seguridad Social monthly pensions report.`,
      resource: avance.series(`count-${c.slug}`),
    }),
  ),
  {
    id: "pensioners",
    topic: "pensions",
    unit: "persons",
    frequency: "M",
    decimals: 0,
    yZero: false,
    periodRef: "start",
    label: { es: "Pensionistas (personas)", en: "Pensioners (people)", ca: "Pensionistes (persones)" },
    note: {
      es: "Personas que cobran al menos una pensión contributiva; algunas cobran dos o más. Hasta 2025, dato de diciembre; desde 2026, mensual.",
      en: "People receiving at least one contributory pension; some receive two or more. Up to 2025, December figure; from 2026, monthly.",
      ca: "Persones que cobren almenys una pensió contributiva; algunes en cobren dues o més. Fins al 2025, dada de desembre; des del 2026, mensual.",
    },
    method: "Number of pensioners of contributory Social Security pensions, Seguridad Social monthly pensioners file (sheet 'Pnes y ptas').",
    resource: pensioners.series("pensioners"),
  },
  {
    id: "pension-average-retirement",
    topic: "pensions",
    unit: "eur",
    frequency: "M",
    decimals: 2,
    yZero: true,
    periodRef: "start",
    label: { es: "Pensión media de jubilación", en: "Average retirement pension", ca: "Pensió mitjana de jubilació" },
    note: {
      es: "Euros al mes, 14 pagas. Hasta 2024, dato a 1 de diciembre; desde 2025, mensual.",
      en: "Euros per month, 14 payments a year. Up to 2024, figure on 1 December; from 2025, monthly.",
      ca: "Euros al mes, 14 pagues. Fins al 2024, dada a 1 de desembre; des del 2025, mensual.",
    },
    method: "Average monthly amount of contributory retirement pensions, Seguridad Social monthly pensions report.",
    resource: avance.series("averageRetirement"),
  },
  {
    id: "pension-average",
    topic: "pensions",
    unit: "eur",
    frequency: "M",
    decimals: 2,
    yZero: true,
    periodRef: "start",
    label: { es: "Pensión media del sistema", en: "Average pension (all classes)", ca: "Pensió mitjana del sistema" },
    note: PENSIONS_NOTE,
    method: "Average monthly amount of all contributory pensions, Seguridad Social monthly pensions report.",
    resource: avance.series("averageAll"),
  },
  {
    id: "pension-median-retirement",
    topic: "pensions",
    unit: "eur",
    frequency: "M",
    decimals: 2,
    yZero: true,
    periodRef: "start",
    label: { es: "Pensión mediana de jubilación", en: "Median retirement pension", ca: "Pensió mediana de jubilació" },
    note: {
      es: "Cálculo propio a partir de la distribución oficial por tramos de cuantía. La Seguridad Social solo publica el mes en curso, así que la serie empieza en la primera descarga.",
      en: "Own calculation from the official distribution by amount bracket. Seguridad Social only publishes the current month, so the series starts at the first download.",
      ca: "Càlcul propi a partir de la distribució oficial per trams de quantia. La Seguretat Social només publica el mes en curs, així que la sèrie comença a la primera descàrrega.",
    },
    method:
      "Median of contributory retirement pensions, interpolated linearly inside the amount bracket that contains the middle pension (INSS, pensions by amount bracket, 'Total sistema', class 'Jubilación').",
    formula: "L + (N/2 − pensions below the bracket) / pensions in the bracket × (U − L)",
    resource: snapshots({
      ...TC_SNAPSHOT,
      periodOf: (body) => ssBracketPeriod(sheetRows(body, "Tramos_Total sistema")),
      value: (body) => ssBracketMedian(sheetRows(body, "Tramos_Total sistema"), "Jubilación").value,
    }),
  },
  {
    id: "pension-payroll",
    topic: "pensions",
    unit: "eur",
    frequency: "M",
    decimals: 0,
    yZero: true,
    periodRef: "start",
    label: { es: "Nómina mensual de pensiones", en: "Monthly pension payroll", ca: "Nòmina mensual de pensions" },
    note: {
      es: "Una paga ordinaria; no incluye las pagas extraordinarias de junio y noviembre. Hasta 2024, nómina de diciembre.",
      en: "One ordinary monthly payment; excludes the extra payments in June and November. Up to 2024, the December payroll.",
      ca: "Una paga ordinària; no inclou les pagues extraordinàries de juny i novembre. Fins al 2024, nòmina de desembre.",
    },
    method: "Total monthly amount of contributory pensions (thousand euros in the source, converted to euros), Seguridad Social monthly pensions report.",
    resource: avance.series("payroll"),
  },
  {
    id: "ss-affiliates",
    topic: "labour",
    unit: "persons",
    frequency: "M",
    decimals: 0,
    yZero: false,
    label: { es: "Afiliados a la Seguridad Social", en: "Social Security affiliates", ca: "Afiliats a la Seguretat Social" },
    note: {
      es: "Media mensual de afiliados en alta, total del sistema.",
      en: "Monthly average of registered affiliates, whole system.",
      ca: "Mitjana mensual d'afiliats en alta, total del sistema.",
    },
    method: "Average number of affiliates registered during each month, total system (TGSS series by regime).",
    resource: affiliates.series("total"),
    map: (points) => points.map((p) => ({ ...p, value: Math.round(p.value) })),
  },
  {
    id: "foreign-affiliates",
    topic: "immigration",
    unit: "persons",
    frequency: "M",
    decimals: 0,
    yZero: true,
    label: {
      es: "Afiliados extranjeros a la Seguridad Social",
      en: "Foreign Social Security affiliates",
      ca: "Afiliats estrangers a la Seguretat Social",
    },
    note: {
      es: "Media mensual de afiliados en alta con nacionalidad extranjera, total del sistema.",
      en: "Monthly average of registered affiliates with foreign nationality, whole system.",
      ca: "Mitjana mensual d'afiliats en alta amb nacionalitat estrangera, total del sistema.",
    },
    method: "Average number of affiliates with foreign nationality registered during each month (TGSS, PX-Web table 3mb, national total).",
    resource: foreignAffiliates.series("total"),
    map: (points) => points.map((p) => ({ ...p, value: Math.round(p.value) })),
  },
  {
    id: "affiliates-per-pension",
    topic: "pensions",
    unit: "ratio",
    frequency: "M",
    decimals: 2,
    yZero: true,
    label: { es: "Afiliados por pensión", en: "Affiliates per pension", ca: "Afiliats per pensió" },
    note: {
      es: "Por pensión, no por pensionista (una persona puede cobrar más de una pensión). Hasta 2024, solo diciembre.",
      en: "Per pension, not per pensioner (one person may receive more than one pension). Up to 2024, December only.",
      ca: "Per pensió, no per pensionista (una persona pot cobrar més d'una pensió). Fins al 2024, només desembre.",
    },
    method: "Average affiliates in the month divided by contributory pensions in payment on day 1 of the same month.",
    inputs: ["ss-affiliates", "pensions-count"],
    formula: "ss-affiliates / pensions-count",
    compute: ([a, p]) => combine(a, p, (x, y) => x / y),
  },
  {
    id: "pension-spending-gdp",
    topic: "pensions",
    unit: "percent_gdp",
    frequency: "A",
    decimals: 1,
    yZero: true,
    label: { es: "Gasto en pensiones", en: "Pension spending", ca: "Despesa en pensions" },
    note: {
      es: "Definición armonizada europea (ESSPROS): jubilación, supervivencia, incapacidad y jubilación anticipada; incluye Clases Pasivas y pensiones no contributivas.",
      en: "Harmonised EU definition (ESSPROS): old-age, survivors', disability and early-retirement pensions; includes civil-service (Clases Pasivas) and non-contributory pensions.",
      ca: "Definició harmonitzada europea (ESSPROS): jubilació, supervivència, incapacitat i jubilació anticipada; inclou Classes Passives i pensions no contributives.",
    },
    method: "Expenditure on pensions, % of GDP, Eurostat spr_exp_pens (spdepb=TOTAL, spdepm=TOTAL).",
    resource: eurostat({
      sourceId: "eurostat-spr-exp-pens-es",
      dataset: "spr_exp_pens",
      filters: { geo: "ES", unit: "PC_GDP", spdepb: "TOTAL", spdepm: "TOTAL" },
      datasetLabel: "Pensions (ESSPROS)",
    }),
  },
  {
    id: "social-security-balance-gdp",
    topic: "pensions",
    unit: "percent_gdp",
    frequency: "A",
    decimals: 1,
    yZero: true,
    label: {
      es: "Saldo de las administraciones de Seguridad Social",
      en: "Social Security funds balance",
      ca: "Saldo de les administracions de Seguretat Social",
    },
    note: {
      es: "No es el déficit contributivo: incluye transferencias del Estado, el Mecanismo de Equidad Intergeneracional, el SEPE y el FOGASA. No hay una serie oficial del déficit contributivo.",
      en: "This is not the contributory deficit: it includes State transfers, the Intergenerational Equity Mechanism, the public employment service (SEPE) and FOGASA. There is no official contributory-deficit series.",
      ca: "No és el dèficit contributiu: inclou transferències de l'Estat, el Mecanisme d'Equitat Intergeneracional, el SEPE i el FOGASA. No hi ha cap sèrie oficial del dèficit contributiu.",
    },
    method: "Net lending (+) / net borrowing (−) of the Social Security funds subsector (S.1314), % of GDP, Eurostat gov_10a_main.",
    resource: eurostat({
      sourceId: "eurostat-gov-10a-main-s1314-es",
      dataset: "gov_10a_main",
      filters: { geo: "ES", unit: "PC_GDP", sector: "S1314", na_item: "B9" },
      datasetLabel: "Government revenue, expenditure and main aggregates",
    }),
  },
];
