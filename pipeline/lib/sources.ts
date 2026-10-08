// Source adapters. Each adapter knows how to download its raw file(s) and how to
// turn the stored raw bytes into dated points plus a Source record for data/sources.json.

import type { Source } from "../../lib/schema";
import fs from "node:fs";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { download, latestRaw, RAW_DIR, saveRaw, type RawFile } from "./raw";

export type Point = { period: string; value: number; status: "final" | "provisional" | "forecast" };

/**
 * Points plus the Source they came from. Resources built from several raw files
 * (snapshots) tag each point with its own sourceId and list every Source in `sources`.
 */
export type Loaded = { points: (Point & { sourceId?: string })[]; source: Source; sources?: Source[] };

export interface Resource {
  /** Unique key per series. */
  key: string;
  /** Resources sharing a fetchKey are downloaded once (several series in one file). Used for --only. */
  fetchKey?: string;
  fetch(): Promise<void>;
  load(): Loaded;
}

const INE_API = "https://servicios.ine.es/wstempus/js/ES";

// ---------------------------------------------------------------- INE Tempus3

type IneData = {
  COD: string;
  Nombre: string;
  Data: { Fecha: string; T3_TipoDato?: string; T3_Periodo?: string; Anyo: number; Valor: number | null; Secreto?: boolean }[];
};
type IneMeta = {
  COD: string;
  Nombre: string;
  Periodicidad: { Codigo: string };
  Escala: { Factor: string };
  Operacion: { Nombre: string };
};

export type IneSeriesOptions = {
  code: string;
  /** Table the series is published in; used for the human-facing link. */
  tableId: string;
  /** Expected INE scale factor ("1E0", "1E3"); values are multiplied by it. A change fails the transform. */
  scale?: string;
  /** Overrides the operation name INE returns. */
  dataset?: string;
};

export function ineSeries(opts: IneSeriesOptions): Resource {
  const dataUrl = `${INE_API}/DATOS_SERIE/${opts.code}?date=20000101:&tip=A`;
  const metaUrl = `${INE_API}/SERIE/${opts.code}?det=2`;
  const file = `${opts.code}.json`;
  const metaFile = `${opts.code}.meta.json`;
  return {
    key: `ine/${opts.code}`,
    async fetch() {
      const data = await download(dataUrl);
      const parsed = JSON.parse(data.body.toString("utf8")) as IneData;
      if (!Array.isArray(parsed.Data) || parsed.Data.length === 0) throw new Error(`INE ${opts.code}: no data`);
      saveRaw("ine", file, data.body, dataUrl, data.contentType);
      const meta = await download(metaUrl);
      saveRaw("ine", metaFile, meta.body, metaUrl, meta.contentType);
    },
    load() {
      const raw = latestRaw("ine", file);
      const metaRaw = latestRaw("ine", metaFile);
      const data = JSON.parse(raw.body.toString("utf8")) as IneData;
      const meta = JSON.parse(metaRaw.body.toString("utf8")) as IneMeta;
      const freq = meta.Periodicidad.Codigo;
      const expectedScale = opts.scale ?? "1E0";
      if (meta.Escala.Factor !== expectedScale) {
        throw new Error(`INE ${opts.code}: scale is ${meta.Escala.Factor}, expected ${expectedScale}`);
      }
      const factor = Number(expectedScale);
      const points: Point[] = [];
      for (const d of data.Data) {
        if (d.Valor === null || d.Secreto) continue;
        const month = Number(d.Fecha.slice(5, 7));
        let period: string;
        // "C": four-yearly surveys (e.g. Structure of Earnings), dated by their reference year.
        if (freq === "A" || freq === "C") period = String(d.Anyo);
        else if (freq === "Q") period = `${d.Anyo}-Q${Math.floor((month - 1) / 3) + 1}`;
        else if (freq === "M") period = `${d.Anyo}-${String(month).padStart(2, "0")}`;
        else throw new Error(`INE ${opts.code}: unsupported periodicity ${freq}`);
        const status = !d.T3_TipoDato || d.T3_TipoDato === "Definitivo" ? "final" : "provisional";
        points.push({ period, value: round(d.Valor * factor, 6), status });
      }
      return {
        points,
        source: {
          id: `ine-${opts.code.toLowerCase()}`,
          publisher: "INE",
          dataset: opts.dataset ?? meta.Operacion.Nombre,
          tableId: opts.tableId,
          seriesCode: opts.code,
          url: `https://www.ine.es/jaxiT3/Tabla.htm?t=${opts.tableId}`,
          apiUrl: dataUrl,
          retrievedAt: raw.retrievedAt,
          rawPath: raw.rawPath,
          fileHash: raw.sha256,
          licence: "CC BY 4.0",
          attribution: "Fuente: INE",
          notes: data.Nombre.trim(),
        },
      };
    },
  };
}

