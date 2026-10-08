// Parsers for sources published only as spreadsheets. Each locates its block by the
// labels printed in the file rather than by fixed row numbers, and throws if a label
// is missing, so a layout change fails the pipeline instead of producing wrong numbers.

import * as XLSX from "xlsx";
import { quantile, type Bracket } from "../../lib/distribution";
import type { Point } from "./sources";

type Cell = string | number | null;

export function sheetRows(body: Buffer, sheetName: string): Cell[][] {
  const wb = XLSX.read(body);
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found (have: ${wb.SheetNames.join(", ")})`);
  return XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: null });
}

const norm = (v: Cell) => (v === null ? "" : String(v).replace(/\s+/g, " ").trim());

const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/**
 * Ministerio de Transportes "Obras en edificación" tables (Colegios de Aparejadores).
 * Monthly rows, newest first: year in `yearCol` on the first row of each year, month
 * abbreviation in `monthCol`, value in `valueCol`.
 */
export function aparejadoresMonthly(
  rows: Cell[][],
  opts: { yearCol: number; monthCol: number; valueCol: number },
): Point[] {
  if (!rows.some((r) => r.some((c) => norm(c) === "TOTAL NACIONAL"))) throw new Error("TOTAL NACIONAL label not found");
  const points: Point[] = [];
  let year: number | null = null;
  let started = false;
  for (const r of rows) {
    const month = MONTHS_ES.indexOf(norm(r[opts.monthCol]));
    if (month === -1) {
      if (started) break; // end of the monthly block
      continue;
    }
    started = true;
    if (typeof r[opts.yearCol] === "number") year = r[opts.yearCol] as number;
    const v = r[opts.valueCol];
    if (year === null || typeof v !== "number") throw new Error(`Unreadable monthly row: ${JSON.stringify(r.slice(0, 8))}`);
    points.push({ period: `${year}-${String(month + 1).padStart(2, "0")}`, value: v, status: "final" });
  }
  if (points.length < 24) throw new Error(`Only ${points.length} monthly rows found`);
  return points;
}

/** MIVAU annual tables: a header row of years and a "TOTAL NACIONAL" row below it. */
export function mivauAnnualTotal(rows: Cell[][]): Point[] {
  const totalIdx = rows.findIndex((r) => norm(r[1]) === "TOTAL NACIONAL");
  if (totalIdx < 1) throw new Error("TOTAL NACIONAL row not found");
  const header = rows[totalIdx - 1];
  const points: Point[] = [];
  header.forEach((h, i) => {
    const v = rows[totalIdx][i];
    if (typeof h === "number" && h >= 1900 && h <= 2100 && typeof v === "number") {
      points.push({ period: String(h), value: v, status: "final" });
    }
  });
  if (points.length === 0) throw new Error("No years in MIVAU header row");
  return points;
}

/**
 * AEAT "Cuadros estadísticos y series", sheet "Ingresos tributarios": the annual block
 * titled "INGRESOS TRIBUTARIOS. Millones de euros." Returns net revenue ("Ingresos netos")
 * for the tax whose group header starts with `taxLabel`, in euros.
 */
export function aeatAnnualNet(rows: Cell[][], taxLabel: string): Point[] {
  const title = rows.findIndex((r) => /INGRESOS TRIBUTARIOS\.?\s*Millones de euros/i.test(norm(r[0])));
  if (title === -1) throw new Error("AEAT annual block title not found");
  const groups = rows[title + 1];
  const sub = rows[title + 2];
  const starts = groups.map((v, i) => (norm(v) ? i : -1)).filter((i) => i > 0);
  const start = starts.find((i) => norm(groups[i]).startsWith(taxLabel));
  if (start === undefined) throw new Error(`AEAT group "${taxLabel}" not found`);
  const end = starts.find((i) => i > start) ?? groups.length;
  let col = -1;
  for (let i = start; i < end; i++) if (norm(sub[i]) === "Ingresos netos") col = i;
  if (col === -1) throw new Error(`"Ingresos netos" column not found for ${taxLabel}`);
  const points: Point[] = [];
  for (let i = title + 3; i < rows.length; i++) {
    const y = norm(rows[i][0]);
    if (!/^\d{4}$/.test(y)) {
      if (points.length > 0) break;
      continue;
    }
    const v = rows[i][col];
    if (typeof v !== "number") throw new Error(`AEAT ${taxLabel} ${y}: no value`);
    points.push({ period: y, value: v * 1e6, status: "final" });
  }
  return points;
}

/** Calendar-year sums of a monthly series; incomplete years are dropped. */
export function annualSums(monthly: Point[]): Point[] {
  const byYear = new Map<string, Point[]>();
  for (const p of monthly) {
    const y = p.period.slice(0, 4);
    byYear.set(y, [...(byYear.get(y) ?? []), p]);
  }
  return [...byYear.entries()]
    .filter(([, ps]) => ps.length === 12)
    .map(([y, ps]) => ({
      period: y,
      value: ps.reduce((s, p) => s + p.value, 0),
      status: ps.some((p) => p.status === "provisional") ? ("provisional" as const) : ("final" as const),
    }));
}

/** Sum of the 12 months ending in each month; months without 11 predecessors are dropped. */
export function rolling12(monthly: Point[]): Point[] {
  const sorted = [...monthly].sort((a, b) => a.period.localeCompare(b.period));
  const out: Point[] = [];
  for (let i = 11; i < sorted.length; i++) {
    const window = sorted.slice(i - 11, i + 1);
    const [y0, m0] = window[0].period.split("-").map(Number);
    const [y1, m1] = window[11].period.split("-").map(Number);
    if ((y1 - y0) * 12 + (m1 - m0) !== 11) continue; // gap in the data
    out.push({
      period: sorted[i].period,
      value: window.reduce((s, p) => s + p.value, 0),
      status: window.some((p) => p.status === "provisional") ? "provisional" : "final",
    });
  }
  return out;
}

// ---------------------------------------------------------------- Seguridad Social

/**
 * INSS "Avance mensual de pensiones" sheets ("Nº Pens. Clases", "Importe €", "P. Media €").
 * Annual rows (stock on 1 December) are returned as "YYYY-12"; monthly rows as "YYYY-MM".
 * `column` is the header label, e.g. "TOTAL" or "JUBILACIÓN".
 */
export function ssAvance(rows: Cell[][], column: string, factor = 1): Point[] {
  const headerIdx = rows.findIndex((r) => norm(r[0]) === "PERIODO");
  if (headerIdx === -1) throw new Error("PERIODO header not found");
  const col = rows[headerIdx].findIndex((c) => norm(c).toUpperCase() === column.toUpperCase());
  if (col === -1) throw new Error(`Column ${column} not found`);
  const byPeriod = new Map<string, Point>();
  let year: number | null = null;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (/variaci[oó]n/i.test(norm(r[2]))) break; // start of the "% de variación anual" block
    if (typeof r[0] === "number") year = r[0];
    const month = MONTHS_ES.indexOf(norm(r[1]));
    const v = r[col];
    if (year === null || typeof v !== "number") continue;
    if (month === -1 && norm(r[1]) === "") {
      // Annual row: value on 1 December. A monthly December row, if present, takes precedence.
      const period = `${year}-12`;
      if (!byPeriod.has(period)) byPeriod.set(period, { period, value: v * factor, status: "final" });
    } else if (month > -1) {
      const period = `${year}-${String(month + 1).padStart(2, "0")}`;
      byPeriod.set(period, { period, value: v * factor, status: "final" });
    }
  }
  if (byPeriod.size < 12) throw new Error(`Only ${byPeriod.size} periods found for ${column}`);
  return [...byPeriod.values()];
}

const MONTHS_ES_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "Septiembre 2026" / "Febrero  2001" → "2026-09". */
export function spanishMonthYear(label: string): string | null {
  const m = norm(label).toLowerCase().match(/^([a-záéíóú]+)\s+(\d{4})$/);
  if (!m) return null;
  const month = MONTHS_ES_LONG.indexOf(m[1] === "setiembre" ? "septiembre" : m[1]);
  return month === -1 ? null : `${m[2]}-${String(month + 1).padStart(2, "0")}`;
}

/** TGSS "Serie de afiliación media por regímenes": monthly average affiliates, TOTAL SISTEMA. */
export function ssAffiliates(rows: Cell[][]): Point[] {
  const headerIdx = rows.findIndex((r) => r.some((c) => norm(c) === "TOTAL SISTEMA"));
  if (headerIdx === -1) throw new Error("TOTAL SISTEMA header not found");
  const col = rows[headerIdx].findIndex((c) => norm(c) === "TOTAL SISTEMA");
  const points: Point[] = [];
  for (const r of rows.slice(headerIdx + 1)) {
    const period = typeof r[0] === "string" ? spanishMonthYear(r[0]) : null;
    if (!period) continue;
    const v = r[col];
    if (typeof v !== "number") throw new Error(`No TOTAL SISTEMA value for ${period}`);
    points.push({ period, value: v, status: "final" });
  }
  if (points.length < 24) throw new Error(`Only ${points.length} months of affiliates found`);
  return points;
}

/** "PENSIONES EN VIGOR A 1 DE SEPTIEMBRE DE 2026 ..." → "2026-09". */
export function ssBracketPeriod(rows: Cell[][]): string {
  const m = norm(rows[0]?.[0] ?? null)
    .toLowerCase()
    .match(/a 1 de ([a-záéíóú]+) de (\d{4})/);
  if (!m) throw new Error("Reference date not found in bracket file title");
  const month = MONTHS_ES_LONG.indexOf(m[1] === "setiembre" ? "septiembre" : m[1]);
  if (month === -1) throw new Error(`Unknown month ${m[1]}`);
  return `${m[2]}-${String(month + 1).padStart(2, "0")}`;
}

function bracketBounds(label: string): [number, number | null] | null {
  const num = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));
  const l = norm(label);
  let m = l.match(/^Hasta\s+([\d.,]+)/i);
  if (m) return [0, num(m[1])];
  m = l.match(/^De\s+([\d.,]+)\s+a\s+([\d.,]+)/i);
  if (m) return [num(m[1]), num(m[2])];
  m = l.match(/^M[aá]s de\s+([\d.,]+)/i);
  if (m) return [num(m[1]), null];
  return null;
}

/**
 * Brackets of one pension class from INSS "Pensiones en vigor por tramos de cuantía"
 * (sheet "Tramos_Total sistema"): counts only (the file has no amounts). Fails if the
 * bracket counts do not add up to the published total.
 */
export function ssBrackets(rows: Cell[][], pensionClass: string): Bracket[] {
  let col = -1;
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10) && col === -1; i++) {
    col = rows[i].findIndex((c) => norm(c).toLowerCase().startsWith(pensionClass.toLowerCase()));
    headerIdx = i;
  }
  if (col === -1) throw new Error(`Class ${pensionClass} not found`);
  let total: number | null = null;
  const brackets: Bracket[] = [];
  for (const r of rows.slice(headerIdx + 1)) {
    const label = norm(r[0]);
    if (label.toLowerCase() === "total") {
      total = Number(r[col]);
      continue;
    }
    const b = bracketBounds(label);
    if (!b) continue;
    brackets.push({ lower: b[0], upper: b[1], count: typeof r[col] === "number" ? (r[col] as number) : 0 });
  }
  const n = brackets.reduce((s, b) => s + b.count, 0);
  if (total === null || Math.abs(n - total) > 0.5) throw new Error(`Bracket counts (${n}) do not add up to the total (${total})`);
  return brackets;
}

/**
 * Median of a pension class, interpolated linearly inside the bracket that contains the
 * middle pension: median = L + (N/2 − cum_before) / n × (U − L).
 */
export function ssBracketMedian(rows: Cell[][], pensionClass: string): { value: number; total: number; bracket: string } {
  const brackets = ssBrackets(rows, pensionClass);
  const q = quantile(brackets, 0.5);
  if (q.value === null) throw new Error("Median falls in the open top bracket");
  const n = brackets.reduce((s, b) => s + b.count, 0);
  const b = brackets.find((x) => x.lower <= q.value! && (x.upper === null || q.value! <= x.upper))!;
  return { value: q.value, total: n, bracket: bracketLabel(b) };
}

function bracketLabel(b: Bracket): string {
  const fmt = (v: number) => new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, useGrouping: "always" }).format(v);
  if (b.lower === 0 && b.upper !== null) return `Hasta ${fmt(b.upper)} euros`;
  return b.upper === null ? `Más de ${fmt(b.lower)}` : `De ${fmt(b.lower)} a ${fmt(b.upper)}`;
}

// ---------------------------------------------------------------- Projection workbooks

/**
 * A data row next to a header row of years (Ageing Report, AIReF chart workbooks).
 * `header` finds the year row; `row` finds the data row after it; the label sits in `labelCol`.
 */
export function yearRow(
  rows: Cell[][],
  opts: { header: (r: Cell[]) => boolean; row: (label: string) => boolean; labelCol: number },
): Point[] {
  const h = rows.findIndex(opts.header);
  if (h === -1) throw new Error("Year header row not found");
  const d = rows.findIndex((r, i) => i > h && opts.row(norm(r[opts.labelCol])));
  if (d === -1) throw new Error("Data row not found");
  const points: Point[] = [];
  rows[h].forEach((y, i) => {
    const v = rows[d][i];
    if (typeof y === "number" && y >= 1990 && y <= 2100 && typeof v === "number") points.push({ period: String(y), value: v, status: "final" });
  });
  if (points.length === 0) throw new Error("No values in data row");
  return points;
}

/** Marks years after `actualUntil` as forecasts. */
export function markForecast(points: Point[], actualUntil: string): Point[] {
  return points.map((p) => (p.period > actualUntil ? { ...p, status: "forecast" as const } : p));
}

/** Minimal CSV reader (quoted fields with commas and doubled quotes). */
export function csvRows(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      out.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    out.push(row);
  }
  return out.filter((r) => r.length > 1 || r[0] !== "");
}

/** "Pnes y ptas" sheet of the Seguridad Social pensioners file: pensioners per month (December before the current year). */
export function ssPensioners(rows: Cell[][]): Point[] {
  const h = rows.findIndex((r) => norm(r[0]) === "AÑO" && norm(r[1]) === "MES");
  if (h === -1) throw new Error("Pensioners: header not found");
  const col = rows[h].findIndex((c) => norm(c).startsWith("PENSIONISTAS"));
  if (col === -1) throw new Error("Pensioners: PENSIONISTAS column not found");
  const points: Point[] = [];
  let year: number | null = null;
  for (const r of rows.slice(h + 1)) {
    if (typeof r[0] === "number") year = r[0];
    const month = MONTHS_ES_LONG.indexOf(norm(r[1]).toLowerCase());
    const v = r[col];
    if (year === null || month === -1 || typeof v !== "number") continue;
    points.push({ period: `${year}-${String(month + 1).padStart(2, "0")}`, value: v, status: "final" });
  }
  if (points.length < 12) throw new Error(`Pensioners: only ${points.length} rows`);
  return points;
}
