// Raw file storage: every downloaded file is kept byte-for-byte under
// data/raw/{group}/{retrieval-date}/ with a manifest recording its URL and SHA-256.

import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import tls from "node:tls";
import zlib from "node:zlib";

export const ROOT = process.cwd();
export const RAW_DIR = path.join(ROOT, "data", "raw");

/** Retrieval date; override with PIPELINE_DATE=YYYY-MM-DD to reproduce a run. */
export const TODAY = process.env.PIPELINE_DATE ?? new Date().toISOString().slice(0, 10);

export type ManifestEntry = {
  url: string;
  retrievedAt: string;
  sha256: string;
  bytes: number;
  contentType: string | null;
};
type Manifest = { files: Record<string, ManifestEntry> };

export function sha256(buf: Buffer | string): string {
  return `sha256:${crypto.createHash("sha256").update(buf).digest("hex")}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Certificates trusted for downloads: Node's bundled roots plus the intermediates in
 * pipeline/certs (for servers that do not send their full chain, e.g. www.airef.es). An
 * explicit list makes downloads independent of the machine's certificate store.
 */
const CERT_DIR = path.join(ROOT, "pipeline", "certs");
const EXTRA_CAS = fs.existsSync(CERT_DIR)
  ? fs.readdirSync(CERT_DIR).filter((f) => f.endsWith(".pem")).map((f) => fs.readFileSync(path.join(CERT_DIR, f), "utf8"))
  : [];
const agent = new https.Agent({ ca: [...tls.rootCertificates, ...EXTRA_CAS], keepAlive: true });

type Response = { body: Buffer; contentType: string | null };

function request(url: string, headers: Record<string, string>, redirects = 5): Promise<Response> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "http:" ? http : https;
    const req = lib.get(
      u,
      { headers: { "accept-encoding": "gzip, deflate, br", ...headers }, agent: u.protocol === "https:" ? agent : undefined, timeout: 90_000 },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          if (redirects === 0) return reject(new Error(`Too many redirects for ${url}`));
          return resolve(request(new URL(res.headers.location, u).href, headers, redirects - 1));
        }
        if (status < 200 || status >= 300) {
          res.resume();
          return reject(new Error(`HTTP ${status} for ${url}`));
        }
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("error", reject);
        res.on("end", () => {
          try {
            let body = Buffer.concat(chunks);
            const enc = res.headers["content-encoding"];
            if (enc === "gzip") body = zlib.gunzipSync(body);
            else if (enc === "deflate") body = zlib.inflateSync(body);
            else if (enc === "br") body = zlib.brotliDecompressSync(body);
            resolve({ body, contentType: res.headers["content-type"] ?? null });
          } catch (err) {
            reject(err);
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error(`Timeout for ${url}`)));
    req.on("error", reject);
  });
}

export async function download(url: string, opts: { headers?: Record<string, string> } = {}): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await request(url, {
        "user-agent": "politica-a-revision-data-pipeline (+https://github.com/MarcLlopart/data-elections-26)",
        ...opts.headers,
      });
      if (res.body.length === 0) throw new Error(`Empty body for ${url}`);
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < 4) await sleep(1500 * attempt);
    }
  }
  throw lastError;
}

function manifestPath(group: string, date: string): string {
  return path.join(RAW_DIR, group, date, "manifest.json");
}

function readManifest(group: string, date: string): Manifest {
  const p = manifestPath(group, date);
  return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")) as Manifest) : { files: {} };
}

export function saveRaw(group: string, filename: string, body: Buffer, url: string, contentType: string | null): string {
  const dir = path.join(RAW_DIR, group, TODAY);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), body);
  const manifest = readManifest(group, TODAY);
  manifest.files[filename] = { url, retrievedAt: TODAY, sha256: sha256(body), bytes: body.length, contentType };
  const sorted = Object.fromEntries(Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(manifestPath(group, TODAY), `${JSON.stringify({ files: sorted }, null, 2)}\n`);
  return path.relative(ROOT, path.join(dir, filename));
}

export type RawFile = ManifestEntry & { rawPath: string; body: Buffer };

/** Latest stored copy of a raw file, verified against its manifest hash. */
export function latestRaw(group: string, filename: string): RawFile {
  const groupDir = path.join(RAW_DIR, group);
  const dates = fs.existsSync(groupDir)
    ? fs.readdirSync(groupDir).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse()
    : [];
  for (const date of dates) {
    const entry = readManifest(group, date).files[filename];
    if (!entry) continue;
    const full = path.join(groupDir, date, filename);
    const body = fs.readFileSync(full);
    if (sha256(body) !== entry.sha256) throw new Error(`Hash mismatch for ${full}`);
    return { ...entry, rawPath: path.relative(ROOT, full), body };
  }
  throw new Error(`No raw file ${group}/${filename}. Run "npm run pipeline:fetch" first.`);
}

/**
 * Removes older copies of files that have a newer copy, so the working tree holds one
 * snapshot per file. Older snapshots stay in git history.
 */
export function pruneRaw(group: string): void {
  const groupDir = path.join(RAW_DIR, group);
  if (!fs.existsSync(groupDir)) return;
  const dates = fs.readdirSync(groupDir).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();
  const seen = new Set<string>();
  for (const date of dates) {
    const manifest = readManifest(group, date);
    for (const name of Object.keys(manifest.files)) {
      if (seen.has(name)) {
        fs.rmSync(path.join(groupDir, date, name), { force: true });
        delete manifest.files[name];
      } else {
        seen.add(name);
      }
    }
    if (Object.keys(manifest.files).length === 0) {
      fs.rmSync(path.join(groupDir, date), { recursive: true, force: true });
    } else {
      fs.writeFileSync(manifestPath(group, date), `${JSON.stringify(manifest, null, 2)}\n`);
    }
  }
}
