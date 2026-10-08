import { SourceFooter } from "@/components/SourceFooter";
import { YearSlider } from "@/components/YearSlider";
import { getIndicator, getPyramid } from "@/lib/data";
import type { Formatters } from "@/lib/i18n-server";
import { latest } from "@/lib/indicators";
import type { Locale } from "@/lib/locales";
import type { Pyramid } from "@/lib/schema";

// Age bands: under the minimum working age, working age, and the ordinary retirement age
// from 2027 (67). Fixed categorical order (validated palette).
const BANDS = [
  { key: "young", from: 0, to: 15, color: "var(--series-3)" },
  { key: "working", from: 16, to: 66, color: "var(--series-1)" },
  { key: "older", from: 67, to: 100, color: "var(--series-2)" },
] as const;

const AR = {
  contributors: "projection-contributors-ageing-report",
  pensioners: "projection-pensioners-ageing-report",
  ratio: "projection-support-ratio-ageing-report",
  spending: "projection-pensions-ageing-report",
  contributions: "projection-pension-contributions-ageing-report",
  balance: "projection-pension-balance-ageing-report",
} as const;

const valueAt = (id: string, period: string) => getIndicator(id).observations.find((o) => o.period === period)?.value;

const bandSum = (y: Pyramid["years"][number], from: number, to: number) =>
  y.men.slice(from, to + 1).reduce((a, b) => a + b, 0) + y.women.slice(from, to + 1).reduce((a, b) => a + b, 0);

/**
 * "Who pays and who receives", now and in 4, 10 and 20 years, from official projections only:
 * the EU Ageing Report (contributors, pensioners, spending, contributions) and INE (population
 * by age). One slider moves all three panels to the same year.
 */
