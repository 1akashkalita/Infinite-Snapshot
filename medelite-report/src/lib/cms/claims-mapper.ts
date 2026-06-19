// claims-mapper.ts — joinClaimsAndAverages(claimsRows, nationRow, stateRow): HospMetric[]
//
// The ONLY file (outside claims-schema.ts) that names CMS average column description substrings.
// Field name / description discipline enforced here (D-14):
//   - Average columns matched by description substring, NOT by hash-suffixed slug (slug rotation safety).
//   - All output is camelCase HospMetric (no CMS snake_case names in the return type).
//
// Key decisions:
//   D-04: METRIC_DEFINITIONS contains verbatim reference labels — garbles preserved, never "corrected".
//   D-10/SC#5: Always produces 12 rows. Absent facility measure → value null + footnoteCode "".
//              Fewer-than-4 is a per-row partial, NOT a whole-section degrade (route decides that via allSettled).
//   D-14: AVERAGE_COLUMN_DESCRIPTIONS maps measureCode → description substring for runtime key scan.
//   D-15: Only adjusted_score is used (not observed_score / expected_score).
//   T-05-COL: Description-substring match over validated AveragesRow; matched value re-coerced number|null.
//             A renamed column → null → per-row suppression text, never a crash or fabricated number.

import type { ClaimsRow } from "@/lib/cms/claims-schema";
import type { AveragesRow } from "@/lib/cms/averages-schema";
import type { HospMetric } from "@/lib/cms/types";

// --- METRIC_DEFINITIONS ---
// Verbatim labels and source routing for the 12 fixed hospitalization/ED data rows.
// Source: reference template (D-01 / D-04): ".planning/reference/Facility Assessment Snapshot.docx".
// Labels are VERBATIM — do NOT correct the garbles ("STR State National Avg. for Hospitalization",
// bare "ED Visit"). The order here is the canonical output order.
const METRIC_DEFINITIONS = [
  // Short-stay rehospitalization (measure 521, unit: percent)
  {
    label: "Short Term Hospitalization",
    measureCode: "521",
    source: "facility",
    unit: "percent",
  },
  {
    label: "STR National Avg. for Hospitalization",
    measureCode: "521",
    source: "nation",
    unit: "percent",
  },
  {
    label: "STR State National Avg. for Hospitalization",
    measureCode: "521",
    source: "state",
    unit: "percent",
  }, // "National" is spurious in label — means STATE
  // Short-stay outpatient ED (measure 522, unit: percent)
  {
    label: "STR ED Visit",
    measureCode: "522",
    source: "facility",
    unit: "percent",
  },
  {
    label: "STR ED Visits National Avg.",
    measureCode: "522",
    source: "nation",
    unit: "percent",
  },
  {
    label: "STR ED Visits State Avg.",
    measureCode: "522",
    source: "state",
    unit: "percent",
  },
  // Long-stay hospitalizations per 1000 resident days (measure 551, unit: rate)
  {
    label: "LT Hospitalization",
    measureCode: "551",
    source: "facility",
    unit: "rate",
  },
  {
    label: "LT National Avg. for Hospitalization",
    measureCode: "551",
    source: "nation",
    unit: "rate",
  },
  {
    label: "LT State National Avg. for Hospitalization",
    measureCode: "551",
    source: "state",
    unit: "rate",
  }, // same garble = STATE
  // Long-stay ED visits per 1000 resident days (measure 552, unit: rate)
  {
    label: "ED Visit",
    measureCode: "552",
    source: "facility",
    unit: "rate",
  }, // garble: bare label, no "LT" prefix; means LT ED facility
  {
    label: "LT ED Visits National Avg.",
    measureCode: "552",
    source: "nation",
    unit: "rate",
  },
  {
    label: "LT ED Visits State Avg.",
    measureCode: "552",
    source: "state",
    unit: "rate",
  },
] as const;

// --- AVERAGE_COLUMN_DESCRIPTIONS ---
// Map from measure_code → description substring used to identify the correct column in an AveragesRow.
// The hash-suffixed slugs (_1d02, _d911, _de9d) in xcdc-v8bm are UNSTABLE and must NOT be
// hardcoded here or in the schema. The mapper scans AveragesRow keys at runtime for a key
// that CONTAINS the target substring (D-14 / T-05-COL).
//
// Description substrings verified against tests/fixtures/averages-xcdc.json (CLAUDE.md rule #3).
// INVARIANT: each substring must match EXACTLY ONE column in an AveragesRow. A substring that
// matches two columns silently fabricates the wrong average (CR-01). In particular, "outpatient_em"
// is a PREFIX of the 552 column ("...outpatient_emergency_department...") and so matches BOTH the
// 522 percentage and the 552 rate — 522 therefore uses the short-stay-unique "who_had_an_outpatient".
// resolveAverage() enforces the invariant at runtime (ambiguous match → null, never a guess), and
// claims-mapper.test.ts asserts single-column uniqueness against the live fixture.
//   521 → "percentage_of_short_stay_residents_who_were_rehospitalized__1d02" contains "rehospitalized"
//   522 → "percentage_of_short_stay_residents_who_had_an_outpatient_em_d911" contains "who_had_an_outpatient"
//   551 → "number_of_hospitalizations_per_1000_longstay_resident_days" contains "hospitalizations_per_1000_longstay"
//   552 → "number_of_outpatient_emergency_department_visits_per_1000_l_de9d" contains
//          "outpatient_emergency_department_visits_per_1000_l"
export const AVERAGE_COLUMN_DESCRIPTIONS: Record<string, string> = {
  "521": "rehospitalized",
  "522": "who_had_an_outpatient",
  "551": "hospitalizations_per_1000_longstay",
  "552": "outpatient_emergency_department_visits_per_1000_l",
};

