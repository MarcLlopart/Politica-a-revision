import { SourceFooter } from "@/components/SourceFooter";
import { renderBarChart } from "@/lib/chart";
import { getIndicator } from "@/lib/data";
import type { Formatters } from "@/lib/i18n-server";
import { latest, WINDOW_START_YEAR } from "@/lib/indicators";
import type { Locale } from "@/lib/locales";

/** CNO-11 major groups in classification order, with their ISCO-08 skill level. */
const GROUPS: { group: string; skill: "high" | "medium" | "elementary" | "military" }[] = [
  { group: "1", skill: "high" },
  { group: "2", skill: "high" },
  { group: "3", skill: "high" },
  { group: "4", skill: "medium" },
  { group: "5", skill: "medium" },
  { group: "6", skill: "medium" },
  { group: "7", skill: "medium" },
  { group: "8", skill: "medium" },
  { group: "9", skill: "elementary" },
  { group: "0", skill: "military" },
];

/**
 * "Are the new jobs qualified?": change in employment by occupation between the same
 * quarter of the first year shown and the latest quarter, grouped by skill level.
 */
export function JobsByOccupation({ locale, f }: { locale: Locale; f: Formatters }) {
  const { t } = f;
  const inds = GROUPS.map((g) => ({ ...g, ind: getIndicator(`employed-occupation-${g.group}`) }));
  const end = latest(inds[0].ind).period;
  const start = `${WINDOW_START_YEAR}${end.slice(4)}`;
  const at = (i: (typeof inds)[number], p: string) => i.ind.observations.find((o) => o.period === p)!.value;
  const rows = inds.map((i) => ({ ...i, from: at(i, start), to: at(i, end) }));
  const totalChange = rows.reduce((s, r) => s + (r.to - r.from), 0);
  const bySkill = (skill: string) => rows.filter((r) => r.skill === skill).reduce((s, r) => s + (r.to - r.from), 0);
  const people = (v: number) => f.number(v, "persons", { decimals: 0, compact: true, signed: true });
  const pct = (v: number) => f.number(v, "percent", { decimals: 0 });

  const bars = rows.map((r) => ({
    label: `${r.group} · ${r.ind.label[locale]}`,
    share: (r.to - r.from) / 1000,
    text: `${people(r.to - r.from)} (${f.number(((r.to - r.from) / r.from) * 100, "percent_change", { decimals: 0 })})`,
  }));
  const period = (p: string) => f.periodOf(inds[0].ind, p);

  return (
    <section className="card mt-6" aria-labelledby="jobs-by-occupation">
      <h2 id="jobs-by-occupation">{t("jobs.title", { start: period(start), end: period(end) })}</h2>
      <p className="mt-1 max-w-3xl text-sm">
        {t("jobs.summary", {
          total: people(totalChange),
          high: people(bySkill("high")),
          highShare: pct((bySkill("high") / totalChange) * 100),
          medium: people(bySkill("medium")),
          mediumShare: pct((bySkill("medium") / totalChange) * 100),
          elementary: people(bySkill("elementary")),
          elementaryShare: pct((bySkill("elementary") / totalChange) * 100),
        })}
      </p>
      <figure className="mt-3">
        <figcaption className="text-sm font-semibold">{t("jobs.chartTitle")}</figcaption>
        <div className="chart mt-2" dangerouslySetInnerHTML={{ __html: renderBarChart(bars, { labelsAbove: true }) }} />
      </figure>
      <ul className="mt-3 space-y-0.5 text-xs text-[var(--ink-2)]">
        <li>{t("jobs.noteSkill")}</li>
        <li>{t("jobs.noteSeason")}</li>
      </ul>
      <details className="disclosure mt-3">
        <summary>{t("indicator.viewData")}</summary>
        <table className="data-table stack-table mt-2 w-full text-sm">
          <thead>
            <tr>
              <th scope="col">{t("jobs.occupation")}</th>
              <th scope="col" className="text-right">{period(start)}</th>
              <th scope="col" className="text-right">{period(end)}</th>
              <th scope="col" className="text-right">{t("jobs.change")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.group}>
                <th scope="row">
                  {r.group} · {r.ind.label[locale]}
                </th>
                <td data-label={period(start)} className="text-right tabular-nums">{f.number(r.from, "persons", { decimals: 0 })}</td>
                <td data-label={period(end)} className="text-right tabular-nums">{f.number(r.to, "persons", { decimals: 0 })}</td>
                <td data-label={t("jobs.change")} className="text-right tabular-nums">{f.number(r.to - r.from, "persons", { decimals: 0, signed: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <SourceFooter
        sourceIds={[...new Set(rows.map((r) => r.ind.observations.find((o) => o.period === end)!.sourceId))].sort()}
        periodLabel={period(end)}
        methodHref={`/${locale}/methodology#ind-share-high-skill-occupations`}
        reportSubject="Jobs by occupation"
        pagePath="/spain/labour#jobs-by-occupation"
        locale={locale}
        f={f}
      />
    </section>
  );
}
