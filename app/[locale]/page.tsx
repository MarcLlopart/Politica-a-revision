import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ReadingsKey } from "@/components/Readings";
import { TopicCard } from "@/components/TopicCard";
import { DASHBOARD } from "@/lib/dashboard";
import { getFormatters } from "@/lib/i18n-server";
import { WINDOW_START_YEAR } from "@/lib/indicators";
import type { Locale } from "@/lib/locales";
import { pageMetadata } from "@/lib/metadata";
import { SITE } from "@/lib/site";
import { TOPICS } from "@/lib/topics";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: "home" });
  // The layout's title template applies only to child segments, so the home page adds the name itself.
  return pageMetadata(locale, "", `${t("title")} · ${SITE.name}`);
}

export default async function SpainPage({ params }: PageProps<"/[locale]">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const f = await getFormatters(locale);
  return (
    <>
      <h1>{f.t("home.title")}</h1>
      <p className="mt-1 max-w-2xl text-[var(--ink-2)]">{f.t("home.intro", { startYear: WINDOW_START_YEAR })}</p>
      <ReadingsKey f={f} methodHref={`/${locale}/methodology#readings`} />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOPICS.map((topic) => (
          <TopicCard key={topic} topic={topic} card={DASHBOARD[topic][0]} locale={locale} f={f} />
        ))}
      </div>
    </>
  );
}
