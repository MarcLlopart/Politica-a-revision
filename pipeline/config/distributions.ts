// Distributions used to say which group a programme means ("pensiones bajas",
// "rentas altas"): bracketed counts → mean, median, most common range, p90, p99, and the
// share above amounts programmes commonly use.

import type { Bracket } from "../../lib/distribution";
import { aeatPublication, aeatRows, aeatText, esNumber } from "../lib/aeat";
import type { DistributionDef } from "../lib/distributions";
import { sheetRows, ssBrackets } from "../lib/parsers";
import { loadSnapshots, snapshotSource } from "../lib/sources";
import { AVANCE, TC_SNAPSHOT } from "./pensions";

// ---------------------------------------------------------------- AEAT publications

/** IRPF brackets were set in pesetas; their euro bounds are the exact conversions. */
const IRPF_BOUNDS: Record<string, number> = {
  "1,5": 1502.53,
  "6": 6010.12,
  "12": 12020.24,
  "21": 21035.42,
  "30": 30050.61,
  "60": 60101.21,
  "150": 150253.03,
  "601": 601012.1,
};

function irpfBounds(label: string): [number, number | null] | null {
  if (/^Negativo y Cero$/i.test(label)) return [0, 0];
  const range = label.match(/^\(([\d,]+)\s*-\s*([\d,]+)\]$/);
  if (range) {
    const lo = range[1] === "0" ? 0 : IRPF_BOUNDS[range[1]];
    const hi = IRPF_BOUNDS[range[2]];
    if (lo === undefined || hi === undefined) throw new Error(`IRPF: unknown bracket ${label}`);
    return [lo, hi];
  }
  const top = label.match(/^Mayor de ([\d,]+)$/i);
  if (top) return [IRPF_BOUNDS[top[1]], null];
  return null;
}

const irpf = aeatPublication({
  site: "irpf",
  firstYear: 2016,
  humanUrl: "https://sede.agenciatributaria.gob.es/Sede/datosabiertos/catalogo/hacienda/Estadistica_de_los_declarantes_del_IRPF.shtml",
  tables: [
    { key: "big", after: /^Estadística por tramos de rendimiento$/i, label: /^\d+\.\s*Base imponible general$/i },
    { key: "bia", after: /^Estadística por tramos de rendimiento$/i, label: /^\d+\.\s*Base imponible del ahorro$/i },
  ],
});

const mercado = aeatPublication({
  site: "mercado",
  firstYear: 2016,
  humanUrl: "https://sede.agenciatributaria.gob.es/Sede/datosabiertos/catalogo/hacienda/Mercado_de_Trabajo_y_Pensiones_en_las_Fuentes_Tributarias.shtml",
  tables: [
    { key: "salarios", label: /^Asalariados, percepciones salariales y salarios por nacionalidad, tramos de salario/i },
    {
      key: "salarios-varon",
      label: /^Asalariados, percepciones salariales y salarios por nacionalidad, tramos de salario/i,
      menu: { name: "Sexo", option: "Varón" },
    },
    {
      key: "salarios-mujer",
      label: /^Asalariados, percepciones salariales y salarios por nacionalidad, tramos de salario/i,
      menu: { name: "Sexo", option: "Mujer" },
    },
    { key: "pensiones", label: /^Pensionistas, percepciones de pensiones y pensiones medias por sexo y tramo de pensi/i },
  ],
});

const patrimonio = aeatPublication({
  site: "patrimonio",
  firstYear: 2016,
  humanUrl: "https://sede.agenciatributaria.gob.es/Sede/datosabiertos/catalogo/hacienda/Estadistica_de_los_declarantes_del_Impuesto_sobre_el_Patrimonio.shtml",
  tables: [{ key: "base", label: /^0?\d+\.?\s*Base imponible$/i }],
});

/** Brackets in multiples of a reference amount ("De 0,5 a 1 SMI", "Más de 10 PM"). */
function multipleBounds(label: string, unit: string, ref: number): [number, number | null] | null {
  const num = (x: string) => Number(x.replace(",", "."));
  const range = label.match(new RegExp(`^De ([\\d,]+) a ([\\d,]+) ${unit}$`, "i"));
  if (range) return [num(range[1]) * ref, num(range[2]) * ref];
  const top = label.match(new RegExp(`^Más de ([\\d,]+) ${unit}$`, "i"));
  if (top) return [num(top[1]) * ref, null];
  return null;
}

