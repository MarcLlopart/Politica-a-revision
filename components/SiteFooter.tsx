import { getTranslations } from "next-intl/server";
import { LocaleLink as Link } from "@/components/LocaleLink";
import type { Locale } from "@/lib/locales";
import { COMMIT, SITE } from "@/lib/site";

export async function SiteFooter({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "footer" });
  const nav = await getTranslations({ locale, namespace: "nav" });
  return (
    <footer className="border-t border-[var(--border)] pb-24 sm:pb-0">
      <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-sm text-[var(--ink-2)]">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          <li>
            <Link href="/methodology">{nav("methodology")}</Link>
          </li>
          <li>
            <Link href="/sources">{nav("sources")}</Link>
          </li>
          <li>
            <Link href="/corrections">{nav("corrections")}</Link>
          </li>
          <li>
            <Link href="/about">{nav("about")}</Link>
          </li>
          <li>
            <a href={SITE.repoUrl} rel="external">
              {t("code")}
            </a>
          </li>
        </ul>
        <p>{t("neutrality")}</p>
        <p>{t("licence")}</p>
        <p className="text-xs">{t("build", { commit: COMMIT.slice(0, 7) })}</p>
      </div>
    </footer>
  );
}
