// Server-side helpers that bind the pure formatters to the current locale's messages.

import { getTranslations } from "next-intl/server";
import { formatDate, formatNumber, formatPeriod, formatValue, type FormatOptions, type Translate } from "./format";
import type { Locale } from "./locales";
import type { Indicator, Localized, Unit } from "./schema";

export async function getFormatters(locale: Locale) {
  const translations = await getTranslations({ locale });
  const t = translations as unknown as Translate;
  return {
    t,
    /** Message template without interpolation (for client components that fill it in). */
    raw: (key: string) => String(translations.raw(key as never)),
    value: (v: number, unit: Unit, opts: FormatOptions) => formatValue(v, unit, locale, t, opts),
    number: (v: number, unit: Unit, opts: FormatOptions) => formatNumber(v, unit, locale, opts),
    period: (p: string) => formatPeriod(p, locale, t),
    /** Period label for an indicator; stocks read "1 Jul 2026" rather than "Q3 2026". */
    periodOf: (x: { periodRef: "period" | "start" }, p: string) => formatPeriod(p, locale, t, x.periodRef),
    date: (d: string) => formatDate(d, locale),
    /** Formats an indicator value at its own precision. */
    indicator: (ind: Indicator, v: number, compact = false) =>
      formatValue(v, ind.unit, locale, t, { decimals: compact ? Math.min(ind.decimals, 1) : ind.decimals, compact }),
    /** Number and unit wording separately, so headlines can set the unit smaller ("37.3%" + "of GDP"). */
    indicatorParts: (ind: Indicator, v: number) => ({
      // Same precision as the published value; only millions are compacted ("22.8M").
      number: formatNumber(v, ind.unit, locale, { decimals: Math.abs(v) >= 1e6 ? 0 : ind.decimals, compact: true }),
      suffix: t(`units.${ind.unit}`, { value: "" }).trim(),
    }),
    localized: (l: Localized) => l[locale],
  };
}

export type Formatters = Awaited<ReturnType<typeof getFormatters>>;
