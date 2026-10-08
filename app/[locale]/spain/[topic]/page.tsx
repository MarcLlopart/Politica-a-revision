import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BarCard } from "@/components/BarCard";
import { DistributionCard } from "@/components/DistributionCard";
import { IndicatorCard } from "@/components/IndicatorCard";
import { EstimatesPanel } from "@/components/EstimatesPanel";
import { GenderPayGap } from "@/components/GenderPayGap";
import { JobsByOccupation } from "@/components/JobsByOccupation";
import { PensionsExplainer } from "@/components/PensionsExplainer";
import { PensionsOutlook } from "@/components/PensionsOutlook";
import { PercentileTable } from "@/components/PercentileTable";
import { ReadingsKey } from "@/components/Readings";
import { SpendingBreakdown } from "@/components/SpendingBreakdown";
import { LocaleLink as Link } from "@/components/LocaleLink";
import { BAR_CARDS, DASHBOARD, DISTRIBUTION_CARDS, ESTIMATE_GROUPS } from "@/lib/dashboard";
import { getDistribution } from "@/lib/data";
import { getFormatters } from "@/lib/i18n-server";
import { LOCALES, type Locale } from "@/lib/locales";
import { pageMetadata } from "@/lib/metadata";
import { isTopic, TOPICS } from "@/lib/topics";

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => TOPICS.map((topic) => ({ locale, topic })));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/spain/[topic]">): Promise<Metadata> {
  const { locale, topic } = (await params) as { locale: Locale; topic: string };
  const t = await getTranslations({ locale, namespace: "topics" });
  return pageMetadata(locale, `/spain/${topic}`, t(topic));
}

export default async function TopicPage({ params }: PageProps<"/[locale]/spain/[topic]">) {
  const { locale, topic } = (await params) as { locale: Locale; topic: string };
  if (!isTopic(topic)) notFound();
  setRequestLocale(locale);
  const f = await getFormatters(locale);
  const cards = DASHBOARD[topic];
  return (
    <>
      <p className="text-sm">
        <Link href="/">← {f.t("topicPage.back")}</Link>
      </p>
      <h1 className="mt-2">{f.t(`topics.${topic}`)}</h1>
      <p className="mt-1 max-w-2xl text-[var(--ink-2)]">{f.t("topicPage.intro")}</p>
      <ReadingsKey f={f} methodHref={`/${locale}/methodology#readings`} />
      {topic === "income" && <PercentileTable f={f} />}
      {topic === "labour" && <JobsByOccupation locale={locale} f={f} />}
      {topic === "pensions" && <PensionsOutlook locale={locale} f={f} pagePath={`/spain/${topic}`} />}
      {topic === "pensions" && <PensionsExplainer locale={locale} f={f} />}
      {topic === "public-spending" && <SpendingBreakdown locale={locale} f={f} />}
      <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
        {cards.map((card, i) => (
          <IndicatorCard key={card.id} card={card} locale={locale} f={f} pagePath={`/spain/${topic}`} open={i === 0} />
        ))}
        {(BAR_CARDS[topic] ?? []).map((c) => (
          <BarCard key={c.id} id={c.id} indicators={c.indicators} show={c.show} locale={locale} f={f} pagePath={`/spain/${topic}`} />
        ))}
      </div>
      {topic === "income" && <GenderPayGap locale={locale} f={f} pagePath={`/spain/${topic}`} />}
      {ESTIMATE_GROUPS[topic] && <EstimatesPanel topic={topic} groups={ESTIMATE_GROUPS[topic]!} locale={locale} f={f} />}
      {(DISTRIBUTION_CARDS[topic] ?? []).length > 0 && (
        <section className="mt-8" aria-labelledby="distribution-heading">
          <h2 id="distribution-heading">{f.t("distribution.sectionTitle")}</h2>
          <div className="mt-3 grid gap-4">
            {DISTRIBUTION_CARDS[topic]!.map((id) => (
              <DistributionCard key={id} dist={getDistribution(id)} locale={locale} f={f} pagePath={`/spain/${topic}`} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
