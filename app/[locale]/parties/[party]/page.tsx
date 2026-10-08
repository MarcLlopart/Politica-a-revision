import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { PartyChip } from "@/components/PartyChip";
import { PartyMenu } from "@/components/PartyMenu";
import { getPartiesFile, getProposals } from "@/lib/data";
import { getFormatters } from "@/lib/i18n-server";
import { LOCALES, type Locale } from "@/lib/locales";
import { pageMetadata } from "@/lib/metadata";
import { repoFileUrl, reportErrorUrl, SITE } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => getPartiesFile().parties.map((p) => ({ locale, party: p.id })));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/parties/[party]">): Promise<Metadata> {
  const { locale, party } = (await params) as { locale: Locale; party: string };
  const p = getPartiesFile().parties.find((x) => x.id === party);
  return pageMetadata(locale, `/parties/${party}`, p ? `${p.acronym} · ${p.name}` : party);
}

export default async function PartyPage({ params }: PageProps<"/[locale]/parties/[party]">) {
  const { locale, party: partyId } = (await params) as { locale: Locale; party: string };
  const party = getPartiesFile().parties.find((p) => p.id === partyId);
  if (!party) notFound();
  setRequestLocale(locale);
  const f = await getFormatters(locale);
  const { t } = f;
  const proposals = getProposals().filter((p) => p.partyId === party.id && p.status === "published");

  return (
    <div className="grid gap-6 sm:grid-cols-[16rem_1fr]">
      <aside className="sm:sticky sm:top-20 sm:self-start">
        <PartyMenu currentId={party.id} f={f} />
      </aside>
      <div className="min-w-0">
        <header>
          <PartyChip party={party} />
          <h1 className="mt-2">{party.name}</h1>
          <p className="mt-1 text-sm text-[var(--ink-2)]">
            {t("parties.seats", { count: party.seats2023 })} · {t("parties.ballotNames")}: {party.ballotNames.join(" · ")}
          </p>
          {party.notes && <p className="mt-2 max-w-2xl text-sm">{party.notes[locale]}</p>}
        </header>

        <section className="mt-6" aria-labelledby="program">
          <h2 id="program">{t("parties.program")}</h2>
          {party.programEditions.map((ed) => (
            <div key={ed.edition} className="card mt-2 text-sm">
              <p className="font-semibold">{t("parties.edition", { date: f.date(ed.electionDate) })}</p>
              {ed.status === "archived" ? (
                <p className="mt-1 text-[var(--ink-2)]">
                  {t("parties.programArchived", { date: f.date(ed.retrievedAt!) })}
                  {ed.url && (
                    <>
                      {" · "}
                      <a href={ed.url} rel="external">
                        {t("parties.original")}
                      </a>
                    </>
                  )}
                  {ed.waybackUrl && (
                    <>
                      {" · "}
                      <a href={ed.waybackUrl} rel="external">
                        {t("parties.wayback")}
                      </a>
                    </>
                  )}
                  {ed.localPath && (
                    <>
                      {" · "}
                      <a href={repoFileUrl(ed.localPath)} rel="external" title={ed.fileHash}>
                        {t("parties.archivedCopy")}
                      </a>
                    </>
                  )}
                </p>
              ) : (
                <p className="mt-1 text-[var(--ink-2)]">{t("parties.programPending")}</p>
              )}
            </div>
          ))}
        </section>

        <section className="mt-6" aria-labelledby="proposals">
          <h2 id="proposals">{t("parties.proposals")}</h2>
          {proposals.length === 0 ? (
            <p className="card mt-2 text-sm text-[var(--ink-2)]">{t("parties.proposalsPending")}</p>
          ) : (
            <ul className="mt-2 space-y-3">
              {proposals.map((p) => (
                <li key={p.id} className="card text-sm">
                  <blockquote lang={p.quote.lang} className="border-l-2 border-[var(--border)] pl-3">
                    {p.quote.text}
                  </blockquote>
                  <p className="mt-1 text-xs text-[var(--ink-2)]">{t("parties.page", { page: p.quote.page })}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-6 text-xs">
          <a href={reportErrorUrl(`Party: ${party.id}`, `${SITE.url}/${locale}/parties/${party.id}`)} rel="external">
            {t("source.reportError")}
          </a>
        </p>
      </div>
    </div>
  );
}
