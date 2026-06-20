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

  // DOCX-01 footer hyperlink assertions (rule #7: clickable Medicare link in every export).
  it('footer contains the CMS link label "View official CMS profile on Medicare.gov"', async () => {
    const { xml } = await getFilledXml(validVm);
    expect(xml).toContain("View official CMS profile on Medicare.gov");
  });

  it('footer contains the processing-date label "CMS dataset processing date"', async () => {
    const { xml } = await getFilledXml(validVm);
    expect(xml).toContain("CMS dataset processing date");
  });

  it('footer contains a <w:hyperlink with r:id="rIdCmsLink"', async () => {
    const { xml } = await getFilledXml(validVm);
    expect(xml).toContain('r:id="rIdCmsLink"');
    expect(xml).toContain("<w:hyperlink");
  });

  it("footer has a right tab stop at pos 9600 to right-align the processing date", async () => {
    const { xml } = await getFilledXml(validVm);
    // Fix 1: right-align footer date — paragraph must declare a right tab stop at 9600 dxa
    expect(xml).toContain('w:val="right"');
    expect(xml).toContain('w:pos="9600"');
  });

  it("word/_rels/document.xml.rels contains rIdCmsLink External relationship pointing to careCompareUrl", async () => {
    const bytes = await buildReportDocxBuffer(validVm);
    const zip = await JSZip.loadAsync(bytes);
    const relsFile = zip.file("word/_rels/document.xml.rels");
    expect(relsFile).not.toBeNull();
    const rels = await relsFile!.async("string");
    expect(rels).toContain('Id="rIdCmsLink"');
    expect(rels).toContain('TargetMode="External"');
    // careCompareUrl for CCN 686123
    expect(rels).toContain(
      "https://www.medicare.gov/care-compare/details/nursing-home/686123",
    );
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

// ---------------------------------------------------------------------------
// CR-01 footgun regression — $ in user input must NOT corrupt OOXML
//
// This test WOULD FAIL against the original string-form .replace() calls
// because JS replacement-pattern metacharacters ($&, $`, $', $$, $1…) would
// be expanded against the match, producing nested/unbalanced <w:t> tags and
// corrupt OOXML that Word cannot open. The callback-form fix (CR-01) makes
// the returned string always literal, so these tests pass.
// ---------------------------------------------------------------------------

describe("CR-01 footgun — $ in user input survives OOXML fill verbatim", () => {
  // The value contains every JS replacement-pattern metacharacter:
  //   $&  → whole match  (corrupts if string-form)
  //   $1  → capture group 1
  //   $$  → literal $ in string-form (but double-expansion would still mangle)
  //   $`  → string before match
  //   $'  → string after match
  const DOLLAR_VALUE = "Cost: $5 $& $1 $$ $`  $' /visit";

  // Build a vm with the dollar-laden string as the nameOverride (→ displayName).
  // ManualInputs.nameOverride has no Zod cap (it's an interface); only the schema
  // enforces .max(500), and this value is ~30 chars — well within the cap.
  const dollarVm = assembleViewModel(
    toFacilityData(parseCMSRow(providerFixture[0])),
    { nameOverride: DOLLAR_VALUE },
    FIXED_DATE,
  );

  it("$ in displayName: document.xml contains the literal value (XML-escaped)", async () => {
    const bytes = await buildReportDocxBuffer(dollarVm);
    const zip = await JSZip.loadAsync(bytes);
    const xmlFile = zip.file("word/document.xml");
    expect(xmlFile).not.toBeNull();
    const xml = await xmlFile!.async("string");

    // The value as it must appear after XML-escaping by xmlEsc():
    //   & → &amp;  (none in our value, but $ must survive literally)
    //   $ is NOT an XML special char, so xmlEsc leaves it as-is.
    // The critical assertion: every `$` sequence survives verbatim — none got
    // re-expanded as a JS replacement-pattern metacharacter.
    expect(xml).toContain("Cost: $5 $&amp; $1 $$ $`  $&apos; /visit");
    // Specifically confirm the literal "$&" sequence (most dangerous metacharacter):
    expect(xml).toContain("$&amp;");
    // And "$1" (capture-group reference that must NOT be expanded):
    expect(xml).toContain("$1");
  });

  it("$ in displayName: document.xml has no nested <w:t> inside <w:t> (structure not corrupted)", async () => {
    const bytes = await buildReportDocxBuffer(dollarVm);
    const zip = await JSZip.loadAsync(bytes);
    const xmlFile = zip.file("word/document.xml");
    const xml = await xmlFile!.async("string");
    // A nested <w:t> immediately inside another <w:t> is the canonical corruption
    // signature produced by the string-form .replace() when $& or $` re-expand.
    // Regex: <w:t…> … <w:t (with any content in between that is not </w:t>)
    expect(xml).not.toMatch(/<w:t\b[^>]*>[^<]*<w:t\b/);
  });

  it("$ in displayName: no unmatched </w:t> (tag count balanced)", async () => {
    const bytes = await buildReportDocxBuffer(dollarVm);
    const zip = await JSZip.loadAsync(bytes);
    const xmlFile = zip.file("word/document.xml");
    const xml = await xmlFile!.async("string");
    // Count opening and closing w:t tags — they must balance.
    const opens = (xml.match(/<w:t\b/g) ?? []).length;
    const closes = (xml.match(/<\/w:t>/g) ?? []).length;
    expect(opens).toEqual(closes);
  });

  // Rels path: the careCompareUrl schema validates protocol + hostname but not the
  // path, so a URL with $& in the path passes the Zod refine. We inject it directly
  // into the vm (bypassing assembleViewModel which always computes it from the CCN)
  // to test the rels .replace() callback fix.
  it("$ in careCompareUrl path: rels file is not corrupted", async () => {
    // Construct a vm whose careCompareUrl ends with $& in the path.
    // The schema refine only checks protocol (https:) + hostname (www.medicare.gov),
    // so this URL passes ReportViewModelSchema validation.
    const dollarUrlVm = {
      ...dollarVm,
      facility: {
        ...dollarVm.facility,
        careCompareUrl:
          "https://www.medicare.gov/care-compare/details/nursing-home/686123$&",
      },
    };

    const bytes = await buildReportDocxBuffer(dollarUrlVm);
    const zip = await JSZip.loadAsync(bytes);
    const relsFile = zip.file("word/_rels/document.xml.rels");
    expect(relsFile).not.toBeNull();
    const rels = await relsFile!.async("string");

    // The literal "$&" must appear in the Target attribute, NOT re-expanded.
    expect(rels).toContain("686123$&amp;");
    // The rels file must not have a spurious extra </Relationships> tag (the
    // corruption signature when $& re-inserts the search string "</Relationships>").
    const closeCount = (rels.match(/<\/Relationships>/g) ?? []).length;
    expect(closeCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Task 3: colored Unicode star runs in docx (D-11 / VIZ-02 / T-7-02)
//
// Guards:
//  - Green hex (#16a34a → "16a34a") present in w:val for an overall_rating=5 (green band).
//  - Unicode filled star glyph (★) present in the filled star row XML.
//  - Red hex (#dc2626 → "dc2626") present for staffing_rating=2 (red band).
//  - null-rating vm → grey hex ("9ca3af") + "N/A" text, no "★" glyph (D-06).
//  - T-7-02: no raw `<` or `>` from xmlEsc injection can appear in the star fragment
//    (closed-enum hex + integer only; no client free-text in the interpolation).
// ---------------------------------------------------------------------------

describe("DOCX star-run injection — D-11 / VIZ-02 / T-7-02", () => {
  // validVm uses fixture CCN 686123: overall_rating=5 (green), staffing_rating=2 (red).
  async function getDocxXml(vm: typeof validVm): Promise<string> {
    const bytes = await buildReportDocxBuffer(vm);
    const zip = await JSZip.loadAsync(bytes);
    const xmlFile = zip.file("word/document.xml");
    expect(xmlFile).not.toBeNull();
    return xmlFile!.async("string");
  }

  it("overall_rating=5 (green band) → w:val contains green hex '16a34a'", async () => {
    const xml = await getDocxXml(validVm);
    // Green band = STAR_BAND_HEX.green = "#16a34a"; strip "#" → "16a34a"
    expect(xml).toContain('w:val="16a34a"');
  });

  it("staffing_rating=2 (red band) → w:val contains red hex 'dc2626'", async () => {
    const xml = await getDocxXml(validVm);
    // Red band = STAR_BAND_HEX.red = "#dc2626"; strip "#" → "dc2626"
    expect(xml).toContain('w:val="dc2626"');
  });

  it("VIZ-02: filled star glyph ★ is present in the XML for a rated star row", async () => {
    const xml = await getDocxXml(validVm);
    expect(xml).toContain("★");
  });

  it("overall_rating=5 → text '★★★★★ 5/5' is present in the XML (5 filled, no outline in injected run)", async () => {
    const xml = await getDocxXml(validVm);
    // buildStarGlyphs(5) = "★★★★★"; full injected run text = "★★★★★ 5/5"
    expect(xml).toContain("★★★★★");
    // The injected run must contain the numeric label confirming all 5 are filled
    expect(xml).toContain("★★★★★ 5/5");
  });

  it("D-06: null-rating vm → grey hex '9ca3af' and 'N/A' text, no ★ glyph", async () => {
    // Build a vm with all star ratings explicitly null (suppress via direct override).
    // We need to bypass assembleViewModel (which reads from fixture) and produce a vm
    // with null starRatings — use spread to override the facility.starRatings fields.
    const nullRatingVm = {
      ...validVm,
      facility: {
        ...validVm.facility,
        starRatings: {
          overall: null,
          healthInspection: null,
          staffing: null,
          qualityCare: null,
        },
      },
    };

    const xml = await getDocxXml(nullRatingVm as typeof validVm);
    // null → buildStarRunXml(null) → grey "N/A" run
    expect(xml).toContain('w:val="9ca3af"');
    expect(xml).toContain("N/A");
    // No filled star glyph should appear for any of the null star rows
    expect(xml).not.toContain("★");
  });

  it("T-7-02: star OOXML fragment contains no unescaped XML angle brackets from input", async () => {
    // Security guard: buildStarRunXml interpolates only STAR_BAND_HEX hex values and
    // an integer rating — no client free-text reaches the fragment. This test confirms
    // the fragment is well-formed by verifying each <w:r> is closed (no unclosed tags).
    const xml = await getDocxXml(validVm);
    // Every <w:r> must be closed with </w:r>
    const opens = (xml.match(/<w:r\b/g) ?? []).length;
    const closes = (xml.match(/<\/w:r>/g) ?? []).length;
    expect(opens).toEqual(closes);
  });
});