// ---------------------------------------------------------------- Eurostat (JSON-stat 2.0)

type JsonStat = {
  id: string[];
  size: number[];
  value: Record<string, number>;
  status?: Record<string, string>;
  dimension: Record<string, { category: { index: Record<string, number> } }>;
  updated?: string;
};

export type EurostatOptions = {
  sourceId: string;
  dataset: string;
  /** Every dimension except time must resolve to a single value. */
  filters: Record<string, string>;
  datasetLabel: string;
};

export function eurostat(opts: EurostatOptions): Resource {
  const params = new URLSearchParams({ format: "JSON", lang: "EN", ...opts.filters, sinceTimePeriod: "2000" });
  const apiUrl = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${opts.dataset}?${params}`;
  const file = `${opts.sourceId}.json`;
  return {
    key: `eurostat/${opts.sourceId}`,
    async fetch() {
      const res = await download(apiUrl);
      saveRaw("eurostat", file, res.body, apiUrl, res.contentType);
    },
    load() {
      const raw = latestRaw("eurostat", file);
      const js = JSON.parse(raw.body.toString("utf8")) as JsonStat;
      const timePos = js.id.indexOf("time");
      js.id.forEach((dim, i) => {
        if (dim !== "time" && js.size[i] !== 1) throw new Error(`Eurostat ${opts.sourceId}: dimension ${dim} has ${js.size[i]} values`);
      });
      if (timePos !== js.id.length - 1) throw new Error(`Eurostat ${opts.sourceId}: time must be the last dimension`);
      const points: Point[] = [];
      for (const [label, idx] of Object.entries(js.dimension.time.category.index)) {
        const v = js.value[String(idx)];
        if (v === undefined || v === null) continue;
        const flag = js.status?.[String(idx)] ?? "";
        points.push({ period: eurostatPeriod(label), value: v, status: flag.includes("p") ? "provisional" : "final" });
      }
      return {
        points,
        source: {
          id: opts.sourceId,
          publisher: "Eurostat",
          dataset: opts.datasetLabel,
          tableId: opts.dataset,
          url: `https://ec.europa.eu/eurostat/databrowser/view/${opts.dataset}/default/table`,
          apiUrl,
          retrievedAt: raw.retrievedAt,
          rawPath: raw.rawPath,
          fileHash: raw.sha256,
          licence: "CC BY 4.0",
          attribution: "Source: Eurostat",
        },
      };
    },
  };
}

export type EurostatMultiOptions = {
  sourceId: string;
  dataset: string;
  /** Single-valued filters (every dimension except `by` and time). */
  filters: Record<string, string>;
  /** Dimension with several values; each value becomes a named series. */
  by: string;
  values: string[];
  datasetLabel: string;
};

/** One Eurostat download holding several series (e.g. every COFOG function), one Source. */
export function eurostatMulti(opts: EurostatMultiOptions): { series(code: string): Resource } {
  const params = new URLSearchParams({ format: "JSON", lang: "EN", ...opts.filters, sinceTimePeriod: "2000" });
  for (const v of opts.values) params.append(opts.by, v);
  const apiUrl = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${opts.dataset}?${params}`;
  const file = `${opts.sourceId}.json`;
  const fetchKey = `eurostat/${opts.sourceId}`;
  const loadAll = () => {
    const raw = latestRaw("eurostat", file);
    const js = JSON.parse(raw.body.toString("utf8")) as JsonStat;
    const byPos = js.id.indexOf(opts.by);
    const timePos = js.id.indexOf("time");
    js.id.forEach((dim, i) => {
      if (dim !== "time" && dim !== opts.by && js.size[i] !== 1) throw new Error(`Eurostat ${opts.sourceId}: dimension ${dim} has ${js.size[i]} values`);
    });
    if (timePos !== js.id.length - 1 || byPos === -1) throw new Error(`Eurostat ${opts.sourceId}: unexpected dimension order`);
    const nTime = js.size[timePos];
    // Stride of the `by` dimension = product of sizes after it (only time is multi-valued after it).
    const stride = js.size.slice(byPos + 1).reduce((a, b) => a * b, 1);
    const series: Record<string, Point[]> = {};
    for (const [code, k] of Object.entries(js.dimension[opts.by].category.index)) {
      const points: Point[] = [];
      for (const [label, t] of Object.entries(js.dimension.time.category.index)) {
        if (t >= nTime) continue;
        const idx = String(k * stride + t);
        const v = js.value[idx];
        if (v === undefined || v === null) continue;
        const flag = js.status?.[idx] ?? "";
        points.push({ period: eurostatPeriod(label), value: v, status: flag.includes("p") ? "provisional" : "final" });
      }
      series[code] = points;
    }
    const source: Source = {
      id: opts.sourceId,
      publisher: "Eurostat",
      dataset: opts.datasetLabel,
      tableId: opts.dataset,
      url: `https://ec.europa.eu/eurostat/databrowser/view/${opts.dataset}/default/table`,
      apiUrl,
      retrievedAt: raw.retrievedAt,
      rawPath: raw.rawPath,
      fileHash: raw.sha256,
      licence: "CC BY 4.0",
      attribution: "Source: Eurostat",
    };
    return { series, source };
  };
  return {
    series(code: string): Resource {
      return {
        key: `${fetchKey}#${code}`,
        fetchKey,
        async fetch() {
          const res = await download(apiUrl);
          saveRaw("eurostat", file, res.body, apiUrl, res.contentType);
          for (const v of opts.values) if (!loadAll().series[v]?.length) throw new Error(`Eurostat ${opts.sourceId}: no data for ${v}`);
        },
        load() {
          const all = loadAll();
          const points = all.series[code];
          if (!points) throw new Error(`Eurostat ${opts.sourceId}: no series ${code}`);
          return { points, source: all.source };
        },
      };
    },
  };
}

