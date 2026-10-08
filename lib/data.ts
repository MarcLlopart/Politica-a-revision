// Loads and validates the versioned JSON in /data. Used at build time by pages,
// route handlers and scripts/validate-data.ts. Parsing failures throw, failing the build.

import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  Assessment,
  ContextEvents,
  Corrections,
  Distribution,
  Estimate,
  Indicator,
  PartiesFile,
  Proposal,
  Pyramid,
  Rubric,
  Source,
} from "./schema";

const ROOT = process.cwd();
export const DATA_DIR = path.join(ROOT, "data");

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function parseFile<T extends z.ZodType>(schema: T, file: string): z.infer<T> {
  const result = schema.safeParse(readJson(file));
  if (!result.success) {
    throw new Error(`Invalid data in ${path.relative(ROOT, file)}:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

function jsonFilesIn(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...jsonFilesIn(full));
    else if (entry.name.endsWith(".json")) out.push(full);
  }
  return out.sort();
}

function memo<T>(fn: () => T): () => T {
  let value: T | undefined;
  let done = false;
  return () => {
    if (!done) {
      value = fn();
      done = true;
    }
    return value as T;
  };
}

export const getSources = memo(() => {
  const list = parseFile(z.array(Source), path.join(DATA_DIR, "sources.json"));
  return new Map(list.map((s) => [s.id, s]));
});

export const getIndicators = memo(() => {
  const list = jsonFilesIn(path.join(DATA_DIR, "indicators")).map((f) => {
    const ind = parseFile(Indicator, f);
    if (path.basename(f, ".json") !== ind.id) throw new Error(`${f}: file name must match id "${ind.id}"`);
    return ind;
  });
  return new Map(list.map((i) => [i.id, i]));
});

export function getIndicator(id: string): Indicator {
  const ind = getIndicators().get(id);
  if (!ind) throw new Error(`Unknown indicator "${id}"`);
  return ind;
}

export function getSource(id: string): Source {
  const s = getSources().get(id);
  if (!s) throw new Error(`Unknown source "${id}"`);
  return s;
}

export const getDistributions = memo(() => {
  const list = jsonFilesIn(path.join(DATA_DIR, "distributions")).map((f) => parseFile(Distribution, f));
  return new Map(list.map((d) => [d.id, d]));
});

export function getDistribution(id: string) {
  const d = getDistributions().get(id);
  if (!d) throw new Error(`Unknown distribution "${id}"`);
  return d;
}

export const getPyramids = memo(() => {
  const list = jsonFilesIn(path.join(DATA_DIR, "pyramids")).map((f) => parseFile(Pyramid, f));
  return new Map(list.map((p) => [p.id, p]));
});

export function getPyramid(id: string) {
  const p = getPyramids().get(id);
  if (!p) throw new Error(`Unknown pyramid "${id}"`);
  return p;
}

export const getEstimates = memo(() => {
  const list = jsonFilesIn(path.join(DATA_DIR, "estimates")).map((f) => parseFile(Estimate, f));
  return new Map(list.map((e) => [e.id, e]));
});

export const getEvents = memo(() => parseFile(ContextEvents, path.join(DATA_DIR, "events.json")));

export const getPartiesFile = memo(() => {
  const file = parseFile(PartiesFile, path.join(DATA_DIR, "parties", "parties.json"));
  // Order rule (brief §2): seats at the last general election, then alphabetical.
  const parties = [...file.parties].sort(
    (a, b) => b.seats2023 - a.seats2023 || a.acronym.localeCompare(b.acronym, "es"),
  );
  return { ...file, parties };
});

export const getCorrections = memo(() =>
  parseFile(Corrections, path.join(DATA_DIR, "corrections.json")).sort((a, b) => b.date.localeCompare(a.date)),
);

export const getProposals = memo(() => jsonFilesIn(path.join(DATA_DIR, "proposals")).map((f) => parseFile(Proposal, f)));

export const getAssessments = memo(() =>
  jsonFilesIn(path.join(DATA_DIR, "assessments")).map((f) => parseFile(Assessment, f)),
);

export const getRubric = memo(() => parseFile(Rubric, path.join(ROOT, "methodology", "rubric.v1.json")));
