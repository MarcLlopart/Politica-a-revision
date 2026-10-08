// Locale-aware number and period formatting. Pure functions: no React, no Next.
// Words (unit suffixes, quarter labels) come from the message files via `t`.

import { INTL_LOCALE, type Locale } from "./locales";
import type { Unit } from "./schema";

const cache = new Map<string, Intl.NumberFormat>();

function numberFormat(locale: Locale, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = cache.get(key);
  if (!f) {
    // "always" so Spanish shows 1.234,5 (CLDR would otherwise skip grouping for 4-digit numbers).
    f = new Intl.NumberFormat(INTL_LOCALE[locale], { useGrouping: "always", ...options });
    cache.set(key, f);
  }
  return f;
}

/**
 * Thousands of millions in Spanish and Catalan as "mM" ("725 mM €"), the press convention,
 * instead of CLDR's "mil M" (es) or "kM" (ca). English keeps "bn".
 */
function thousandMillions(value: number, locale: Locale, signDisplay: "auto" | "exceptZero", suffix: string): string {
  const n = numberFormat(locale, { maximumFractionDigits: 1, signDisplay }).format(value / 1e9);
  return `${n}\u00a0mM${suffix.replace(" ", "\u00a0")}`;
}

export type FormatOptions = { decimals: number; compact?: boolean; signed?: boolean };

/** Formats the numeric part of a value; percent and euro units include their symbol. */
export function formatNumber(value: number, unit: Unit, locale: Locale, opts: FormatOptions): string {
  const digits = { minimumFractionDigits: opts.decimals, maximumFractionDigits: opts.decimals };
  const signDisplay = opts.signed || unit === "percent_change" ? ("exceptZero" as const) : ("auto" as const);
  switch (unit) {
    case "percent":
    case "percent_change":
    case "percent_gdp":
      return numberFormat(locale, { style: "percent", signDisplay, ...digits }).format(value / 100);
    case "eur":
      if (opts.compact && Math.abs(value) >= 1e9 && locale !== "en") return thousandMillions(value, locale, signDisplay, " €");
      if (opts.compact && Math.abs(value) >= 1e6) {
        return numberFormat(locale, {
          style: "currency",
          currency: "EUR",
          notation: "compact",
          maximumFractionDigits: 1,
          signDisplay,
        }).format(value);
      }
      return numberFormat(locale, { style: "currency", currency: "EUR", signDisplay, ...digits }).format(value);
    default:
      if (opts.compact && Math.abs(value) >= 1e9 && locale !== "en") return thousandMillions(value, locale, signDisplay, "");
      if (opts.compact && Math.abs(value) >= 1e6) {
        return numberFormat(locale, { notation: "compact", maximumFractionDigits: 1, signDisplay }).format(value);
      }
      return numberFormat(locale, { signDisplay, ...digits }).format(value);
  }
}

export type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Adds the localized unit wording, e.g. "105.2% of GDP" or "83.1 years". */
export function formatValue(
  value: number,
  unit: Unit,
  locale: Locale,
  t: Translate,
  opts: FormatOptions,
): string {
  return t(`units.${unit}`, { value: formatNumber(value, unit, locale, opts) });
}

export type ParsedPeriod = { year: number; quarter?: number; month?: number };

export function parsePeriod(period: string): ParsedPeriod {
  const [y, rest] = period.split("-");
  const year = Number(y);
  if (!rest) return { year };
  if (rest.startsWith("Q")) return { year, quarter: Number(rest.slice(1)) };
  return { year, month: Number(rest) };
}

/** Start of the period as a UTC date; used as the x position in charts. */
export function periodStart(period: string): Date {
  const p = parsePeriod(period);
  const month = p.month ? p.month - 1 : p.quarter ? (p.quarter - 1) * 3 : 0;
  return new Date(Date.UTC(p.year, month, 1));
}

/** Middle of the period as a fractional year, e.g. 2024-Q1 → 2024.125. */
export function periodMidYear(period: string): number {
  const p = parsePeriod(period);
  if (p.month) return p.year + (p.month - 0.5) / 12;
  if (p.quarter) return p.year + (p.quarter - 0.5) / 4;
  return p.year + 0.5;
}

export function formatPeriod(period: string, locale: Locale, t: Translate, ref: "period" | "start" = "period"): string {
  if (ref === "start") return formatDate(periodStart(period).toISOString().slice(0, 10), locale);
  const p = parsePeriod(period);
  if (p.quarter) return t("format.quarter", { quarter: p.quarter, year: p.year });
  if (p.month) {
    return new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: "short", year: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(p.year, p.month - 1, 1)),
    );
  }
  return String(p.year);
}

export function formatDate(isoDate: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}
