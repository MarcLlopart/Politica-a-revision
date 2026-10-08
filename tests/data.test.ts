import { describe, expect, it } from "vitest";
import { getIndicators, getPartiesFile, getSources } from "../lib/data";
import { validateData } from "../scripts/validate-data";

describe("data files", () => {
  it("pass build validation", () => {
    expect(validateData()).toEqual([]);
  });

  it("give every observation a source", () => {
    const sources = getSources();
    for (const ind of getIndicators().values()) {
      for (const o of ind.observations) expect(sources.has(o.sourceId), `${ind.id} ${o.period}`).toBe(true);
    }
  });

  it("order parties by seats, then alphabetically", () => {
    const parties = getPartiesFile().parties;
    for (let i = 1; i < parties.length; i++) {
      const [a, b] = [parties[i - 1], parties[i]];
      expect(a.seats2023 > b.seats2023 || (a.seats2023 === b.seats2023 && a.acronym.localeCompare(b.acronym, "es") <= 0)).toBe(true);
    }
  });

  it("include only parties with at least one seat, adding up to the Congreso total", () => {
    const file = getPartiesFile();
    expect(file.parties.every((p) => p.seats2023 >= 1)).toBe(true);
    expect(file.parties.reduce((s, p) => s + p.seats2023, 0)).toBe(file.election.totalSeats);
  });
});