/**
 * Brackets must add up to the published total row. A difference of 0.001% is tolerated
 * (AEAT's 2024 wage table is off by one person); a missing or misread row is far larger.
 */
/** AEAT wage-earner brackets (multiples of the year's SMI, stated in the table notes). */
function wageBrackets(key: "salarios" | "salarios-varon" | "salarios-mujer") {
  return mercado.load().map(({ year, pages }) => {
    const html = pages[key].body.toString("utf8");
    const smi = esNumber(aeatText(html).match(/SMI:\s*([\d.,]+)/)?.[1] ?? "");
    if (!smi) throw new Error(`AEAT wages ${year}: SMI not found in notes`);
    const rows = aeatRows(html);
    const brackets: Bracket[] = [];
    for (const r of rows) {
      const b = multipleBounds(r.label, "SMI", smi);
      if (b) brackets.push({ lower: b[0], upper: b[1], count: r.cells[0] ?? 0, amount: r.cells[2] ?? 0 });
    }
    checkTotal(brackets, rows.find((r) => /^Total$/i.test(r.label))?.cells[0], `AEAT wages ${key} ${year}`);
    return {
      period: String(year),
      brackets,
      source: mercado.source(year, pages[key], `Mercado de trabajo y pensiones en las fuentes tributarias: asalariados por tramos de salario${key === "salarios" ? "" : key === "salarios-varon" ? " (varones)" : " (mujeres)"}`),
    };
  });
}

function checkTotal(brackets: Bracket[], total: number | null | undefined, what: string) {
  const n = brackets.reduce((s, b) => s + b.count, 0);
  if (total === null || total === undefined || Math.abs(n - total) > Math.max(0.5, total * 1e-5)) {
    throw new Error(`${what}: brackets add up to ${n}, total row says ${total}`);
  }
}

