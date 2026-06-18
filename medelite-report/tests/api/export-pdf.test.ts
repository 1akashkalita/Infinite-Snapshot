import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/export/pdf/route";
import { assembleViewModel } from "@/lib/report/view-model";
import { toFacilityData } from "@/lib/cms/mapper";
import { parseCMSRow } from "@/lib/cms/parse";
import providerFixture from "../fixtures/provider-686123.json";

// D-20/D-21: POST /api/export/pdf stub — Zod-validates incoming body.
//   Bad shape → 400 { error: { kind: 'invalid_request', message } }
//   Valid ReportViewModel → 501 { error: { kind: 'not_implemented', message } }
//   No Zod internals in 400 body (same envelope discipline as the facility route D-05).

const FIXED_DATE = "2026-06-17T12:00:00Z";

// Build a valid ReportViewModel from the captured fixture (D-11 / CLAUDE.md rule #3).
const validVm = assembleViewModel(
  toFacilityData(parseCMSRow(providerFixture[0])),
  {},
  FIXED_DATE,
);

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

describe("POST /api/export/pdf — valid ReportViewModel body (D-21)", () => {
  it("returns 501 for a valid ReportViewModel", async () => {
    const resp = await POST(makeRequest(validVm));
    expect(resp.status).toBe(501);
  });

  it("returns kind: 'not_implemented' for a valid body", async () => {
    const resp = await POST(makeRequest(validVm));
    const body = await resp.json();
    expect(body.error.kind).toBe("not_implemented");
  });

  it("501 body has a message string", async () => {
    const resp = await POST(makeRequest(validVm));
    const body = await resp.json();
    expect(typeof body.error.message).toBe("string");
    expect(body.error.message.length).toBeGreaterThan(0);
  });
});

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

  it("SC#2: static header strings appear in the PDF buffer (CLAUDE.md rule #2)", async () => {
    const resp = await POST(makeRequest(validVm));
    const buf = Buffer.from(await resp.arrayBuffer());
    const latin1 = buf.toString("latin1");
    expect(latin1).toContain("INFINITE");
    expect(latin1).toContain("FACILITY ASSESSMENT SNAPSHOT");
    expect(latin1).toContain("FL");
  });

  it("rule #2: facility name appears in body but platformLine header is intact", async () => {
    const resp = await POST(makeRequest(validVm));
    const buf = Buffer.from(await resp.arrayBuffer());
    const latin1 = buf.toString("latin1");
    // The header platformLine must be present:
    expect(latin1).toContain("INFINITE");
    // Facility name appears in the PDF body:
    expect(latin1).toContain("KENDALL LAKES");
  });
});
