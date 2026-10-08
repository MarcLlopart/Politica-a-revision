// Locale constants shared by the app, the data schemas and the pipeline.
// Kept free of Next.js imports so the pipeline can use it from plain Node.

export const LOCALES = ["es", "en", "ca"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";

/** BCP 47 tags used for Intl number/date formatting. */
export const INTL_LOCALE: Record<Locale, string> = {
  es: "es-ES",
  en: "en-GB",
  ca: "ca-ES",
};

/** Endonyms shown in the language switcher. */
export const LOCALE_NAMES: Record<Locale, string> = {
  es: "Español",
  en: "English",
  ca: "Català",
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
