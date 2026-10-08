import type { Metadata } from "next";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./locales";

/** Canonical URL plus hreflang alternates for every launch locale. */
export function pageMetadata(locale: Locale, path: string, title: string, description?: string): Metadata {
  const languages: Record<string, string> = Object.fromEntries(LOCALES.map((l) => [l, `/${l}${path}`]));
  languages["x-default"] = `/${DEFAULT_LOCALE}${path}`;
  // Without a page description, the layout's site description is inherited.
  return {
    title,
    ...(description ? { description } : {}),
    alternates: { canonical: `/${locale}${path}`, languages },
    openGraph: { title, ...(description ? { description } : {}), locale, type: "website" },
  };
}
