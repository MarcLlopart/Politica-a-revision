// Values published by October 2026 that the owner listed in the brief (§4).
// They are historical figures, so they should keep matching after weekly refreshes
// unless the publisher revises them, in which case the test flags the revision.

import { describe, expect, it } from "vitest";
import { getDistribution, getIndicator } from "../lib/data";
import { shareAbove } from "../lib/distribution";

function value(id: string, period: string): number {
  const o = getIndicator(id).observations.find((x) => x.period === period);
  if (!o) throw new Error(`${id} has no value for ${period}`);
  return o.value;
}

describe("sanity values from the brief", () => {
  it("EPA Q2 2026 unemployment rate is 9.87%", () => {
    expect(value("unemployment-rate", "2026-Q2")).toBe(9.87);
  });

  it("EPA Q2 2026 employed is 22,779,000", () => {
    expect(value("employed", "2026-Q2")).toBe(22_779_000);
  });

  it("average Social Security affiliates in July 2026 is 22,508,065", () => {
    expect(value("ss-affiliates", "2026-07")).toBe(22_508_065);
  });

  it("contributory pensions on 1 September 2026 are 10,547,417", () => {
    expect(value("pensions-count", "2026-09")).toBe(10_547_417);
  });

  it("monthly pension payroll in September 2026 is €14,498.2M", () => {
    expect(value("pension-payroll", "2026-09") / 1e6).toBeCloseTo(14_498.2, 1);
  });

  it("average retirement pension in September 2026 is €1,576.1", () => {
    expect(value("pension-average-retirement", "2026-09")).toBeCloseTo(1576.1, 1);
  });

  it("INE median gross salary 2024 is €24,497.17", () => {
    expect(value("median-salary", "2024")).toBe(24_497.17);
  });

  it("population aged 65+ in INE's 2026 projection base year is 21.1%", () => {
    expect(value("projected-share-65-plus", "2026")).toBeCloseTo(21.1, 1);
  });
});

describe("internal consistency", () => {
  it("natural change equals births minus deaths", () => {
    const nc = getIndicator("natural-change");
    for (const o of nc.observations) {
      expect(o.value).toBe(value("births", o.period) - value("deaths", o.period));
    }
  });

  it("final MNP natural change for 2024 matches INE (-118,113)", () => {
    expect(value("natural-change", "2024")).toBe(-118_113);
  });

  it("dwellings completed in 2025 match the published annual total (88,254)", () => {
    expect(value("dwellings-completed", "2025")).toBe(88_254);
  });

  it("foreign affiliates in July 2026 match the published figure (3,512,223)", () => {
    expect(value("foreign-affiliates", "2026-07")).toBe(3_512_223);
  });

  it("median retirement pension on 1 September 2026 is €1,284.78 (bracket interpolation)", () => {
    expect(value("pension-median-retirement", "2026-09")).toBeCloseTo(1284.78, 2);
  });
});

describe("distributions (published figures they must reproduce)", () => {
  const last = (id: string) => {
    const d = getDistribution(id);
    return d.periods.find((p) => p.period === "2024")!;
  };

  it("IRPF 2024: 24,628,279 returns; 6.43% above €60,101 and 0.87% above €150,253", () => {
    const p = last("irpf-income");
    expect(p.total).toBe(24_628_279);
    expect(shareAbove(p.brackets, 60_101.21)).toBeCloseTo(0.0643, 4);
    expect(shareAbove(p.brackets, 150_253.03)).toBeCloseTo(0.0087, 4);
  });

  it("AEAT wages 2024: mean €24,962 as published", () => {
    expect(last("wage-earners").stats.mean.value).toBeCloseTo(24_962, 0);
  });

  it("AEAT pensioners 2024: 9,805,311 people, mean €19,720 as published", () => {
    const p = last("pensioners");
    expect(p.total).toBe(9_805_311);
    expect(p.stats.mean.value).toBeCloseTo(19_720, -1);
  });

  it("wealth tax 2024: 227,424 filers", () => {
    expect(last("wealth-tax-filers").total).toBe(227_424);
  });

  it("published percentiles: INE wage P90 2024, Eurostat income P99 2025, Banco de España wealth median 2024", () => {
    expect(value("wage-p90", "2024")).toBe(52_515.27);
    expect(value("household-income-p99", "2025")).toBe(68_318);
    expect(value("household-wealth-p50", "2024")).toBeCloseTo(160_829.2, 1);
  });
});

describe("job quality (EPA and Eurostat)", () => {
  it("occupation groups add up to total employment (Q2 2026: 22,779,000)", () => {
    const groups = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
    const sum = groups.reduce((s, g) => s + value(`employed-occupation-${g}`, "2026-Q2"), 0);
    expect(Math.abs(sum - value("employed", "2026-Q2"))).toBeLessThanOrEqual(200); // INE rounds each group to hundreds
  });

  it("professionals (group 2) Q2 2026: 4,677,400; Eurostat over-qualification Spain 2025: 34.0%", () => {
    expect(value("employed-occupation-2", "2026-Q2")).toBe(4_677_400);
    expect(value("overqualification-es", "2025")).toBe(34);
  });
});

describe("salaries", () => {
  it("minimum wage per BOE decree matches the published amounts (2016–2026)", () => {
    const expected: Record<string, number> = { "2016": 655.2, "2017": 707.7, "2018": 735.9, "2019": 900, "2020": 950, "2021": 965, "2022": 1000, "2023": 1080, "2024": 1134, "2025": 1184, "2026": 1221 };
    for (const [year, amount] of Object.entries(expected)) expect(value("minimum-wage-monthly", year)).toBe(amount);
  });

  it("AEAT 2024 mean wage: men €27,411, women €22,255; INE 2024 median in 2025 euros €25,152", () => {
    expect(value("wage-earners-men-mean", "2024")).toBeCloseTo(27_411, -1);
    expect(value("wage-earners-women-mean", "2024")).toBeCloseTo(22_255, -1);
    expect(value("wage-p50-real", "2024")).toBeCloseTo(25_151.87, 1);
  });
});
