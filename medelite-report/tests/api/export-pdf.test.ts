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
