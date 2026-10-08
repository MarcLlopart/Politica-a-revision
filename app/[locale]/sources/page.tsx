import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSources } from "@/lib/data";
import { getFormatters } from "@/lib/i18n-server";
import type { Locale } from "@/lib/locales";
import { pageMetadata } from "@/lib/metadata";
import { repoFileUrl } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[locale]/sources">): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: "sourcesPage" });
  return pageMetadata(locale, "/sources", t("title"));
}

/** Every source with its raw file and hash, so any number can be traced to downloaded bytes. */
export default async function SourcesPage({ params }: PageProps<"/[locale]/sources">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const f = await getFormatters(locale);
  const { t } = f;
  const sources = [...getSources().values()].sort((a, b) => a.publisher.localeCompare(b.publisher) || a.id.localeCompare(b.id));
  return (
    <>
      <h1>{t("sourcesPage.title")}</h1>
      <p className="mt-1 max-w-2xl text-[var(--ink-2)]">{t("sourcesPage.intro")}</p>
      <div className="mt-6">
        <table className="data-table stack-table w-full text-xs">
          <thead>
            <tr>
              <th scope="col">{t("sourcesPage.dataset")}</th>
              <th scope="col">{t("sourcesPage.retrieved")}</th>
              <th scope="col">{t("sourcesPage.raw")}</th>
              <th scope="col">{t("sourcesPage.licence")}</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} id={s.id} className="scroll-mt-20 align-top">
                <th scope="row">
                  <a href={s.url} rel="external" className="font-semibold">
                    {s.publisher}, {s.dataset}
                  </a>
                  <br />
                  <span className="text-[var(--ink-2)]">
                    {s.tableId && <>{t("sourcesPage.table")} {s.tableId}</>}
                    {s.seriesCode && <> · {t("sourcesPage.series")} <code>{s.seriesCode}</code></>}
                    {s.notes && <> · {s.notes}</>}
                  </span>
                </th>
                <td data-label={t("sourcesPage.retrieved")} className="whitespace-nowrap">{f.date(s.retrievedAt)}</td>
                <td data-label={t("sourcesPage.raw")}>
                  <a href={repoFileUrl(s.rawPath)} rel="external">
                    <code>{s.rawPath.split("/").slice(-2).join("/")}</code>
                  </a>
                  <br />
                  <code className="text-[var(--ink-2)]" title={s.fileHash}>
                    {s.fileHash.slice(0, 19)}…
                  </code>
                  <br />
                  <a href={s.apiUrl} rel="external">
                    {t("sourcesPage.downloadUrl")}
                  </a>
                </td>
                <td data-label={t("sourcesPage.licence")}>
                  {s.licence}
                  <br />
                  <span className="text-[var(--ink-2)]">{s.attribution}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
