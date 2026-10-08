import { ChartHover } from "@/components/ChartHover";
import { Headline } from "@/components/Headline";
import { Readings } from "@/components/Readings";
import { SourceFooter } from "@/components/SourceFooter";
import { renderLineChart, renderSparkline } from "@/lib/chart";
import type { CardDef } from "@/lib/dashboard";
import { getEvents, getIndicator } from "@/lib/data";
import type { Formatters } from "@/lib/i18n-server";
import { comparisonStart, forecasts, latest, windowed, WINDOW_START_YEAR } from "@/lib/indicators";
import type { Locale } from "@/lib/locales";
import { readingsFor } from "@/lib/readings";
import type { Indicator } from "@/lib/schema";

// Validated categorical order (adjacent pairs pass CVD checks); 4 series carry direct labels and a legend.
const SERIES_COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];

type Props = { card: CardDef; locale: Locale; f: Formatters; pagePath: string; open?: boolean };

/** All indicators a card depends on, including inputs of derived indicators (for sources). */
function withInputs(inds: Indicator[]): Indicator[] {
  const out = new Map<string, Indicator>();
  const visit = (i: Indicator) => {
    if (out.has(i.id)) return;
    out.set(i.id, i);
    i.calculation.inputs.forEach((id) => visit(getIndicator(id)));
  };
  inds.forEach(visit);
  return [...out.values()];
}

