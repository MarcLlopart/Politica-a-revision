// Archives each party's official programme (brief §5): downloads the file listed in
// data/parties/parties.json, stores it under sources/programs/{party}/{edition}/ with a
// source.json (URL, date, SHA-256, Wayback link) and marks the edition "archived".
// Usage: npm run programs:archive [-- --only pp]

import fs from "node:fs";
import path from "node:path";
import { PartiesFile } from "../../lib/schema";
import { download, ROOT, sha256, TODAY } from "../lib/raw";

const PARTIES_FILE = path.join(ROOT, "data", "parties", "parties.json");
const onlyIdx = process.argv.indexOf("--only");
const only = onlyIdx > -1 ? process.argv[onlyIdx + 1] : undefined;

/** File extension of a programme URL; extension-less URLs (e.g. PNV's) are PDFs. */
const ext = (url: string) => (path.extname(new URL(url).pathname) || ".pdf").toLowerCase();

const file = PartiesFile.parse(JSON.parse(fs.readFileSync(PARTIES_FILE, "utf8")));
let failures = 0;

for (const party of file.parties) {
  if (only && party.id !== only) continue;
  for (const ed of party.programEditions) {
    if (!ed.url) {
      console.log(`- ${party.id} ${ed.edition}: no URL yet`);
      continue;
    }
    try {
      let body: Buffer;
      let from = ed.url;
      const isPdf = (b: Buffer) => b.subarray(0, 5).toString("latin1") === "%PDF-";
      try {
        body = (await download(ed.url)).body;
        // Some sites answer bots with an HTML page; treat that as a failed download.
        if (ext(ed.url) === ".pdf" && !isPdf(body)) throw new Error("response is not a PDF");
      } catch (err) {
        // Original gone: fall back to the Wayback copy (the "id_" form returns the raw bytes).
        if (!ed.waybackUrl) throw err;
        from = ed.waybackUrl.replace(/\/web\/(\d+)\//, "/web/$1id_/");
        body = (await download(from)).body;
        if (ext(ed.url) === ".pdf" && !isPdf(body)) throw new Error("Wayback copy is not a PDF either");
      }
      const dir = path.join(ROOT, "sources", "programs", party.id, ed.edition);
      fs.mkdirSync(dir, { recursive: true });
      const target = path.join(dir, `programa${ext(ed.url)}`);
      const hash = sha256(body);
      if (ed.fileHash && ed.fileHash !== hash) {
        // Never silently replace an archived programme: quotes cite its pages.
        throw new Error(`downloaded file differs from the archived one (${ed.fileHash}); review manually`);
      }
      fs.writeFileSync(target, body);
      const meta = {
        url: ed.url,
        downloadedFrom: from,
        retrievedAt: ed.retrievedAt ?? TODAY,
        sha256: hash,
        waybackUrl: ed.waybackUrl ?? null,
        languages: ed.languages,
        bytes: body.length,
      };
      fs.writeFileSync(path.join(dir, "source.json"), `${JSON.stringify(meta, null, 2)}\n`);
      Object.assign(ed, {
        status: "archived",
        localPath: path.relative(ROOT, target),
        fileHash: hash,
        retrievedAt: meta.retrievedAt,
      });
      console.log(`✓ ${party.id} ${ed.edition} (${(body.length / 1e6).toFixed(1)} MB)`);
    } catch (err) {
      failures++;
      console.error(`✗ ${party.id} ${ed.edition}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

fs.writeFileSync(PARTIES_FILE, `${JSON.stringify(PartiesFile.parse(file), null, 2)}\n`);
if (failures > 0) process.exitCode = 1;
