import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LocaleLink as Link } from "@/components/LocaleLink";
import type { Locale } from "@/lib/locales";
import { pageMetadata } from "@/lib/metadata";
import { SITE } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: "about" });
  return pageMetadata(locale, "/about", t("title"));
}

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "about" });
  return (
    <div className="max-w-2xl">
      <h1>{t("title")}</h1>
      <div className="prose-block mt-3">
        <p>{t("p1", { name: SITE.name })}</p>
        <p>{t("p2")}</p>
      </div>
      <h2 className="mt-6">{t("funding.title")}</h2>
      <p className="mt-2">{t("funding.body")}</p>
      <h2 className="mt-6">{t("principles.title")}</h2>
      <ul className="prose-block mt-2">
        <li>{t("principles.sameRubric")}</li>
        <li>{t("principles.blind")}</li>
        <li>{t("principles.noCausal")}</li>
        <li>{t("principles.traceable")}</li>
        <li>{t("principles.corrections")}</li>
      </ul>
      <p className="mt-2">
        <Link href="/methodology">{t("readMethodology")}</Link>
      </p>
      <h2 className="mt-6">{t("open.title")}</h2>
      <div className="prose-block mt-2">
        <p>{t("open.licences")}</p>
        <p>
          {t("open.contact")}{" "}
          <a href={`${SITE.repoUrl}/issues`} rel="external">
            GitHub
          </a>
        </p>
      </div>
      <h2 className="mt-6">{t("privacy.title")}</h2>
      <p className="mt-2">{t("privacy.body")}</p>
    </div>
  );
}
