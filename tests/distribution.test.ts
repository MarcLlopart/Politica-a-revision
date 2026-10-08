import { describe, expect, it } from "vitest";
import { mean, modalRange, quantile, regroup, shareAbove, type Bracket } from "../lib/distribution";

// 100 people: 50 in [0, 1000), 40 in [1000, 2000) with mean 1500 (= midpoint, so the fitted
// power law is flat), 10 above 2000 with mean 4000.
const B: Bracket[] = [
  { lower: 0, upper: 1000, count: 50, amount: 25_000 },
  { lower: 1000, upper: 2000, count: 40, amount: 60_000 },
  { lower: 2000, upper: null, count: 10, amount: 40_000 },
];

describe("quantile", () => {
  it("interpolates linearly when a bracket's amount cannot shape it", () => {
    expect(quantile(B, 0.5)).toEqual({ value: 1000, method: "linear" });
    expect(quantile(B, 0.25).value).toBeCloseTo(500, 9);
  });

  it("matches the bracket mean with a power law (flat when the mean is the midpoint)", () => {
    const q = quantile(B, 0.7);
    expect(q.method).toBe("pareto");
    expect(q.value).toBeCloseTo(1500, 3);
  });

  it("puts people near the lower bound when the bracket mean is low", () => {
    // [60k, 150k] with mean 84.5k (AEAT IRPF 2024): the median of the bracket is well below 105k.
    const wide: Bracket[] = [
      { lower: 0, upper: 60_000, count: 0 },
      { lower: 60_000, upper: 150_000, count: 1000, amount: 84_520_000 },
    ];
    const med = quantile(wide, 0.5).value!;
    expect(med).toBeGreaterThan(60_000);
    expect(med).toBeLessThan(84_520);
    // The fitted shape reproduces the bracket mean: integrate numerically.
    let sum = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) sum += quantile(wide, (i + 0.5) / n).value!;
    expect(sum / n).toBeCloseTo(84_520, -1);
  });

  it("fits a Pareto tail in the open top bracket", () => {
    // mean 4000 above L = 2000 → alpha = 2; p99: S = 0.01 = 0.10 (2000/x)^2 → x = 2000·√10
    const p99 = quantile(B, 0.99);
    expect(p99.method).toBe("pareto");
    expect(p99.value).toBeCloseTo(2000 * Math.sqrt(10), 6);
  });

  it("reports only a lower bound when the open bracket has no amount", () => {
    const noAmount = B.map((b) => ({ ...b, amount: undefined }));
    expect(quantile(noAmount, 0.99)).toEqual({ value: null, atLeast: 2000, method: "linear" });
  });
});

describe("shareAbove", () => {
  it("is consistent with quantile", () => {
    expect(shareAbove(B, 1500)).toBeCloseTo(0.3, 6); // half of the 40, plus the 10 at the top
    expect(shareAbove(B, quantile(B, 0.8).value!)).toBeCloseTo(0.2, 6);
    expect(shareAbove(B, 2000 * Math.sqrt(10))).toBeCloseTo(0.01, 9);
    expect(shareAbove(B, 0)).toBe(1);
  });

  it("is unknown inside an open bracket without amount", () => {
    expect(shareAbove(B.map((b) => ({ ...b, amount: undefined })), 3000)).toBeNull();
  });
});

describe("mean and mode", () => {
  it("uses exact amounts or a published mean, never midpoints", () => {
    expect(mean(B)).toEqual({ value: 1250, method: "exact" });
    expect(mean(B, 1234)).toEqual({ value: 1234, method: "published" });
    expect(mean(B.map((b) => ({ ...b, amount: undefined }))).value).toBeNull();
  });

  it("finds the densest range, not the most populated wide bracket", () => {
    const skewed: Bracket[] = [
      { lower: 0, upper: 100, count: 30 }, // 0.3 per unit
      { lower: 100, upper: 1100, count: 60 }, // 0.06 per unit
      { lower: 1100, upper: 1100.01, count: 1 }, // narrow, but only 1 person
    ];
    expect(modalRange(skewed, 100)).toEqual({ lower: 0, upper: 100, share: 30 / 91 });
  });

  it("regroups brackets at display edges", () => {
    expect(regroup(B, [2000]).map((g) => [g.lower, g.upper, g.count])).toEqual([
      [0, 2000, 90],
      [2000, null, 10],
    ]);
  });
});