export function IndicatorCard({ card, locale, f, pagePath, open = false }: Props) {
  const { t } = f;
  const inds = card.indicators.map(getIndicator);
  const main = inds[0];
  const multi = inds.length > 1;
  const title = multi ? t(`cards.${card.id}`) : main.label[locale];
  // Series with forecasts get a forecast line. Forecast-only series (an anchor year and then
  // forecasts) feed only that line, not the headline or the observed summary.
  const forecastSeries = inds.filter((i) => forecasts(i).length > 0);
  const forecastOnly = (i: Indicator) => i.observations.filter((o) => o.status !== "forecast").length <= 1;
  const observedSeries = inds.filter((i) => !forecastOnly(i));
  const headlineSeries = observedSeries.length > 0 ? observedSeries : [main];
  const last = latest(headlineSeries[0]);
  // Series that stop more than two years before the newest (e.g. a discontinued method) get no
  // headline or summary; series with a different latest period show it next to their value.
  const newestYear = Math.max(...headlineSeries.map((i) => Number(latest(i).period.slice(0, 4))));
  const current = headlineSeries.filter((i) => Number(latest(i).period.slice(0, 4)) >= newestYear - 2);

  const sourceIds = [
    ...new Set(withInputs(inds).flatMap((i) => [...windowed(i).map((o) => o.sourceId), ...i.calculation.extraSourceIds])),
  ].sort();
  const events = getEvents()
    .filter((e) => e.topics.includes(main.topic))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e, i) => ({ ...e, n: i + 1 }));
  const shownEvents = events.filter((e) => Number(e.date.slice(0, 4)) >= WINDOW_START_YEAR);

  const per = (p: string) => f.periodOf(main, p);
  const chartLabel = t("indicator.chartLabel", { title, start: per(windowed(main)[0].period), end: per(windowed(main).at(-1)!.period) });
  const chart = renderLineChart({
    series: inds.map((ind, i) => ({
      key: ind.id,
      label: ind.label[locale],
      color: SERIES_COLORS[i],
      points: windowed(ind).map((o) => ({ period: o.period, value: o.value, forecast: o.status === "forecast" })),
    })),
    events: shownEvents.map((e) => ({ n: e.n, date: e.date })),
    yZero: main.yZero,
    tick: (v) => f.number(v, main.unit, { decimals: tickDecimals(main), compact: true }),
    valueText: (v) => f.indicator(main, v),
    periodText: per,
  });

  const anchor = `card-${card.id}`;
  const hasProvisional = inds.some((i) => windowed(i).some((o) => o.status === "provisional"));
  const hasForecast = inds.some((i) => forecasts(i).length > 0);

  return (
    <article id={anchor} className="card scroll-mt-20" aria-labelledby={`${anchor}-title`}>
      <h2 id={`${anchor}-title`} className="text-sm font-semibold text-[var(--ink-2)]">
        {title}
      </h2>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {current.map((ind) => {
            const l = latest(ind);
            const i = inds.indexOf(ind);
            // Several current series get a colour key and label; a single one reads like a plain card.
            const keyed = current.length > 1;
            return (
              <p key={ind.id} className={keyed ? "flex items-baseline gap-2" : undefined}>
                {keyed && (
                  <span className="inline-block h-0.5 w-3 shrink-0 self-center rounded" style={{ background: SERIES_COLORS[i] }} aria-hidden="true" />
                )}
                <Headline ind={ind} value={l.value} f={f} size={keyed ? "md" : "lg"} />
                {keyed && (
                  <span className="text-xs whitespace-nowrap text-[var(--ink-2)]">
                    {ind.label[locale]}
                    {l.period !== last.period && ` (${per(l.period)})`}
                  </span>
                )}
              </p>
            );
          })}
          <p className="text-xs text-[var(--ink-2)]">
            {per(last.period)}
            {last.status === "provisional" && ` · ${t("indicator.provisional")}`}
          </p>
        </div>
        <div className="sparkline shrink-0" dangerouslySetInnerHTML={{ __html: renderSparkline(windowed(headlineSeries[0])) }} />
      </div>
      {forecastSeries.map((ind) => {
        const fc = forecasts(ind).at(-1);
        return fc ? (
          <p key={`${ind.id}-forecast`} className="mt-1 text-sm text-[var(--ink-2)]">
            {t("indicator.forecastLine", {
              series: multi ? `${ind.label[locale]}: ` : "",
              value: f.indicator(ind, fc.value),
              period: f.periodOf(ind, fc.period),
            })}
          </p>
        ) : null;
      })}
      {current.filter((ind) => !forecastOnly(ind)).map((ind) => {
        const s = comparisonStart(ind);
        const l = latest(ind);
        const values = {
          series: ind.label[locale],
          start: f.indicator(ind, s.value),
          startPeriod: f.periodOf(ind, s.period),
          end: f.indicator(ind, l.value),
          endPeriod: f.periodOf(ind, l.period),
        };
        return (
          <p key={ind.id} className="mt-2 text-sm">
            {s.period === l.period
              ? t("indicator.singlePoint", values)
              : multi
                ? t("indicator.summarySeries", values)
                : t("indicator.summary", values)}
          </p>
        );
      })}
      <Readings
        f={f}
        items={current
          .filter((ind) => !forecastOnly(ind))
          .flatMap((ind) => readingsFor(ind, multi).map((reading) => ({ ind, reading, series: multi ? ind.label[locale] : undefined })))}
      />

      <details className="disclosure mt-2" open={open}>
        <summary>{t("indicator.expand")}</summary>
        <div className="mt-3">
          <ChartHover {...chart} label={chartLabel} hint={t("indicator.chartHint")} />
          {multi && (
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label={t("indicator.legend")}>
              {inds.map((ind, i) => (
                <li key={ind.id} className="flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-4 rounded" style={{ background: SERIES_COLORS[i] }} aria-hidden="true" />
                  {ind.label[locale]}
                </li>
              ))}
            </ul>
          )}
          <ul className="mt-2 space-y-0.5 text-xs text-[var(--ink-2)]">
            {!main.yZero && <li>{t("indicator.axisNotZero")}</li>}
            {[...new Set(inds.flatMap((ind) => (ind.note ? [ind.note[locale]] : [])))].map((note) => (
              <li key={note}>{note}</li>
            ))}
            {hasProvisional && <li>{t("indicator.provisionalNote")}</li>}
            {hasForecast && <li>{t("indicator.forecastNote")}</li>}
            <li>{t("indicator.fullHistory", { year: main.observations[0].period.slice(0, 4) })}</li>
          </ul>
          {shownEvents.length > 0 && (
            <div className="mt-2 text-xs text-[var(--ink-2)]">
              <p className="font-semibold">{t("indicator.events")}</p>
              <ol className="mt-0.5 space-y-0.5">
                {shownEvents.map((e) => (
                  <li key={e.id}>
                    <span className="font-semibold">{e.n}</span> · {f.date(e.date)} · {e.label[locale]}{" "}
                    <a href={e.sourceUrl} rel="external">
                      ({t("indicator.eventSource")})
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <details className="disclosure mt-3">
            <summary>{t("indicator.viewData")}</summary>
            <DataTable inds={inds} locale={locale} f={f} />
          </details>
          <SourceFooter
            sourceIds={sourceIds}
            periodLabel={per(last.period)}
            csvHref={`/csv/${main.id}.csv`}
            methodHref={`/${locale}/methodology#ind-${main.id}`}
            reportSubject={`Indicator: ${card.indicators.join(", ")}`}
            pagePath={`${pagePath}#${anchor}`}
            locale={locale}
            f={f}
          />
          {multi && (
            <p className="mt-1 text-xs">
              {inds.slice(1).map((ind) => (
                <a key={ind.id} href={`/csv/${ind.id}.csv`} download className="mr-3 inline-block min-h-6 py-1">
                  {t("source.csv")} · {ind.label[locale]}
                </a>
              ))}
            </p>
          )}
        </div>
      </details>
    </article>
  );
}

function DataTable({ inds, locale, f }: { inds: Indicator[]; locale: Locale; f: Formatters }) {
  const periods = [...new Set(inds.flatMap((i) => windowed(i).map((o) => o.period)))].sort().reverse();
  const byId = inds.map((i) => new Map(windowed(i).map((o) => [o.period, o])));
  return (
    <div className="mt-2 max-h-72 overflow-y-auto">
      <table className="data-table w-full text-sm">
        <thead>
          <tr>
            <th scope="col">{f.t("indicator.period")}</th>
            {inds.map((i) => (
              <th key={i.id} scope="col" className="text-right">
                {i.label[locale]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => (
            <tr key={p}>
              <th scope="row">{f.periodOf(inds[0], p)}</th>
              {inds.map((ind, k) => {
                const o = byId[k].get(p);
                return (
                  <td key={ind.id} className="text-right tabular-nums">
                    {o ? f.indicator(ind, o.value) : "–"}
                    {o?.status === "provisional" && <abbr title={f.t("indicator.provisional")}> p</abbr>}
                    {o?.status === "forecast" && <abbr title={f.t("indicator.forecast")}> f</abbr>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function tickDecimals(ind: Indicator): number {
  if (ind.unit === "eur" || ind.unit === "persons" || ind.unit === "dwellings" || ind.unit === "pensions") return 0;
  return Math.min(ind.decimals, 1);
}
