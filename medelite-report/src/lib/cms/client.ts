// client.ts — fetchFacility(ccn): Promise<FacilityData>
//
// Full pipeline: URL build → fetch with 8s timeout → status check → Zod validate → map.
// Throws typed CmsError for every failure mode (D-18/D-19).
//
// Security notes:
//   T-02-SSRF: host+path come from fixed constants (CMS_BASE_URL/DATASET_PROVIDER_INFO).
//              CCN is passed ONLY as a conditions[0][value] — never concatenated into host/path.
//   T-02-DOS: AbortSignal.timeout(8000) caps upstream CMS latency (D-19).
//   T-02-LEAK: validation_error CmsError carries no extra field; prettified Zod issues are
//              console.error'd server-side only (D-05/D-06).
//
// CCN format gating is the route handler's responsibility (D-22 / Task 3).
// This function receives a pre-validated, normalized CCN.

import { z } from "zod";
import { safeParseCMSRow } from "@/lib/cms/parse";
import { toFacilityData } from "@/lib/cms/mapper";
import { CmsError } from "@/lib/cms/errors";
import {
  CMS_BASE_URL,
  DATASET_PROVIDER_INFO,
  CCN_FILTER_FIELD,
} from "@/lib/cms/constants";
import type { FacilityData } from "@/lib/cms/types";

/**
 * Fetches a single facility from the CMS Provider Information dataset by CCN.
 *
 * Pipeline:
 *   1. Build URL from fixed constants + CCN as a condition value only (T-02-SSRF)
 *   2. Fetch with 8s AbortSignal.timeout (D-19 — fail fast; no auto-retry in v1, D-23)
 *   3. Non-200 → cms_api_error (D-18)
 *   4. Zero rows → not_found
 *   5. Zod validate via safeParseCMSRow → validation_error on failure (D-05/D-06)
 *   6. toFacilityData → FacilityData (camelCase domain model, D-14)
 *
 * @param ccn - Pre-validated, normalized 6-alphanumeric CCN from the route handler (D-22)
 * @throws {CmsError} kind: network_error | cms_api_error | not_found | validation_error
 */
export async function fetchFacility(ccn: string): Promise<FacilityData> {
  // Build URL: host+path from fixed constants; CCN is only a condition value (T-02-SSRF)
  const url = new URL(`${CMS_BASE_URL}/${DATASET_PROVIDER_INFO}/0`);
  url.searchParams.set("conditions[0][property]", CCN_FILTER_FIELD);
  url.searchParams.set("conditions[0][value]", ccn);
  // Single "=" operator — "==" returns HTTP 400 from CMS (verified in RESEARCH.md Pitfall 3)
  url.searchParams.set("conditions[0][operator]", "=");
  url.searchParams.set("limit", "1");

  // Fetch with 8s timeout (D-19: fail fast; catch both AbortError and network failures)
  let resp: Response;
  try {
    resp = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
  } catch {
    // AbortError from timeout, network unreachable, ECONNREFUSED, etc.
    // D-04: retry copy OK for network_error (transient; user can try again)
    throw new CmsError(
      "network_error",
      "CMS data is unavailable — please try again.",
    );
  }

  // D-18: non-200 from CMS (5xx, 4xx, etc.)
  // D-04: retry copy OK for cms_api_error (transient)
  if (!resp.ok) {
    throw new CmsError(
      "cms_api_error",
      "CMS returned an error — please try again.",
    );
  }

  // Parse the JSON response — CMS returns { count, results }
  const json = (await resp.json()) as { count: number; results: unknown[] };

  // Zero rows → not_found (CCN does not exist in the dataset)
  if (json.results.length === 0) {
    throw new CmsError(
      "not_found",
      `No facility found for CCN ${ccn}.`,
      { ccn }, // D-07: the normalized CCN echoed for route handler to include in 404 body
    );
  }

  // Zod validate via safeParseCMSRow (CLAUDE.md rule #4: never use unvalidated CMS data)
  const parseResult = safeParseCMSRow(json.results[0]);
  if (!parseResult.success) {
    // D-06: log server-side only — includes CCN + full prettified Zod issues
    console.error(
      `[validation_error] CCN=${ccn}`,
      z.prettifyError(parseResult.error),
    );
    // D-04/D-05: honest non-retry message; no Zod internals in the thrown error
    // ⚠ DELIBERATE: no extra field on validation_error CmsError (D-05 T-02-LEAK)
    throw new CmsError(
      "validation_error",
      "We couldn't read this facility's data right now.",
    );
  }

  // Map validated ParsedProvider to camelCase FacilityData (D-14/D-16)
  return toFacilityData(parseResult.data);
}
