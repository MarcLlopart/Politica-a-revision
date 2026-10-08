import { getEstimates } from "@/lib/data";
import type { Formatters } from "@/lib/i18n-server";
import type { Locale } from "@/lib/locales";
import type { Estimate } from "@/lib/schema";
import { repoFileUrl, reportErrorUrl, SITE } from "@/lib/site";
import type { Topic } from "@/lib/topics";

/**
 * Figures that only exist inside reports or laws, each with its document, page and archived
 * copy, grouped by kind. Independent estimates are labelled with their author and kept apart
 * from official series.
 */
export function EstimatesPanel({ topic, groups, locale, f }: { topic: Topic; groups: { id: string; ids: string[] }[]; locale: Locale; f: Formatters }) {
  const { t } = f;
  const all = getEstimates();
  return (
    <section className="card mt-6" aria-labelledby={`estimates-${topic}`}>
      <h2 id={`estimates-${topic}`}>{t("estimates.title")}</h2>
      <p className="mt-1 max-w-3xl text-sm text-[var(--ink-2)]">{t("estimates.intro")}</p>
      {groups.map((g) => (
        <div key={g.id} className="mt-4">
          <h3 className="text-sm font-semibold">{t(`estimates.groups.${g.id}`)}</h3>
          <ul className="mt-2 grid gap-3 md:grid-cols-2">
            {g.ids.map((id) => (
              <EstimateItem key={id} e={all.get(id)!} topic={topic} locale={locale} f={f} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** One figure from a document: value, definition, document and page, archived copy. */
export function EstimateItem({ e, topic, locale, f }: { e: Estimate; topic: Topic; locale: Locale; f: Formatters }) {
  const { t } = f;
  const value =
    e.unit === "ratio"
      ? f.number(e.value, "ratio", { decimals: 2 })
      : f.value(e.value, e.unit, { decimals: e.unit === "eur" && Math.abs(e.value) >= 1e9 ? 1 : e.unit === "percent" ? 1 : 2, compact: Math.abs(e.value) >= 1e6 });
  return (
    <li id={`est-${e.id}`} className="scroll-mt-20 rounded-lg bg-[var(--surface-2)] p-3 text-sm">
      <p className="text-xs font-semibold text-[var(--ink-2)]">
        {t(`estimates.kind.${e.kind}`)} · {e.publisher}
      </p>
      <p className="font-semibold">{e.label[locale]}</p>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-[var(--ink-2)]">{e.period}</p>
      <p className="mt-1 text-xs">{e.definition[locale]}</p>
      <p className="mt-2 text-xs text-[var(--ink-2)]">
        <a href={e.document.url} rel="external">
          {e.document.title}
        </a>
        {" · "}
        {e.document.location}
        {e.document.localPath && (
          <>
            {" · "}
            <a href={repoFileUrl(e.document.localPath)} rel="external" title={e.document.fileHash}>
              {t("estimates.archived")}
            </a>
          </>
        )}
      </p>
      <p className="mt-1 text-xs text-[var(--ink-2)]">
        {e.checkedBy.length > 0 ? t("estimates.checked") : t("estimates.unchecked")}
        {" · "}
        <a href={reportErrorUrl(`Estimate: ${e.id}`, `${SITE.url}/${locale}/spain/${topic}#est-${e.id}`)} rel="external" className="inline-block min-h-6 py-1">
          {t("source.reportError")}
        </a>
      </p>
    </li>
  );
}
