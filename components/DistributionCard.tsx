import { SourceFooter } from "@/components/SourceFooter";
import { ThresholdChecker } from "@/components/ThresholdChecker";
import { renderBarChart } from "@/lib/chart";
import { quantile, regroup, type Bracket } from "@/lib/distribution";
import type { Formatters } from "@/lib/i18n-server";
import { INTL_LOCALE, type Locale } from "@/lib/locales";
import type { Distribution, StatValue } from "@/lib/schema";

type Props = { dist: Distribution; locale: Locale; f: Formatters; pagePath: string };

/**
 * Who is in a distribution: mean, median, most common range, P90 and P99, a bar chart of
 * the share in each amount range, the share above selected amounts, and an amount checker.
 */
export function DistributionCard({ dist, locale, f, pagePath }: Props) {
  const { t } = f;
  const last = dist.periods[dist.periods.length - 1];
  const s = last.stats;
  const eur = (v: number) => f.number(v, "eur", { decimals: 0, compact: Math.abs(v) >= 1e6 });
  const unit = t(`distribution.unit.${dist.amountPer}`);
  const pct = (v: number) => f.number(v * 100, "percent", { decimals: v < 0.1 ? 1 : 0 });
  const stat = (st: StatValue) =>
    st.value === null
      ? t("distribution.atLeast", { value: eur(st.atLeast ?? 0) })
      : `${st.method === "linear" || st.method === "pareto" ? "≈ " : ""}${eur(st.value)}`;
  const anchor = `dist-${dist.id}`;
  const periodLabel = f.periodOf(dist, last.period);

  const tiles = [
    { key: "mean", label: t("distribution.mean"), value: stat(s.mean), hint: t("distribution.meanHint") },
    { key: "median", label: t("distribution.median"), value: stat(s.median), hint: t("distribution.medianHint") },
    s.mode
      ? {
          key: "mode",
          label: t("distribution.mode"),
          value: t("distribution.range", { lower: eur(s.mode.lower), upper: eur(s.mode.upper) }),
          hint: t("distribution.modeHint", { share: pct(s.mode.share) }),
        }
      : { key: "mode", label: t("distribution.mode"), value: "–", hint: t("distribution.modeUnavailable") },
    { key: "p90", label: t("distribution.p90"), value: stat(s.p90), hint: t("distribution.p90Hint") },
    { key: "p99", label: t("distribution.p99"), value: stat(s.p99), hint: t("distribution.p99Hint") },
  ];

  const bracketLabel = (b: Bracket, first: boolean) =>
    b.upper === null
      ? t("distribution.over", { lower: eur(b.lower) })
      : first && b.lower === 0
        ? t("distribution.upTo", { upper: eur(b.upper) })
        : t("distribution.range", { lower: eur(b.lower), upper: eur(b.upper) });

  // Which display group holds each marked statistic.
  const groups = dist.displayEdges ? regroup(last.brackets, dist.displayEdges) : last.brackets;
  const marks: [string, StatValue][] = [
    ["P50", s.median],
    ["P90", s.p90],
    ["P99", s.p99],
  ];
  const rows = groups.map((g, i) => {
    const share = g.count / last.total;
    const tags = marks
      .filter(([, st]) => {
        const v = st.value ?? st.atLeast;
        return v !== undefined && v !== null && v >= g.lower && (g.upper === null || v < g.upper || (st.value === null && v === g.upper));
      })
      .map(([k]) => k);
    return { label: bracketLabel(g, i === 0), share, text: [pct(share), ...tags].join(" · ") };
  });

  const summary = t("distribution.summary", { median: stat(s.median), p90: stat(s.p90) });
  const sourceIds = [...new Set([last.sourceId, ...last.extraSourceIds, ...(s.mean.sourceId ? [s.mean.sourceId] : [])])];
  const firstThreshold = last.thresholds.find((x) => x.shareAbove !== null)?.amount ?? quantile(last.brackets, 0.5).value ?? 0;

  return (
    <article id={anchor} className="card scroll-mt-20 lg:col-span-2" aria-labelledby={`${anchor}-title`}>
      <h3 id={`${anchor}-title`} className="text-base font-semibold">
        {dist.label[locale]}
      </h3>
      <p className="text-xs text-[var(--ink-2)]">
        {t("distribution.subtitle", {
          population: dist.population[locale],
          count: f.number(last.total, "persons", { decimals: 0 }),
          period: periodLabel,
          unit,
        })}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile) => (
          <div key={tile.key} className="rounded-lg bg-[var(--surface-2)] p-2">
            <dt className="text-xs font-semibold text-[var(--ink-2)]">{tile.label}</dt>
            <dd className="text-lg font-semibold leading-tight">{tile.value}</dd>
            <dd className="text-xs text-[var(--ink-2)]">{tile.hint}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm">{summary}</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <figure>
          <figcaption className="text-xs font-semibold text-[var(--ink-2)]">{t("distribution.chartTitle")}</figcaption>
          <div className="chart mt-1" dangerouslySetInnerHTML={{ __html: renderBarChart(rows) }} />
        </figure>
        <div>
          <table className="data-table w-full text-sm">
            <caption className="text-left text-xs font-semibold text-[var(--ink-2)]">{t("distribution.thresholdsTitle")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("distribution.amount")}</th>
                <th scope="col" className="text-right">
                  {t("distribution.shareAbove")}
                </th>
                <th scope="col" className="text-right">
                  {t("distribution.countAbove")}
                </th>
              </tr>
            </thead>
            <tbody>
              {last.thresholds.map((x) => (
                <tr key={x.amount}>
                  <th scope="row" className="tabular-nums">
                    {eur(x.amount)}
                  </th>
                  <td className="text-right tabular-nums">{x.shareAbove === null ? "–" : `≈ ${pct(x.shareAbove)}`}</td>
                  <td className="text-right tabular-nums">{x.countAbove === null ? "–" : f.number(x.countAbove, "persons", { decimals: 0 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ThresholdChecker
            brackets={last.brackets}
            total={last.total}
            intlLocale={INTL_LOCALE[locale]}
            label={t("distribution.checkerLabel", { unit })}
            resultTemplate={f.raw("distribution.checkerResult")}
            unknownTemplate={f.raw("distribution.checkerUnknown")}
            initial={firstThreshold}
          />
        </div>
      </div>

      <ul className="mt-3 space-y-0.5 text-xs text-[var(--ink-2)]">
        <li>{t("distribution.methodNote")}</li>
        {dist.note && <li>{dist.note[locale]}</li>}
      </ul>

      <details className="disclosure mt-3">
        <summary>{t("indicator.viewData")}</summary>
        <div className="mt-2 max-h-72 overflow-y-auto">
          <table className="data-table w-full text-sm">
            <thead>
              <tr>
                <th scope="col">{t("distribution.amount")}</th>
                <th scope="col" className="text-right">
                  {t("distribution.count")}
                </th>
                <th scope="col" className="text-right">
                  {t("distribution.share")}
                </th>
              </tr>
            </thead>
            <tbody>
              {last.brackets.map((b, i) => (
                <tr key={i}>
                  <th scope="row">{bracketLabel(b, i === 0)}</th>
                  <td className="text-right tabular-nums">{f.number(b.count, "persons", { decimals: 0 })}</td>
                  <td className="text-right tabular-nums">{pct(b.count / last.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <SourceFooter
        sourceIds={sourceIds}
        periodLabel={periodLabel}
        csvHref={`/csv/distribution-${dist.id}.csv`}
        methodHref={`/${locale}/methodology#distributions`}
        reportSubject={`Distribution: ${dist.id}`}
        pagePath={`${pagePath}#${anchor}`}
        locale={locale}
        f={f}
      />
    </article>
  );
}