export function PensionsOutlook({ locale, f, pagePath }: { locale: Locale; f: Formatters; pagePath: string }) {
  const { t } = f;
  const o = (key: string, values?: Record<string, string | number>) => t(`pensionsOutlook.${key}`, values);
  const pyramid = getPyramid("population-projection");
  const base = Number(pyramid.years[0].period);
  const years = pyramid.years.map((y) => y.period);
  const people = (v: number) => f.number(v, "persons", { decimals: 0, compact: true });
  const gdp = (v: number) => f.value(v, "percent_gdp", { decimals: 1 });

  const maxPeople = Math.max(...years.map((y) => valueAt(AR.contributors, y) ?? 0));
  const maxMoney = Math.max(...years.flatMap((y) => [valueAt(AR.spending, y) ?? 0, valueAt(AR.contributions, y) ?? 0]));
  const maxAge = Math.max(...pyramid.years.flatMap((y) => [...y.men, ...y.women]));

  // Today, as observed by Seguridad Social (same month for affiliates and pensions).
  const month = latest(getIndicator("pensions-count")).period;
  const affiliates = valueAt("ss-affiliates", month);
  const pensions = valueAt("pensions-count", month)!;
  const pensioners = valueAt("pensioners", month);

  const stops = years.map((y) => (Number(y) === base ? o("now", { year: y }) : o("ahead", { year: y, n: Number(y) - base })));
  const sourceIds = [
    ...new Set([
      ...Object.values(AR).flatMap((id) => getIndicator(id).observations.map((x) => x.sourceId)),
      ...pyramid.years.map((y) => y.sourceId),
      ...["ss-affiliates", "pensions-count", "pensioners"].map((id) => latest(getIndicator(id)).sourceId),
    ]),
  ].sort();

  return (
    <section className="card mt-6" aria-labelledby="pensions-outlook">
      <h2 id="pensions-outlook">{o("title")}</h2>
      <p className="mt-1 max-w-3xl text-sm">{o("intro")}</p>
      {affiliates !== undefined && (
        <p className="mt-2 max-w-3xl text-sm text-[var(--ink-2)]">
          {o("today", {
            period: f.periodOf(getIndicator("pensions-count"), month),
            affiliates: people(affiliates),
            pensions: people(pensions),
            pensioners: pensioners !== undefined ? people(pensioners) : "–",
            ratio: f.number(affiliates / pensions, "ratio", { decimals: 2 }),
          })}
        </p>
      )}

      <div className="mt-4">
        <YearSlider stops={stops} label={o("slider")}>
          {pyramid.years.map((y) => {
            const contributors = valueAt(AR.contributors, y.period)!;
            const pensionersAr = valueAt(AR.pensioners, y.period)!;
            const spending = valueAt(AR.spending, y.period)!;
            const contributions = valueAt(AR.contributions, y.period)!;
            const balance = valueAt(AR.balance, y.period)!;
            const bands = BANDS.map((b) => ({ ...b, total: bandSum(y, b.from, b.to) }));
            const working = bands[1].total;
            const older = bands[2].total;
            const projected = y.status === "forecast";
            return (
              <div key={y.period} className="mt-4 grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold">{o("whoTitle", { year: y.period })}</h3>
                  <p className="mt-1">
                    <span className="text-3xl font-semibold">{f.number(valueAt(AR.ratio, y.period)!, "ratio", { decimals: 2 })}</span>{" "}
                    <span className="text-sm text-[var(--ink-2)]">{o("ratio")}</span>
                  </p>
                  <div className="mt-3 flex flex-col items-center gap-1" role="img" aria-label={o("whoAlt", { pensioners: people(pensionersAr), contributors: people(contributors), year: y.period })}>
                    <div className="h-8 rounded" style={{ width: `${(pensionersAr / maxPeople) * 100}%`, background: "var(--series-2)" }} />
                    <p className="text-xs">
                      {o("pensioners")}: <strong>{people(pensionersAr)}</strong>
                    </p>
                    <div className="mt-1 h-8 rounded" style={{ width: `${(contributors / maxPeople) * 100}%`, background: "var(--series-1)" }} />
                    <p className="text-xs">
                      {o("contributors")}: <strong>{people(contributors)}</strong>
                    </p>
                  </div>

                  <h3 className="mt-5 text-sm font-semibold">{o("moneyTitle", { year: y.period })}</h3>
                  <dl className="mt-2 space-y-2 text-xs">
                    {[
                      { key: "spending", v: spending, color: "var(--series-2)" },
                      { key: "contributions", v: contributions, color: "var(--series-1)" },
                    ].map((m) => (
                      <div key={m.key}>
                        <dt>{o(m.key)}</dt>
                        <dd className="mt-0.5 flex items-center gap-2">
                          <span className="block h-4 rounded-r" style={{ width: `${(m.v / maxMoney) * 80}%`, background: m.color }} aria-hidden="true" />
                          <span className="whitespace-nowrap font-semibold">{gdp(m.v)}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-2 text-sm">{o("balance", { value: gdp(balance) })}</p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold">
                    {o("pyramidTitle", { year: y.period })}
                    {projected ? ` · ${o("projection")}` : ` · ${o("baseYear")}`}
                  </h3>
                  <p className="mt-1">
                    <span className="text-3xl font-semibold">{f.number(working / older, "ratio", { decimals: 2 })}</span>{" "}
                    <span className="text-sm text-[var(--ink-2)]">{o("workingPerOlder")}</span>
                  </p>
                  <PyramidChart
                    year={y}
                    maxAge={maxAge}
                    label={o("pyramidAlt", {
                      year: y.period,
                      young: people(bands[0].total),
                      working: people(working),
                      older: people(older),
                    })}
                    men={o("men")}
                    women={o("women")}
                  />
                  <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label={t("indicator.legend")}>
                    {bands.map((b) => (
                      <li key={b.key} className="flex items-center gap-1.5">
                        <span className="inline-block h-3 w-3 rounded-sm" style={{ background: b.color }} aria-hidden="true" />
                        {o(`bands.${b.key}`)}: {people(b.total)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </YearSlider>
      </div>

      <ul className="mt-4 space-y-0.5 text-xs text-[var(--ink-2)]">
        <li>{o("noteProjection")}</li>
        <li>{o("noteDefinitions")}</li>
        <li>{o("noteAges")}</li>
      </ul>
      <SourceFooter
        sourceIds={sourceIds}
        methodHref={`/${locale}/methodology#ind-${AR.ratio}`}
        reportSubject="Pensions outlook (Ageing Report, INE projections)"
        pagePath={`${pagePath}#pensions-outlook`}
        locale={locale}
        f={f}
      />
    </section>
  );
}

/** Population pyramid: one bar per year of age, men left, women right, coloured by age band. */
function PyramidChart({ year, maxAge, label, men, women }: { year: Pyramid["years"][number]; maxAge: number; label: string; men: string; women: string }) {
  const W = 360;
  const gap = 30;
  const half = (W - gap) / 2;
  const row = 2.8;
  const top = 8; // room for the "100+" label
  const H = top + 101 * row;
  const color = (age: number) => BANDS.find((b) => age >= b.from && age <= b.to)!.color;
  const y = (age: number) => top + (100 - age) * row;
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-[var(--ink-2)]" aria-hidden="true">
        <span>{men}</span>
        <span>{women}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 block h-auto w-full" role="img" aria-label={label}>
        {year.men.map((v, age) => (
          <rect key={`m${age}`} x={half - (v / maxAge) * half} y={y(age)} width={(v / maxAge) * half} height={row - 0.5} fill={color(age)} />
        ))}
        {year.women.map((v, age) => (
          <rect key={`w${age}`} x={half + gap} y={y(age)} width={(v / maxAge) * half} height={row - 0.5} fill={color(age)} />
        ))}
        {[0, 20, 40, 60, 80, 100].map((age) => (
          <text key={age} x={W / 2} y={y(age) + row} textAnchor="middle" fontSize="9" fill="var(--ink-2)">
            {age === 100 ? "100+" : age}
          </text>
        ))}
      </svg>
    </div>
  );
}
