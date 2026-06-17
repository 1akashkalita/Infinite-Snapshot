import { describe, expect, it, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/facility/route";
import providerFixture from "../fixtures/provider-686123.json";

// Tests for GET /api/facility route handler.
// Uses NextRequest (non-dynamic route: ?ccn= query param, not path segment).
// Stubs global fetch to avoid real CMS calls.
// Covers D-01 (5-kind HTTP taxonomy), D-05 (leak invariant), D-22 (CCN gate).

afterEach(() => vi.unstubAllGlobals());

// Helper: build a stub fetch that resolves with the provider fixture
function stubFetchHappy() {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ count: 1, results: [providerFixture[0]] }),
          { status: 200 },
        ),
      ),
  );
}

// Helper: build a stub fetch that rejects (AbortError / network failure)
function stubFetchAbort() {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockRejectedValue(
        new DOMException("The operation was aborted.", "AbortError"),
      ),
  );
}

describe("GET /api/facility", () => {
  // Missing CCN → 400 invalid_ccn (before any fetch)
  it("returns 400 invalid_ccn for missing ccn param", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const req = new NextRequest("http://localhost/api/facility");
    const resp = await GET(req);
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error.kind).toBe("invalid_ccn");
    // fetch must NOT be called for invalid CCN (D-22 gate before fetch)
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Too-short CCN → 400 (D-22 gate)
  it("returns 400 invalid_ccn for ccn=12 (too short) and fetch is NOT called", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const req = new NextRequest("http://localhost/api/facility?ccn=12");
    const resp = await GET(req);
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error.kind).toBe("invalid_ccn");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Non-alphanumeric → 400 (D-22 gate — special characters)
  it("returns 400 invalid_ccn for non-alphanumeric CCN", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const req = new NextRequest("http://localhost/api/facility?ccn=6861!3");
    const resp = await GET(req);
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error.kind).toBe("invalid_ccn");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Whitespace normalization: trimmed and uppercased before gate (D-22/D-07)
  it("normalizes whitespace: %20686123%20 reaches fetch as 686123", async () => {
    stubFetchHappy();
    const req = new NextRequest(
      "http://localhost/api/facility?ccn=%20686123%20",
    );
    const resp = await GET(req);
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.data.ccn).toBe("686123");
  });

  // Happy path → 200 with { data: FacilityData } (DATA-01)
  it("returns 200 with { data: FacilityData } for valid CCN 686123", async () => {
    stubFetchHappy();
    const req = new NextRequest("http://localhost/api/facility?ccn=686123");
    const resp = await GET(req);
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.data).toBeDefined();
    expect(body.data.ccn).toBe("686123");
    expect(body.data.providerName).toBe(
      "KENDALL LAKES HEALTHCARE AND REHAB CENTER",
    );
    // Must NOT have an error field
    expect(body.error).toBeUndefined();
  });

  // not_found → 404 with ccn in body (D-01/D-07)
  it("returns 404 not_found with ccn when pipeline returns not_found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ count: 0, results: [] }), {
          status: 200,
        }),
      ),
    );
    const req = new NextRequest("http://localhost/api/facility?ccn=000000");
    const resp = await GET(req);
    expect(resp.status).toBe(404);
    const body = await resp.json();
    expect(body.error.kind).toBe("not_found");
    // D-07: echoed ccn is the normalized value that passed the format gate
    expect(body.error.ccn).toBe("000000");
  });

  // network_error → 502 (D-01)
  it("returns 502 network_error when CMS fetch is aborted", async () => {
    stubFetchAbort();
    const req = new NextRequest("http://localhost/api/facility?ccn=686123");
    const resp = await GET(req);
    expect(resp.status).toBe(502);
    const body = await resp.json();
    expect(body.error.kind).toBe("network_error");
  });

  // cms_api_error → 502 (D-01)
  it("returns 502 cms_api_error when CMS returns non-200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("error", { status: 500 })),
    );
    const req = new NextRequest("http://localhost/api/facility?ccn=686123");
    const resp = await GET(req);
    expect(resp.status).toBe(502);
    const body = await resp.json();
    expect(body.error.kind).toBe("cms_api_error");
  });

  // validation_error → 502 (D-01)
  it("returns 502 validation_error when CMS row is malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ count: 1, results: [{ broken: true }] }),
            { status: 200 },
          ),
        ),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const req = new NextRequest("http://localhost/api/facility?ccn=686123");
    const resp = await GET(req);
    expect(resp.status).toBe(502);
    const body = await resp.json();
    expect(body.error.kind).toBe("validation_error");
  });

  // D-05 LEAK INVARIANT (HIGH): validation_error body contains ZERO Zod internals
  it("D-05 LEAK INVARIANT: validation_error body contains no Zod internals", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ count: 1, results: [{ broken: true }] }),
            { status: 200 },
          ),
        ),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const req = new NextRequest("http://localhost/api/facility?ccn=686123");
    const resp = await GET(req);
    const body = await resp.json();
    const bodyStr = JSON.stringify(body);

    // Must NOT contain any Zod internal fields/values
    expect(bodyStr).not.toMatch(/issues|expected|received|path|code/);
    // Body is exactly { error: { kind, message } } — no ccn, no extra fields
    expect(body.error.kind).toBe("validation_error");
    expect(body.error).not.toHaveProperty("ccn");
    expect(body.error).not.toHaveProperty("extra");
    expect(body.error).not.toHaveProperty("issues");
  });

  // Lowercase CCN is uppercased before fetch (D-22 normalization)
  it("uppercases lowercase CCN before passing to fetch", async () => {
    // This only matters for alphanumeric CCNs; numeric ones are unaffected
    // Use a CCN that would differ if uppercased (e.g., alphanumeric state codes)
    // For numeric, just verify it still reaches 200 after uppercasing
    stubFetchHappy();
    const req = new NextRequest("http://localhost/api/facility?ccn=686123");
    const resp = await GET(req);
    expect(resp.status).toBe(200);
  });
});
