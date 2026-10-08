// Official forecasts and long-term projections (we make none of our own). Each series keeps
// its last actual year as an anchor and marks later years as "forecast"; it is drawn as a
// dashed continuation and never presented as an observation. Vintages are explicit so a
// new release is a reviewed config change. Verified on 2026-10-08.

import type { Localized, Source } from "../../lib/schema";
import type { IndicatorDef } from "../lib/define";
import { csvRows, markForecast, sheetRows, yearRow } from "../lib/parsers";
import { download, latestRaw, saveRaw } from "../lib/raw";
import { file, type Point, type Resource } from "../lib/sources";

const L = (es: string, en: string, ca: string): Localized => ({ es, en, ca });

// ---------------------------------------------------------------- IMF World Economic Outlook (SDMX CSV)

const IMF_VINTAGE = "WEO_2026_APR_VINTAGE";
const IMF_LABEL = "FMI, abril 2026|IMF, April 2026|FMI, abril 2026";
const IMF_INDICATORS = ["NGDP_RPCH", "PCPIPCH", "GGR_NGDP", "GGX_NGDP", "GGXCNL_NGDP", "GGXWDG_NGDP"];

const IMF_API = `https://api.imf.org/external/sdmx/2.1/data/IMF.RES,${IMF_VINTAGE},1.0.0/ESP.${IMF_INDICATORS.join("+")}.A?startPeriod=2015`;
const IMF_FILE = `weo-${IMF_VINTAGE.toLowerCase()}-esp.csv`;

/** One indicator from the WEO CSV, from its last actual year (anchor) onwards. */
function parseImf(body: Buffer, indicator: string): Point[] {
  const [header, ...rows] = csvRows(body.toString("utf8"));
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i === -1) throw new Error(`IMF CSV: no column ${name}`);
    return i;
  };
  const [ind, time, value] = [col("INDICATOR"), col("TIME_PERIOD"), col("OBS_VALUE")];
  const actual = header.findIndex((h) => h.startsWith("LATEST_ACTUAL"));
  const own = rows.filter((r) => r[ind] === indicator && r[value] !== "");
  if (own.length === 0) throw new Error(`IMF CSV: no rows for ${indicator}`);
  const lastActual = actual > -1 && own[0][actual] ? own[0][actual].slice(0, 4) : "2025";
  const points: Point[] = own.map((r) => ({ period: r[time], value: Number(r[value]), status: "final" }));
  return markForecast(points, lastActual).filter((p) => p.period >= lastActual);
}

function imfWeo(indicator: string): Resource {
  return {
    key: `imf/${indicator}`,
    fetchKey: "imf/weo",
    async fetch() {
      const res = await download(IMF_API, { headers: { accept: "application/vnd.sdmx.data+csv;version=1.0.0" } });
      for (const i of IMF_INDICATORS) parseImf(res.body, i); // fail early if the format changed
      saveRaw("imf", IMF_FILE, res.body, IMF_API, res.contentType);
    },
    load() {
      const raw = latestRaw("imf", IMF_FILE);
      const source: Source = {
        id: "imf-weo-2026-apr-esp",
        publisher: "International Monetary Fund",
        dataset: "World Economic Outlook, April 2026",
        tableId: IMF_VINTAGE,
        url: "https://www.imf.org/external/datamapper/profile/ESP",
        apiUrl: IMF_API,
        retrievedAt: raw.retrievedAt,
        rawPath: raw.rawPath,
        fileHash: raw.sha256,
        licence: "IMF copyright and usage terms: reuse with attribution, without altering accuracy",
        attribution: "Source: International Monetary Fund, World Economic Outlook database",
      };
      return { points: parseImf(raw.body, indicator), source };
    },
  };
}

// ---------------------------------------------------------------- European Commission AMECO (web query)

const AMECO_VINTAGE = "Comisión Europea, primavera 2026|European Commission, spring 2026|Comissió Europea, primavera 2026";
/** Last year that is outturn in the Spring 2026 forecast. */
const AMECO_ACTUAL_UNTIL = "2025";

