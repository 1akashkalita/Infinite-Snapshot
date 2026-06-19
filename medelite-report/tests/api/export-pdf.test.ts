import { describe, expect, it } from "vitest";
import { inflateSync } from "zlib";
import { POST } from "@/app/api/export/pdf/route";
import { assembleViewModel } from "@/lib/report/view-model";
import { toFacilityData } from "@/lib/cms/mapper";
import { parseCMSRow } from "@/lib/cms/parse";
import { joinClaimsAndAverages } from "@/lib/cms/claims-mapper";
import { ClaimsRowSchema } from "@/lib/cms/claims-schema";
import { AveragesRowSchema } from "@/lib/cms/averages-schema";
import providerFixture from "../fixtures/provider-686123.json";
import claimsFixture from "../fixtures/claims-686123.json";
import averagesFixture from "../fixtures/averages-xcdc.json";

// D-20/D-21: POST /api/export/pdf stub — Zod-validates incoming body.
//   Bad shape → 400 { error: { kind: 'invalid_request', message } }
//   Valid ReportViewModel → 501 { error: { kind: 'not_implemented', message } }
//   No Zod internals in 400 body (same envelope discipline as the facility route D-05).

const FIXED_DATE = "2026-06-17T12:00:00Z";

// Build the 12-item hospMetrics from the captured fixtures (CLAUDE.md rule #3).
// joinClaimsAndAverages is the canonical source of the 12-row array (Plan 02).
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

// Build a vm with 12-item hospMetrics for CLM-03 garble fidelity assertions in the PDF buffer.
const validVmWithMetrics = assembleViewModel(
  toFacilityData(parseCMSRow(providerFixture[0])),
  {},
  FIXED_DATE,
  hospMetrics,
);

