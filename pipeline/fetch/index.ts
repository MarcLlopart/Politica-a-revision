// Downloads every raw source used by the indicator definitions into data/raw/.
// Usage: npm run pipeline:fetch [-- --only ine/EPA815]

import { DISTRIBUTIONS } from "../config/distributions";
import { INDICATORS } from "../config/indicators";
import { PYRAMIDS } from "../config/pyramids";
import { resourcesOf } from "../lib/define";
import { pruneRaw } from "../lib/raw";
import type { Resource } from "../lib/sources";

const onlyIdx = process.argv.indexOf("--only");
const only = onlyIdx > -1 ? process.argv[onlyIdx + 1] : undefined;

const resources = new Map<string, Resource>();
for (const def of INDICATORS) {
  for (const r of resourcesOf(def)) resources.set(r.fetchKey ?? r.key, r);
}
for (const def of DISTRIBUTIONS) {
  for (const r of def.resources ?? []) resources.set(r.fetchKey ?? r.key, r);
}
for (const def of PYRAMIDS) {
  for (const { resource } of def.years) resources.set(resource.key, resource);
}

const queue = [...resources.entries()].filter(([key]) => !only || key === only).map(([, r]) => r);
const failures: { key: string; error: string }[] = [];
let done = 0;

async function worker() {
  for (let r = queue.shift(); r; r = queue.shift()) {
    try {
      await r.fetch();
      done++;
      console.log(`✓ ${r.fetchKey ?? r.key}`);
    } catch (err) {
      const key = r.fetchKey ?? r.key;
      failures.push({ key, error: err instanceof Error ? err.message : String(err) });
      console.error(`✗ ${key}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

await Promise.all(Array.from({ length: 4 }, worker));

for (const group of new Set([...resources.keys()].map((k) => k.split("/")[0]))) pruneRaw(group);

console.log(`\nFetched ${done} resources, ${failures.length} failed.`);
if (failures.length > 0) process.exitCode = 1;
