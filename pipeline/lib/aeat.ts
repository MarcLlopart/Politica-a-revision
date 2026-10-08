// AEAT statistics publications ("Estadística de los declarantes del IRPF", "Mercado de
// trabajo y pensiones en las fuentes tributarias", "Impuesto sobre el Patrimonio").
// They are static HTML tables with hashed file names that change between years, so each
// table is found the way a reader would: year home page → site map → link by its label.

import type { Source } from "../../lib/schema";
import { download, latestRaw, saveRaw, type RawFile } from "./raw";

const ROOT = "https://sede.agenciatributaria.gob.es/AEAT/Contenidos_Comunes/La_Agencia_Tributaria/Estadisticas/Publicaciones/sites";

export type AeatSite = "irpf" | "mercado" | "patrimonio";

export type AeatTableSpec = {
  key: string;
  /** Link text in the site map, matched against the whole trimmed text. */
  label: RegExp;
  /** Only consider links after the first link whose text matches this (a section heading). */
  after?: RegExp;
  /** Then pick a filter from the table's own menu, e.g. { name: "Sexo", option: "Mujer" }. */
  menu?: { name: string; option: string };
};

/** Link of one option in a table page's filter menu (both the 2016–18 and 2019+ layouts). */
function menuLink(html: string, name: string, option: string): string {
  const block = html.match(new RegExp(`<a[^>]*href="#"[^>]*>\\s*${name}\\s*</a>\\s*<ul[^>]*>([\\s\\S]*?)</ul>`));
  if (!block) throw new Error(`AEAT: menu "${name}" not found`);
  const link = links(block[1]).find((l) => l.text === option);
  if (!link) throw new Error(`AEAT: option "${option}" not in menu "${name}"`);
  return link.href;
}

/** The selection a table page shows, e.g. "Sexo: Mujer , Tramos de Edad: Total , …". */
export function aeatSelection(html: string): string {
  const m = html.match(/id="titulo_noprint"[^>]*>([\s\S]*?)<\/(?:div|h2)>/);
  return m ? decode(m[1]) : "";
}

function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ({ aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", ordm: "º", ordf: "ª" })[name] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

function links(html: string): { href: string; text: string }[] {
  return [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ href: m[1], text: decode(m[2]) }));
}

/** Parses es-ES numbers ("1.531.620", "-584.067.734", "3,34"). */
export function esNumber(s: string): number | null {
  const t = s.trim();
  if (t === "" || t === "-") return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Rows of AEAT's `table01`: the row label and its numeric cells. */
export function aeatRows(html: string): { label: string; cells: (number | null)[] }[] {
  const table = html.match(/<table id="table01"[^>]*>[\s\S]*?<\/table>/)?.[0];
  if (!table) throw new Error("AEAT: table01 not found");
  const rows: { label: string; cells: (number | null)[] }[] = [];
  for (const tr of table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const th = tr[1].match(/<th[^>]*class="row-heading[^"]*"[^>]*>([\s\S]*?)<\/th>/);
    if (!th) continue;
    const cells = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => esNumber(decode(m[1])));
    rows.push({ label: decode(th[1]), cells });
  }
  if (rows.length === 0) throw new Error("AEAT: no rows in table01");
  return rows;
}

/** Plain text of the page (for values stated in notes, e.g. "SMI: 15.876 euros"). */
export function aeatText(html: string): string {
  return decode(html);
}

export type AeatPublication = {
  site: AeatSite;
  years: number[];
  tables: AeatTableSpec[];
  /** Fetches every available year (missing years are skipped). */
  fetch(): Promise<void>;
  /** Stored table pages per year, newest copy of each. */
  load(): { year: number; pages: Record<string, RawFile> }[];
  source(year: number, raw: RawFile, dataset: string): Source;
};

export function aeatPublication(opts: { site: AeatSite; firstYear: number; tables: AeatTableSpec[]; humanUrl: string }): AeatPublication {
  const lastYear = new Date().getUTCFullYear() - 1;
  const years = Array.from({ length: lastYear - opts.firstYear + 1 }, (_, i) => opts.firstYear + i);
  const file = (year: number, key: string) => `${opts.site}-${year}-${key}.html`;
  return {
    site: opts.site,
    years,
    tables: opts.tables,
    async fetch() {
      for (const year of years) {
        const base = `${ROOT}/${opts.site}/${year}`;
        let home: string;
        try {
          home = (await download(`${base}/home.html`)).body.toString("utf8");
        } catch {
          continue; // not published yet
        }
        const map = links(home).find((l) => /^mapa.*\.html$/.test(l.href));
        if (!map) throw new Error(`AEAT ${opts.site} ${year}: site map link not found`);
        const mapLinks = links((await download(`${base}/${map.href}`)).body.toString("utf8"));
        for (const t of opts.tables) {
          const start = t.after ? mapLinks.findIndex((l) => t.after!.test(l.text)) : 0;
          if (start === -1) throw new Error(`AEAT ${opts.site} ${year}: section ${t.after} not found`);
          const link = mapLinks.slice(start).find((l) => t.label.test(l.text));
          if (!link) throw new Error(`AEAT ${opts.site} ${year}: table ${t.label} not found`);
          let url = `${base}/${link.href}`;
          let res = await download(url);
          if (t.menu) {
            url = `${base}/${menuLink(res.body.toString("utf8"), t.menu.name, t.menu.option)}`;
            res = await download(url);
            const selection = aeatSelection(res.body.toString("utf8"));
            if (!selection.includes(`${t.menu.name}: ${t.menu.option}`)) {
              throw new Error(`AEAT ${opts.site} ${year}: page shows "${selection}", expected ${t.menu.name}: ${t.menu.option}`);
            }
          }
          aeatRows(res.body.toString("utf8")); // fail early if the layout changed
          saveRaw("aeat-dist", file(year, t.key), res.body, url, res.contentType);
        }
      }
    },
    load() {
      const out: { year: number; pages: Record<string, RawFile> }[] = [];
      for (const year of years) {
        try {
          const pages = Object.fromEntries(opts.tables.map((t) => [t.key, latestRaw("aeat-dist", file(year, t.key))]));
          out.push({ year, pages });
        } catch {
          // Year not downloaded (not yet published).
        }
      }
      if (out.length === 0) throw new Error(`AEAT ${opts.site}: nothing stored. Run "npm run pipeline:fetch" first.`);
      return out;
    },
    source(year, raw, dataset) {
      return {
        id: `aeat-${opts.site}-${year}-${raw.rawPath.split("-").at(-1)!.replace(/\.html$/, "")}`,
        publisher: "Agencia Tributaria (AEAT)",
        dataset: `${dataset} ${year}`,
        url: opts.humanUrl,
        apiUrl: raw.url,
        retrievedAt: raw.retrievedAt,
        rawPath: raw.rawPath,
        fileHash: raw.sha256,
        licence: "Reuse permitted with attribution and last-update date (AEAT legal notice)",
        attribution: "Fuente: Agencia Estatal de Administración Tributaria",
      };
    },
  };
}
