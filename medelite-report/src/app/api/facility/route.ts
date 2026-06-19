// route.ts — GET /api/facility?ccn=<CCN>
//
// Thin route handler: CCN gate → fetchFacility pipeline → exhaustive CmsError→HTTP mapping.
// Non-dynamic route: CCN comes from query string (?ccn=), NOT from ctx.params.
// (ctx.params would only exist for /api/facility/[ccn]/route.ts — this is not that.)
//
// Security:
//   T-02-CCN: trim + uppercase-normalize + /^[A-Za-z0-9]{6}$/ gate before any fetch (D-22/D-07)
//   T-02-LEAK: validation_error body is ONLY { kind, message } — no ccn, no Zod internals (D-05)
//
// NJS16 notes (AGENTS.md / route.md):
//   - Read CCN from request.nextUrl.searchParams.get('ccn') — NOT ctx.params
//   - Response.json(body, { status }) — web-standard, no import needed
//   - export const runtime = 'nodejs' — D-25, future-proofs for react-pdf

import type { NextRequest } from "next/server";
import {
  fetchFacility,
  fetchClaimsMeasures,
  fetchAverages,
} from "@/lib/cms/client";
import { joinClaimsAndAverages } from "@/lib/cms/claims-mapper";
import type { HospMetric } from "@/lib/cms/types";
import { CmsError, assertNever } from "@/lib/cms/errors";

// D-25: explicit Node.js runtime — required for routes that will later import @react-pdf/renderer
export const runtime = "nodejs";

/**
 * GET /api/facility?ccn=<CCN>
 *
 * Returns 200 with { data: FacilityData } on success.
 * Returns an error envelope { error: { kind, message, ...extra } } on failure (D-02).
 *
 * HTTP status mapping (D-01):
 *   400  invalid_ccn      — CCN missing/malformed (before any fetch)
 *   404  not_found        — valid format, no CMS row found; body includes echoed ccn (D-07)
 *   502  network_error    — upstream CMS timeout or network failure
 *   502  cms_api_error    — CMS returned non-200
 *   502  validation_error — CMS row failed Zod validation; NO Zod internals in body (D-05)
 */
export async function GET(request: NextRequest) {
  // 1. Read raw CCN from query string (non-dynamic route — no ctx.params)
  const raw = request.nextUrl.searchParams.get("ccn");

  // 2. Missing/null param → immediate 400
  if (raw === null) {
    return Response.json(
      {
        error: {
          kind: "invalid_ccn",
          message: "CCN must be exactly 6 alphanumeric characters.",
        },
      },
      { status: 400 },
    );
  }

  // 3. Normalize: trim whitespace + uppercase (D-22/D-07)
  //    Cap-then-reflect: length-cap ensures we only echo a short safe string (D-07)
  const ccn = raw.trim().toUpperCase().slice(0, 20); // max 20 chars before gate

  // 4. Format gate — /^[A-Za-z0-9]{6}$/ (D-22: NOT ^\d{6}$ — alphanumeric state codes exist)
  if (!/^[A-Za-z0-9]{6}$/.test(ccn)) {
    return Response.json(
      {
        error: {
          kind: "invalid_ccn",
          message: "CCN must be exactly 6 alphanumeric characters.",
        },
      },
      { status: 400 },
    );
  }

  // 5. Full pipeline: fetch + validate + map (may throw CmsError)
  //
  // Fan-out architecture (D-07/D-08):
  //   1. fetchFacility is the ONLY hard dependency — throws CmsError on failure (unchanged).
  //   2. After provider info resolves, fan out to both bonus datasets via Promise.allSettled.
  //      fetchAverages needs facility.state (only known after provider resolves — Pitfall 2).
  //   3. Both allSettled results fulfilled → join 12 rows (even if claims < 4: per-row partial, D-10/SC#5).
  //      Either allSettled result rejected → hospMetrics absent (whole-section degrade, D-09).
  //
  // Worst-case timing note: provider ~8s then parallel bonus ~8s = ~16s total;
  // each fetch has its own AbortSignal.timeout(8000) so a hung claims/averages call
  // degrades (D-09) rather than holding the request past the Vercel ~10s wall.
  // In practice CMS responds in <2s so this is theoretical headroom only.
  try {
    const facility = await fetchFacility(ccn); // hard dependency — throws on failure

    // Fan out to claims + averages concurrently after provider info resolves (D-07/D-08).
    // allSettled absorbs rejections — claims/averages failures never reach the CmsError switch.
    const [claimsResult, averagesResult] = await Promise.allSettled([
      fetchClaimsMeasures(ccn),
      fetchAverages(facility.state),
    ]);

    // Determine hospMetrics: both fulfilled → 12-row join; either rejected → undefined (D-09).
    // The gate is the allSettled fulfilled/rejected status ONLY — not the claims row count.
    // A fewer-than-4 claims set yields per-row suppression (D-10/SC#5), not a degrade.
    let hospMetrics: HospMetric[] | undefined;
    if (
      claimsResult.status === "fulfilled" &&
      averagesResult.status === "fulfilled"
    ) {
      hospMetrics = joinClaimsAndAverages(
        claimsResult.value,
        averagesResult.value.nation,
        averagesResult.value.state,
      );
    }
    // Either rejected → hospMetrics stays undefined (D-09 graceful degrade).
    // undefined is omitted from JSON automatically; the client treats absent hospMetrics
    // as the degraded state and renders a "temporarily unavailable" line (D-09).

    return Response.json({ data: facility, hospMetrics }, { status: 200 });
  } catch (err) {
    // Re-throw non-CmsError (unexpected JS exceptions — don't silently swallow)
    if (!(err instanceof CmsError)) throw err;

    // Exhaustive switch — assertNever at default gives a compile error if a 6th kind is added
    // without a corresponding case (D-03 exhaustiveness).
    switch (err.kind) {
      case "invalid_ccn":
        return Response.json(
          { error: { kind: err.kind, message: err.message } },
          { status: 400 },
        );

      case "not_found":
        // D-07: echo the normalized, format-passed CCN (not raw user input)
        return Response.json(
          { error: { kind: err.kind, message: err.message, ccn } },
          { status: 404 },
        );

      case "network_error":
        return Response.json(
          { error: { kind: err.kind, message: err.message } },
          { status: 502 },
        );

      case "cms_api_error":
        return Response.json(
          { error: { kind: err.kind, message: err.message } },
          { status: 502 },
        );

      case "validation_error":
        // ⚠ D-05 T-02-LEAK: ONLY { kind, message } — NO ccn, NO extra, NO Zod internals
        // The console.error with CCN + prettified Zod issues is done in client.ts (D-06)
        return Response.json(
          { error: { kind: err.kind, message: err.message } },
          { status: 502 },
        );

      default:
        // err is a CmsError instance (a class), so the switch narrows err.kind — not err
        // itself — to `never` here. Pass the discriminant: if a 6th kind is ever added to
        // CmsApiError without a case above, err.kind stops narrowing to never and this
        // line fails to compile (D-03 exhaustiveness preserved).
        return assertNever(err.kind);
    }
  }
}
