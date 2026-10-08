// Normalises the stored raw files into data/indicators/{id}.json and data/sources.json.
// Reads only from data/raw, so it is deterministic: same raw files → same output.

import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { Distribution, Indicator, Pyramid, Source } from "../../lib/schema";
import { DISTRIBUTIONS } from "../config/distributions";
import { buildPeriod } from "../lib/distributions";
import { INDICATORS } from "../config/indicators";
import { PYRAMIDS } from "../config/pyramids";
import { isCombined, isDerived } from "../lib/define";
import { ROOT } from "../lib/raw";
import { round, type Loaded, type Point, type Resource } from "../lib/sources";

const OUT_DIR = path.join(ROOT, "data", "indicators");

type Built = { points: Point[]; sourceByPeriod: Map<string, string>; sourceIds: string[] };

const loadedByResource = new Map<string, Loaded>();
const built = new Map<string, Built>();
const sources = new Map<string, z.infer<typeof Source>>();
const report: string[] = [];

function load(resource: Resource): Loaded {
  let loaded = loadedByResource.get(resource.key);
  if (!loaded) {
    loaded = resource.load();
    loadedByResource.set(resource.key, loaded);
  }
  for (const s of loaded.sources ?? [loaded.source]) sources.set(s.id, s);
  return loaded;
}

for (const def of INDICATORS) {
  let result: Built;
  let inputs: string[] = [];
  let formula: string | undefined;

  if (isDerived(def)) {
    const inputBuilds = def.inputs.map((id) => {
      const b = built.get(id);
      if (!b) throw new Error(`${def.id}: input ${id} must be defined earlier in config`);
      return b;
    });
    const points = def.compute(inputBuilds.map((b) => b.points));
    const first = inputBuilds[0];
    result = {
      points,
      sourceByPeriod: new Map(points.map((p) => [p.period, first.sourceByPeriod.get(p.period) ?? first.sourceIds[0]])),
      sourceIds: [...new Set(inputBuilds.flatMap((b) => b.sourceIds))],
    };
    inputs = def.inputs;
    formula = def.formula;
  } else if (isCombined(def)) {
    const parts = def.resources.map(load);
    const points = def.combine(parts.map((l) => l.points));
    result = {
      points,
      sourceByPeriod: new Map(points.map((p) => [p.period, parts[p.from].source.id])),
      sourceIds: parts.map((l) => l.source.id),
    };
    formula = def.formula;
  } else {
    const loaded = load(def.resource);
    const tagged = new Map(loaded.points.map((p) => [p.period, p.sourceId ?? loaded.source.id]));
    const points = def.map ? def.map(loaded.points) : loaded.points;
    result = {
      points,
      sourceByPeriod: new Map(points.map((p) => [p.period, tagged.get(p.period) ?? loaded.source.id])),
      sourceIds: (loaded.sources ?? [loaded.source]).map((s) => s.id),
    };
  }

  const sorted = [...result.points].sort((a, b) => a.period.localeCompare(b.period));
  if (sorted.length === 0) throw new Error(`${def.id}: no observations`);

  const indicator = Indicator.parse({
    id: def.id,
    topic: def.topic,
    unit: def.unit,
    frequency: def.frequency,
    decimals: def.decimals,
    label: def.label,
    note: def.note,
    yZero: def.yZero,
    periodRef: def.periodRef ?? "period",
    calculation: { method: def.method, formula, inputs },
    observations: sorted.map((p) => ({
      period: p.period,
      value: round(p.value, Math.max(def.decimals + 2, 4)),
      sourceId: result.sourceByPeriod.get(p.period)!,
      status: p.status,
    })),
  });

  built.set(def.id, { ...result, points: sorted });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `${def.id}.json`);
  const previous = fs.existsSync(outFile) ? (JSON.parse(fs.readFileSync(outFile, "utf8")) as z.infer<typeof Indicator>) : null;
  fs.writeFileSync(outFile, `${JSON.stringify(indicator, null, 2)}\n`);

  const last = sorted[sorted.length - 1];
  const prevLast = previous?.observations.at(-1);
  const changed = !prevLast || prevLast.period !== last.period || prevLast.value !== indicator.observations.at(-1)!.value;
  report.push(`${changed ? "•" : " "} ${def.id.padEnd(34)} ${last.period.padEnd(8)} ${last.value}`);
}

