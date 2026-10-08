import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LocaleLink as Link } from "@/components/LocaleLink";
import { getProposals } from "@/lib/data";
import { getFormatters } from "@/lib/i18n-server";
import type { Locale } from "@/lib/locales";
import { pageMetadata } from "@/lib/metadata";
import { TOPICS } from "@/lib/topics";

export async function generateMetadata({ params }: PageProps<"/[locale]/compare">): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: "compare" });
  return pageMetadata(locale, "/compare", t("title"));
}

export default async function ComparePage({ params }: PageProps<"/[locale]/compare">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const f = await getFormatters(locale);
  const published = getProposals().filter((p) => p.status === "published");
  return (
    <>
      <h1>{f.t("compare.title")}</h1>
      <p className="mt-1 max-w-2xl text-[var(--ink-2)]">{f.t("compare.intro")}</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOPICS.map((topic) => {
          const count = published.filter((p) => p.topic.includes(topic)).length;
          return (
            <li key={topic}>
              <Link href={`/compare/${topic}`} className="card h-full">
                <p className="font-semibold text-[var(--ink)]">{f.t(`topics.${topic}`)}</p>
                <p className="mt-1 text-sm text-[var(--ink-2)]">
                  {count > 0 ? f.t("parties.proposalCount", { count }) : f.t("parties.proposalsNotYet")}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
