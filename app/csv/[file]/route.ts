// Static CSV download per indicator: every observation since the start of the series,
// with its source, retrieval date and raw-file hash on each row.

import { getDistributions, getIndicators, getSource } from "@/lib/data";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [
    ...[...getIndicators().keys()].map((id) => ({ file: `${id}.csv` })),
    ...[...getDistributions().keys()].map((id) => ({ file: `distribution-${id}.csv` })),
  ];
}

const DIST_COLUMNS = ["distribution_id", "period", "lower", "upper", "count", "amount", "amount_per", "source_id", "source_url", "retrieved_at", "raw_file", "raw_sha256"];

function distributionCsv(id: string): string | null {
  const d = getDistributions().get(id);
  if (!d) return null;
  const lines = [DIST_COLUMNS.join(",")];
  for (const p of d.periods) {
    const s = getSource(p.sourceId);
    for (const b of p.brackets) {
      lines.push(
        [d.id, p.period, b.lower, b.upper ?? "", b.count, b.amount ?? "", d.amountPer, s.id, s.url, s.retrievedAt, s.rawPath, s.fileHash.replace("sha256:", "")]
          .map((v) => cell(v))
          .join(","),
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

const COLUMNS = [
  "indicator_id",
  "period",
  "value",
  "unit",
  "status",
  "source_id",
  "publisher",
  "dataset",
  "table_id",
  "series_code",
  "source_url",
  "download_url",
  "retrieved_at",
  "raw_file",
  "raw_sha256",
  "licence",
  "attribution",
] as const;

function cell(v: string | number | undefined): string {
  const s = v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(_req: Request, { params }: RouteContext<"/csv/[file]">) {
  const { file } = await params;
  const id = file.replace(/\.csv$/, "");
  if (id.startsWith("distribution-")) {
    const csv = distributionCsv(id.slice("distribution-".length));
    if (!csv) return new Response("Not found", { status: 404 });
    return new Response(csv, {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${id}.csv"` },
    });
  }
  const ind = getIndicators().get(id);
  if (!ind) return new Response("Not found", { status: 404 });
  const lines = [COLUMNS.join(",")];
  for (const o of ind.observations) {
    const s = getSource(o.sourceId);
    lines.push(
      [
        ind.id,
        o.period,
        o.value,
        ind.unit,
        o.status,
        s.id,
        s.publisher,
        s.dataset,
        s.tableId,
        s.seriesCode,
        s.url,
        s.apiUrl,
        s.retrievedAt,
        s.rawPath,
        s.fileHash.replace("sha256:", ""),
        s.licence,
        s.attribution,
      ]
        .map(cell)
        .join(","),
    );
  }
  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${id}.csv"`,
    },
  });
}