// --- Helper: resolve an average value from an AveragesRow by description substring ---
// Returns number | null. A renamed column resolves to null (per-row suppression fallback).
// Mirrors the nullableNum empty→null logic (T-05-COL).
function resolveAverage(
  row: AveragesRow,
  descriptionSubstring: string,
): number | null {
  // Collect ALL columns whose key contains the substring. Scanning the first match (the old
  // behavior) made the result depend on CMS column insertion order — an ambiguous substring
  // would silently return whichever matching column happened to come first (CR-01).
  const matchingKeys = Object.keys(row).filter((key) =>
    key.includes(descriptionSubstring),
  );

  if (matchingKeys.length === 0) {
    // Column not found — slug may have rotated or description doesn't match any key.
    // Return null to trigger per-row suppression text (T-05-COL: never crash or fabricate).
    return null;
  }

  if (matchingKeys.length > 1) {
    // Ambiguous: the substring matched multiple columns. Refuse to guess which is correct —
    // returning a value we cannot uniquely attribute would fabricate data. Fail loud (log)
    // and suppress the row instead (data integrity over a plausible-but-wrong number).
    console.warn(
      `resolveAverage: substring "${descriptionSubstring}" matched ${matchingKeys.length} columns ` +
        `(${matchingKeys.join(", ")}); suppressing to avoid fabricating an average.`,
    );
    return null;
  }

  const rawValue = (row as Record<string, unknown>)[matchingKeys[0]];
  if (rawValue === null || rawValue === undefined) return null;
  if (typeof rawValue === "number") return rawValue;
  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Joins facility claims rows (ijh5-nb2v) with national and state average rows (xcdc-v8bm)
 * into the 12 fixed HospMetric data points.
 *
 * Contract:
 * - Always returns exactly 12 HospMetric objects in the verbatim reference label order (D-04).
 * - Absent facility measure (measure_code missing from claimsRows, D-10/SC#5) → that
 *   facility row has value null + footnoteCode "" (formatFootnote renders "Not available");
 *   its nation/state average rows STILL carry their values (per-row, NOT per-measure-group, suppression).
 * - A CMS-suppressed facility measure (adjusted_score === null from ClaimsRowSchema) →
 *   value null + footnoteCode from footnote_for_score.
 * - National/state average rows always carry the description-matched value (number|null).
 *   No footnoteCode on average rows.
 * - The decision to degrade the whole section is the route's (Plan 03, Promise.allSettled-rejection).
 *   This mapper never returns undefined — it always returns the 12-row array.
 *
 * @param claimsRows - Validated ClaimsRow array from ijh5-nb2v (may be 0-4 rows). D-15: adjusted_score only.
 * @param nationRow  - Validated AveragesRow for state_or_nation = "NATION" from xcdc-v8bm.
 * @param stateRow   - Validated AveragesRow for state_or_nation = facility.state from xcdc-v8bm.
 * @returns HospMetric[12] in METRIC_DEFINITIONS order.
 */
export function joinClaimsAndAverages(
  claimsRows: ClaimsRow[],
  nationRow: AveragesRow,
  stateRow: AveragesRow,
): HospMetric[] {
  // Index claims rows by measure_code for O(1) lookup.
  const claimsByCode = new Map<string, ClaimsRow>();
  for (const row of claimsRows) {
    claimsByCode.set(row.measure_code, row);
  }

  return METRIC_DEFINITIONS.map((def) => {
    const unit = def.unit as "percent" | "rate";
    const descriptionSubstring = AVERAGE_COLUMN_DESCRIPTIONS[def.measureCode];

    if (def.source === "facility") {
      const claimsRow = claimsByCode.get(def.measureCode);

      if (!claimsRow) {
        // Measure absent from claims response (fewer-than-4 / D-10/SC#5).
        // Treat as suppressed with empty footnoteCode so formatFootnote renders "Not available".
        return {
          label: def.label,
          value: null,
          unit,
          footnoteCode: "",
        };
      }

      // adjusted_score is number|null after ClaimsRowSchema coercion (D-15, nullableNum).
      const value = claimsRow.adjusted_score;
      const footnoteCode = claimsRow.footnote_for_score;

      if (value === null) {
        // CMS suppressed this measure — footnote_for_score tells why (D-11).
        return {
          label: def.label,
          value: null,
          unit,
          footnoteCode,
        };
      }

      // Valid facility value — no footnoteCode needed.
      return {
        label: def.label,
        value,
        unit,
      };
    }

    // Nation or state average row — always resolve from averages (independent of facility claims).
    // D-10: national/state rows are NEVER suppressed because a facility measure is suppressed/absent.
    const avgRow = def.source === "nation" ? nationRow : stateRow;
    const value = descriptionSubstring
      ? resolveAverage(avgRow, descriptionSubstring)
      : null;

    return {
      label: def.label,
      value,
      unit,
      // No footnoteCode on average rows (averages don't carry footnote signals).
    };
  });
}
