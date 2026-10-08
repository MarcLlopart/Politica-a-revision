import { SourceFooter } from "@/components/SourceFooter";
import { renderBarChart } from "@/lib/chart";
import { getIndicator } from "@/lib/data";
import type { Formatters } from "@/lib/i18n-server";
import type { Locale } from "@/lib/locales";

/** Function slugs as defined in pipeline/config/spending.ts (indicator ids spending-{slug}-eur / -gdp). */
const SHOWN = ["old-age", "health", "education", "debt-interest", "economic-affairs", "public-order", "defence", "culture", "environment", "housing-community"];

type Props = { locale: Locale; f: Formatters };

/**
 * Where each €100 goes, for the latest year with complete data: shares of spending by
 * function, how spending was financed, and spending per €100 of taxes and contributions.
 * Every figure is a ratio of published Eurostat amounts for the same year.
 */
export function SpendingBreakdown({ locale, f }: Props) {
  const { t } = f;
  const ind = (id: string) => getIndicator(id);
  const ids = ["spending-total-eur", "taxes-contributions-eur", "revenue-total-eur", "population-annual", "gdp-nominal", ...SHOWN.map((s) => `spending-${s}-eur`), "spending-social-protection-eur", "spending-general-services-eur"];
  // Latest year present in every input.
  const common = ids
    .map((id) => new Set(ind(id).observations.map((o) => o.period)))
    .reduce((a, b) => new Set([...a].filter((x) => b.has(x))));
  const year = [...common].sort().at(-1)!;
  const v = (id: string) => ind(id).observations.find((o) => o.period === year)!.value;

  const total = v("spending-total-eur");
  const taxes = v("taxes-contributions-eur");
  const revenue = v("revenue-total-eur");
  const population = v("population-annual");
  const fn = (slug: string) => v(`spending-${slug}-eur`);
  const label = (slug: string) => ind(`spending-${slug}-gdp`).label[locale];

  // Of every €100 spent: the ten COFOG divisions, with pensions and debt interest split out so the parts add up to 100.
  const parts = [
    { key: "old-age", label: label("old-age"), amount: fn("old-age") },
    { key: "other-social", label: t("spending.otherSocial"), amount: fn("social-protection") - fn("old-age") },
    { key: "health", label: label("health"), amount: fn("health") },
    { key: "education", label: label("education"), amount: fn("education") },
    { key: "debt-interest", label: label("debt-interest"), amount: fn("debt-interest") },
    { key: "other-general", label: t("spending.otherGeneral"), amount: fn("general-services") - fn("debt-interest") },
    ...SHOWN.slice(4).map((slug) => ({ key: slug, label: label(slug), amount: fn(slug) })),
  ];
  const euro = (x: number) => f.number(x, "eur", { decimals: 1 });
  const big = (x: number) => f.number(x, "eur", { decimals: 1, compact: true });

  const per100 = parts.map((p) => ({ label: p.label, share: (p.amount / total) * 100, text: euro((p.amount / total) * 100) }));
  const borrowing = total - revenue;
  const financing = [
    { label: t("spending.taxes"), share: (taxes / total) * 100, text: euro((taxes / total) * 100) },
    { label: t("spending.otherRevenue"), share: ((revenue - taxes) / total) * 100, text: euro(((revenue - taxes) / total) * 100) },
    ...(borrowing > 0 ? [{ label: t("spending.borrowing"), share: (borrowing / total) * 100, text: euro((borrowing / total) * 100) }] : []),
  ];
  const perTax = [
    { label: t("spending.allSpending"), share: (total / taxes) * 100, text: euro((total / taxes) * 100) },
    ...parts.slice(0, 6).concat(parts.filter((p) => p.key === "defence")).map((p) => ({ label: p.label, share: (p.amount / taxes) * 100, text: euro((p.amount / taxes) * 100) })),
  ];

  const sourceIds = [...new Set(ids.map((id) => ind(id).observations.find((o) => o.period === year)!.sourceId))].sort();

  return (
    <section className="card mt-6" aria-labelledby="spending-breakdown">
      <h2 id="spending-breakdown">{t("spending.title", { year })}</h2>
      <p className="mt-1 max-w-3xl text-sm text-[var(--ink-2)]">{t("spending.intro", { total: big(total), taxes: big(taxes) })}</p>
      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <figure>
          <figcaption className="text-sm font-semibold">{t("spending.per100Title")}</figcaption>
          <div className="chart mt-2" dangerouslySetInnerHTML={{ __html: renderBarChart(per100, { labelsAbove: true }) }} />
        </figure>
        <figure>
          <figcaption className="text-sm font-semibold">{t("spending.financingTitle")}</figcaption>
          <div className="chart mt-2" dangerouslySetInnerHTML={{ __html: renderBarChart(financing, { labelsAbove: true }) }} />
          <p className="mt-2 text-xs text-[var(--ink-2)]">{t("spending.financingNote")}</p>
        </figure>
        <figure>
          <figcaption className="text-sm font-semibold">{t("spending.perTaxTitle")}</figcaption>
          <div className="chart mt-2" dangerouslySetInnerHTML={{ __html: renderBarChart(perTax, { labelsAbove: true }) }} />
          <p className="mt-2 text-xs text-[var(--ink-2)]">{t("spending.perTaxNote")}</p>
        </figure>
      </div>

      <details className="disclosure mt-4">
        <summary>{t("indicator.viewData")}</summary>
        <table className="data-table stack-table mt-2 w-full text-sm">
          <thead>
            <tr>
              <th scope="col">{t("spending.colFunction")}</th>
              <th scope="col" className="text-right">{t("spending.colAmount")}</th>
              <th scope="col" className="text-right">{t("spending.colGdp")}</th>
              <th scope="col" className="text-right">{t("spending.colPerPerson")}</th>
              <th scope="col" className="text-right">{t("spending.colPer100")}</th>
            </tr>
          </thead>
          <tbody>
            {parts.map((p) => {
              const g = (p.amount / v("gdp-nominal")) * 100;
              return (
                <tr key={p.key}>
                  <th scope="row">{p.label}</th>
                  <td data-label={t("spending.colAmount")} className="text-right tabular-nums">{big(p.amount)}</td>
                  <td data-label={t("spending.colGdp")} className="text-right tabular-nums">{f.number(g, "percent", { decimals: 1 })}</td>
                  <td data-label={t("spending.colPerPerson")} className="text-right tabular-nums">{f.number(p.amount / population, "eur", { decimals: 0 })}</td>
                  <td data-label={t("spending.colPer100")} className="text-right tabular-nums">{euro((p.amount / total) * 100)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
      <ul className="mt-3 space-y-0.5 text-xs text-[var(--ink-2)]">
        <li>{t("spending.noteCofog")}</li>
        <li>{t("spending.noteOtherSocial")}</li>
        <li>{t("spending.noteDefence")}</li>
      </ul>
      <SourceFooter
        sourceIds={sourceIds}
        methodHref={`/${locale}/methodology#ind-spending-total-eur`}
        reportSubject={`Spending breakdown ${year}`}
        pagePath="/spain/public-spending#spending-breakdown"
        locale={locale}
        f={f}
      />
    </section>
  );
}