function eurostatPeriod(label: string): string {
  if (/^\d{4}$/.test(label)) return label;
  const q = label.match(/^(\d{4})-?Q([1-4])$/);
  if (q) return `${q[1]}-Q${q[2]}`;
  const m = label.match(/^(\d{4})-?M?(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}`;
  throw new Error(`Unrecognised Eurostat period ${label}`);
}

// ---------------------------------------------------------------- Banco de España (BIEST series API)

type BdeSeries = { serie: string; descripcion: string; codFrecuencia: string; fechas: string[]; valores: (number | null)[] };

export type BdeOptions = { code: string; tableId: string; dataset: string; humanUrl: string };

export function bdeSeries(opts: BdeOptions): Resource {
  const apiUrl = `https://app.bde.es/bierest/resources/srdatosapp/listaSeries?idioma=es&series=${opts.code}&rango=MAX`;
  const file = `${opts.code}.json`;
  return {
    key: `bde/${opts.code}`,
    async fetch() {
      const res = await download(apiUrl);
      const parsed = JSON.parse(res.body.toString("utf8")) as BdeSeries[];
      if (!parsed[0]?.fechas?.length) throw new Error(`BdE ${opts.code}: no data`);
      saveRaw("bde", file, res.body, apiUrl, res.contentType);
    },
    load() {
      const raw = latestRaw("bde", file);
      const [s] = JSON.parse(raw.body.toString("utf8")) as BdeSeries[];
      const points: Point[] = [];
      s.fechas.forEach((f, i) => {
        const v = s.valores[i];
        if (v === null || v === undefined) return;
        const year = Number(f.slice(0, 4));
        const month = Number(f.slice(5, 7));
        const period =
          s.codFrecuencia === "Q"
            ? `${year}-Q${Math.floor((month - 1) / 3) + 1}`
            : s.codFrecuencia === "M"
              ? `${year}-${String(month).padStart(2, "0")}`
              : String(year);
        points.push({ period, value: v, status: "final" });
      });
      return {
        points,
        source: {
          id: `bde-${opts.code.toLowerCase().replace(/_/g, "-")}`,
          publisher: "Banco de España",
          dataset: opts.dataset,
          tableId: opts.tableId,
          seriesCode: opts.code,
          url: opts.humanUrl,
          apiUrl,
          retrievedAt: raw.retrievedAt,
          rawPath: raw.rawPath,
          fileHash: raw.sha256,
          licence: "Reuse permitted with attribution (Banco de España legal notice)",
          attribution: "Fuente: Banco de España",
          notes: s.descripcion,
        },
      };
    },
  };
}

// ---------------------------------------------------------------- Downloaded files (XLSX, CSV, PDF)

export type FileOptions = {
  sourceId: string;
  group: string;
  filename: string;
  /** Download URL, or a function that resolves it (e.g. latest monthly file). */
  url: string | (() => Promise<string>);
  humanUrl: string;
  publisher: string;
  dataset: string;
  tableId?: string;
  licence: string;
  attribution: string;
  notes?: string;
  /**
   * Store the file gzip-compressed as `${filename}.gz` (for large files that change often).
   * Decompressing gives back the downloaded bytes exactly.
   */
  gzip?: boolean;
  /** Named series contained in the file. */
  parse(body: Buffer): Record<string, Point[]>;
};

/**
 * A downloaded file holding one or more named series. `series(name)` gives a Resource per
 * series; they share one download (same fetchKey) and one Source record.
 */
export function file(opts: FileOptions): { series(name: string): Resource } {
  const fetchKey = `${opts.group}/${opts.sourceId}`;
  const stored = opts.gzip ? `${opts.filename}.gz` : opts.filename;
  const unpack = (body: Buffer) => (opts.gzip ? gunzipSync(body) : body);
  const parseChecked = (body: Buffer) => {
    const all = opts.parse(body);
    for (const [name, points] of Object.entries(all)) {
      if (points.length === 0) throw new Error(`${opts.sourceId}: series "${name}" is empty`);
    }
    return all;
  };
  return {
    series(name: string): Resource {
      return {
        key: `${fetchKey}#${name}`,
        fetchKey,
        async fetch() {
          const url = typeof opts.url === "string" ? opts.url : await opts.url();
          const res = await download(url);
          // Parse before saving so a changed layout fails the fetch instead of storing an unusable file.
          parseChecked(res.body);
          saveRaw(opts.group, stored, opts.gzip ? gzipSync(res.body, { level: 9 }) : res.body, url, res.contentType);
        },
        load() {
          const raw = latestRaw(opts.group, stored);
          const points = parseChecked(unpack(raw.body))[name];
          if (!points) throw new Error(`${opts.sourceId}: no series "${name}"`);
          return {
            points,
            source: {
              id: opts.sourceId,
              publisher: opts.publisher,
              dataset: opts.dataset,
              tableId: opts.tableId,
              url: opts.humanUrl,
              apiUrl: raw.url,
              retrievedAt: raw.retrievedAt,
              rawPath: raw.rawPath,
              fileHash: raw.sha256,
              licence: opts.licence,
              attribution: opts.attribution,
              notes: opts.gzip ? `${opts.notes ?? ""} Stored gzip-compressed; gunzip gives the downloaded file.`.trim() : opts.notes,
            },
          };
        },
      };
    },
  };
}

// ---------------------------------------------------------------- Monthly snapshots

export type SnapshotOptions = Omit<FileOptions, "parse" | "filename" | "sourceId"> & {
  /** Stored as `${prefix}-${YYYY-MM}.${ext}`; source ids are `${sourceIdPrefix}-${YYYY-MM}`. */
  prefix: string;
  ext: string;
  sourceIdPrefix: string;
  /** Reference month printed inside the file ("YYYY-MM"). */
  periodOf(body: Buffer): string;
  value(body: Buffer): number;
};

/** Every stored snapshot `${prefix}-YYYY-MM.${ext}` in a raw group, latest copy of each month. */
export function loadSnapshots(group: string, prefix: string, ext: string): { period: string; raw: RawFile }[] {
  const pattern = new RegExp(`^${prefix}-(\\d{4}-\\d{2})\\.${ext}$`);
  const groupDir = path.join(RAW_DIR, group);
  const names = new Set<string>();
  for (const date of fs.existsSync(groupDir) ? fs.readdirSync(groupDir) : []) {
    const dir = path.join(groupDir, date);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) if (pattern.test(f)) names.add(f);
  }
  if (names.size === 0) throw new Error(`No ${prefix} snapshots in ${group}. Run "npm run pipeline:fetch" first.`);
  return [...names].sort().map((name) => ({ period: name.match(pattern)![1], raw: latestRaw(group, name) }));
}

