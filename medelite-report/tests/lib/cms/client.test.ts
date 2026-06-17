import { describe, expect, it, vi, afterEach } from "vitest";
import { fetchFacility } from "@/lib/cms/client";
import providerFixture from "../../fixtures/provider-686123.json";

// Tests for fetchFacility — the full CMS fetch+timeout+validate+map pipeline.
// Uses vi.stubGlobal('fetch', ...) to stub global fetch; restored after each test.
// Covers all 5 error paths (D-01/D-18/D-19) and the D-06 server-side logging requirement.

afterEach(() => vi.unstubAllGlobals());

describe("fetchFacility", () => {
  // Happy path: returns FacilityData with correct providerName and qualityCare
  it("returns FacilityData for a valid CMS response", async () => {
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
    const facility = await fetchFacility("686123");
    expect(facility.providerName).toBe(
      "KENDALL LAKES HEALTHCARE AND REHAB CENTER",
    );
    expect(facility.starRatings.qualityCare).toBe(5);
    expect(facility.ccn).toBe("686123");
  });

  // D-19: Aborted fetch → network_error (AbortSignal.timeout fires)
  it("throws CmsError network_error when fetch is aborted", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValue(
          new DOMException("The operation was aborted.", "AbortError"),
        ),
    );
    await expect(fetchFacility("686123")).rejects.toMatchObject({
      kind: "network_error",
    });
  });

  // D-19: Any network-level throw → network_error (network unreachable, ECONNREFUSED, etc.)
  it("throws CmsError network_error on generic network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );
    await expect(fetchFacility("686123")).rejects.toMatchObject({
      kind: "network_error",
    });
  });

  // D-18: Non-200 CMS response → cms_api_error
  it("throws CmsError cms_api_error when CMS returns non-200", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("Internal Server Error", { status: 500 }),
        ),
    );
    await expect(fetchFacility("686123")).rejects.toMatchObject({
      kind: "cms_api_error",
    });
  });

  // D-01: Zero rows → not_found with the CCN in extra
  it("throws CmsError not_found when CMS returns zero results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ count: 0, results: [] }), {
          status: 200,
        }),
      ),
    );
    await expect(fetchFacility("000000")).rejects.toMatchObject({
      kind: "not_found",
    });
  });

  // D-05/D-06: Malformed row → validation_error thrown + console.error called with CCN
  it("throws CmsError validation_error for malformed CMS row and logs to console.error", async () => {
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
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(fetchFacility("686123")).rejects.toMatchObject({
      kind: "validation_error",
    });

    // D-06: server-side logging must include the CCN
    expect(errorSpy).toHaveBeenCalled();
    const logArgs = errorSpy.mock.calls[0].join(" ");
    expect(logArgs).toContain("686123");

    errorSpy.mockRestore();
  });

  // D-04: validation_error message is honest non-retry copy (no "please try again")
  it("validation_error message is honest non-retry copy", async () => {
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

    let thrownErr: unknown;
    try {
      await fetchFacility("686123");
    } catch (e) {
      thrownErr = e;
    }

    expect(thrownErr).toMatchObject({ kind: "validation_error" });
    const msg = (thrownErr as { message: string }).message;
    // honest non-retry message — should NOT say "try again"
    expect(msg.toLowerCase()).not.toContain("try again");
  });

  // D-05: thrown validation_error CmsError has no extra field (no Zod internals)
  it("validation_error CmsError carries no extra field (D-05 leak prevention)", async () => {
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

    let thrownErr: unknown;
    try {
      await fetchFacility("686123");
    } catch (e) {
      thrownErr = e;
    }

    expect(thrownErr).toMatchObject({ kind: "validation_error" });
    // No extra field — D-05 invariant
    expect((thrownErr as { extra?: unknown }).extra).toBeUndefined();
  });

  // CMS condition operator must be single '=' (not '==')
  it("constructs CMS URL with single '=' operator (not '==')", async () => {
    const capturedUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        capturedUrls.push(url);
        return Promise.resolve(
          new Response(
            JSON.stringify({ count: 1, results: [providerFixture[0]] }),
            { status: 200 },
          ),
        );
      }),
    );

    await fetchFacility("686123");

    expect(capturedUrls.length).toBeGreaterThan(0);
    const url = capturedUrls[0];
    // Operator must be encoded '=' (as %3D) — NOT '==' (which would be %3D%3D)
    // URL.searchParams.set encodes '=' to '%3D'
    expect(url).toContain("%3D");
    expect(url).not.toContain("%3D%3D");
  });
});
