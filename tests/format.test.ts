import { describe, expect, it } from "vitest";
import { formatNumber, formatPeriod, periodStart, type Translate } from "../lib/format";

const t: Translate = (key, values) => (key === "format.quarter" ? `Q${values?.quarter} ${values?.year}` : key);

// Intl inserts narrow/no-break spaces; normalise them for readable assertions.
const plain = (s: string) => s.replace(/[  ]/g, " ");

describe("formatNumber", () => {
  it("groups thousands in Spanish even for four-digit numbers", () => {
    expect(plain(formatNumber(1234.5, "eur", "es", { decimals: 1 }))).toBe("1.234,5 €");
  });

  it("uses English conventions for en", () => {
    expect(formatNumber(1234.5, "eur", "en", { decimals: 1 })).toBe("€1,234.5");
  });

  it("formats percentages from percent values", () => {
    expect(plain(formatNumber(9.87, "percent", "es", { decimals: 2 }))).toBe("9,87 %");
    expect(formatNumber(9.87, "percent", "en", { decimals: 2 })).toBe("9.87%");
  });

  it("signs growth rates", () => {
    expect(formatNumber(2.6, "percent_change", "en", { decimals: 1 })).toBe("+2.6%");
    expect(formatNumber(-0.4, "percent_change", "en", { decimals: 1 })).toBe("-0.4%");
  });

  it("compacts large counts when asked", () => {
    // en-GB follows British style ("22.8m").
    expect(formatNumber(22_779_000, "persons", "en", { decimals: 0, compact: true })).toBe("22.8m");
    expect(plain(formatNumber(22_779_000, "persons", "es", { decimals: 0, compact: true }))).toBe("22,8 M");
  });

  it("writes thousands of millions as mM in Spanish and Catalan, bn in English", () => {
    expect(plain(formatNumber(725e9, "eur", "es", { decimals: 0, compact: true }))).toBe("725 mM €");
    expect(plain(formatNumber(14.53e9, "eur", "ca", { decimals: 0, compact: true }))).toBe("14,5 mM €");
    expect(plain(formatNumber(-3.2e9, "eur", "es", { decimals: 0, compact: true, signed: true }))).toBe("-3,2 mM €");
    expect(formatNumber(725e9, "eur", "en", { decimals: 0, compact: true })).toBe("€725bn");
    expect(plain(formatNumber(3.4e6, "eur", "es", { decimals: 0, compact: true }))).toBe("3,4 M €");
  });
});

describe("periods", () => {
  it("labels quarters through messages and months through Intl", () => {
    expect(formatPeriod("2026-Q2", "en", t)).toBe("Q2 2026");
    expect(formatPeriod("2024", "en", t)).toBe("2024");
    expect(formatPeriod("2026-09", "en", t)).toBe("Sept 2026");
  });

  it("labels stocks by their reference date", () => {
    expect(formatPeriod("2026-Q3", "en", t, "start")).toBe("1 Jul 2026");
  });

  it("maps periods to their first day", () => {
    expect(periodStart("2026-Q3").toISOString().slice(0, 10)).toBe("2026-07-01");
    expect(periodStart("2026-09").toISOString().slice(0, 10)).toBe("2026-09-01");
  });
});
