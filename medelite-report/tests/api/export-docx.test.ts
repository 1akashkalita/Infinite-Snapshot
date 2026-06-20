import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/export/docx/route";
import { buildReportDocx } from "@/lib/docx/ReportDocx";
import { assembleViewModel } from "@/lib/report/view-model";
import { toFacilityData } from "@/lib/cms/mapper";
import { parseCMSRow } from "@/lib/cms/parse";
import { joinClaimsAndAverages } from "@/lib/cms/claims-mapper";
import { ClaimsRowSchema } from "@/lib/cms/claims-schema";
import { AveragesRowSchema } from "@/lib/cms/averages-schema";
import providerFixture from "../fixtures/provider-686123.json";
import claimsFixture from "../fixtures/claims-686123.json";
import averagesFixture from "../fixtures/averages-xcdc.json";
import { Packer } from "docx";
import JSZip from "jszip";

// DOCX-01: POST /api/export/docx route tests.
//   Valid ReportViewModel → 200 OOXML buffer (PK ZIP magic bytes, < 4.5 MB)
//   with correct Content-Type and Content-Disposition .docx filename.
//   Bad shape → 400 { error: { kind: 'invalid_request', message } }
//   No Zod internals in 400 body (D-05 discipline).

const FIXED_DATE = "2026-06-17T12:00:00Z";

// Build the 12-item hospMetrics from the captured fixtures (CLAUDE.md rule #3).
const parsedClaims = claimsFixture.map((row) => ClaimsRowSchema.parse(row));
const NATION = AveragesRowSchema.parse(averagesFixture.NATION);
const FL = AveragesRowSchema.parse(averagesFixture.FL);
const hospMetrics = joinClaimsAndAverages(parsedClaims, NATION, FL);

// Build a valid ReportViewModel from the captured fixture (D-11 / CLAUDE.md rule #3).
const validVm = assembleViewModel(
  toFacilityData(parseCMSRow(providerFixture[0])),
  {},
  FIXED_DATE,
);

// Build a vm with 12-item hospMetrics for the claims path assertion.
const validVmWithMetrics = assembleViewModel(
  toFacilityData(parseCMSRow(providerFixture[0])),
  {},
  FIXED_DATE,
  hospMetrics,
);

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/export/docx", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/export/docx — invalid body", () => {
  it("returns 400 for an empty object body", async () => {
    const resp = await POST(makeRequest({}));
    expect(resp.status).toBe(400);
  });

  it("returns kind: 'invalid_request' for a bad shape", async () => {
    const resp = await POST(makeRequest({ bad: "shape" }));
    const body = await resp.json();
    expect(body.error.kind).toBe("invalid_request");
  });

  it("error envelope has a message string", async () => {
    const resp = await POST(makeRequest({ missing: "all fields" }));
    const body = await resp.json();
    expect(typeof body.error.message).toBe("string");
    expect(body.error.message.length).toBeGreaterThan(0);
  });

  // D-05: the 400 body must NEVER expose Zod internals (paths, issues, codes).
  it("400 body does not leak Zod internals (D-05 discipline)", async () => {
    const resp = await POST(makeRequest({ bad: "shape" }));
    const body = await resp.json();
    const bodyStr = JSON.stringify(body);
    // Must not expose Zod issue paths, codes, or internal detail
    expect(bodyStr).not.toMatch(/issues|expected|received|path/);
  });

  it("400 body has the exact error envelope shape (no extra fields)", async () => {
    const resp = await POST(makeRequest(null));
    const body = await resp.json();
    expect(Object.keys(body)).toEqual(["error"]);
    expect(Object.keys(body.error)).toEqual(["kind", "message"]);
  });

  // WR-01: a non-JSON request body must return 400 invalid_request, not a raw 500.
  it("returns 400 invalid_request for a non-JSON body (not a raw 500)", async () => {
    const req = new Request("http://localhost/api/export/docx", {
      method: "POST",
      body: "this is not json{",
      headers: { "Content-Type": "application/json" },
    });
    const resp = await POST(req);
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error.kind).toBe("invalid_request");
  });
});

