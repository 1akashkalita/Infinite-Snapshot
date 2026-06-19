import { describe, expect, it, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/facility/route";
import providerFixture from "../fixtures/provider-686123.json";
import claimsFixture from "../fixtures/claims-686123.json";
import averagesFixture from "../fixtures/averages-xcdc.json";

// Tests for GET /api/facility route handler.
// Uses NextRequest (non-dynamic route: ?ccn= query param, not path segment).
// Stubs global fetch to avoid real CMS calls.
// Covers D-01 (5-kind HTTP taxonomy), D-05 (leak invariant), D-22 (CCN gate).
// Phase 5: covers the 3-dataset allSettled fan-out (D-07/D-08/D-09/D-10/SC#5).

afterEach(() => vi.unstubAllGlobals());

// CMS API envelope wrappers for the three datasets
const providerEnvelope = JSON.stringify({
  count: 1,
  results: [providerFixture[0]],
});
const claimsEnvelope = JSON.stringify({
  count: 4,
  results: claimsFixture,
});
const nationEnvelope = JSON.stringify({
  count: 1,
  results: [averagesFixture.NATION],
});
const flEnvelope = JSON.stringify({
  count: 1,
  results: [averagesFixture.FL],
});

/**
 * Builds a URL-discriminating fetch mock.
 * Each call is routed by dataset ID in the URL path:
 *   4pq5-n9py → provider, ijh5-nb2v → claims, xcdc-v8bm → averages (NATION or FL).
 */
function stubFetchAllThree() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("4pq5-n9py")) {
        return Promise.resolve(new Response(providerEnvelope, { status: 200 }));
      }
      if (url.includes("ijh5-nb2v")) {
        return Promise.resolve(new Response(claimsEnvelope, { status: 200 }));
      }
      if (url.includes("xcdc-v8bm")) {
        // Determine NATION vs FL by conditions[0][value] param
        const u = new URL(url);
        const val = u.searchParams.get("conditions[0][value]");
        const body = val === "NATION" ? nationEnvelope : flEnvelope;
        return Promise.resolve(new Response(body, { status: 200 }));
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    }),
  );
}

