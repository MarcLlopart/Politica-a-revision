import { describe, expect, it } from "vitest";
import { decemberAsAnnual, splice } from "../pipeline/lib/define";
import { annualSums, rolling12, ssBracketMedian } from "../pipeline/lib/parsers";
import type { Point } from "../pipeline/lib/sources";

const p = (period: string, value: number): Point => ({ period, value, status: "final" });

describe("splice", () => {
  it("keeps final years and marks later years as provisional from the extension", () => {
    const out = splice([p("2023", 1), p("2024", 2)], [p("2024", 99), p("2025", 3)]);
    expect(out).toEqual([
      { period: "2023", value: 1, status: "final", from: 0 },
      { period: "2024", value: 2, status: "final", from: 0 },
      { period: "2025", value: 3, status: "provisional", from: 1 },
    ]);
  });

  it("turns December year-to-date values into annual totals", () => {
    expect(decemberAsAnnual([p("2025-11", 10), p("2025-12", 12), p("2026-07", 7)])).toEqual([p("2025", 12)]);
  });
});

describe("monthly aggregation", () => {
  const months = Array.from({ length: 14 }, (_, i) => {
    const y = 2024 + Math.floor(i / 12);
    return p(`${y}-${String((i % 12) + 1).padStart(2, "0")}`, 1);
  });

  it("sums complete years only", () => {
    expect(annualSums(months)).toEqual([p("2024", 12)]);
  });

  it("builds 12-month rolling sums from the 12th month", () => {
    const r = rolling12(months);
    expect(r.map((x) => x.period)).toEqual(["2024-12", "2025-01", "2025-02"]);
    expect(r.every((x) => x.value === 12)).toBe(true);
  });

  it("skips windows with a gap", () => {
    const gappy = months.filter((m) => m.period !== "2024-06");
    expect(rolling12(gappy)).toEqual([]);
  });
});

describe("median from amount brackets", () => {
  const rows = [
    ["PENSIONES EN VIGOR A 1 DE SEPTIEMBRE DE 2026"],
    [null, "Total pensiones", null, "Jubilación"],
    ["Total", 100, null, 100],
    ["Hasta 500,00 euros", 0, null, 20],
    ["De 500,01 a 1.000,00", 0, null, 40],
    ["Más de 1.000,00", 0, null, 40],
  ];

  it("interpolates inside the bracket holding the middle pension", () => {
    // N/2 = 50; 20 below the bracket; 30 of 40 into [500.01, 1000] → 500.01 + 0.75 × 499.99
    const m = ssBracketMedian(rows, "Jubilación");
    expect(m.value).toBeCloseTo(500.01 + 0.75 * 499.99, 6);
    expect(m.bracket).toBe("De 500,01 a 1.000,00");
  });

  it("fails if bracket counts do not add up to the total", () => {
    const broken = rows.map((r) => (r[0] === "Total" ? ["Total", 100, null, 101] : r));
    expect(() => ssBracketMedian(broken, "Jubilación")).toThrow(/do not add up/);
  });
});
