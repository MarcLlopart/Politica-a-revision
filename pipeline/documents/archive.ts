// Archives the documents behind figures in data/estimates/*.json: downloads each URL once,
// stores it under sources/documents/{publisher}/ with its SHA-256 and records the path.
// Usage: npm run documents:archive [-- --only fedea-contributory-deficit-2025]

import fs from "node:fs";
import path from "node:path";
import { Estimate } from "../../lib/schema";
import { download, ROOT, sha256, TODAY } from "../lib/raw";

const DIR = path.join(ROOT, "data", "estimates");
const onlyIdx = process.argv.indexOf("--only");
const only = onlyIdx > -1 ? process.argv[onlyIdx + 1] : undefined;
const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
let failures = 0;
// Several figures can come from the same document: download it once.
const fetched = new Map<string, { body: Buffer; contentType: string | null }>();

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".json"))) {
  const file = path.join(DIR, f);
  const e = Estimate.parse(JSON.parse(fs.readFileSync(file, "utf8")));
  if (only && e.id !== only) continue;
  if (e.document.localPath && fs.existsSync(path.join(ROOT, e.document.localPath))) continue; // already archived
  try {
    if (!fetched.has(e.document.url)) fetched.set(e.document.url, await download(e.document.url));
    const { body, contentType } = fetched.get(e.document.url)!;
    const magic = body.subarray(0, 5).toString("latin1");
    const ext = magic === "%PDF-" ? ".pdf" : magic.startsWith("PK") ? (contentType?.includes("zip") ? ".zip" : ".xlsx") : contentType?.includes("xml") ? ".xml" : ".html";
    // Name after the document's own id when the URL carries one (e.g. BOE ?id=BOE-A-…), else the file name.
    const u = new URL(e.document.url);
    const base = u.searchParams.get("id") ?? decodeURIComponent(path.basename(u.pathname, path.extname(u.pathname)));
    const name = `${slug(base) || e.id}${ext}`;
    const dir = path.join(ROOT, "sources", "documents", slug(e.publisher));
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, name);
    fs.writeFileSync(target, body);
    e.document.localPath = path.relative(ROOT, target);
    e.document.fileHash = sha256(body);
    e.document.retrievedAt = TODAY;
    fs.writeFileSync(file, `${JSON.stringify(Estimate.parse(e), null, 2)}\n`);
    console.log(`✓ ${e.id} → ${e.document.localPath} (${(body.length / 1e6).toFixed(2)} MB)`);
  } catch (err) {
    failures++;
    console.error(`✗ ${e.id}: ${err instanceof Error ? err.message : err}`);
  }
}
if (failures > 0) process.exitCode = 1;