// Distributions (bracketed counts → statistics).
const DIST_DIR = path.join(ROOT, "data", "distributions");
fs.mkdirSync(DIST_DIR, { recursive: true });
const builtDistributions = new Set<string>();
for (const def of DISTRIBUTIONS) {
  const inputs = def.load().sort((a, b) => a.period.localeCompare(b.period));
  for (const input of inputs) {
    sources.set(input.source.id, input.source);
    for (const extra of input.extraSources ?? []) sources.set(extra.id, extra);
    if (input.publishedMean) sources.set(input.publishedMean.source.id, input.publishedMean.source);
  }
  const dist = Distribution.parse({
    id: def.id,
    topic: def.topic,
    amountPer: def.amountPer,
    periodRef: def.periodRef ?? "period",
    label: def.label,
    population: def.population,
    note: def.note,
    displayEdges: def.displayEdges,
    calculation: { method: def.method, inputs: [] },
    periods: inputs.map((input) => buildPeriod(def, input)),
  });

  // Selected statistics as yearly indicators, so they get trend charts and CSVs like any series.
  for (const spec of def.indicators ?? []) {
    const obs = dist.periods.flatMap((p) => {
      const v = p.stats[spec.stat].value;
      return v === null ? [] : [{ period: p.period, value: Math.round(v * 100) / 100, sourceId: p.sourceId, status: "final" as const }];
    });
    const indicator = Indicator.parse({
      id: spec.id,
      topic: def.topic,
      unit: "eur",
      frequency: /^\d{4}$/.test(obs[0].period) ? "A" : "M",
      decimals: 0,
      label: spec.label,
      note: def.note,
      yZero: true,
      periodRef: def.periodRef ?? "period",
      calculation: {
        method: `${spec.stat} of the distribution "${def.id}" (see Distributions on the methodology page). ${def.method}`,
        inputs: [],
        extraSourceIds: [...new Set(dist.periods.flatMap((p) => p.extraSourceIds))],
      },
      observations: obs,
    });
    fs.writeFileSync(path.join(OUT_DIR, `${spec.id}.json`), `${JSON.stringify(indicator, null, 2)}\n`);
    built.set(spec.id, { points: [], sourceByPeriod: new Map(), sourceIds: [] });
    const lastObs = obs[obs.length - 1];
    report.push(`  ${spec.id.padEnd(34)} ${lastObs.period.padEnd(8)} ${lastObs.value}`);
  }
  fs.writeFileSync(path.join(DIST_DIR, `${def.id}.json`), `${JSON.stringify(dist, null, 2)}\n`);
  builtDistributions.add(def.id);
  const last = dist.periods.at(-1)!;
  const fmt = (st: { value: number | null; atLeast?: number }) => (st.value === null ? `>${st.atLeast}` : st.value.toFixed(0));
  const mode = last.stats.mode ? `${last.stats.mode.lower.toFixed(0)}–${last.stats.mode.upper.toFixed(0)}` : "n/a";
  report.push(
    `  ${def.id.padEnd(34)} ${last.period.padEnd(8)} mean ${fmt(last.stats.mean)} p50 ${fmt(last.stats.median)} p90 ${fmt(last.stats.p90)} p99 ${fmt(last.stats.p99)} mode ${mode}`,
  );
}
for (const f of fs.readdirSync(DIST_DIR)) {
  if (f.endsWith(".json") && !builtDistributions.has(f.replace(/\.json$/, ""))) fs.rmSync(path.join(DIST_DIR, f));
}

// Population pyramids (population by sex and single year of age).
const PYRAMID_DIR = path.join(ROOT, "data", "pyramids");
fs.mkdirSync(PYRAMID_DIR, { recursive: true });
for (const def of PYRAMIDS) {
  const years = def.years.map(({ period, resource }) => {
    const { men, women, source } = resource.ages();
    sources.set(source.id, source);
    const r = (v: number) => Math.round(v);
    return { period, status: period > def.observedUntil ? "forecast" : "final", sourceId: source.id, men: men.map(r), women: women.map(r) };
  });
  const pyramid = Pyramid.parse({ id: def.id, label: def.label, note: def.note, calculation: { method: def.method, inputs: [] }, years });
  fs.writeFileSync(path.join(PYRAMID_DIR, `${def.id}.json`), `${JSON.stringify(pyramid)}\n`);
  const last = years.at(-1)!;
  report.push(`  ${def.id.padEnd(34)} ${last.period.padEnd(8)} ${[...last.men, ...last.women].reduce((a, b) => a + b, 0)}`);
}

// Remove indicator files that are no longer defined.
for (const f of fs.readdirSync(OUT_DIR)) {
  if (f.endsWith(".json") && !built.has(f.replace(/\.json$/, ""))) fs.rmSync(path.join(OUT_DIR, f));
}

const sourceList = z.array(Source).parse([...sources.values()].sort((a, b) => a.id.localeCompare(b.id)));
fs.writeFileSync(path.join(ROOT, "data", "sources.json"), `${JSON.stringify(sourceList, null, 2)}\n`);

console.log(report.join("\n"));
console.log(`\nWrote ${built.size} indicators, ${builtDistributions.size} distributions and ${sourceList.length} sources (• = latest value changed).`);
