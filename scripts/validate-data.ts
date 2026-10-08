// Build-time data validation (runs before `next build`). Fails if any displayed value
// lacks a valid source, a raw file does not match its hash, a translation is missing,
// or assessments use more than one rubric version.

import fs from "node:fs";
import path from "node:path";
import { BAR_CARDS, CONTRIBUTION_RATES, DASHBOARD, DISTRIBUTION_CARDS, ESTIMATE_GROUPS } from "../lib/dashboard";
import {
  getAssessments,
  getCorrections,
  getDistributions,
  getEstimates,
  getEvents,
  getIndicators,
  getPartiesFile,
  getProposals,
  getPyramids,
  getRubric,
  getSources,
} from "../lib/data";
import { LOCALES } from "../lib/locales";
import { TOPICS } from "../lib/topics";
import { sha256 } from "../pipeline/lib/raw";

export function validateData(root = process.cwd()): string[] {
  const errors: string[] = [];
  const err = (msg: string) => errors.push(msg);

  // Zod validation happens inside the loaders; a parse error throws with the file name.
  const sources = getSources();
  const indicators = getIndicators();
  getEvents();
  getCorrections();
  const parties = getPartiesFile();
  const proposals = getProposals();
  const assessments = getAssessments();
  const rubric = getRubric();

  // Sources: raw files exist and match their hashes.
  for (const s of sources.values()) {
    const file = path.join(root, s.rawPath);
    if (!fs.existsSync(file)) {
      err(`source ${s.id}: raw file ${s.rawPath} missing`);
      continue;
    }
    if (sha256(fs.readFileSync(file)) !== s.fileHash) err(`source ${s.id}: hash mismatch for ${s.rawPath}`);
  }

  // Indicators: every observation has a known source; inputs exist.
  for (const ind of indicators.values()) {
    for (const o of ind.observations) {
      if (!sources.has(o.sourceId)) err(`indicator ${ind.id} ${o.period}: unknown source ${o.sourceId}`);
    }
    for (const input of ind.calculation.inputs) {
      if (!indicators.has(input)) err(`indicator ${ind.id}: unknown input ${input}`);
    }
    for (const id of ind.calculation.extraSourceIds) {
      if (!sources.has(id)) err(`indicator ${ind.id}: unknown extra source ${id}`);
    }
  }

  // Pyramids: every year has a known source.
  for (const p of getPyramids().values()) {
    for (const y of p.years) if (!sources.has(y.sourceId)) err(`pyramid ${p.id} ${y.period}: unknown source ${y.sourceId}`);
  }

  // Distributions: sources exist, brackets add up, cards reference existing distributions.
  const distributions = getDistributions();
  for (const d of distributions.values()) {
    for (const p of d.periods) {
      if (!sources.has(p.sourceId)) err(`distribution ${d.id} ${p.period}: unknown source ${p.sourceId}`);
      for (const id of p.extraSourceIds) if (!sources.has(id)) err(`distribution ${d.id} ${p.period}: unknown source ${id}`);
      if (p.stats.mean.sourceId && !sources.has(p.stats.mean.sourceId)) err(`distribution ${d.id}: unknown mean source`);
      const n = p.brackets.reduce((s, b) => s + b.count, 0);
      if (Math.abs(n - p.total) > 0.5) err(`distribution ${d.id} ${p.period}: brackets add up to ${n}, total ${p.total}`);
    }
  }
  for (const [topic, cards] of Object.entries(BAR_CARDS)) {
    for (const c of cards ?? []) for (const id of c.indicators) if (!indicators.has(id)) err(`bar card ${topic}/${c.id}: unknown indicator ${id}`);
  }
  for (const [topic, ids] of Object.entries(DISTRIBUTION_CARDS)) {
    for (const id of ids ?? []) if (!distributions.has(id)) err(`dashboard ${topic}: unknown distribution ${id}`);
  }

  // Figures from documents: the archived document exists and matches its hash.
  for (const e of getEstimates().values()) {
    const d = e.document;
    if (!d.localPath || !d.fileHash || !d.retrievedAt) {
      err(`estimate ${e.id}: document not archived (run npm run documents:archive)`);
      continue;
    }
    const file = path.join(root, d.localPath);
    if (!fs.existsSync(file)) err(`estimate ${e.id}: ${d.localPath} missing`);
    else if (sha256(fs.readFileSync(file)) !== d.fileHash) err(`estimate ${e.id}: document hash mismatch`);
  }

  const estimateIds = new Set(getEstimates().keys());
  for (const [topic, groups] of Object.entries(ESTIMATE_GROUPS)) {
    for (const g of groups ?? []) for (const id of g.ids) if (!estimateIds.has(id)) err(`estimates ${topic}/${g.id}: unknown estimate ${id}`);
  }
  for (const id of CONTRIBUTION_RATES) if (!estimateIds.has(id)) err(`contribution rates: unknown estimate ${id}`);

  // Dashboard: every topic has cards, every card references existing indicators of one unit.
  for (const topic of TOPICS) {
    const cards = DASHBOARD[topic];
    if (!cards || cards.length === 0) err(`dashboard: topic ${topic} has no cards`);
    for (const card of cards ?? []) {
      const inds = card.indicators.map((id) => indicators.get(id));
      inds.forEach((ind, i) => {
        if (!ind) err(`dashboard ${topic}/${card.id}: unknown indicator ${card.indicators[i]}`);
      });
      const units = new Set(inds.filter(Boolean).map((i) => i!.unit));
      if (units.size > 1) err(`dashboard ${topic}/${card.id}: mixes units ${[...units].join(", ")}`);
    }
  }

  // Messages: identical key sets in every locale, no empty strings, card titles present.
  const flatten = (obj: unknown, prefix = ""): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object") Object.assign(out, flatten(v, key));
      else out[key] = String(v);
    }
    return out;
  };
  const messages = Object.fromEntries(
    LOCALES.map((l) => [l, flatten(JSON.parse(fs.readFileSync(path.join(root, "messages", `${l}.json`), "utf8")))]),
  );
  const reference = Object.keys(messages[LOCALES[0]]).sort();
  for (const l of LOCALES) {
    const keys = Object.keys(messages[l]).sort();
    for (const k of reference) if (!(k in messages[l])) err(`messages/${l}.json: missing ${k}`);
    for (const k of keys) {
      if (!reference.includes(k)) err(`messages/${l}.json: extra key ${k}`);
      if (messages[l][k].trim() === "") err(`messages/${l}.json: empty ${k}`);
    }
  }
  for (const topic of TOPICS) {
    for (const card of DASHBOARD[topic] ?? []) {
      if (card.indicators.length > 1 && !(`cards.${card.id}` in messages[LOCALES[0]])) {
        err(`messages: missing title cards.${card.id}`);
      }
    }
  }

  // Parties: archived programmes exist and match their hashes.
  const partyIds = new Set(parties.parties.map((p) => p.id));
  for (const p of parties.parties) {
    for (const ed of p.programEditions) {
      if (ed.status !== "archived") continue;
      if (!ed.localPath || !ed.fileHash || !ed.url || !ed.retrievedAt) {
        err(`party ${p.id} ${ed.edition}: archived edition needs url, localPath, fileHash and retrievedAt`);
        continue;
      }
      const file = path.join(root, ed.localPath);
      if (!fs.existsSync(file)) err(`party ${p.id}: programme file ${ed.localPath} missing`);
      else if (sha256(fs.readFileSync(file)) !== ed.fileHash) err(`party ${p.id}: programme hash mismatch`);
    }
  }

  // Proposals and assessments.
  const proposalIds = new Set<string>();
  for (const p of proposals) {
    if (proposalIds.has(p.id)) err(`proposal ${p.id}: duplicate id`);
    proposalIds.add(p.id);
    if (!partyIds.has(p.partyId)) err(`proposal ${p.id}: unknown party ${p.partyId}`);
    if (!sources.has(p.quote.sourceId) && !parties.parties.some((x) => x.programEditions.some((e) => `program-${x.id}-${e.edition}` === p.quote.sourceId))) {
      err(`proposal ${p.id}: unknown quote source ${p.quote.sourceId}`);
    }
  }
  const publishedVersions = new Set<string>();
  for (const a of assessments) {
    const proposal = proposals.find((p) => p.id === a.proposalId);
    if (!proposal) err(`assessment ${a.proposalId}: unknown proposal`);
    if (a.rubricVersion !== rubric.version) err(`assessment ${a.proposalId}: rubric ${a.rubricVersion}, current is ${rubric.version}`);
    if (rubric.status !== "frozen") err(`assessment ${a.proposalId}: rubric ${rubric.version} is not frozen`);
    if (!indicators.has(a.baseline.indicatorId)) err(`assessment ${a.proposalId}: unknown baseline indicator ${a.baseline.indicatorId}`);
    for (const input of a.calculation.inputs) {
      if (!sources.has(input.sourceId)) err(`assessment ${a.proposalId}: input ${input.name} has unknown source ${input.sourceId}`);
    }
    if (proposal?.status === "published") publishedVersions.add(a.rubricVersion);
  }
  if (publishedVersions.size > 1) err(`published assessments use several rubric versions: ${[...publishedVersions].join(", ")}`);

  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const errors = validateData();
    if (errors.length > 0) {
      console.error(`Data validation failed (${errors.length}):\n${errors.map((e) => `  - ${e}`).join("\n")}`);
      process.exit(1);
    }
    console.log(`Data valid: ${getIndicators().size} indicators, ${getSources().size} sources, ${getPartiesFile().parties.length} parties.`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
