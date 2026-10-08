import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PartyChip } from "@/components/PartyChip";
import { LocaleLink as Link } from "@/components/LocaleLink";
import { getPartiesFile, getProposals } from "@/lib/data";
import { getFormatters } from "@/lib/i18n-server";
import type { Locale } from "@/lib/locales";
import { pageMetadata } from "@/lib/metadata";

export async function generateMetadata({ params }: PageProps<"/[locale]/parties">): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: "parties" });
  return pageMetadata(locale, "/parties", t("title"));
}

export default async function PartiesPage({ params }: PageProps<"/[locale]/parties">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const f = await getFormatters(locale);
  const { election, inclusionRule, orderRule, parties } = getPartiesFile();
  const published = getProposals().filter((p) => p.status === "published");
  return (
    <>
      <h1>{f.t("parties.title")}</h1>
      <div className="mt-2 max-w-2xl space-y-1 text-sm text-[var(--ink-2)]">
        <p>{inclusionRule[locale]}</p>
        <p>{orderRule[locale]}</p>
        <p>
          {f.t("parties.electionSource")}:{" "}
          <a href={election.sourceUrl} rel="external">
            {election.sourceLabel}
          </a>
        </p>
      </div>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {parties.map((p) => {
          const count = published.filter((q) => q.partyId === p.id).length;
          return (
            <li key={p.id}>
              <Link href={`/parties/${p.id}`} className="card h-full">
                <div className="flex items-center justify-between gap-2">
                  <PartyChip party={p} />
                  <span className="text-sm text-[var(--ink-2)] tabular-nums">{f.t("parties.seats", { count: p.seats2023 })}</span>
                </div>
                <p className="mt-2 font-semibold text-[var(--ink)]">{p.name}</p>
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
