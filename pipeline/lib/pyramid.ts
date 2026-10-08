// Population by sex and single year of age (0–99, then 100+) from an INE table, one raw file
// per year (DATOS_TABLA filtered to 1 January of that year, with metadata).

import type { Source } from "../../lib/schema";
import { download, latestRaw, saveRaw } from "./raw";
import type { Resource } from "./sources";

const INE_API = "https://servicios.ine.es/wstempus/js/ES";

type TableSeries = {
  COD: string;
  MetaData: { Id: number; T3_Variable: string; Nombre: string; Codigo: string }[];
  Data: { Anyo: number; Valor: number | null; T3_TipoDato?: string }[];
};

export const AGES = 101; // 0–99 and 100+

export type PyramidYear = { men: number[]; women: number[]; source: Source };

export type PyramidResource = Resource & { ages(): PyramidYear };

export function inePyramidYear(opts: { tableId: string; year: string; dataset: string }): PyramidResource {
  const apiUrl = `${INE_API}/DATOS_TABLA/${opts.tableId}?date=${opts.year}0101:${opts.year}0101&tip=AM`;
  const file = `table-${opts.tableId}-${opts.year}.json`;

  const parse = (body: Buffer) => {
    const series = JSON.parse(body.toString("utf8")) as TableSeries[];
    const men = new Array<number>(AGES).fill(NaN);
    const women = new Array<number>(AGES).fill(NaN);
    for (const s of series) {
      const sex = s.MetaData.find((m) => m.T3_Variable === "Sexo")?.Nombre;
      const age = s.MetaData.find((m) => m.T3_Variable === "Valores simples de edad" || m.T3_Variable === "Semiintervalos de edad")?.Codigo;
      if (!age || (sex !== "Hombres" && sex !== "Mujeres")) continue; // totals by sex or age
      const index = age === "Y-GE100" ? 100 : Number(age.slice(1));
      const value = s.Data.find((d) => String(d.Anyo) === opts.year)?.Valor;
      if (!Number.isInteger(index) || index < 0 || index > 100 || value === null || value === undefined) continue;
      (sex === "Hombres" ? men : women)[index] = value;
    }
    if ([...men, ...women].some((v) => Number.isNaN(v))) throw new Error(`INE ${opts.tableId} ${opts.year}: missing ages`);
    return { men, women };
  };

  const source = (raw: ReturnType<typeof latestRaw>): Source => ({
    id: `ine-table-${opts.tableId}-${opts.year}`,
    publisher: "INE",
    dataset: opts.dataset,
    tableId: opts.tableId,
    url: `https://www.ine.es/jaxiT3/Tabla.htm?t=${opts.tableId}`,
    apiUrl,
    retrievedAt: raw.retrievedAt,
    rawPath: raw.rawPath,
    fileHash: raw.sha256,
    licence: "CC BY 4.0",
    attribution: "Fuente: INE",
    notes: `Population by sex and single year of age on 1 January ${opts.year}.`,
  });

  return {
    key: `ine/table-${opts.tableId}-${opts.year}`,
    async fetch() {
      const res = await download(apiUrl);
      parse(res.body);
      saveRaw("ine", file, res.body, apiUrl, res.contentType);
    },
    load() {
      const raw = latestRaw("ine", file);
      const { men, women } = parse(raw.body);
      const total = [...men, ...women].reduce((a, b) => a + b, 0);
      return { points: [{ period: opts.year, value: total, status: "final" }], source: source(raw) };
    },
    ages() {
      const raw = latestRaw("ine", file);
      return { ...parse(raw.body), source: source(raw) };
    },
  };
}
