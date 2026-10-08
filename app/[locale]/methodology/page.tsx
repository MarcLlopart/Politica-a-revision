import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { shownIndicatorIds } from "@/lib/dashboard";
import { getEvents, getIndicators, getPartiesFile, getRubric, getSource } from "@/lib/data";
import { getFormatters } from "@/lib/i18n-server";
import { WINDOW_START_YEAR } from "@/lib/indicators";
import type { Locale } from "@/lib/locales";
import { pageMetadata } from "@/lib/metadata";
import { IN_LINE_BAND, READING_RULES, rulesOf, type ReadingRule } from "@/lib/readings";
import { repoFileUrl } from "@/lib/site";
import { TOPICS } from "@/lib/topics";

export async function generateMetadata({ params }: PageProps<"/[locale]/methodology">): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: "methodology" });
  return pageMetadata(locale, "/methodology", t("title"));
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-8 scroll-mt-20" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>{title}</h2>
      <div className="prose-block mt-2 max-w-3xl text-sm">{children}</div>
    </section>
  );
}

export default async function MethodologyPage({ params }: PageProps<"/[locale]/methodology">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const f = await getFormatters(locale);
  const { t } = f;
  const m = (key: string, values?: Record<string, string | number>) => t(`methodology.${key}`, values);
  const rubric = getRubric();
  const parties = getPartiesFile();
  const shown = shownIndicatorIds();
  const indicators = [...getIndicators().values()].sort(
    (a, b) => TOPICS.indexOf(a.topic) - TOPICS.indexOf(b.topic) || a.id.localeCompare(b.id),
  );

  return (
    <>
      <h1>{m("title")}</h1>
      <p className="mt-1 max-w-2xl text-[var(--ink-2)]">{m("intro")}</p>
      <p className="mt-2 text-xs text-[var(--ink-2)]">{t("review.status")}</p>

      <nav aria-label={m("contents")} className="mt-4 text-sm">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          <li><a href="#data">{m("data.title")}</a></li>
          <li><a href="#indicators">{m("indicators.title")}</a></li>
          <li><a href="#distributions">{m("distributions.title")}</a></li>
          <li><a href="#readings">{m("readings.title")}</a></li>
          <li><a href="#parties">{m("parties.title")}</a></li>
          <li><a href="#assessment">{m("assessment.title")}</a></li>
          <li><a href="#neutrality">{m("neutrality.title")}</a></li>
        </ul>
      </nav>

      <Section id="data" title={m("data.title")}>
        <p>{m("data.p1")}</p>
        <p>{m("data.p2")}</p>
        <p>{m("data.p3", { year: WINDOW_START_YEAR })}</p>
        <p>{m("data.p4")}</p>
        <p>{m("data.p5")}</p>
        <p>{m("data.p6")}</p>
        <h3 className="mt-4 font-semibold">{m("data.eventsTitle")}</h3>
        <p>{m("data.events")}</p>
        <ul>
          {getEvents().map((e) => (
            <li key={e.id}>
              {f.date(e.date)} · {e.label[locale]} ·{" "}
              <a href={e.sourceUrl} rel="external">
                {t("indicator.eventSource")}
              </a>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="indicators" title={m("indicators.title")}>
        <p>{m("indicators.intro")}</p>
      </Section>
      <div className="mt-3">
        <table className="data-table stack-table w-full text-xs">
          <thead>
            <tr>
              <th scope="col">{m("indicators.indicator")}</th>
              <th scope="col">{m("indicators.source")}</th>
              <th scope="col">{m("indicators.method")}</th>
              <th scope="col">{m("indicators.data")}</th>
            </tr>
          </thead>
          <tbody>
            {indicators.map((ind) => {
              const srcIds = [...new Set(ind.observations.map((o) => o.sourceId))];
              return (
                <tr key={ind.id} id={`ind-${ind.id}`} className="scroll-mt-20 align-top">
                  <th scope="row">
                    <span className="font-semibold">{ind.label[locale]}</span>
                    <br />
                    <span className="text-[var(--ink-2)]">
                      {t(`topics.${ind.topic}`)} · <code>{ind.id}</code>
                      {!shown.has(ind.id) && ` · ${m("indicators.notOnDashboard")}`}
                    </span>
                  </th>
                  <td data-label={m("indicators.source")}>
                    {srcIds.map((id) => {
                      const s = getSource(id);
                      return (
                        <span key={id} className="block">
                          <a href={s.url} rel="external">
                            {s.publisher}, {s.dataset}
                          </a>
                          {s.seriesCode && <> · <code>{s.seriesCode}</code></>}
                          {" · "}
                          <a href={repoFileUrl(s.rawPath)} rel="external">
                            {t("source.raw")}
                          </a>
                        </span>
                      );
                    })}
                  </td>
                  <td data-label={m("indicators.method")}>
                    {ind.calculation.method}
                    {ind.calculation.formula && (
                      <>
                        <br />
                        <code>{ind.calculation.formula}</code>
                      </>
                    )}
                  </td>
                  <td data-label={m("indicators.data")}>
                    <a href={`/csv/${ind.id}.csv`} download>
                      CSV
                    </a>
                    <br />
                    <span className="text-[var(--ink-2)]">
                      {ind.observations[0].period}–{ind.observations.at(-1)!.period}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Section id="distributions" title={m("distributions.title")}>
        <p>{m("distributions.p1")}</p>
        <p>{m("distributions.p2")}</p>
        <p>{m("distributions.p3")}</p>
        <p>{m("distributions.p4")}</p>
        <p>{m("distributions.p5")}</p>
      </Section>

      <Section id="readings" title={m("readings.title")}>
        <p>{m("readings.p1")}</p>
        <p>{m("readings.p2")}</p>
        <p>
          {m("readings.p3", {
            pp: t("readings.pp", { value: f.number(IN_LINE_BAND, "ratio", { decimals: 1 }) }),
            pct: f.number(IN_LINE_BAND, "percent", { decimals: 1 }),
          })}
        </p>
        <p>{m("readings.p4")}</p>
        <p>{m("readings.p5")}</p>
        <p>{m("readings.p6")}</p>
        <p>{m("readings.p7")}</p>
        <p>{m("readings.p8")}</p>
        <table className="data-table stack-table mt-3 w-full text-xs">
          <thead>
            <tr>
              <th scope="col">{m("readings.rule")}</th>
              <th scope="col">{m("readings.indicators")}</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(Object.groupBy(Object.keys(READING_RULES).flatMap((id) => rulesOf(id).map((rule) => [id, rule] as const)), ([, rule]) => ruleKey(rule))).map(([key, entries]) => (
              <tr key={key} className="align-top">
                <th scope="row">{m(`readings.rules.${key}`)}</th>
                <td data-label={m("readings.indicators")}>
                  {entries!.map(([id], i) => (
                    <span key={id}>
                      {i > 0 && " · "}
                      <a href={`#ind-${id}`}>{getIndicators().get(id)!.label[locale]}</a>
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section id="parties" title={m("parties.title")}>
        <p>{parties.inclusionRule[locale]}</p>
        <p>{parties.orderRule[locale]}</p>
        <p>{m("parties.coalitions")}</p>
        <p>{m("parties.programs")}</p>
        <p>{m("parties.extraction")}</p>
        <p>{m("parties.selection")}</p>
      </Section>

      <Section id="assessment" title={m("assessment.title")}>
        <p>
          {m("assessment.rubricStatus", {
            version: rubric.version,
            status: t(`methodology.assessment.status.${rubric.status}`),
          })}{" "}
          <a href={repoFileUrl("methodology/rubric.v1.json")} rel="external">
            rubric.v1.json
          </a>
        </p>
        <p>{m("assessment.scope")}</p>
        <ul>
          <li>{m("assessment.fields.restatement")}</li>
          <li>{m("assessment.fields.baseline")}</li>
          <li>{m("assessment.fields.required")}</li>
          <li>{m("assessment.fields.benchmark")}</li>
          <li>{m("assessment.fields.funding")}</li>
          <li>{m("assessment.fields.estimates")}</li>
          <li>{m("assessment.fields.calculation")}</li>
          <li>{m("assessment.fields.confidence")}</li>
        </ul>
        <h3 className="mt-4 font-semibold">{m("assessment.bandsTitle")}</h3>
        <ul>
          <li>{m("assessment.bands.consistent")}</li>
          <li>{m("assessment.bands.ambitious")}</li>
          <li>{m("assessment.bands.unprecedented")}</li>
          <li>{m("assessment.bands.not_assessable")}</li>
          <li>{m("assessment.bands.costNotCovered", { threshold: f.number(rubric.costNotCovered.thresholdPctGDP, "percent", { decimals: 1 }) })}</li>
        </ul>
        <p>{m("assessment.noScore")}</p>
        <p>{m("assessment.blind")}</p>
      </Section>

      <Section id="neutrality" title={m("neutrality.title")}>
        <ul>
          <li>{m("neutrality.sameRubric")}</li>
          <li>{m("neutrality.noCausal")}</li>
          <li>{m("neutrality.language")}</li>
          <li>{m("neutrality.colours")}</li>
          <li>{m("neutrality.readings")}</li>
          <li>{m("neutrality.headline")}</li>
          <li>{m("neutrality.translations")}</li>
          <li>{m("neutrality.corrections")}</li>
        </ul>
      </Section>
    </>
  );
}

/** Groups the reading rules for the methodology table (message keys `methodology.readings.rules.*`). */
function ruleKey(rule: ReadingRule): string {
  return rule.kind === "reference" ? "reference" : `${rule.kind}-${rule.better}`;
}