export function snapshotSource(opts: Omit<SnapshotOptions, "periodOf" | "value">, raw: RawFile, period: string): Source {
  return {
    id: `${opts.sourceIdPrefix}-${period}`,
    publisher: opts.publisher,
    dataset: opts.dataset,
    tableId: opts.tableId,
    url: opts.humanUrl,
    apiUrl: raw.url,
    retrievedAt: raw.retrievedAt,
    rawPath: raw.rawPath,
    fileHash: raw.sha256,
    licence: opts.licence,
    attribution: opts.attribution,
    notes: opts.notes,
  };
}

/**
 * For publications that only ever show the current month (e.g. INSS pensions by amount
 * bracket): each month's file is stored under its own name and never pruned, so the
 * series grows by one point per month from the first retrieval onwards.
 */
export function snapshots(opts: SnapshotOptions): Resource {
  return {
    key: `${opts.group}/${opts.prefix}`,
    async fetch() {
      const url = typeof opts.url === "string" ? opts.url : await opts.url();
      const res = await download(url);
      const period = opts.periodOf(res.body);
      opts.value(res.body); // fail early if the layout changed
      saveRaw(opts.group, `${opts.prefix}-${period}.${opts.ext}`, res.body, url, res.contentType);
    },
    load() {
      const items = loadSnapshots(opts.group, opts.prefix, opts.ext).map(({ period, raw }) => {
        if (opts.periodOf(raw.body) !== period) throw new Error(`${raw.rawPath}: file is for ${opts.periodOf(raw.body)}`);
        const source = snapshotSource(opts, raw, period);
        return { point: { period, value: opts.value(raw.body), status: "final" as const, sourceId: source.id }, source };
      });
      return { points: items.map((i) => i.point), source: items[items.length - 1].source, sources: items.map((i) => i.source) };
    },
  };
}

export function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}
