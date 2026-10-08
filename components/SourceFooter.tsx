import { getSource } from "@/lib/data";
import type { Formatters } from "@/lib/i18n-server";
import type { Locale } from "@/lib/locales";
import type { Source } from "@/lib/schema";
import { repoFileUrl, reportErrorUrl, SITE } from "@/lib/site";

type Props = {
  sourceIds: string[];
  /** Latest period covered, shown next to the dataset name when there is a single source. */
  periodLabel?: string;
  csvHref?: string;
  methodHref: string;
  /** Short description of the item for the error report, e.g. "Indicator: unemployment-rate". */
  reportSubject: string;
  pagePath: string;
  locale: Locale;
  f: Formatters;
};

const sep = " · ";

/**
 * One source:  "Source: INE, EPA (65219) · Q2 2026 · retrieved 8 Oct 2026 · table · raw file · CSV · method"
 * Several:     one line per source (table, raw file), then CSV and method once.
 */
export function SourceFooter({ sourceIds, periodLabel, csvHref, methodHref, reportSubject, pagePath, locale, f }: Props) {
  const { t } = f;
  // Sources from the same table page (e.g. one file per year) are shown as one line.
  const groups = new Map<string, Source[]>();
  for (const s of sourceIds.map(getSource)) groups.set(`${s.publisher}|${s.url}`, [...(groups.get(`${s.publisher}|${s.url}`) ?? []), s]);
  const sources = [...groups.values()].map((g) => {
    const sorted = [...g].sort((a, b) => a.rawPath.localeCompare(b.rawPath));
    const newest = sorted[sorted.length - 1];
    return g.length === 1 ? { ...newest, files: 1 } : { ...newest, dataset: newest.dataset.replace(/\s\d{4}$/, ""), files: g.length };
  });
  const single = sources.length === 1;

  const sourceLine = (s: Source & { files: number }) => (
    <>
      <span className="font-semibold text-[var(--ink)]">{t("source.label")}:</span> {s.publisher}, {s.dataset}
      {s.tableId ? ` (${s.tableId})` : ""}
      {single && periodLabel ? `${sep}${periodLabel}` : ""}
      {sep}
      {t("source.retrieved", { date: f.date(s.retrievedAt) })}
      {sep}
      <a href={s.url} rel="external">
        {t("source.table")}
      </a>
      {sep}
      <a href={repoFileUrl(s.rawPath)} rel="external" title={s.fileHash}>
        {t("source.raw")}
      </a>
      {s.files > 1 && (
        <>
          {sep}
          <a href={`/${locale}/sources`}>{t("source.allFiles", { count: s.files })}</a>
        </>
      )}
    </>
  );

  const shared = (
    <>
      {csvHref && (
        <>
          <a href={csvHref} download>
            {t("source.csv")}
          </a>
          {sep}
        </>
      )}
      <a href={methodHref}>{t("source.method")}</a>
    </>
  );

  return (
    <footer className="mt-3 border-t border-[var(--border)] pt-2 text-xs leading-relaxed text-[var(--ink-2)]">
      {single ? (
        <p>
          {sourceLine(sources[0])}
          {sep}
          {shared}
        </p>
      ) : (
        <>
          {sources.map((s) => (
            <p key={s.id}>{sourceLine(s)}</p>
          ))}
          <p>{shared}</p>
        </>
      )}
      <p className="mt-1">
        <a href={reportErrorUrl(reportSubject, `${SITE.url}/${locale}${pagePath}`)} rel="external" className="inline-block min-h-6 py-1">
          {t("source.reportError")}
        </a>
      </p>
    </footer>
  );
}
