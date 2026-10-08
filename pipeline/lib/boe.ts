// Amounts set by law, read from the official BOE XML of each decree. Each decree is its
// own raw file and Source, so every yearly value cites the exact provision.

import type { Source } from "../../lib/schema";
import { download, latestRaw, saveRaw } from "./raw";
import type { Point, Resource } from "./sources";

export type Decree = { period: string; boeId: string; title: string };

function text(xml: string): string {
  return xml.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/[\s  ]+/g, " ");
}

/** "1 221", "1.221", "735,90" → number. */
export function boeNumber(s: string): number {
  return Number(s.replace(/[\s.  ]/g, "").replace(",", "."));
}

export function boeDecrees(opts: { key: string; decrees: Decree[]; extract(text: string): number }): Resource {
  const file = (id: string) => `${id}.xml`;
  const url = (id: string) => `https://www.boe.es/diario_boe/xml.php?id=${id}`;
  return {
    key: `boe/${opts.key}`,
    async fetch() {
      for (const d of opts.decrees) {
        const res = await download(url(d.boeId));
        opts.extract(text(res.body.toString("utf8"))); // fail early if the wording changed
        saveRaw("boe", file(d.boeId), res.body, url(d.boeId), res.contentType);
      }
    },
    load() {
      const items = opts.decrees.map((d) => {
        const raw = latestRaw("boe", file(d.boeId));
        const source: Source = {
          id: `boe-${d.boeId.toLowerCase()}`,
          publisher: "Boletín Oficial del Estado",
          dataset: d.title,
          tableId: d.boeId,
          url: `https://www.boe.es/diario_boe/txt.php?id=${d.boeId}`,
          apiUrl: raw.url,
          retrievedAt: raw.retrievedAt,
          rawPath: raw.rawPath,
          fileHash: raw.sha256,
          licence: "Public domain (official legislation)",
          attribution: "Fuente: Boletín Oficial del Estado",
        };
        const point: Point & { sourceId: string } = {
          period: d.period,
          value: opts.extract(text(raw.body.toString("utf8"))),
          status: "final",
          sourceId: source.id,
        };
        return { point, source };
      });
      return { points: items.map((i) => i.point), source: items[items.length - 1].source, sources: items.map((i) => i.source) };
    },
  };
}
