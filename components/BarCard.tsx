import { SourceFooter } from "@/components/SourceFooter";
import { renderBarChart } from "@/lib/chart";
import { getIndicator } from "@/lib/data";
import type { Formatters } from "@/lib/i18n-server";
import { latest, WINDOW_START_YEAR } from "@/lib/indicators";
import type { Locale } from "@/lib/locales";

/**
 * Comparison of categories (e.g. age groups) at the latest period, with the change since the
 * first year shown. For categories that would be too many lines on one chart.
 * `show: "change"` (price indices): bars are the change since the same period of the first
 * year shown; the first indicator is the reference row and the rest are sorted by change.
 */
export function BarCard({
  id,
  indicators,
  show = "level",
  locale,
  f,
  pagePath,
}: {
  id: string;
  indicators: string[];
  show?: "level" | "change";
  locale: Locale;
  f: Formatters;
  pagePath: string;
}) {
  const { t } = f;
  const inds = indicators.map(getIndicator);
  const period = latest(inds[0]).period;
  const start = `${WINDOW_START_YEAR}${period.slice(4)}`;
  const at = (i: (typeof inds)[number], p: string) => i.observations.find((o) => o.period === p);
  const since = t("barCard.since", { year: WINDOW_START_YEAR });

  const rows = inds.map((ind, k) => {
    const now = at(ind, period)!;
    const then = at(ind, start);
    if (show === "change") {
      const change = then ? (now.value / then.value - 1) * 100 : 0;
      const label = k === 0 ? t("barCard.cpiAll") : ind.label[locale];
      return { label, share: change, text: f.number(change, "percent_change", { decimals: 1 }) };
    }
    // Rates change in percentage points; amounts in %.
    const rate = ind.unit === "percent";
    const change = then ? (rate ? now.value - then.value : ((now.value - then.value) / then.value) * 100) : null;
    const changeText =
      change === null
        ? ""
        : rate
          ? t("readings.pp", { value: f.number(change, "ratio", { decimals: 1, signed: true }) })
          : f.number(change, "percent_change", { decimals: 0 });
    return {
      label: ind.label[locale],
      share: now.value,
      text: `${f.indicator(ind, now.value)}${change === null ? "" : ` (${changeText} ${since})`}`,
    };
  });
  const ordered = show === "change" ? [rows[0], ...rows.slice(1).sort((a, b) => b.share - a.share)] : rows;

  const anchor = `card-${id}`;
  const periodText = show === "change" ? t("barCard.changePeriod", { start: f.periodOf(inds[0], start), end: f.periodOf(inds[0], period) }) : f.periodOf(inds[0], period);
  return (
    <article id={anchor} className="card scroll-mt-20" aria-labelledby={`${anchor}-title`}>
      <h2 id={`${anchor}-title`} className="text-sm font-semibold text-[var(--ink-2)]">
        {t(`cards.${id}`)}
      </h2>
      <p className="text-xs text-[var(--ink-2)]">{periodText}</p>
      <div className="chart mt-2" dangerouslySetInnerHTML={{ __html: renderBarChart(ordered, { labelsAbove: true }) }} />
      {/* The chart is hidden from assistive technology; the same values as a table. */}
      <table className="sr-only">
        <caption>{t(`cards.${id}`)}</caption>
        <tbody>
          {ordered.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td>{r.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(show === "change" ? t("barCard.changeNote") : inds[0].note?.[locale]) && (
        <p className="mt-2 text-xs text-[var(--ink-2)]">{show === "change" ? t("barCard.changeNote") : inds[0].note![locale]}</p>
      )}
      <SourceFooter
        sourceIds={[...new Set(inds.flatMap((i) => [at(i, period)?.sourceId, at(i, start)?.sourceId]).filter((s): s is string => !!s))].sort()}
        periodLabel={f.periodOf(inds[0], period)}
        csvHref={`/csv/${inds[show === "change" ? 1 : 0].id}.csv`}
        methodHref={`/${locale}/methodology#ind-${inds[show === "change" ? 1 : 0].id}`}
        reportSubject={`Bars: ${id}`}
        pagePath={`${pagePath}#${anchor}`}
        locale={locale}
        f={f}
      />
    </article>
  );
}
