import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PartyChip } from "@/components/PartyChip";
import { LocaleLink as Link } from "@/components/LocaleLink";
import { getPartiesFile, getProposals } from "@/lib/data";
import { getFormatters } from "@/lib/i18n-server";
import { LOCALES, type Locale } from "@/lib/locales";
import { pageMetadata } from "@/lib/metadata";
import { isTopic, TOPICS } from "@/lib/topics";

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => TOPICS.map((topic) => ({ locale, topic })));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/compare/[topic]">): Promise<Metadata> {
  const { locale, topic } = (await params) as { locale: Locale; topic: string };
  const t = await getTranslations({ locale });
  return pageMetadata(locale, `/compare/${topic}`, `${t("compare.title")}: ${t(`topics.${topic}`)}`);
}

/** Every party's published proposals for one topic, side by side, in the stated party order. */
export default async function CompareTopicPage({ params }: PageProps<"/[locale]/compare/[topic]">) {
  const { locale, topic } = (await params) as { locale: Locale; topic: string };
  if (!isTopic(topic)) notFound();
  setRequestLocale(locale);
  const f = await getFormatters(locale);
  const { parties } = getPartiesFile();
  const proposals = getProposals().filter((p) => p.status === "published" && p.topic.includes(topic));
  return (
    <>
      <p className="text-sm">
        <Link href="/compare">← {f.t("compare.title")}</Link>
      </p>
      <h1 className="mt-2">{f.t(`topics.${topic}`)}</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--ink-2)]">{f.t("compare.topicIntro")}</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {parties.map((party) => {
          const own = proposals.filter((p) => p.partyId === party.id);
          return (
            <section key={party.id} className="card" aria-label={party.name}>
              <h2 className="flex items-center gap-2">
                <PartyChip party={party} />
                <span className="truncate text-sm font-semibold">{party.name}</span>
              </h2>
              {own.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--ink-2)]">{f.t("compare.none")}</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {own.map((p) => (
                    <li key={p.id}>
                      <Link href={`/parties/${party.id}#${p.id}`}>{p.translation?.[locale] ?? p.quote.text}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