describe("POST /api/export/docx — valid body", () => {
  it("returns 200 success for a valid ReportViewModel", async () => {
    const resp = await POST(makeRequest(validVm));
    expect(resp.status).toBe(200);
  });

  it("Content-Type is the OOXML MIME type", async () => {
    const resp = await POST(makeRequest(validVm));
    expect(resp.headers.get("content-type")).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("Content-Disposition is attachment with .docx filename", async () => {
    const resp = await POST(makeRequest(validVm));
    expect(resp.headers.get("content-disposition")).toContain("attachment");
    expect(resp.headers.get("content-disposition")).toContain(".docx");
  });

  it("Content-Disposition filename contains the slug of the facility name (kendall-lakes)", async () => {
    const resp = await POST(makeRequest(validVm));
    const cd = resp.headers.get("content-disposition") ?? "";
    // Kendall Lakes Healthcare and Rehab Center → "kendall-lakes-..."
    expect(cd).toContain("kendall-lakes");
  });

  // DOCX-01 SC#3 — size guard: must be under 4.5 MB
  it("buffer is under 4_500_000 bytes (DOCX-01 SC#3 size limit)", async () => {
    const resp = await POST(makeRequest(validVm));
    const buf = Buffer.from(await resp.arrayBuffer());
    expect(Buffer.byteLength(buf)).toBeLessThan(4_500_000);
  });

  // ZIP magic bytes — proves it's a real OOXML file, not empty/corrupt
  it("response body is a valid OOXML ZIP (PK magic bytes 50 4B 03 04)", async () => {
    const resp = await POST(makeRequest(validVm));
    const bytes = new Uint8Array(await resp.arrayBuffer());
    expect(bytes[0]).toBe(0x50); // P
    expect(bytes[1]).toBe(0x4b); // K
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
  });

  // Claims path: validVmWithMetrics → 200 (renders without throwing)
  it("returns 200 for validVmWithMetrics (claims path renders without throwing)", async () => {
    const resp = await POST(makeRequest(validVmWithMetrics));
    expect(resp.status).toBe(200);
  });
});

// DOCX-EMU-01: image extent regression guard — ensures the logo transformation is in
// pixels (not EMU). The docx library multiplies px by 9525 internally; passing EMU
// produced wp:extent cx ≈ 17_419_320_000 (~0.3 mile) which Word refuses to open.
//
// This test unzips the generated .docx and reads word/document.xml, then checks that
// the wp:extent cx attribute is a sane positive integer (< 10_000_000 EMU ≈ < ~11 in).
// At 192 px the correct cx = 192 × 9525 = 1_828_800 — well within the bound.
// The old bug produced cx = 1_828_800 × 9525 = 17_419_320_000, which exceeds 10_000_000.
describe("DOCX image extent regression (EMU/px guard)", () => {
  it("wp:extent cx in word/document.xml is sane (< 10_000_000 EMU — guards against EMU×9525 double-scaling)", async () => {
    const doc = buildReportDocx(validVm);
    const buffer = await Packer.toBuffer(doc);
    const zip = await JSZip.loadAsync(buffer);
    const xmlFile = zip.file("word/document.xml");
    expect(xmlFile).not.toBeNull();
    const xml = await xmlFile!.async("string");

    // Extract all wp:extent cx="..." values and assert each is within a sane range.
    // The regex matches the first occurrence; a valid 192px logo produces cx=1828800.
    const matches = [...xml.matchAll(/wp:extent\s+cx="(\d+)"/g)];
    expect(matches.length).toBeGreaterThan(0);

    for (const match of matches) {
      const cx = parseInt(match[1], 10);
      // Must be a positive integer and < 10_000_000 EMU (≈ 11 inches)
      expect(cx).toBeGreaterThan(0);
      expect(cx).toBeLessThan(10_000_000);
    }
  });
});

// DOCX-GRID-01: table grid column-collapse regression guard.
//
// Microsoft Word lays out column widths from <w:tblGrid><w:gridCol w:w="N"/>. When
// columnWidths is omitted from the docx Table constructor the library emits a
// placeholder grid of w:w="100" (≈ 0.07 inch) causing both columns to collapse to
// ~1 character wide and all cell text to wrap one letter per line (invisible in
// browsers/mammoth which auto-expand columns, but fatal in Word).
//
// This test unzips the generated .docx, reads word/document.xml, and asserts that
// every <w:gridCol> carries a real width (> 1000 dxa) and that the two-column grid
// sums to approximately TABLE_WIDTH_DXA (9360 ± 10 for any rounding).
// The test FAILS against the old code that emitted w:w="100".
describe("DOCX-GRID-01: table grid column-collapse regression", () => {
  it("w:tblGrid gridCol widths are real (> 1000 dxa each) and sum to ~9360 (not collapsed placeholder 100)", async () => {
    const doc = buildReportDocx(validVm);
    const buffer = await Packer.toBuffer(doc);
    const zip = await JSZip.loadAsync(buffer);
    const xmlFile = zip.file("word/document.xml");
    expect(xmlFile).not.toBeNull();
    const xml = await xmlFile!.async("string");

    // Extract all <w:tblGrid> blocks and the gridCol widths within the first one.
    // A real two-column table should have exactly 2 gridCol entries summing to 9360.
    const tblGridMatch = xml.match(/<w:tblGrid>([\s\S]*?)<\/w:tblGrid>/);
    expect(tblGridMatch).not.toBeNull();
    const tblGridXml = tblGridMatch![1];

    const gridColMatches = [
      ...tblGridXml.matchAll(/<w:gridCol[^/]*w:w="(\d+)"/g),
    ];
    // Must have exactly 2 columns (label + value)
    expect(gridColMatches.length).toBe(2);

    const widths = gridColMatches.map((m) => parseInt(m[1], 10));
    // Each column must be a real width — the collapsed placeholder is w:w="100" (~0.07 in).
    // Label col ≈ 3931 dxa, value col ≈ 5429 dxa — both well above 1000.
    for (const w of widths) {
      expect(w).toBeGreaterThan(1000);
    }

    // Total must match TABLE_WIDTH_DXA (9360) within a small rounding tolerance.
    const total = widths.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(9350);
    expect(total).toBeLessThanOrEqual(9370);
  });
});
