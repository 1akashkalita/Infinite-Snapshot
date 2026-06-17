// mapper.ts — toFacilityData(parsed: ParsedProvider): FacilityData
//
// The ONLY file (outside schema.ts) that names CMS snake_case column names (D-14).
// All field assignments traced to tests/fixtures/provider-686123.json (CLAUDE.md rule #3).
// Consumers receive the camelCase FacilityData boundary; CMS field names stay here.
//
// Key decisions enforced here:
//   D-15: providerName ← provider_name (NOT legal_business_name — legal name has ", LLC")
//   D-16: starRatings.qualityCare ← qm_rating (NOT longstay_qm_rating or shortstay_qm_rating)
//   DATA-03: no zip in address — zip_code is intentionally excluded
//   D-12: processingDate preserved as string (CMS freshness signal)

import type { ParsedProvider } from "@/lib/cms/schema";
import type { FacilityData } from "@/lib/cms/types";

/**
 * Maps a validated CMS provider row (ParsedProvider) to the camelCase FacilityData domain model.
 *
 * This is the single CMS→domain boundary. Never add CMS field names anywhere else in the
 * codebase — route handlers, view-model, PDF renderer all consume FacilityData, not ParsedProvider.
 *
 * Field name discipline (D-14/D-15/D-16):
 *   - providerName ← provider_name   ⚠ DELIBERATE: NOT legal_business_name (has ", LLC" suffix)
 *   - qualityCare  ← qm_rating       ⚠ DELIBERATE: NOT longstay_qm_rating / shortstay_qm_rating
 *   - zip is EXCLUDED               ⚠ DELIBERATE: DATA-03 — no ZIP in composed address
 */
export function toFacilityData(parsed: ParsedProvider): FacilityData {
  return {
    // Identity — preserved as string (leading zeros, alphanumeric CCNs)
    ccn: parsed.cms_certification_number_ccn,

    // ⚠ D-15/NAME-01: provider_name is the operating name.
    //   legal_business_name = "KENDALL LAKES HEALTHCARE AND REHAB CENTER, LLC" — do NOT use.
    //   A verifier must not "correct" this to legal_business_name; the ", LLC" is unwanted.
    providerName: parsed.provider_name,

    // DATA-03: composed from three fields; zip_code intentionally excluded
    address: {
      street: parsed.provider_address, // "5280 SW 157 AVENUE"
      city: parsed.citytown, // "MIAMI" — NOT provider_city (that field doesn't exist in CMS)
      state: parsed.state, // "FL"   — NOT provider_state (that field doesn't exist in CMS)
    },

    // Top-level state for assembleHeader(state) — CLAUDE.md rule #2 (header takes state, not name)
    state: parsed.state,

    // Star ratings — all from Provider Information dataset (4pq5-n9py)
    starRatings: {
      overall: parsed.overall_rating, // overall_rating (coerced to number|null by schema)
      healthInspection: parsed.health_inspection_rating,
      staffing: parsed.staffing_rating,
      // ⚠ D-16: qm_rating is "Quality of Resident Care" per CLAUDE.md field mapping.
      //   longstay_qm_rating (=5) and shortstay_qm_rating (=3) are different fields — do NOT use.
      qualityCare: parsed.qm_rating,
    },

    // Census Capacity — coerced to number|null by nullableNum in schema (DATA-05)
    certifiedBeds: parsed.number_of_certified_beds,

    // D-12: processing_date is a CMS freshness signal preserved as a string
    processingDate: parsed.processing_date,
  };
}
