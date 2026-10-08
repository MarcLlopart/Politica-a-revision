import { describe, expect, it } from "vitest";
import { getIndicator, getIndicators } from "../lib/data";
import { DASHBOARD } from "../lib/dashboard";
import { cpiRatio, IN_LINE_BAND, READING_RULES, readingsFor, rulesOf, toneOf, topicTally } from "../lib/readings";

describe("reading rules", () => {
  it("refer to indicators shown on a topic page", () => {
    const shown = new Set(Object.values(DASHBOARD).flatMap((cards) => cards.flatMap((c) => c.indicators)));
    for (const id of Object.keys(READING_RULES)) {
      expect(getIndicators().has(id), id).toBe(true);
      expect(shown.has(id), id).toBe(true);
    }
  });

  it("compare prices and incomes only when they are in euros, index points or growth rates", () => {
    for (const id of Object.keys(READING_RULES)) {
      for (const rule of rulesOf(id)) if (rule.kind === "vsCpi") expect(["eur", "index", "percent_change"], id).toContain(getIndicator(id).unit);
    }
  });

  it("give every ruled indicator at least one reading", () => {
    for (const id of Object.keys(READING_RULES)) expect(readingsFor(getIndicator(id)).length, id).toBeGreaterThan(0);
  });
});

describe("CPI comparison", () => {
  it("matches INE's published annual-average inflation", () => {
    const annual = getIndicator("cpi-inflation-annual");
    for (const o of annual.observations.filter((x) => Number(x.period) >= 2018)) {
      const r = cpiRatio(String(Number(o.period) - 1), o.period)!;
      expect((r.ratio - 1) * 100).toBeCloseTo(o.value, 0);
    }
  });

  it("computes real change as nominal deflated by the CPI over the same span", () => {
    const wage = getIndicator("wage-p50");
    const r = readingsFor(wage).find((x) => x.kind === "vsCpiLevel" && x.from === "2018");
    expect(r?.kind).toBe("vsCpiLevel");
    if (r?.kind !== "vsCpiLevel") return;
    const v = (p: string) => wage.observations.find((o) => o.period === p)!.value;
    const cpi = (p: string) => getIndicator("cpi-index-annual").observations.find((o) => o.period === p)!.value;
    expect(r.nominal).toBeCloseTo((v(r.to) / v("2018") - 1) * 100, 6);
    expect(r.real).toBeCloseTo(((v(r.to) / v("2018")) / (cpi(r.to) / cpi("2018")) - 1) * 100, 6);
  });

  it("marks house prices rising faster than the CPI as unfavourable and wages doing so as favourable", () => {
    const better = (id: string) => (rulesOf(id)[0] as { better: "up" | "down" }).better;
    expect(toneOf(9, better("house-prices"), IN_LINE_BAND)).toBe("unfavourable");
    expect(toneOf(2, better("wage-p50"), IN_LINE_BAND)).toBe("favourable");
    expect(toneOf(0.3, better("wage-p50"), IN_LINE_BAND)).toBe("neutral");
  });
});

describe("topic tallies", () => {
  it("count debt as well as the deficit for public finances", () => {
    const t = topicTally("public-finances");
    expect(t.favourable + t.unfavourable + t.neutral).toBe(4);
    expect(t.unfavourable).toBeGreaterThanOrEqual(1);
  });

  it("give unrated indicators a direction but no rating", () => {
    const [r] = readingsFor(getIndicator("spending-total-gdp"), true);
    expect(r).toMatchObject({ kind: "change", rated: false, tone: "neutral" });
  });
});
