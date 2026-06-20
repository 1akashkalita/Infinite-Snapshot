import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/export/docx/route";
import { buildReportDocxBuffer } from "@/lib/docx/ReportDocx";
import { assembleViewModel } from "@/lib/report/view-model";
import { toFacilityData } from "@/lib/cms/mapper";
import { parseCMSRow } from "@/lib/cms/parse";
import { joinClaimsAndAverages } from "@/lib/cms/claims-mapper";
import { ClaimsRowSchema } from "@/lib/cms/claims-schema";
import { AveragesRowSchema } from "@/lib/cms/averages-schema";
import providerFixture from "../fixtures/provider-686123.json";
import claimsFixture from "../fixtures/claims-686123.json";
import averagesFixture from "../fixtures/averages-xcdc.json";
import JSZip from "jszip";

// DOCX-01: POST /api/export/docx route tests.
//   Valid ReportViewModel → 200 OOXML buffer (PK ZIP magic bytes, < 4.5 MB)
//   with correct Content-Type and Content-Disposition .docx filename.
//   Bad shape → 400 { error: { kind: 'invalid_request', message } }
//   No Zod internals in 400 body (D-05 discipline).
//
//   Template-fill assertions (pivot from from-scratch docx primitives):
//   - facility name present in filled XML
//   - at least one metric value present
//   - no residual placeholders remain
//   - yellow shading markers stripped
//   - label-parity: every claims-mapper label appears as a filled row

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

// ---------------------------------------------------------------------------
// Template-fill assertions — replace the obsolete from-scratch docx-primitive
// guards (wp:extent image-extent test and w:gridCol "not collapsed" test) with
// assertions that verify the template fill actually worked correctly.
// ---------------------------------------------------------------------------

describe("DOCX template-fill assertions", () => {
  // Helper: build buffer from vm and parse the word/document.xml
  async function getFilledXml(
    vm: typeof validVm,
  ): Promise<{ xml: string; zip: JSZip }> {
    const bytes = await buildReportDocxBuffer(vm);
    const zip = await JSZip.loadAsync(bytes);
    const xmlFile = zip.file("word/document.xml");
    expect(xmlFile).not.toBeNull();
    const xml = await xmlFile!.async("string");
    return { xml, zip };
  }

  it("filled facility name is present in the document XML", async () => {
    const { xml } = await getFilledXml(validVm);
    // Kendall Lakes Healthcare and Rehab Center (CMS uppercase from fixture)
    expect(xml).toContain("KENDALL LAKES HEALTHCARE AND REHAB CENTER");
  });

  it("at least one metric value from the fixture is present (e.g. a % value)", async () => {
    const { xml } = await getFilledXml(validVmWithMetrics);
    // The fixture for CCN 686123 has real metric values — at least one percentage
    // will appear formatted as "N.N%" in the filled XML. We match the generic pattern.
    expect(xml).toMatch(/\d+\.\d+%/);
  });

  it("no residual {CMS API} placeholder remains", async () => {
    const { xml } = await getFilledXml(validVmWithMetrics);
    expect(xml).not.toContain("{CMS API}");
  });

  it("no residual {Address} placeholder remains", async () => {
    const { xml } = await getFilledXml(validVm);
    expect(xml).not.toContain("{Address}");
  });

  it("no residual {STATE} placeholder remains", async () => {
    const { xml } = await getFilledXml(validVm);
    expect(xml).not.toContain("{STATE}");
  });

  it("no residual {Number of Certified Beds} placeholder remains", async () => {
    const { xml } = await getFilledXml(validVm);
    expect(xml).not.toContain("{Number of Certified Beds}");
  });

  it("no residual {Average Number of Residents per Day} placeholder remains", async () => {
    const { xml } = await getFilledXml(validVm);
    expect(xml).not.toContain("{Average Number of Residents per Day}");
  });

  it("no residual {CMS API Star Rating} placeholder remains", async () => {
    const { xml } = await getFilledXml(validVm);
    expect(xml).not.toContain("{CMS API Star Rating}");
  });

  it("no residual <Text placeholder remains (XML-escaped form)", async () => {
    const { xml } = await getFilledXml(validVm);
    // Template uses <Text> as placeholder — XML-escaped to &lt;Text in the OOXML
    expect(xml).not.toContain("&lt;Text");
  });

  it('yellow shading markers (w:fill="ffff00") are stripped from the output', async () => {
    const { xml } = await getFilledXml(validVmWithMetrics);
    expect(xml).not.toMatch(/w:fill="ffff00"/i);
  });

  // Label-parity guard: every label from claims-mapper must appear as a filled row.
  // This guards against future label drift between the claims-mapper and the template.
  it("all 12 claims-mapper labels appear as filled rows in the output (label-parity guard)", async () => {
    const { xml } = await getFilledXml(validVmWithMetrics);

    // The 12 verbatim labels from claims-mapper.ts (D-04 — garbles preserved)
    const expectedLabels = [
      "Short Term Hospitalization",
      "STR National Avg. for Hospitalization",
      "STR State National Avg. for Hospitalization",
      "STR ED Visit",
      "STR ED Visits National Avg.",
      "STR ED Visits State Avg.",
      "LT Hospitalization",
      "LT National Avg. for Hospitalization",
      "LT State National Avg. for Hospitalization",
      "ED Visit",
      "LT ED Visits National Avg.",
      "LT ED Visits State Avg.",
    ];

    for (const label of expectedLabels) {
      // Each label is in the left cell of a table row — it must appear in the filled XML.
      expect(xml, `Missing label in filled XML: "${label}"`).toContain(label);
    }
  });
});