export const DISTRIBUTIONS: DistributionDef[] = [
  {
    id: "retirement-pensions",
    topic: "pensions",
    amountPer: "month",
    periodRef: "start",
    label: {
      es: "Cuánto cobran los pensionistas de jubilación",
      en: "How much retirement pensions pay",
      ca: "Quant cobren els pensionistes de jubilació",
    },
    population: {
      es: "pensiones contributivas de jubilación",
      en: "contributory retirement pensions",
      ca: "pensions contributives de jubilació",
    },
    note: {
      es: "Importe mensual bruto, 14 pagas. Por pensión, no por persona. El tramo más alto («más de 3.359,61 €») no publica importes, así que lo que cae dentro solo puede decirse como «más de».",
      en: "Gross monthly amount, 14 payments a year. Per pension, not per person. The top bracket (“above €3,359.61”) has no published amounts, so values inside it can only be given as “more than”.",
      ca: "Import mensual brut, 14 pagues. Per pensió, no per persona. El tram més alt («més de 3.359,61 €») no publica imports, així que el que hi cau dins només es pot dir com a «més de».",
    },
    method:
      "INSS distribution of contributory retirement pensions by monthly amount bracket ('Total sistema', class 'Jubilación'). Percentiles by linear interpolation inside brackets; mean as published in the INSS monthly report for the same month.",
    thresholds: [1000, 1500, 2000, 2500, 3000],
    mode: { binWidth: 50 },
    displayEdges: [500, 750, 1000, 1250, 1500, 2000, 2500, 3000],
    load() {
      const averages = AVANCE.series("averageRetirement").load();
      return loadSnapshots(TC_SNAPSHOT.group, TC_SNAPSHOT.prefix, TC_SNAPSHOT.ext).map(({ period, raw }) => {
        const published = averages.points.find((p) => p.period === period);
        return {
          period,
          brackets: ssBrackets(sheetRows(raw.body, "Tramos_Total sistema"), "Jubilación"),
          source: snapshotSource(TC_SNAPSHOT, raw, period),
          publishedMean: published ? { value: published.value, source: averages.source } : undefined,
        };
      });
    },
  },
  {
    id: "irpf-income",
    topic: "income",
    amountPer: "year",
    label: {
      es: "Renta declarada en el IRPF",
      en: "Income declared for income tax (IRPF)",
      ca: "Renda declarada a l'IRPF",
    },
    population: {
      es: "declaraciones del IRPF (territorio común)",
      en: "income tax returns (common-regime territory)",
      ca: "declaracions de l'IRPF (territori comú)",
    },
    note: {
      es: "Renta = base imponible general más base del ahorro. Una declaración conjunta cuenta una vez con la renta de la pareja. No incluye a quien no declara ni a País Vasco y Navarra. Tramos fijados en pesetas.",
      en: "Income = general tax base plus savings tax base. A joint return counts once, with the couple's combined income. Excludes people who do not file, and the Basque Country and Navarre. Brackets were set in pesetas.",
      ca: "Renda = base imposable general més base de l'estalvi. Una declaració conjunta compta una vegada amb la renda de la parella. No inclou qui no declara ni el País Basc i Navarra. Trams fixats en pessetes.",
    },
    method:
      "AEAT, Estadística de los declarantes del IRPF, by 'tramos de rendimientos e imputaciones' (general + savings tax base, each floored at 0). Count = all returns in the bracket; amount = general base + savings base in the bracket. Mean = total amount / returns.",
    thresholds: [30000, 60000, 100000, 150000, 200000, 300000, 600000],
    mode: "none",
    resources: [irpfResource()],
    load() {
      return irpf.load().map(({ year, pages }) => {
        const big = aeatRows(pages.big.body.toString("utf8"));
        const bia = new Map(aeatRows(pages.bia.body.toString("utf8")).map((r) => [r.label, r]));
        const brackets: Bracket[] = [];
        for (const r of big) {
          const bounds = irpfBounds(r.label);
          if (!bounds) continue;
          const zero = bounds[1] === 0;
          const amount = zero ? 0 : (r.cells[4] ?? 0) + (bia.get(r.label)?.cells[4] ?? 0);
          brackets.push({ lower: bounds[0], upper: bounds[1], count: r.cells[0] ?? 0, amount });
        }
        checkTotal(brackets, big.find((r) => /^Total$/i.test(r.label))?.cells[0], `IRPF ${year}`);
        return { period: String(year), brackets, source: irpf.source(year, pages.big, "Estadística de los declarantes del IRPF, base imponible general (y del ahorro) por tramos"), extraSources: [irpf.source(year, pages.bia, "Estadística de los declarantes del IRPF, base imponible del ahorro por tramos")] };
      });
    },
    indicators: [
      { stat: "median", id: "irpf-income-p50", label: { es: "Mediana (P50)", en: "Median (P50)", ca: "Mediana (P50)" } },
      { stat: "p90", id: "irpf-income-p90", label: { es: "P90", en: "P90", ca: "P90" } },
      { stat: "p99", id: "irpf-income-p99", label: { es: "P99", en: "P99", ca: "P99" } },
    ],
  },
  {
    id: "wage-earners",
    topic: "income",
    amountPer: "year",
    label: { es: "Salarios anuales (todos los asalariados)", en: "Annual wages (all wage earners)", ca: "Salaris anuals (tots els assalariats)" },
    population: {
      es: "personas que cobraron algún salario en el año",
      en: "people who received any wage during the year",
      ca: "persones que van cobrar algun salari durant l'any",
    },
    note: {
      es: "Salario bruto anual por persona, sumando todos sus pagadores (modelo 190). Incluye a quien trabajó solo parte del año o a tiempo parcial. Tramos en múltiplos del salario mínimo de cada año. Sin País Vasco ni Navarra.",
      en: "Gross annual wage per person, adding up all payers (form 190). Includes people who worked only part of the year or part-time. Brackets are multiples of each year's minimum wage. Excludes the Basque Country and Navarre.",
      ca: "Salari brut anual per persona, sumant tots els pagadors (model 190). Inclou qui va treballar només part de l'any o a temps parcial. Trams en múltiples del salari mínim de cada any. Sense País Basc ni Navarra.",
    },
    method:
      "AEAT, Mercado de trabajo y pensiones en las fuentes tributarias: wage earners, wages and average wage by wage bracket (multiples of the annual SMI stated in the table notes). Mean = total wages / wage earners.",
    thresholds: [20000, 30000, 50000, 60000, 100000, 150000],
    mode: "bracket",
    resources: [mercadoResource()],
    load: () => wageBrackets("salarios"),
    indicators: [
      { stat: "median", id: "wage-earners-p50", label: { es: "Mediana (P50)", en: "Median (P50)", ca: "Mediana (P50)" } },
      { stat: "p90", id: "wage-earners-p90", label: { es: "P90", en: "P90", ca: "P90" } },
      { stat: "p99", id: "wage-earners-p99", label: { es: "P99", en: "P99", ca: "P99" } },
    ],
  },
  ...(["men", "women"] as const).map(
    (sex): DistributionDef => ({
      id: `wage-earners-${sex}`,
      topic: "income",
      amountPer: "year",
      label:
        sex === "men"
          ? { es: "Salarios anuales: hombres", en: "Annual wages: men", ca: "Salaris anuals: homes" }
          : { es: "Salarios anuales: mujeres", en: "Annual wages: women", ca: "Salaris anuals: dones" },
      population:
        sex === "men"
          ? { es: "hombres que cobraron algún salario en el año", en: "men who received any wage during the year", ca: "homes que van cobrar algun salari durant l'any" }
          : { es: "mujeres que cobraron algún salario en el año", en: "women who received any wage during the year", ca: "dones que van cobrar algun salari durant l'any" },
      note: {
        es: "Salario bruto anual por persona, sumando todos sus pagadores (modelo 190), sin ajustar por tiempo trabajado: incluye jornadas parciales y años incompletos. Sin País Vasco ni Navarra.",
        en: "Gross annual wage per person, adding up all payers (form 190), not adjusted for time worked: includes part-time work and part years. Excludes the Basque Country and Navarre.",
        ca: "Salari brut anual per persona, sumant tots els pagadors (model 190), sense ajustar pel temps treballat: inclou jornades parcials i anys incomplets. Sense País Basc ni Navarra.",
      },
      method:
        "AEAT, Mercado de trabajo y pensiones en las fuentes tributarias: wage earners, wages and average wage by wage bracket, filtered by sex in the table's own menu (multiples of the annual SMI). Mean = total wages / wage earners.",
      thresholds: [20000, 30000, 50000, 60000, 100000],
      mode: "bracket",
      load: () => wageBrackets(sex === "men" ? "salarios-varon" : "salarios-mujer"),
      indicators: [
        { stat: "median", id: `wage-earners-${sex}-p50`, label: sex === "men" ? { es: "Hombres", en: "Men", ca: "Homes" } : { es: "Mujeres", en: "Women", ca: "Dones" } },
        { stat: "mean", id: `wage-earners-${sex}-mean`, label: sex === "men" ? { es: "Hombres", en: "Men", ca: "Homes" } : { es: "Mujeres", en: "Women", ca: "Dones" } },
      ],
    }),
  ),
  {
    id: "pensioners",
    topic: "income",
    amountPer: "year",
    label: { es: "Pensiones anuales por persona", en: "Annual pension income per person", ca: "Pensions anuals per persona" },
    population: { es: "personas que cobraron alguna pensión en el año", en: "people who received any pension during the year", ca: "persones que van cobrar alguna pensió durant l'any" },
    note: {
      es: "Suma de todas las pensiones de cada persona en el año (contributivas y de otros regímenes, según el modelo 190). Tramos en múltiplos de la pensión mínima. Sin País Vasco ni Navarra.",
      en: "All pensions of each person in the year added up (form 190). Brackets are multiples of the minimum pension. Excludes the Basque Country and Navarre.",
      ca: "Suma de totes les pensions de cada persona durant l'any (model 190). Trams en múltiples de la pensió mínima. Sense País Basc ni Navarra.",
    },
    method:
      "AEAT, Mercado de trabajo y pensiones en las fuentes tributarias: pensioners and average annual pension by pension bracket (multiples of the minimum pension stated in the notes). Bracket amount = pensioners × average pension (no amount column is published).",
    thresholds: [15000, 20000, 30000, 40000, 50000],
    mode: "bracket",
    load() {
      return mercado.load().map(({ year, pages }) => {
        const html = pages.pensiones.body.toString("utf8");
        const pm = esNumber(aeatText(html).match(/PMI?:\s*([\d.,]+)/)?.[1] ?? "");
        if (!pm) throw new Error(`AEAT pensions ${year}: minimum pension not found in notes`);
        const rows = aeatRows(html);
        const brackets: Bracket[] = [];
        for (const r of rows) {
          const b = multipleBounds(r.label, "PM", pm);
          if (b) brackets.push({ lower: b[0], upper: b[1], count: r.cells[0] ?? 0, amount: (r.cells[0] ?? 0) * (r.cells[2] ?? 0) });
        }
        checkTotal(brackets, rows.find((r) => /^Total$/i.test(r.label))?.cells[0], `AEAT pensions ${year}`);
        return { period: String(year), brackets, source: mercado.source(year, pages.pensiones, "Mercado de trabajo y pensiones en las fuentes tributarias: pensionistas por tramos de pensión") };
      });
    },
  },
  {
    id: "wealth-tax-filers",
    topic: "income",
    amountPer: "total",
    label: { es: "Patrimonio declarado (Impuesto sobre el Patrimonio)", en: "Wealth declared (wealth tax)", ca: "Patrimoni declarat (Impost sobre el Patrimoni)" },
    population: { es: "declarantes del Impuesto sobre el Patrimonio", en: "wealth tax filers", ca: "declarants de l'Impost sobre el Patrimoni" },
    note: {
      es: "Base imponible: patrimonio neto sujeto, tras deudas y sin bienes exentos. Solo declaran quienes deben pagar o tienen más de 2 millones en bienes, por lo que no es la distribución de toda la población. Sin País Vasco ni Navarra.",
      en: "Tax base: taxable net wealth, after debts and excluding exempt assets. Only people who owe tax or hold more than €2 million in assets file, so this is not the distribution of the whole population. Excludes the Basque Country and Navarre.",
      ca: "Base imposable: patrimoni net subjecte, després de deutes i sense béns exempts. Només declaren els qui han de pagar o tenen més de 2 milions en béns, de manera que no és la distribució de tota la població. Sense País Basc ni Navarra.",
    },
    method: "AEAT, Estadística de los declarantes del Impuesto sobre el Patrimonio: filers and tax base by tax-base bracket (thousand euros). Mean = total base / filers.",
    thresholds: [1000000, 3000000, 5000000, 10000000, 30000000],
    mode: "none",
    resources: [patrimonioResource()],
    load() {
      return patrimonio.load().map(({ year, pages }) => {
        const rows = aeatRows(pages.base.body.toString("utf8"));
        const num = (x: string) => Number(x.replace(/\./g, "").replace(",", ".")) * 1000;
        const brackets: Bracket[] = [];
        for (const r of rows) {
          let b: [number, number | null] | null = null;
          const upTo = r.label.match(/^Hasta ([\d.,]+)$/i);
          const range = r.label.match(/^([\d.,]+)\s*-\s*([\d.,]+)$/);
          const top = r.label.match(/^Más(?: de)? ([\d.,]+)$/i);
          if (upTo) b = [0, num(upTo[1])];
          else if (range) b = [num(range[1]), num(range[2])];
          else if (top) b = [num(top[1]), null];
          if (b) brackets.push({ lower: b[0], upper: b[1], count: r.cells[0] ?? 0, amount: r.cells[4] ?? 0 });
        }
        checkTotal(brackets, rows.find((r) => /^Total$/i.test(r.label))?.cells[0], `AEAT wealth tax ${year}`);
        return { period: String(year), brackets, source: patrimonio.source(year, pages.base, "Estadística de los declarantes del Impuesto sobre el Patrimonio, base imponible por tramos") };
      });
    },
  },
];

function irpfResource() {
  return { key: "aeat-dist/irpf", fetch: () => irpf.fetch(), load: () => { throw new Error("fetch-only resource"); } };
}
function mercadoResource() {
  return { key: "aeat-dist/mercado", fetch: () => mercado.fetch(), load: () => { throw new Error("fetch-only resource"); } };
}
function patrimonioResource() {
  return { key: "aeat-dist/patrimonio", fetch: () => patrimonio.fetch(), load: () => { throw new Error("fetch-only resource"); } };
}