// ---------------------------------------------------------------------------
// extractTextFromPdf — helper to read rendered text from a PDF buffer.
//
// react-pdf v4 stores page content in FlateDecode-compressed streams with
// text as hex-encoded glyph codes in TJ operators:
//   [<53686f7274> spacing ...] TJ  →  "Short..."
// A raw latin1 scan does NOT find text (the page content stream is compressed).
// This helper decompresses each stream and extracts the glyph codes.
// Used for CLM-03 garble fidelity assertions (plan 05-04).
// ---------------------------------------------------------------------------
function extractTextFromPdf(pdfBuffer: Buffer): string {
  const latin1 = pdfBuffer.toString("latin1");
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const texts: string[] = [];
  let match;
  while ((match = streamRegex.exec(latin1)) !== null) {
    const raw = Buffer.from(match[1], "latin1");
    try {
      const decompressed = inflateSync(raw).toString("binary");
      // Extract ASCII text from hex-encoded TJ glyph sequences
      const tjMatches = decompressed.matchAll(/\[([^\]]+)\]\s*TJ/g);
      for (const tj of tjMatches) {
        const hexParts = tj[1].matchAll(/<([0-9a-fA-F]+)>/g);
        let chunk = "";
        for (const h of hexParts) {
          const hex = h[1];
          for (let i = 0; i < hex.length; i += 2) {
            const code = parseInt(hex.substring(i, i + 2), 16);
            if (code >= 32 && code < 128) chunk += String.fromCharCode(code);
          }
        }
        if (chunk) texts.push(chunk);
      }
    } catch {
      // Non-compressed or malformed stream — skip
    }
  }
  return texts.join(" ");
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/export/pdf", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/export/pdf — invalid body (D-20/D-21)", () => {
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

  // WR-01: a non-JSON request body throws inside request.json(); the route must catch it
  // and return the contracted 400 invalid_request, not let a raw SyntaxError become a 500.
  it("returns 400 invalid_request for a non-JSON body (not a raw 500)", async () => {
    const req = new Request("http://localhost/api/export/pdf", {
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

// Phase 4 (D-09): The 501/not_implemented stub describe block has been replaced.
// The valid-body 200 assertions now live in the Phase-4 describe block below.

// Phase 4: real PDF response tests (D-09 / SC#5).
// This describe block is RED against the current 501 stub — it will become GREEN in Task 3
// when the stub is replaced with renderToBuffer.
describe("POST /api/export/pdf — Phase 4: real PDF response (D-09 / SC#5)", () => {
  it("returns 200 for a valid ReportViewModel", async () => {
    const resp = await POST(makeRequest(validVm));
    expect(resp.status).toBe(200);
  });

  it("SC#5: Content-Type is application/pdf", async () => {
    const resp = await POST(makeRequest(validVm));
    expect(resp.headers.get("content-type")).toContain("application/pdf");
  });

  it("SC#5: Content-Disposition is attachment", async () => {
    const resp = await POST(makeRequest(validVm));
    expect(resp.headers.get("content-disposition")).toContain("attachment");
  });

  it("SC#5: Content-Disposition filename contains a slug of the facility name", async () => {
    const resp = await POST(makeRequest(validVm));
    const cd = resp.headers.get("content-disposition") ?? "";
    // Kendall Lakes Healthcare and Rehab Center → "kendall-lakes-..."
    expect(cd).toContain("kendall-lakes");
  });

  it("SC#5: Medicare URL appears in the PDF buffer (D-04 / PDF-02)", async () => {
    const resp = await POST(makeRequest(validVm));
    const buf = Buffer.from(await resp.arrayBuffer());
    const url =
      "https://www.medicare.gov/care-compare/details/nursing-home/686123";
    expect(buf.toString("latin1")).toContain(url);
  });

  // SC#2: The page text content stream is FlateDecode-compressed in react-pdf v4, so
  // individual rendered strings ("INFINITE", "FACILITY ASSESSMENT SNAPSHOT") are NOT
  // findable via a raw latin1 scan. Instead, verify:
  //   (a) The PDF is valid (starts with %PDF header)
  //   (b) Helvetica-Bold font resource is present (confirms styled header rendering occurred)
  //   (c) The Document title metadata contains the facility name (uncompressed PDF string)
  // Full visual verification of header content is via a PDF viewer (SC#4 manual check).
  it("SC#2: PDF is valid and uses Helvetica-Bold (confirming styled header rendered)", async () => {
    const resp = await POST(makeRequest(validVm));
    const buf = Buffer.from(await resp.arrayBuffer());
    const latin1 = buf.toString("latin1");
    // Valid PDF signature
    expect(latin1).toContain("%PDF");
    // Helvetica-Bold font referenced — confirms the bold header section was rendered
    expect(latin1).toContain("Helvetica-Bold");
  });

  // rule #2: The facility name appears in uncompressed Document metadata (Title object).
  // The header platformLine is in the compressed content stream; rule #2 is enforced by
  // the ReportPDF component structure (header View receives only vm.header — source assertion).
  it("rule #2: facility name appears in document metadata; PDF is non-empty", async () => {
    const resp = await POST(makeRequest(validVm));
    const buf = Buffer.from(await resp.arrayBuffer());
    const latin1 = buf.toString("latin1");
    // Document Title metadata is uncompressed — facility name is present in the PDF info dict
    expect(latin1).toContain("KENDALL LAKES");
    // Buffer is a real PDF (non-empty, valid header)
    expect(buf.length).toBeGreaterThan(1000);
  });

  // CLM-03: garble fidelity in the PDF buffer — metric labels are rendered verbatim from the
  // reference template (D-04). react-pdf v4 stores page content in FlateDecode-compressed
  // streams (TJ glyph operators). extractTextFromPdf decompresses the stream and decodes the
  // hex-encoded glyph codes to assert rendered text (same technique as the SC#2 Helvetica-Bold
  // font check — uncompressed metadata differs from the compressed content stream).
  // REQUIRED by plan 05-04 Task 2 acceptance criteria (CLM-03 garble fidelity in the PDF).
  it("CLM-03: PDF rendered text contains verbatim metric label 'Short Term Hospitalization'", async () => {
    const resp = await POST(makeRequest(validVmWithMetrics));
    const buf = Buffer.from(await resp.arrayBuffer());
    const text = extractTextFromPdf(buf);
    // "Short Term Hospitalization" is the clean label for the first metric row
    expect(text).toContain("Short Term Hospitalization");
  });

  it("CLM-03: PDF rendered text contains garbled label 'STR State National Avg. for Hospitalization'", async () => {
    const resp = await POST(makeRequest(validVmWithMetrics));
    const buf = Buffer.from(await resp.arrayBuffer());
    const text = extractTextFromPdf(buf);
    // "STR State National Avg. for Hospitalization" is a reference garble (D-04): the word
    // "National" is spurious — it means the STATE average. Preserved verbatim per CLM-03.
    expect(text).toContain("STR State National Avg. for Hospitalization");
  });
});
