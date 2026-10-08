// Figures transcribed from documents must still appear in the archived documents.
// Machine-readable ones (BOE XML, OECD workbooks) are checked here; PDFs are checked by hand.

import fs from "node:fs";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { getEstimates } from "../lib/data";

const text = (path: string) => fs.readFileSync(path, "utf8").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const cell = (path: string, sheet: string, ref: string) => XLSX.read(fs.readFileSync(path)).Sheets[sheet][ref]?.v as number;

describe("document-backed figures", () => {
  const e = getEstimates();

  it("2026 contribution rates and bases appear in Orden PJC/297/2026", () => {
    const t = text(e.get("contribution-rate-common-contingencies-2026")!.document.localPath!);
    for (const s of ["28,30", "23,60", "4,70", "0,90", "7,05", "0,70", "0,20", "5.101,20"]) expect(t).toContain(s);
  });

  it("2026 pension amounts appear in Real Decreto 241/2026 and the revaluation in RDL 3/2026", () => {
    const rd = text(e.get("maximum-pension-2026")!.document.localPath!);
    expect(rd).toContain("3.359,60");
    expect(rd).toContain("13.106,80");
    expect(text(e.get("pension-revaluation-2026")!.document.localPath!)).toContain("2,7 por ciento");
  });

  it("OECD cells match", () => {
    expect(cell(e.get("oecd-gross-replacement-rate")!.document.localPath!, "t4-1", "O14")).toBeCloseTo(80.4, 1);
    expect(cell(e.get("oecd-old-age-ratio-2050")!.document.localPath!, "g1-5", "AH127")).toBeCloseTo(74.2, 1);
  });
});
