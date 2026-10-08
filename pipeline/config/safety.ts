// Safety: criminal offences known to the police (Ministerio del Interior, Portal Estadístico
// de Criminalidad, annual series) as rates per inhabitant, and the share of people who report
// crime, violence or vandalism in their area (Eurostat, EU-SILC). The ministry's main site
// (interior.gob.es) blocks automated downloads; the statistics portal serves the same tables.

import type { Localized } from "../../lib/schema";
import { combine, type IndicatorDef } from "../lib/define";
import { parsePx, pxAnnualSeries } from "../lib/px";
import { eurostat, file } from "../lib/sources";

const L = (es: string, en: string, ca: string): Localized => ({ es, en, ca });

const PX_URL = "https://estadisticasdecriminalidad.ses.mir.es/sec/jaxiPx/files/_px/es/px/Datos1/l0/01001.px?nocab=1";

/** Offence types used, by their label in the ministry's table 01001. */
const OFFENCES = {
  total: "TOTAL INFRACCIONES PENALES",
  homicides: "1.1.1.-Homicidios dolosos/asesinatos consumados",
  sexual: "3. LIBERTAD SEXUAL",
  "violent-robbery": "5.3.-Robos con violencia o intimidación",
  "home-burglary": "5.2.2.-Robos con fuerza en viviendas",
  "online-fraud": "5.5.1.-Estafas informáticas",
} as const;

const interior = file({
  sourceId: "interior-hechos-conocidos-anual",
  group: "interior",
  filename: "01001.px",
  url: PX_URL,
  humanUrl: "https://estadisticasdecriminalidad.ses.mir.es/sec/jaxiPx/Tabla.htm?path=/Datos1/l0/&file=01001.px",
  publisher: "Ministerio del Interior",
  dataset: "Portal Estadístico de Criminalidad: hechos conocidos por tipología penal (series anuales)",
  tableId: "01001",
  licence: "Reuse with attribution (Ley 37/2007 on the reuse of public sector information)",
  attribution: "Fuente: Ministerio del Interior, Portal Estadístico de Criminalidad",
  notes: "National total (TOTAL NACIONAL). Police forces reporting to the Sistema Estadístico de Criminalidad; see the table notes for the Mossos d'Esquadra and Ertzaintza coverage of some offence types.",
  parse: (body) => {
    const px = parsePx(body);
    return Object.fromEntries(
      Object.entries(OFFENCES).map(([key, label]) => [
        key,
        pxAnnualSeries(px, "periodo", { "Comunidades autónomas": "TOTAL NACIONAL", "Tipología penal": label }),
      ]),
    );
  },
});

const POLICE_NOTE = L(
  "Infracciones conocidas por la policía: dependen de cuánto se denuncia y de cómo se registra, y la reforma del Código Penal de 2022 cambió algunos tipos. 2020 está afectado por la pandemia. Tasas sobre la población media anual.",
  "Offences known to the police: they depend on how much is reported and how it is recorded, and the 2022 Criminal Code reform changed some offence types. 2020 is affected by the pandemic. Rates use the annual average population.",
  "Infraccions conegudes per la policia: depenen de quant es denuncia i de com es registra, i la reforma del Codi Penal del 2022 va canviar alguns tipus. El 2020 està afectat per la pandèmia. Taxes sobre la població mitjana anual.",
);

const count = (key: keyof typeof OFFENCES, label: Localized): IndicatorDef => ({
  id: `offences-${key}`,
  topic: "safety",
  unit: "count",
  frequency: "A",
  decimals: 0,
  yZero: true,
  label,
  note: POLICE_NOTE,
  method: `Criminal offences known to the police, "${OFFENCES[key]}", national total, Ministerio del Interior table 01001.`,
  resource: interior.series(key),
});

const rate = (key: keyof typeof OFFENCES, per: 1000 | 100000, label: Localized, id = `${key}-rate`, decimals = 1): IndicatorDef => ({
  id,
  topic: "safety",
  unit: per === 1000 ? "per_1000" : "per_100k",
  frequency: "A",
  decimals,
  yZero: true,
  label,
  note: POLICE_NOTE,
  method: `Offences known to the police ("${OFFENCES[key]}", Ministerio del Interior table 01001) per ${per === 1000 ? "1,000" : "100,000"} inhabitants, using the annual average population (Eurostat nama_10_pe).`,
  inputs: [`offences-${key}`, "population-annual"],
  formula: `offences ÷ population × ${per}`,
  compute: ([o, p]) => combine(o, p, (x, y) => (x / y) * per),
});

