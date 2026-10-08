import { EstimateItem } from "@/components/EstimatesPanel";
import { IndicatorCard } from "@/components/IndicatorCard";
import { SourceFooter } from "@/components/SourceFooter";
import { renderBarChart } from "@/lib/chart";
import { GENDER_PAY_GAP } from "@/lib/dashboard";
import { getEstimates, getIndicator } from "@/lib/data";
import type { Formatters } from "@/lib/i18n-server";
import { latest, WINDOW_START_YEAR } from "@/lib/indicators";
import type { Locale } from "@/lib/locales";

/**
 * "Gender pay gap: the same job?": the official measures from the most comparable to the
 * least. No official statistic compares two people in the same post at the same employer;
 * Eurostat's decomposition (same measured characteristics) is the closest.
 */
export function GenderPayGap({ locale, f, pagePath }: { locale: Locale; f: Formatters; pagePath: string }) {
  const { t } = f;
  const g = (key: string, values?: Record<string, string | number>) => t(`genderPayGap.${key}`, values);
  const estimates = getEstimates();
  const [adjusted, unadjusted] = GENDER_PAY_GAP.estimates.map((id) => estimates.get(id)!);

  const groups = GENDER_PAY_GAP.occupation.map(getIndicator);
  const period = latest(groups[0]).period;
  const at = (id: string, p: string) => getIndicator(id).observations.find((o) => o.period === p);
  const pct = (v: number) => f.number(v, "percent", { decimals: 1 });
  const rows = groups.map((ind) => {
    const now = at(ind.id, period)!.value;
    const then = at(ind.id, String(WINDOW_START_YEAR))?.value;
    const change = then === undefined ? "" : ` (${t("readings.pp", { value: f.number(now - then, "ratio", { decimals: 1, signed: true }) })} ${t("barCard.since", { year: WINDOW_START_YEAR })})`;
    return { label: ind.label[locale], share: now, text: `${pct(now)}${change}` };
  });
  const byGroup = rows.slice(1).map((r) => r.share);
  const raw = latest(getIndicator("gender-pay-gap"));

  return (
    <section className="card mt-6" aria-labelledby="gender-pay-gap">
      <h2 id="gender-pay-gap">{g("title")}</h2>
      <p className="mt-1 max-w-3xl text-sm">{g("intro")}</p>
      <p className="mt-2 max-w-3xl text-sm font-semibold">
        {g("summary", {
          adjusted: pct(adjusted.value),
          adjustedYear: adjusted.period,
          min: pct(Math.min(...byGroup)),
          max: pct(Math.max(...byGroup)),
          groupYear: period,
          raw: pct(raw.value),
          rawYear: raw.period,
        })}
      </p>

      <h3 className="mt-5 text-sm font-semibold">1 · {g("step1")}</h3>
      <p className="mt-1 max-w-3xl text-sm text-[var(--ink-2)]">{g("step1Text")}</p>
      <ul className="mt-2 grid gap-3 md:grid-cols-2">
        <EstimateItem e={adjusted} topic="income" locale={locale} f={f} />
        <EstimateItem e={unadjusted} topic="income" locale={locale} f={f} />
      </ul>

      <h3 className="mt-6 text-sm font-semibold">2 · {g("step2", { year: period })}</h3>
      <p className="mt-1 max-w-3xl text-sm text-[var(--ink-2)]">{g("step2Text")}</p>
      <div className="chart mt-2 max-w-xl" dangerouslySetInnerHTML={{ __html: renderBarChart(rows, { labelsAbove: true }) }} />
      <table className="sr-only">
        <caption>{g("step2", { year: period })}</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td>{r.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 max-w-3xl text-xs text-[var(--ink-2)]">{groups[0].note?.[locale]}</p>
      <SourceFooter
        sourceIds={[...new Set(groups.flatMap((i) => getIndicator(i.calculation.inputs[0]).observations.map((o) => o.sourceId).concat(getIndicator(i.calculation.inputs[1]).observations.map((o) => o.sourceId))))].sort()}
        periodLabel={period}
        csvHref={`/csv/${groups[0].id}.csv`}
        methodHref={`/${locale}/methodology#ind-${groups[0].id}`}
        reportSubject="Gender pay gap by occupation"
        pagePath={`${pagePath}#gender-pay-gap`}
        locale={locale}
        f={f}
      />

      <h3 className="mt-6 text-sm font-semibold">3 · {g("step3")}</h3>
      <p className="mt-1 max-w-3xl text-sm text-[var(--ink-2)]">{g("step3Text")}</p>
      <div className="mt-3 grid items-start gap-4 lg:grid-cols-2">
        {GENDER_PAY_GAP.cards.map((card) => (
          <IndicatorCard key={card.id} card={card} locale={locale} f={f} pagePath={pagePath} />
        ))}
      </div>
    </section>
  );
}
