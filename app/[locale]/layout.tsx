import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NavLinks, type NavItem } from "@/components/NavLinks";
import { SiteFooter } from "@/components/SiteFooter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LocaleLink as Link } from "@/components/LocaleLink";
import { routing } from "@/i18n/routing";
import { SITE } from "@/lib/site";
import { THEME_SCRIPT } from "@/lib/theme";
import "../globals.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(SITE.url),
    title: { default: `${SITE.name} · ${t("title")}`, template: `%s · ${SITE.name}` },
    description: t("description"),
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "nav" });
  const items: NavItem[] = [
    { href: "/", label: t("spain"), icon: "spain" },
    { href: "/parties", label: t("parties"), icon: "parties" },
    { href: "/compare", label: t("compare"), icon: "compare" },
    { href: "/about", label: t("about"), icon: "about" },
  ];

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <a href="#main" className="skip-link">
          {t("skipToContent")}
        </a>
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--page)]/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4">
            <Link href="/" className="truncate font-bold text-[var(--ink)] no-underline">
              {SITE.name}
            </Link>
            <NavLinks items={items} label={t("main")} variant="top" locale={locale} />
            <div className="flex shrink-0 items-center gap-1">
              <LanguageSwitcher label={t("language")} current={locale} />
              <ThemeToggle label={t("themeToggle")} />
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 pt-6 pb-12">
          {children}
        </main>
        <SiteFooter locale={locale} />
        <NavLinks items={items} label={t("main")} variant="bottom" locale={locale} />
      </body>
    </html>
  );
}
