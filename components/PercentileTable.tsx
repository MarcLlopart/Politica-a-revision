import { PERCENTILE_TABLE, type StatColumn } from "@/lib/dashboard";
import { getDistribution, getIndicator } from "@/lib/data";
import type { Formatters } from "@/lib/i18n-server";
import { latest } from "@/lib/indicators";
import type { StatValue } from "@/lib/schema";

const COLUMNS: StatColumn[] = ["mean", "median", "mode", "p90", "p99"];

/**
 * "Who is who": mean, median, most common amount, P90 and P99 for every population we have,
 * so a threshold in a programme can be placed against each. Units differ between rows
 * (gross or net, per person or per household, per year or per month) and are stated per row.
 */
export function PercentileTable({ f }: { f: Formatters }) {
  const { t } = f;
  const eur = (v: number) => f.number(v, "eur", { decimals: 0, compact: Math.abs(v) >= 1e6 });
  const estimated = (st: StatValue) =>
    st.value === null
      ? t("distribution.atLeast", { value: eur(st.atLeast ?? 0) })
      : `${st.method === "linear" || st.method === "pareto" ? "≈ " : ""}${eur(st.value)}`;

  const rows = PERCENTILE_TABLE.map((row) => {
    if ("distribution" in row) {
      const d = getDistribution(row.distribution);
      const p = d.periods[d.periods.length - 1];
      const s = p.stats;
      return {
        id: row.id,
        anchor: `#dist-${d.id}`,
        unit: t(`distribution.unit.${d.amountPer}`),
        period: f.periodOf(d, p.period),
        cells: {
          mean: estimated(s.mean),
          median: estimated(s.median),
          mode: s.mode ? t("distribution.range", { lower: eur(s.mode.lower), upper: eur(s.mode.upper) }) : null,
          p90: estimated(s.p90),
          p99: estimated(s.p99),
        } as Record<StatColumn, string | null>,
      };
    }
    const median = getIndicator(row.indicators.median!);
    const period = latest(median).period;
    const cells = Object.fromEntries(
      COLUMNS.map((c) => {
        const id = row.indicators[c];
        if (!id) return [c, null];
        const o = getIndicator(id).observations.find((x) => x.period === period);
        return [c, o ? eur(o.value) : null];
      }),
    ) as Record<StatColumn, string | null>;
    return { id: row.id, anchor: null, unit: t(`distribution.unit.${row.per}`), period: f.periodOf(median, period), cells };
  });

  return (
    <section aria-labelledby="who-is-who" className="card mt-6">
      <h2 id="who-is-who">{t("percentileTable.title")}</h2>
      <p className="mt-1 max-w-3xl text-sm text-[var(--ink-2)]">{t("percentileTable.intro")}</p>
      <table className="data-table stack-table mt-3 w-full text-sm">
        <thead>
          <tr>
            <th scope="col">{t("percentileTable.population")}</th>
            {COLUMNS.map((c) => (
              <th key={c} scope="col" className="text-right">
                {t(`percentileTable.columns.${c}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="align-top">
              <th scope="row">
                {r.anchor ? <a href={r.anchor}>{t(`percentileTable.rows.${r.id}`)}</a> : t(`percentileTable.rows.${r.id}`)}
                <span className="block text-xs text-[var(--ink-2)]">
                  {r.unit} · {r.period}
                </span>
              </th>
              {COLUMNS.map((c) => (
                <td key={c} data-label={t(`percentileTable.columns.${c}`)} className="text-right tabular-nums">
                  {r.cells[c] ?? <span title={t("percentileTable.notPublished")}>–</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-3 space-y-0.5 text-xs text-[var(--ink-2)]">
        <li>{t("percentileTable.noteUnits")}</li>
        <li>{t("percentileTable.noteEstimated")}</li>
        <li>{t("percentileTable.noteMissing")}</li>
      </ul>
    </section>
  );
}
