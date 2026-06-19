// claims-schema.ts — validates a single row from the CMS Medicare Claims Quality Measures
// dataset (ijh5-nb2v). Field names verified against tests/fixtures/claims-686123.json
// (CLAUDE.md rule #3). Dataset confirmed live via CMS metastore 2026-06-18/2026-06-19.
//
// Design decisions (from 05-CONTEXT.md / 05-PATTERNS.md):
//   D-04: .passthrough() — only depended-on fields are modeled; extras pass through.
//   D-05: required keys with nullableNum — missing key fails loud (DATA-06 invariant).
//   D-07: adjusted_score is coerced via nullableNum ("" → null; "25.5" → 25.5).
//   D-15: Only adjusted_score is modeled; observed_score/expected_score pass through.
//   T-05-V5-NUM: nullableNum rejects non-numeric strings — malformed scores never
//                coerced into fabricated numbers (CLAUDE.md rule #4 / T-05-V5-NUM).

import { z } from "zod";

// Helper: validate a CMS numeric field. CMS returns these as strings (often "" when
// suppressed), as a real number, or null — never as a boolean/array/object.
// Behaviors:  ""/"   " → null  |  "0" → 0  |  "5" → 5  |  null → null  |  5 → 5
// A non-numeric string OR any other type (boolean, array, object) is REJECTED, so
// malformed CMS data can never be silently coerced into a fabricated number
// (CLAUDE.md rule #4 / review CR-01). z.coerce.number() is intentionally NOT used
// because Number(true) === 1 and Number([]) === 0 would pass validation.
// Copied verbatim from schema.ts (inline — not imported, per 05-PATTERNS.md).
const nullableNum = z
  .union([z.string(), z.number(), z.null()])
  .transform((v, ctx) => {
    if (v === null) return null;
    if (typeof v === "number") return v;
    const trimmed = v.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      ctx.addIssue({
        code: "custom",
        message: `Expected a numeric string, got "${v}"`,
      });
      return z.NEVER;
    }
    return n;
  });

/**
 * ClaimsRowSchema — validates a single row from ijh5-nb2v (Medicare Claims Quality Measures).
 *
 * Field names verified against tests/fixtures/claims-686123.json (CLAUDE.md rule #3).
 * Dataset ID `ijh5-nb2v` confirmed live via CMS metastore 2026-06-18 and re-confirmed 2026-06-19.
 *
 * Key decisions:
 * - adjusted_score uses nullableNum: "" → null (suppressed), "25.575578" → 25.575578 (coerced).
 * - observed_score and expected_score are NOT declared keys (D-15: display adjusted only;
 *   they pass through via .passthrough()).
 * - footnote_for_score is preserved as a string ("" when no suppression; footnote code when suppressed).
 */
export const ClaimsRowSchema = z
  .object({
    // Identity fields — verified in tests/fixtures/claims-686123.json (rule #3)
    cms_certification_number_ccn: z.string(),
    measure_code: z.string(), // "521" | "522" | "551" | "552"
    measure_description: z.string(),
    resident_type: z.string(), // "Short Stay" | "Long Stay"

    // Facility adjusted score: coerced from CMS string; "" → null (suppressed)
    // D-15: only adjusted_score; observed/expected pass through via .passthrough()
    adjusted_score: nullableNum,

    // Suppression signal: "" = not suppressed; footnote code (e.g. "9") = suppressed
    footnote_for_score: z.string(),

    processing_date: z.string(),
  })
  .passthrough(); // D-04: unmodeled columns (observed_score, expected_score, etc.) pass through

/** Typed output of ClaimsRowSchema. Consumers use this type (not snake_case fields directly). */
export type ClaimsRow = z.infer<typeof ClaimsRowSchema>;
