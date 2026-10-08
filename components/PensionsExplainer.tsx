import { BalanceCalculator } from "@/components/BalanceCalculator";
import { SourceFooter } from "@/components/SourceFooter";
import { renderBarChart } from "@/lib/chart";
import { CONTRIBUTION_RATES } from "@/lib/dashboard";
import { getEstimates, getIndicator } from "@/lib/data";
import type { Formatters } from "@/lib/i18n-server";
import { latest } from "@/lib/indicators";
import { INTL_LOCALE, type Locale } from "@/lib/locales";

const CLASSES = ["retirement", "widowhood", "disability", "orphanhood", "family"];

/**
 * How pay-as-you-go pensions are financed, using the series on this page: who pays and who
 * receives in the same month, what kinds of pensions are paid, and the balance identity.
 */
export function PensionsExplainer({ locale, f }: { locale: Locale; f: Formatters }) {
  const { t } = f;
  const ind = getIndicator;
  // Same month for affiliates and pensions.
  const months = (id: string) => new Set(ind(id).observations.map((o) => o.period));
  const affiliatesMonths = months("ss-affiliates");
  const month = [...months("pensions-count")].filter((m) => affiliatesMonths.has(m)).sort().at(-1)!;
  const at = (id: string, p: string) => ind(id).observations.find((o) => o.period === p)!;
  const affiliates = at("ss-affiliates", month).value;
  const pensions = at("pensions-count", month).value;
  const pensionersObs = ind("pensioners").observations.find((o) => o.period === month);
  const pensioners = pensionersObs?.value;
  const ratio = affiliates / pensions;
  const monthLabel = f.periodOf(ind("pensions-count"), month);
  const people = (v: number) => f.number(v, "persons", { decimals: 0, compact: true });

  const classes = CLASSES.map((c) => ({ c, i: ind(`pensions-count-${c}`) }));
  const classRows = classes.map(({ i }) => {
    const v = at(i.id, month).value;
    const share = (v / pensions) * 100;
    return { label: i.label[locale], share: v / 1e6, text: `${people(v)} (${f.number(share, "percent", { decimals: share < 1 ? 1 : 0 })})` };
  });
  const retirementShare = at("pensions-count-retirement", month).value / pensions;

  // Balance identity with averages: average pension (all classes, 14 payments) vs average wage.
  const avgPension = latest(ind("pension-average"));
  const avgWage = latest(ind("wage-mean"));
  const pensionToWage = (avgPension.value * 14) / avgWage.value;
  const rateEstimate = getEstimates().get("contribution-rate-common-contingencies-2026");

  const sourceIds = [
    ...new Set([
      at("ss-affiliates", month).sourceId,
      at("pensions-count", month).sourceId,
      ...(pensionersObs ? [pensionersObs.sourceId] : []),
      avgPension.sourceId,
      avgWage.sourceId,
    ]),
  ].sort();

  return (
    <section className="card mt-6" aria-labelledby="pensions-explainer">
      <h2 id="pensions-explainer">{t("pensionsExplainer.title")}</h2>
      <p className="mt-1 max-w-3xl text-sm text-[var(--ink-2)]">{t("pensionsExplainer.intro")}</p>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">{t("pensionsExplainer.whoTitle", { month: monthLabel })}</h3>
          <p className="mt-1 text-sm">
            {t("pensionsExplainer.whoText", { affiliates: people(affiliates), pensions: people(pensions), ratio: f.number(ratio, "ratio", { decimals: 2 }) })}
          </p>
          <div
            className="chart mt-2"
            dangerouslySetInnerHTML={{
              __html: renderBarChart(
                [
                  { label: t("pensionsExplainer.affiliates"), share: affiliates / 1e6, text: people(affiliates) },
                  { label: t("pensionsExplainer.pensions"), share: pensions / 1e6, text: people(pensions) },
                  ...(pensioners
                    ? [{ label: t("pensionsExplainer.pensioners"), share: pensioners / 1e6, text: people(pensioners) }]
                    : []),
                ],
                { labelsAbove: true },
              ),
            }}
          />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{t("pensionsExplainer.typesTitle")}</h3>
          <p className="mt-1 text-sm">{t("pensionsExplainer.typesText", { share: f.number(retirementShare * 100, "percent", { decimals: 0 }) })}</p>
          <div className="chart mt-2" dangerouslySetInnerHTML={{ __html: renderBarChart(classRows, { labelsAbove: true }) }} />
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold">{t("pensionsExplainer.balanceTitle")}</h3>
        <p className="mt-1 max-w-3xl text-sm">{t("pensionsExplainer.balanceText")}</p>
        <div className="mt-3 max-w-xl">
          <BalanceCalculator
            intlLocale={INTL_LOCALE[locale]}
            contributorsPerPension={Math.round(ratio * 100) / 100}
            pensionToWage={Math.round(pensionToWage * 1000) / 1000}
            actualRate={rateEstimate?.value ?? 28.3}
            labels={{
              title: t("pensionsExplainer.calcTitle"),
              ratioLabel: t("pensionsExplainer.calcRatio"),
              replacementLabel: t("pensionsExplainer.calcReplacement"),
              resultLabel: t("pensionsExplainer.calcResult"),
              actualLabel: t("pensionsExplainer.calcActual"),
              reset: t("pensionsExplainer.calcReset"),
              formula: t("pensionsExplainer.calcFormula"),
            }}
          />
        </div>
        <ul className="mt-3 space-y-0.5 text-xs text-[var(--ink-2)]">
          <li>
            {t("pensionsExplainer.defaults", {
              pension: f.number(avgPension.value, "eur", { decimals: 2 }),
              pensionPeriod: f.periodOf(ind("pension-average"), avgPension.period),
              wage: f.number(avgWage.value, "eur", { decimals: 0 }),
              wagePeriod: avgWage.period,
            })}
          </li>
          <li>{t("pensionsExplainer.simplification")}</li>
        </ul>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold">{t("pensionsExplainer.ratesTitle")}</h3>
        <table className="data-table stack-table mt-2 w-full max-w-3xl text-sm">
          <thead>
            <tr>
              <th scope="col">{t("pensionsExplainer.ratesConcept")}</th>
              <th scope="col" className="text-right">
                {t("pensionsExplainer.ratesRate")}
              </th>
              <th scope="col">{t("pensionsExplainer.ratesSplit")}</th>
            </tr>
          </thead>
          <tbody>
            {CONTRIBUTION_RATES.map((id) => {
              const e = getEstimates().get(id)!;
              return (
                <tr key={id} className="align-top">
                  <th scope="row">{e.label[locale]}</th>
                  <td data-label={t("pensionsExplainer.ratesRate")} className="text-right tabular-nums">
                    {f.number(e.value, "percent", { decimals: 2 })}
                  </td>
                  <td data-label={t("pensionsExplainer.ratesSplit")} className="text-xs">
                    {e.definition[locale]}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-[var(--ink-2)]">
          {t("pensionsExplainer.ratesSource")}{" "}
          <a href={getEstimates().get(CONTRIBUTION_RATES[0])!.document.url} rel="external">
            {getEstimates().get(CONTRIBUTION_RATES[0])!.document.title}
          </a>
        </p>
      </div>

      <p className="mt-4 text-sm">
        {t("pensionsExplainer.simulator")}{" "}
        <a href="https://prestaciones.seg-social.es/simulador-servicio/simulador-pension-jubilacion.html" rel="external">
          {t("pensionsExplainer.simulatorLink")}
        </a>
      </p>

      <SourceFooter
        sourceIds={sourceIds}
        methodHref={`/${locale}/methodology#ind-affiliates-per-pension`}
        reportSubject="Pensions explainer"
        pagePath="/spain/pensions#pensions-explainer"
        locale={locale}
        f={f}
      />
    </section>
  );
}
