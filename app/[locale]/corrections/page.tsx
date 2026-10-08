import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCorrections } from "@/lib/data";
import { getFormatters } from "@/lib/i18n-server";
import type { Locale } from "@/lib/locales";
import { pageMetadata } from "@/lib/metadata";
import { SITE } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[locale]/corrections">): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: "corrections" });
  return pageMetadata(locale, "/corrections", t("title"));
}

export default async function CorrectionsPage({ params }: PageProps<"/[locale]/corrections">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const f = await getFormatters(locale);
  const { t } = f;
  const corrections = getCorrections();
  return (
    <>
      <h1>{t("corrections.title")}</h1>
      <p className="mt-1 max-w-2xl text-[var(--ink-2)]">{t("corrections.intro")}</p>
      <p className="mt-2 text-sm">
        <a href={`${SITE.repoUrl}/issues/new?template=report-error.yml`} rel="external">
          {t("source.reportError")}
        </a>
        {" · "}
        <a href={`${SITE.repoUrl}/commits/main/data`} rel="external">
          {t("corrections.history")}
        </a>
      </p>
      {corrections.length === 0 ? (
        <p className="card mt-6 text-sm text-[var(--ink-2)]">{t("corrections.none")}</p>
      ) : (
        <ol className="mt-6 space-y-3">
          {corrections.map((c, i) => (
            <li key={i} className="card text-sm">
              <p className="text-xs text-[var(--ink-2)]">
                {f.date(c.date)} · {t(`corrections.scope.${c.scope}`)}
                {c.ids.length > 0 && <> · <code>{c.ids.join(", ")}</code></>}
                {c.commit && (
                  <>
                    {" · "}
                    <a href={`${SITE.repoUrl}/commit/${c.commit}`} rel="external">
                      {c.commit.slice(0, 7)}
                    </a>
                  </>
                )}
              </p>
              <p className="mt-1">
                <span className="font-semibold">{t("corrections.what")}:</span> {c.what[locale]}
              </p>
              <p className="mt-1">
                <span className="font-semibold">{t("corrections.why")}:</span> {c.why[locale]}
              </p>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
