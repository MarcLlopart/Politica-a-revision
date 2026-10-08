// Minimal reader for PC-Axis (.px) files, as published by Seguridad Social's PX-Web.
// DATA is row-major over STUB dimensions, then HEADING dimensions.

import type { Point } from "./sources";

export type Px = { dims: { name: string; values: string[] }[]; data: (number | null)[] };

function quotedList(s: string): string[] {
  return [...s.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1].replace(/""/g, '"').trim());
}

export function parsePx(body: Buffer): Px {
  const charset = body.subarray(0, 200).toString("latin1").match(/CHARSET="([^"]+)"/)?.[1];
  const text = new TextDecoder(charset === "ANSI" ? "windows-1252" : "utf-8").decode(body);
  const [head, dataPart] = text.split(/\nDATA=/);
  if (!dataPart) throw new Error("PX: DATA section not found");
  const keyword = (name: string) => head.match(new RegExp(`(?:^|\\n)${name}=([\\s\\S]*?);\\s*(?:\\n|$)`))?.[1];
  const stub = quotedList(keyword("STUB") ?? "");
  const heading = quotedList(keyword("HEADING") ?? "");
  const dims = [...stub, ...heading].map((name) => {
    const raw = head.match(new RegExp(`VALUES\\("${name}"\\)=([\\s\\S]*?);\\s*\\n`))?.[1];
    if (!raw) throw new Error(`PX: no VALUES for ${name}`);
    return { name, values: quotedList(raw) };
  });
  const data = dataPart
    .replace(/;\s*$/, "")
    .trim()
    .split(/\s+/)
    .map((tok) => (/^"?\.+"?$|^"-"$/.test(tok) ? null : Number(tok)));
  const expected = dims.reduce((n, d) => n * d.values.length, 1);
  if (data.length !== expected) throw new Error(`PX: ${data.length} values, expected ${expected}`);
  return { dims, data };
}

/** Series for one combination of the other dimensions; `periodOf` maps a period label (null = skip). */
function pxSeries(px: Px, periodDim: string, select: Record<string, string>, periodOf: (label: string) => string | null): Point[] {
  const strides: number[] = [];
  let stride = 1;
  for (let i = px.dims.length - 1; i >= 0; i--) {
    strides[i] = stride;
    stride *= px.dims[i].values.length;
  }
  let base = 0;
  let periodIdx = -1;
  px.dims.forEach((d, i) => {
    if (d.name === periodDim) {
      periodIdx = i;
      return;
    }
    const want = select[d.name];
    const k = d.values.indexOf(want);
    if (want === undefined || k === -1) throw new Error(`PX: value "${want}" not found in ${d.name}`);
    base += k * strides[i];
  });
  if (periodIdx === -1) throw new Error(`PX: no dimension ${periodDim}`);
  const points: Point[] = [];
  px.dims[periodIdx].values.forEach((label, k) => {
    const v = px.data[base + k * strides[periodIdx]];
    const period = periodOf(label);
    if (v === null || period === null) return;
    points.push({ period, value: v, status: "final" });
  });
  return points.sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Monthly series for one combination of the other dimensions.
 * `periodDim` values look like "202607"; `select` maps every other dimension to a value label.
 */
export function pxMonthlySeries(px: Px, periodDim: string, select: Record<string, string>): Point[] {
  return pxSeries(px, periodDim, select, (label) => (/^\d{6}$/.test(label) ? `${label.slice(0, 4)}-${label.slice(4)}` : null));
}

/** Annual series ("2025") for one combination of the other dimensions. */
export function pxAnnualSeries(px: Px, periodDim: string, select: Record<string, string>): Point[] {
  return pxSeries(px, periodDim, select, (label) => (/^\d{4}$/.test(label) ? label : null));
}