export const SAFETY: IndicatorDef[] = [
  count("total", L("Infracciones penales conocidas", "Criminal offences known to the police", "Infraccions penals conegudes")),
  count("homicides", L("Homicidios dolosos y asesinatos consumados", "Completed intentional homicides and murders", "Homicidis dolosos i assassinats consumats")),
  count("sexual", L("Delitos contra la libertad sexual", "Sexual offences", "Delictes contra la llibertat sexual")),
  count("violent-robbery", L("Robos con violencia o intimidación", "Robbery with violence or intimidation", "Robatoris amb violència o intimidació")),
  count("home-burglary", L("Robos con fuerza en viviendas", "Home burglaries", "Robatoris amb força en habitatges")),
  count("online-fraud", L("Estafas informáticas", "Online fraud", "Estafes informàtiques")),
  rate("total", 1000, L("Todas las infracciones", "All offences", "Totes les infraccions"), "crime-rate"),
  {
    id: "crime-rate-excl-online-fraud",
    topic: "safety",
    unit: "per_1000",
    frequency: "A",
    decimals: 1,
    yZero: true,
    label: L("Sin estafas informáticas", "Excluding online fraud", "Sense estafes informàtiques"),
    note: POLICE_NOTE,
    method: "Criminal offences known to the police minus online fraud (Ministerio del Interior table 01001), per 1,000 inhabitants (annual average population, Eurostat nama_10_pe).",
    inputs: ["offences-total", "offences-online-fraud", "population-annual"],
    formula: "(offences − online fraud) ÷ population × 1,000",
    compute: ([t, o, p]) => combine(combine(t, o, (x, y) => x - y), p, (x, y) => (x / y) * 1000),
  },
  rate("homicides", 100000, L("Homicidios y asesinatos consumados por 100.000 habitantes", "Completed homicides and murders per 100,000 inhabitants", "Homicidis i assassinats consumats per 100.000 habitants"), "homicide-rate", 2),
  rate("sexual", 100000, L("Delitos contra la libertad sexual por 100.000 habitantes", "Sexual offences per 100,000 inhabitants", "Delictes contra la llibertat sexual per 100.000 habitants"), "sexual-offences-rate"),
  rate("violent-robbery", 100000, L("Robos con violencia o intimidación", "Robbery with violence or intimidation", "Robatoris amb violència o intimidació")),
  rate("home-burglary", 100000, L("Robos con fuerza en viviendas", "Home burglaries", "Robatoris amb força en habitatges")),
  rate("online-fraud", 100000, L("Estafas informáticas por 100.000 habitantes", "Online fraud per 100,000 inhabitants", "Estafes informàtiques per 100.000 habitants")),
  {
    id: "perceived-crime-area",
    topic: "safety",
    unit: "percent",
    frequency: "A",
    decimals: 1,
    yZero: true,
    label: L(
      "Población que declara delincuencia, violencia o vandalismo en su zona",
      "People reporting crime, violence or vandalism in their area",
      "Població que declara delinqüència, violència o vandalisme a la seva zona",
    ),
    note: L(
      "Encuesta de Condiciones de Vida (EU-SILC). Desde 2020 la pregunta se hace cada tres años; el siguiente dato es de 2026.",
      "EU Statistics on Income and Living Conditions (EU-SILC). Since 2020 the question is asked every three years; the next figure is for 2026.",
      "Enquesta de Condicions de Vida (EU-SILC). Des del 2020 la pregunta es fa cada tres anys; la propera dada és del 2026.",
    ),
    method: "Share of the population living in households reporting crime, violence or vandalism in the area, Eurostat ilc_mddw03 (all households, all incomes).",
    resource: eurostat({
      sourceId: "eurostat-ilc-mddw03-es",
      dataset: "ilc_mddw03",
      filters: { geo: "ES", freq: "A", hhcomp: "TOTAL", rskpovth: "TOTAL", unit: "PC" },
      datasetLabel: "Crime, violence or vandalism in the area",
    }),
  },
];