// Helper: build a stub fetch that resolves with the provider fixture (only)
function stubFetchHappy() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(providerEnvelope, { status: 200 })),
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

  // Lowercase alphanumeric CCN is uppercased before reaching fetch (D-22 normalization).
  // Uses an alphanumeric CCN so .toUpperCase() is NOT a no-op, and captures the actual
  // condition value sent to the provider fetch — proving normalization rather than just a 200.
  // Note: the route now issues 4 fetches (provider + claims + NATION + FL) via allSettled.
  // We assert on the provider fetch URL (4pq5-n9py) specifically, not on the total call count.
  it("uppercases a lowercase alphanumeric CCN before passing it to fetch", async () => {
    const capturedUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        capturedUrls.push(url);
        // Return valid responses for all three datasets so the handler completes
        if (url.includes("4pq5-n9py")) {
          return Promise.resolve(
            new Response(providerEnvelope, { status: 200 }),
          );
        }
        if (url.includes("ijh5-nb2v")) {
          return Promise.resolve(new Response(claimsEnvelope, { status: 200 }));
        }
        if (url.includes("xcdc-v8bm")) {
          const u = new URL(url);
          const val = u.searchParams.get("conditions[0][value]");
          const body = val === "NATION" ? nationEnvelope : flEnvelope;
          return Promise.resolve(new Response(body, { status: 200 }));
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      }),
    );
    const req = new NextRequest("http://localhost/api/facility?ccn=ab1234");
    const resp = await GET(req);
    expect(resp.status).toBe(200);

    // Check that the provider fetch URL contained the uppercased CCN
    const providerUrl = capturedUrls.find((u) => u.includes("4pq5-n9py"));
    expect(providerUrl).toBeDefined();
    const value = new URL(providerUrl!).searchParams.get(
      "conditions[0][value]",
    );
    expect(value).toBe("AB1234");
    expect(value).not.toBe("ab1234");
  });

  // ---------------------------------------------------------------------------
  // Phase 5: 3-dataset allSettled fan-out (D-07/D-08/D-09/D-10/SC#5)
  // ---------------------------------------------------------------------------

  // Happy path (all 3 datasets succeed) → data + 12-item hospMetrics (CLM-01)
  it("returns 200 with { data: FacilityData, hospMetrics: 12-item array } when all 3 datasets succeed", async () => {
    stubFetchAllThree();
    const req = new NextRequest("http://localhost/api/facility?ccn=686123");
    const resp = await GET(req);
    expect(resp.status).toBe(200);
    const body = await resp.json();
    // data must be the FacilityData (unchanged from Phase 2)
    expect(body.data).toBeDefined();
    expect(body.data.ccn).toBe("686123");
    // hospMetrics must be a 12-item array
    expect(Array.isArray(body.hospMetrics)).toBe(true);
    expect(body.hospMetrics).toHaveLength(12);
    // route must NOT call assembleViewModel (body.data is FacilityData, not a ReportViewModel)
    expect(body.data).not.toHaveProperty("header");
    expect(body.data).not.toHaveProperty("generatedAt");
  });

  // D-07: route uses Promise.allSettled (grep-level assertion via URL capture)
  it("issues the claims + averages fetches after provider resolves (D-07 allSettled)", async () => {
    const fetchedUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        fetchedUrls.push(url);
        if (url.includes("4pq5-n9py")) {
          return Promise.resolve(
            new Response(providerEnvelope, { status: 200 }),
          );
        }
        if (url.includes("ijh5-nb2v")) {
          return Promise.resolve(new Response(claimsEnvelope, { status: 200 }));
        }
        if (url.includes("xcdc-v8bm")) {
          const u = new URL(url);
          const val = u.searchParams.get("conditions[0][value]");
          const body = val === "NATION" ? nationEnvelope : flEnvelope;
          return Promise.resolve(new Response(body, { status: 200 }));
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      }),
    );
    const req = new NextRequest("http://localhost/api/facility?ccn=686123");
    await GET(req);
    // Must have fetched provider + claims + NATION + FL = 4 fetch calls
    expect(fetchedUrls.length).toBe(4);
    expect(fetchedUrls.some((u) => u.includes("4pq5-n9py"))).toBe(true);
    expect(fetchedUrls.some((u) => u.includes("ijh5-nb2v"))).toBe(true);
    expect(fetchedUrls.some((u) => u.includes("xcdc-v8bm"))).toBe(true);
  });

  // D-10/SC#5: partial claims (only 3 of 4 measures) → status 200, hospMetrics still 12 items,
  // missing measure's facility row has value null, its national/state average rows still carry values.
  // This proves a fewer-than-4 claims count does NOT trigger the D-09 whole-section degrade.
  it("D-10/SC#5: partial claims (3 measures) → 200, hospMetrics still 12 rows, missing facility value null but averages present", async () => {
    // Only first 3 of the 4 claims rows (521, 522, 551 — missing 552)
    const partialClaimsEnvelope = JSON.stringify({
      count: 3,
      results: claimsFixture.slice(0, 3),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("4pq5-n9py")) {
          return Promise.resolve(
            new Response(providerEnvelope, { status: 200 }),
          );
        }
        if (url.includes("ijh5-nb2v")) {
          return Promise.resolve(
            new Response(partialClaimsEnvelope, { status: 200 }),
          );
        }
        if (url.includes("xcdc-v8bm")) {
          const u = new URL(url);
          const val = u.searchParams.get("conditions[0][value]");
          const body = val === "NATION" ? nationEnvelope : flEnvelope;
          return Promise.resolve(new Response(body, { status: 200 }));
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      }),
    );
    const req = new NextRequest("http://localhost/api/facility?ccn=686123");
    const resp = await GET(req);
    expect(resp.status).toBe(200);
    const body = await resp.json();
    // hospMetrics must still be 12 rows (no whole-section degrade — D-10/SC#5)
    expect(Array.isArray(body.hospMetrics)).toBe(true);
    expect(body.hospMetrics).toHaveLength(12);
    // Find the rows for measure 552 (ED Visit, LT ED Visits National/State Avg.)
    // Indices 9, 10, 11 correspond to 552 rows in METRIC_DEFINITIONS order
    const edVisitFacilityRow = body.hospMetrics[9]; // "ED Visit" — facility 552
    const edVisitNationRow = body.hospMetrics[10]; // "LT ED Visits National Avg."
    const edVisitStateRow = body.hospMetrics[11]; // "LT ED Visits State Avg."
    // Facility row for absent 552 must have value null (suppressed/absent)
    expect(edVisitFacilityRow.value).toBeNull();
    // National and state average rows must still carry their numeric values (independent of facility claims)
    expect(typeof edVisitNationRow.value).toBe("number");
    expect(typeof edVisitStateRow.value).toBe("number");
  });

  // D-09: claims fetch rejects → status 200, data present, hospMetrics absent
  it("D-09: degrades (hospMetrics absent) when claims fetch rejects, data still present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("4pq5-n9py")) {
          return Promise.resolve(
            new Response(providerEnvelope, { status: 200 }),
          );
        }
        if (url.includes("ijh5-nb2v")) {
          // Simulate network failure on claims
          return Promise.reject(
            new DOMException("The operation was aborted.", "AbortError"),
          );
        }
        if (url.includes("xcdc-v8bm")) {
          const u = new URL(url);
          const val = u.searchParams.get("conditions[0][value]");
          const body = val === "NATION" ? nationEnvelope : flEnvelope;
          return Promise.resolve(new Response(body, { status: 200 }));
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      }),
    );
    const req = new NextRequest("http://localhost/api/facility?ccn=686123");
    const resp = await GET(req);
    expect(resp.status).toBe(200);
    const body = await resp.json();
    // data must still be present
    expect(body.data).toBeDefined();
    expect(body.data.ccn).toBe("686123");
    // hospMetrics must be absent (degraded state — D-09)
    expect(body.hospMetrics).toBeUndefined();
  });

  // D-09: averages fetch rejects → status 200, data present, hospMetrics absent
  it("D-09: degrades (hospMetrics absent) when averages fetch rejects, data still present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("4pq5-n9py")) {
          return Promise.resolve(
            new Response(providerEnvelope, { status: 200 }),
          );
        }
        if (url.includes("ijh5-nb2v")) {
          return Promise.resolve(new Response(claimsEnvelope, { status: 200 }));
        }
        if (url.includes("xcdc-v8bm")) {
          // Simulate CMS non-200 on averages
          return Promise.resolve(new Response("error", { status: 503 }));
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      }),
    );
    const req = new NextRequest("http://localhost/api/facility?ccn=686123");
    const resp = await GET(req);
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.data).toBeDefined();
    expect(body.hospMetrics).toBeUndefined();
  });

  // D-07: provider-info failure still returns existing 5-kind taxonomy (hard dependency unchanged)
  it("D-07: provider-info failure still returns 502 network_error (existing taxonomy unchanged)", async () => {
    stubFetchAbort();
    const req = new NextRequest("http://localhost/api/facility?ccn=686123");
    const resp = await GET(req);
    expect(resp.status).toBe(502);
    const body = await resp.json();
    expect(body.error.kind).toBe("network_error");
    // Must NOT have data or hospMetrics
    expect(body.data).toBeUndefined();
    expect(body.hospMetrics).toBeUndefined();
  });
});