function ameco(variable: string, sourceId: string, label: string, transform?: (p: Point[]) => Point[]): Resource {
  const years = Array.from({ length: 2027 - 2015 + 1 }, (_, i) => 2015 + i).join(",");
  const apiUrl = `https://ec.europa.eu/economy_finance/ameco/wq/series?fullVariable=${variable}&countries=ESP&years=${years}&Lastyear=0&Yearorder=ASC`;
  const fileName = `${sourceId}.html`;
  const parse = (body: Buffer) => {
    const html = body.toString("utf8");
    const heads = [...html.matchAll(/<th>(\d{4})<\/th>/g)].map((m) => m[1]);
    const cells = [...html.matchAll(/<td formula="[^"]*">([^<]*)<\/td>/g)].map((m) => m[1]);
    if (heads.length === 0 || heads.length !== cells.length) throw new Error(`AMECO ${variable}: unexpected table`);
    const points: Point[] = heads.flatMap((y, i) => (cells[i] === "" || cells[i] === "NA" ? [] : [{ period: y, value: Number(cells[i]), status: "final" as const }]));
    const shaped = transform ? transform(points) : points;
    return markForecast(shaped, AMECO_ACTUAL_UNTIL).filter((p) => p.period >= AMECO_ACTUAL_UNTIL);
  };
  return {
    key: `ameco/${sourceId}`,
    async fetch() {
      const res = await download(apiUrl);
      parse(res.body);
      saveRaw("ameco", fileName, res.body, apiUrl, res.contentType);
    },
    load() {
      const raw = latestRaw("ameco", fileName);
      return {
        points: parse(raw.body),
        source: {
          id: sourceId,
          publisher: "European Commission (DG ECFIN)",
          dataset: `AMECO, Spring 2026 Economic Forecast: ${label}`,
          tableId: variable,
          url: "https://economy-finance.ec.europa.eu/economic-surveillance-eu-member-states/country-pages-including-country-reports/spain/economic-forecast-spain_en",
          apiUrl,
          retrievedAt: raw.retrievedAt,
          rawPath: raw.rawPath,
          fileHash: raw.sha256,
          licence: "CC BY 4.0",
          attribution: "Source: European Commission, AMECO",
        },
      };
    },
  };
}

/** Growth rates from a volume level series. */
const growth = (points: Point[]) =>
  points.slice(1).map((p, i) => ({ ...p, value: (p.value / points[i].value - 1) * 100 }));

// ---------------------------------------------------------------- Ageing Report 2024 and AIReF (XLSX)

const ar2024 = file({
  sourceId: "ec-ageing-report-2024-statistical-annex",
  group: "ageing-report",
  filename: "2024_Ageing_Report-Statistical_annex_all_countryfiches.xlsx",
  url: "https://economy-finance.ec.europa.eu/document/download/e248db46-f876-4e72-8821-efae678e81ea_en?filename=2024_Ageing_Report-Statistical_annex_all_countryfiches.xlsx",
  humanUrl: "https://economy-finance.ec.europa.eu/publications/2024-ageing-report-economic-and-budgetary-projections-eu-member-states-2022-2070_en",
  publisher: "European Commission and Economic Policy Committee",
  dataset: "2024 Ageing Report, statistical annex (country fiches), Spain, baseline scenario",
  tableId: "ESb / ESc",
  licence: "CC BY 4.0",
  attribution: "Source: European Commission (DG ECFIN) and Economic Policy Committee, 2024 Ageing Report",
  notes: "Base year 2022 is outturn; 2023–2070 are projections.",
  parse: (body) => {
    const b = sheetRows(body, "ESb");
    const c = sheetRows(body, "ESc");
    const first = (title: RegExp) => (r: (string | number | null)[]) => typeof r[0] === "string" && title.test(r[0]) && r.includes(2070);
    const mk = (rows: typeof b, title: RegExp, row: (l: string) => boolean) => markForecast(yearRow(rows, { header: first(title), row, labelCol: 0 }), "2022");
    const scaleBy = (points: Point[], k: number) => points.map((p) => ({ ...p, value: p.value * k }));
    return {
      pensions: mk(b, /^Baseline as % of GDP$/, (l) => l === "Public pensions, gross"),
      "pension-contributions": mk(b, /^Baseline as % of GDP$/, (l) => l === "Public pensions, contributions"),
      "pension-balance": mk(b, /^Baseline as % of GDP$/, (l) => l.startsWith("Balance of the pension system")),
      pensioners: scaleBy(mk(b, /^Additional indicators$/, (l) => l === "Pensioners (public, 1000 persons)"), 1000),
      contributors: scaleBy(mk(b, /^Additional indicators$/, (l) => l === "Contributors (public pensions, 1000 persons)"), 1000),
      "support-ratio": scaleBy(mk(b, /^Additional indicators$/, (l) => l.startsWith("Support ratio")), 0.01),
      health: mk(c, /^Health care spending as % of GDP$/, (l) => l === "Baseline"),
      ltc: mk(c, /^Long-term care spending as % of GDP$/, (l) => l === "Baseline"),
      education: mk(c, /^Education spending as % of GDP$/, (l) => l === "Baseline"),
    };
  },
});

const AIREF_URL_2026 = "https://www.airef.es/wp-content/uploads/2026/05/Pensiones/AIReF.-Tablas-y-graficos.-Estudio-de-evaluacion-de-la-regla-de-gasto-en-pensiones.xlsx";
const airef2026 = file({
  sourceId: "airef-2026-pension-rule-study",
  group: "airef",
  filename: "AIReF-Tablas-y-graficos-Estudio-regla-gasto-pensiones-2026.xlsx",
  url: AIREF_URL_2026,
  humanUrl: "https://www.airef.es/es/estudios/estudio-sobre-la-regla-de-gasto-de-pensiones/",
  publisher: "AIReF",
  dataset: "Estudio sobre la regla de gasto de pensiones (2026): tablas y gráficos",
  tableId: "Gráficos 4, 23, 24, 25",
  licence: "Reuse with attribution and without distortion (AIReF legal notice, Ley 37/2007)",
  attribution: "Fuente: Autoridad Independiente de Responsabilidad Fiscal (AIReF)",
  notes: "2025 is outturn in AIReF's definition; 2026–2050 are AIReF projections.",
  parse: (body) => {
    const sheet = (name: string, label: string) =>
      markForecast(
        yearRow(sheetRows(body, name), { header: (r) => r.includes(2015) && r.includes(2050), row: (l) => l === label, labelCol: 1 }),
        "2025",
      );
    return {
      pensions: sheet("Gráfico 4", "AIReF 2026"),
      health: sheet("Gráfico 23", "AIReF 2026"),
      ltc: sheet("Gráfico 24", "AIReF"),
      education: sheet("Gráfico 25", "AIReF"),
    };
  },
});

// ---------------------------------------------------------------- NATO (image-only PDF, transcribed)

/**
 * NATO "Defence Expenditure of NATO Countries (2014–2026)", Table 3, row Spain, share of
 * real GDP. The PDF has no text layer; values were read from the page rendered at 300 dpi
 * and cross-checked against the text-searchable 2025 edition for 2014–2024. 2025–2026 are
 * NATO estimates.
 */
const NATO_TRANSCRIBED: Record<string, number> = {
  "2014": 0.92, "2015": 0.92, "2016": 0.8, "2017": 0.9, "2018": 0.92, "2019": 0.9, "2020": 1.0,
  "2021": 1.02, "2022": 1.13, "2023": 1.17, "2024": 1.42, "2025": 2.0, "2026": 2.0,
};

function natoDefence(): Resource {
  const url = "https://www.nato.int/content/dam/nato/webready/documents/finance/def-exp-2026-en.pdf";
  const fileName = "def-exp-2026-en.pdf";
  return {
    key: "nato/def-exp-2026",
    async fetch() {
      const res = await download(url);
      if (res.body.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error("NATO: not a PDF");
      saveRaw("nato", fileName, res.body, url, res.contentType);
    },
    load() {
      const raw = latestRaw("nato", fileName);
      return {
        points: Object.entries(NATO_TRANSCRIBED).map(([period, value]) => ({
          period,
          value,
          status: period >= "2025" ? ("provisional" as const) : ("final" as const),
        })),
        source: {
          id: "nato-defence-expenditure-2014-2026",
          publisher: "NATO",
          dataset: "Defence Expenditure of NATO Countries (2014–2026), Table 3",
          tableId: "Table 3, Spain (p. 7)",
          url: "https://www.nato.int/en/what-we-do/introduction-to-nato/defence-expenditures-and-natos-5-commitment",
          apiUrl: url,
          retrievedAt: raw.retrievedAt,
          rawPath: raw.rawPath,
          fileHash: raw.sha256,
          licence: "No open licence stated; public NATO press release, cited with attribution",
          attribution: "Source: NATO",
          notes: "Image-only PDF: values transcribed by hand from Table 3 (pending a second check).",
        },
      };
    },
  };
}

// ---------------------------------------------------------------- Indicators

const label = (s: string) => {
  const [es, en, ca] = s.split("|");
  return L(es, en, ca);
};

const forecast = (
  id: string,
  topic: IndicatorDef["topic"],
  unit: IndicatorDef["unit"],
  lbl: string,
  method: string,
  resource: Resource,
  note?: Localized,
): IndicatorDef => ({ id, topic, unit, frequency: "A", decimals: 1, yZero: true, label: label(lbl), note, method, resource });

const PROJECTION_NOTE = L(
  "Proyección oficial publicada por la fuente, no una observación. Cada fuente usa su propia definición, por eso las líneas no coinciden en el año base.",
  "Official projection published by the source, not an observation. Each source uses its own definition, so the lines differ in the base year.",
  "Projecció oficial publicada per la font, no una observació. Cada font fa servir la seva definició, per això les línies no coincideixen a l'any base.",
);

const AR_PENSIONS_NOTE = L(
  "Proyección del Informe de Envejecimiento 2024 de la UE con la legislación vigente al elaborarlo (sin reformas posteriores). Cuenta personas pensionistas y cotizantes de todos los regímenes públicos, por eso no coincide con los afiliados y pensiones de la Seguridad Social.",
  "Projection from the EU 2024 Ageing Report under the legislation in force when it was prepared (no later reforms). It counts pensioners and contributors of all public schemes, so it differs from Seguridad Social's affiliates and pensions.",
  "Projecció de l'Informe d'Envelliment 2024 de la UE amb la legislació vigent quan es va elaborar (sense reformes posteriors). Compta persones pensionistes i cotitzants de tots els règims públics, per això no coincideix amb els afiliats i pensions de la Seguretat Social.",
);

export const FORECASTS: IndicatorDef[] = [
  forecast("forecast-gdp-growth-imf", "economy", "percent_change", IMF_LABEL, "Real GDP growth, IMF World Economic Outlook April 2026 (NGDP_RPCH).", imfWeo("NGDP_RPCH")),
  forecast("forecast-gdp-growth-ec", "economy", "percent_change", AMECO_VINTAGE, "Real GDP growth computed from AMECO GDP volume (OVGD), European Commission Spring 2026 forecast.", ameco("1.1.0.0.OVGD", "ameco-ovgd-esp-spring-2026", "GDP at constant prices", growth)),
  forecast("forecast-balance-imf", "public-finances", "percent_gdp", IMF_LABEL, "General government net lending/borrowing, % of GDP, IMF WEO April 2026 (GGXCNL_NGDP).", imfWeo("GGXCNL_NGDP")),
  forecast("forecast-balance-ec", "public-finances", "percent_gdp", AMECO_VINTAGE, "General government net lending/borrowing (EDP), % of GDP, AMECO UBLGE, European Commission Spring 2026 forecast.", ameco("1.0.319.0.UBLGE", "ameco-ublge-esp-spring-2026", "Net lending (EDP)")),
  forecast("forecast-debt-imf", "public-finances", "percent_gdp", IMF_LABEL, "General government gross debt, % of GDP, IMF WEO April 2026 (GGXWDG_NGDP).", imfWeo("GGXWDG_NGDP")),
  forecast("forecast-debt-ec", "public-finances", "percent_gdp", AMECO_VINTAGE, "General government consolidated gross debt (EDP), % of GDP, AMECO UDGG, European Commission Spring 2026 forecast.", ameco("1.0.319.0.UDGG", "ameco-udgg-esp-spring-2026", "Gross debt (EDP)")),
  forecast("forecast-expenditure-imf", "public-spending", "percent_gdp", IMF_LABEL, "General government total expenditure, % of GDP, IMF WEO April 2026 (GGX_NGDP).", imfWeo("GGX_NGDP")),
  forecast("forecast-expenditure-ec", "public-spending", "percent_gdp", AMECO_VINTAGE, "General government total expenditure (EDP), % of GDP, AMECO UUTGE, European Commission Spring 2026 forecast.", ameco("1.0.319.0.UUTGE", "ameco-uutge-esp-spring-2026", "Total expenditure (EDP)")),
  forecast("forecast-revenue-imf", "public-spending", "percent_gdp", IMF_LABEL, "General government revenue, % of GDP, IMF WEO April 2026 (GGR_NGDP).", imfWeo("GGR_NGDP")),
  forecast("forecast-revenue-ec", "public-spending", "percent_gdp", AMECO_VINTAGE, "General government total revenue, % of GDP, AMECO URTG, European Commission Spring 2026 forecast.", ameco("1.0.319.0.URTG", "ameco-urtg-esp-spring-2026", "Total revenue")),

  ...(["pensions", "health", "ltc", "education"] as const).flatMap((what): IndicatorDef[] => [
    forecast(
      `projection-${what}-airef`,
      what === "pensions" ? "pensions" : "public-spending",
      "percent_gdp",
      "AIReF 2026|AIReF 2026|AIReF 2026",
      `Projected public spending on ${what === "ltc" ? "long-term care" : what}, % of GDP, AIReF 2026 pension spending rule study (long-term scenario to 2050).`,
      airef2026.series(what),
      PROJECTION_NOTE,
    ),
    forecast(
      `projection-${what}-ageing-report`,
      what === "pensions" ? "pensions" : "public-spending",
      "percent_gdp",
      "Informe de Envejecimiento 2024 (UE)|EU Ageing Report 2024|Informe d'Envelliment 2024 (UE)",
      `Projected public spending on ${what === "ltc" ? "long-term care" : what}, % of GDP, 2024 Ageing Report baseline scenario (European Commission and Economic Policy Committee).`,
      ar2024.series(what),
      PROJECTION_NOTE,
    ),
  ]),

  ...(
    [
      ["pension-contributions", "percent_gdp", 1, "Cotizaciones a pensiones públicas|Contributions to public pensions|Cotitzacions a pensions públiques", "Contributions to public pensions, % of GDP"],
      ["pension-balance", "percent_gdp", 1, "Saldo del sistema de pensiones (cotizaciones − gasto)|Pension system balance (contributions − spending)|Saldo del sistema de pensions (cotitzacions − despesa)", "Balance of the pension system (contributions minus gross expenditure), % of GDP"],
      ["pensioners", "persons", 0, "Pensionistas|Pensioners|Pensionistes", "Pensioners of public pensions (persons, not pensions), thousands × 1,000"],
      ["contributors", "persons", 0, "Cotizantes|Contributors|Cotitzants", "Contributors to public pensions (all public schemes), thousands × 1,000"],
      ["support-ratio", "ratio", 2, "Cotizantes por pensionista|Contributors per pensioner|Cotitzants per pensionista", "Support ratio (contributors per 100 pensioners) ÷ 100"],
    ] as const
  ).map(([what, unit, decimals, lbl, desc]): IndicatorDef => ({
    ...forecast(
      `projection-${what}-ageing-report`,
      "pensions",
      unit,
      lbl,
      `${desc}, 2024 Ageing Report baseline scenario (European Commission and Economic Policy Committee), sheet ESb. 2022 is outturn; later years are projections under the legislation in force when the report was prepared.`,
      ar2024.series(what),
      AR_PENSIONS_NOTE,
    ),
    decimals,
  })),

  {
    id: "defence-nato-gdp",
    topic: "public-spending",
    unit: "percent_gdp",
    frequency: "A",
    decimals: 2,
    yZero: true,
    label: L("Definición OTAN", "NATO definition", "Definició OTAN"),
    note: L(
      "La OTAN cuenta solo la Administración central, en caja, e incluye pensiones militares, I+D de defensa, misiones y gasto de defensa de otros ministerios. 2025 y 2026 son estimaciones de la OTAN. Valores transcritos de un PDF sin capa de texto (pendientes de una segunda comprobación).",
      "NATO counts central government only, on a cash basis, and includes military pensions, defence R&D, missions and defence spending by other ministries. 2025 and 2026 are NATO estimates. Values transcribed from a PDF without a text layer (pending a second check).",
      "L'OTAN compta només l'Administració central, en caixa, i inclou pensions militars, R+D de defensa, missions i despesa de defensa d'altres ministeris. 2025 i 2026 són estimacions de l'OTAN. Valors transcrits d'un PDF sense capa de text (pendents d'una segona comprovació).",
    ),
    method: "NATO core defence expenditure as a share of real GDP (Table 3), transcribed from the image-only PDF of the 2014–2026 report.",
    resource: natoDefence(),
  },
  {
    id: "defence-cofog-gdp",
    topic: "public-spending",
    unit: "percent_gdp",
    frequency: "A",
    decimals: 2,
    yZero: true,
    label: L("Definición COFOG (Eurostat)", "COFOG definition (Eurostat)", "Definició COFOG (Eurostat)"),
    note: L(
      "COFOG cuenta todas las administraciones en contabilidad nacional; las pensiones militares van a protección social y la sanidad militar a sanidad.",
      "COFOG counts all levels of government in national accounts; military pensions go to social protection and military health care to health.",
      "COFOG compta totes les administracions en comptabilitat nacional; les pensions militars van a protecció social i la sanitat militar a sanitat.",
    ),
    method: "Same series as 'spending-defence-gdp' (Eurostat gov_10a_exp, COFOG GF02, % of GDP), relabelled for the comparison with NATO.",
    inputs: ["spending-defence-gdp"],
    formula: "spending-defence-gdp",
    compute: ([cofog]) => cofog,
  },
];
