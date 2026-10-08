// Neutral-language guard (brief §2): user-facing text must not use evaluative adjectives
// about parties or proposals, or the word "hallucination".

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const BANNED = [
  // en
  "hallucinat",
  "absurd",
  "brave",
  "populis",
  "unrealistic",
  "irresponsible",
  "reckless",
  "fantasy",
  "lie",
  // es
  "alucinaci",
  "absurd",
  "valiente",
  "populis",
  "irreal",
  "irresponsable",
  "mentira",
  "disparate",
  // ca
  "al·lucinaci",
  "valent",
  "irresponsable",
  "mentida",
];

function textFiles(): string[] {
  const out = ["messages/es.json", "messages/en.json", "messages/ca.json", "data/events.json", "data/corrections.json"];
  for (const dir of ["data/proposals", "data/assessments"]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir, { recursive: true }) as string[]) if (f.endsWith(".json")) out.push(path.join(dir, f));
  }
  return out;
}

function strings(value: unknown, keyPath: string[] = []): { key: string; text: string }[] {
  if (typeof value === "string") return [{ key: keyPath.join("."), text: value }];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, [...keyPath, String(i)]));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) =>
      // Verbatim programme quotes are the party's own words and are exempt.
      k === "quote" ? [] : strings(v, [...keyPath, k]),
    );
  }
  return [];
}

describe("neutral language", () => {
  for (const file of textFiles()) {
    it(`${file} uses no banned terms`, () => {
      const hits = strings(JSON.parse(fs.readFileSync(file, "utf8"))).flatMap(({ key, text }) =>
        BANNED.filter((w) => new RegExp(`\\b${w}`, "i").test(text)).map((w) => `${key}: "${w}"`),
      );
      expect(hits).toEqual([]);
    });
  }
});
