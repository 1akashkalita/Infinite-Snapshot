// averages-schema.ts — validates a single row from the CMS State/US Averages dataset
// (xcdc-v8bm). Field names verified against tests/fixtures/averages-xcdc.json
// (CLAUDE.md rule #3). Dataset confirmed live via CMS metastore 2026-06-18/2026-06-19.
//
// Design decisions (from 05-CONTEXT.md / 05-PATTERNS.md):
//   D-04: .passthrough() — only state_or_nation and processing_date are modeled;
//         all ~45 metric columns (including hash-suffixed ones) pass through.
//   D-14: The 4 average columns are NOT declared as required keys — their hash-suffixed
//         slugs are unstable across CMS re-exports. The claims-mapper.ts uses
//         description-substring matching at runtime to locate the correct column.
//   T-05-V5-PASS: passthrough is by design; the mapper reads only description-matched
//                 columns, which are coerced to numbers downstream (not executed raw).
//
// The two required keys (state_or_nation + processing_date) are verified present in
// tests/fixtures/averages-xcdc.json (rule #3).

import { z } from "zod";

/**
 * AveragesRowSchema — validates a single row from xcdc-v8bm (State/US Averages).
 *
 * Field names verified against tests/fixtures/averages-xcdc.json (CLAUDE.md rule #3).
 * Dataset ID `xcdc-v8bm` confirmed live via CMS metastore 2026-06-18 and re-confirmed 2026-06-19.
 *
 * Key decisions:
 * - Only state_or_nation and processing_date are modeled as required keys.
 * - The ~45 metric columns (including 4 claims-average columns with hash-suffixed slugs)
 *   pass through via .passthrough() — the mapper does description-based key scan (D-14).
 * - CRITICAL: Do NOT declare hash-suffixed column slugs here — slugs rotate across
 *   CMS data re-exports. Description-matching in claims-mapper.ts handles this (D-14).
 */
export const AveragesRowSchema = z
  .object({
    // Key field: "NATION" for national averages, or 2-letter state code (e.g. "FL")
    // Verified in tests/fixtures/averages-xcdc.json top-level row key (rule #3)
    state_or_nation: z.string(),
    processing_date: z.string(),
  })
  .passthrough(); // ALL other columns pass through — mapper does description-based key scan (D-14)

/** Typed output of AveragesRowSchema. The ~45 passthrough columns are accessible via index signature. */
export type AveragesRow = z.infer<typeof AveragesRowSchema>;
