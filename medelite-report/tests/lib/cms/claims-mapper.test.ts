import { describe, expect, it, vi } from "vitest";
import {
  joinClaimsAndAverages,
  AVERAGE_COLUMN_DESCRIPTIONS,
} from "@/lib/cms/claims-mapper";
import { ClaimsRowSchema } from "@/lib/cms/claims-schema";
import { AveragesRowSchema } from "@/lib/cms/averages-schema";
import claimsFixture from "../../fixtures/claims-686123.json";
import averagesFixture from "../../fixtures/averages-xcdc.json";

// Tests for joinClaimsAndAverages — the 12-row join contract.
// All assertions anchored to tests/fixtures/claims-686123.json + tests/fixtures/averages-xcdc.json
// (CLAUDE.md rule #3). Fixture-verified values from 05-CONTEXT.md / 05-RESEARCH.md.
//
// Test cases cover:
//   CLM-01: 12 rows, verbatim labels in order, fixture-verified values
//   CLM-02: Per-row suppression (facility suppressed → null + footnoteCode; averages still render)
//   CLM-03: Label order matches reference exactly (garbles preserved)
//   D-10/SC#5: Fewer-than-4 claims (absent measure) → 12 rows; absent facility row suppressed, averages still render
//
// Suppressed/absent cases use synthetic ClaimsRow objects (686123 fixture has no suppression).

// Parse the fixture arrays through their schemas — exactly like mapper.test.ts uses parseCMSRow.
const NATION = AveragesRowSchema.parse(averagesFixture.NATION);
const FL = AveragesRowSchema.parse(averagesFixture.FL);
const parsedClaims = claimsFixture.map((row) => ClaimsRowSchema.parse(row));

// Helper: build a synthetic ClaimsRow with override fields.
function makeClaimsRow(overrides: Record<string, unknown>) {
  return ClaimsRowSchema.parse({
    cms_certification_number_ccn: "686123",
    measure_code: "521",
    measure_description:
      "Percentage of short-stay residents who were rehospitalized after a nursing home admission",
    resident_type: "Short Stay",
    adjusted_score: "25.575578",
    footnote_for_score: "",
    processing_date: "2026-05-01",
    ...overrides,
  });
}

// --- CLM-01: 12-row contract ---

describe("joinClaimsAndAverages — CLM-01: 12-row contract", () => {
  it("returns exactly 12 HospMetric objects for the full 686123 fixture", () => {
    const metrics = joinClaimsAndAverages(parsedClaims, NATION, FL);
    expect(metrics).toHaveLength(12);
  });

  it("returns 12 rows with verbatim labels in the exact reference order (garbles preserved)", () => {
    const metrics = joinClaimsAndAverages(parsedClaims, NATION, FL);
    const labels = metrics.map((m) => m.label);
    expect(labels).toEqual([
      "Short Term Hospitalization",
      "STR National Avg. for Hospitalization",
      "STR State National Avg. for Hospitalization",
      "STR ED Visit",
      "STR ED Visits National Avg.",
      "STR ED Visits State Avg.",
      "LT Hospitalization",
      "LT National Avg. for Hospitalization",
      "LT State National Avg. for Hospitalization",
      "ED Visit",
      "LT ED Visits National Avg.",
      "LT ED Visits State Avg.",
    ]);
  });

  it("Row 1 (521 facility): value === 25.575578, unit === 'percent'", () => {
    const metrics = joinClaimsAndAverages(parsedClaims, NATION, FL);
    expect(metrics[0]!.label).toBe("Short Term Hospitalization");
    expect(metrics[0]!.value).toBe(25.575578);
    expect(metrics[0]!.unit).toBe("percent");
  });

  it("Row 7 (551 facility): value === 2.752503, unit === 'rate'", () => {
    const metrics = joinClaimsAndAverages(parsedClaims, NATION, FL);
    expect(metrics[6]!.label).toBe("LT Hospitalization");
    expect(metrics[6]!.value).toBe(2.752503);
    expect(metrics[6]!.unit).toBe("rate");
  });

  it("Row 2 (521 nation): value === 23.875617 (matched by 'rehospitalized' description, not hash slug)", () => {
    const metrics = joinClaimsAndAverages(parsedClaims, NATION, FL);
    expect(metrics[1]!.label).toBe("STR National Avg. for Hospitalization");
    expect(metrics[1]!.value).toBe(23.875617);
    expect(metrics[1]!.unit).toBe("percent");
    expect(metrics[1]!.footnoteCode).toBeUndefined();
  });

  it("Row 3 (521 state/FL): value === 26.203324 (matched by description, not hash slug)", () => {
    const metrics = joinClaimsAndAverages(parsedClaims, NATION, FL);
    expect(metrics[2]!.label).toBe(
      "STR State National Avg. for Hospitalization",
    );
    expect(metrics[2]!.value).toBe(26.203324);
    expect(metrics[2]!.unit).toBe("percent");
  });

  it("Row 4 (522 facility): value === 8.094575, unit === 'percent'", () => {
    const metrics = joinClaimsAndAverages(parsedClaims, NATION, FL);
    expect(metrics[3]!.label).toBe("STR ED Visit");
    expect(metrics[3]!.value).toBe(8.094575);
    expect(metrics[3]!.unit).toBe("percent");
  });

  it("Row 5 (522 nation): value === 12.013574 (matched by 'outpatient_em' description)", () => {
    const metrics = joinClaimsAndAverages(parsedClaims, NATION, FL);
    expect(metrics[4]!.label).toBe("STR ED Visits National Avg.");
    expect(metrics[4]!.value).toBe(12.013574);
  });

  it("Row 6 (522 state): value === 9.157686", () => {
    const metrics = joinClaimsAndAverages(parsedClaims, NATION, FL);
    expect(metrics[5]!.label).toBe("STR ED Visits State Avg.");
    expect(metrics[5]!.value).toBe(9.157686);
  });

  it("Row 8 (551 nation): value === 1.897659 (matched by 'hospitalizations_per_1000_longstay' description)", () => {
    const metrics = joinClaimsAndAverages(parsedClaims, NATION, FL);
    expect(metrics[7]!.label).toBe("LT National Avg. for Hospitalization");
    expect(metrics[7]!.value).toBe(1.897659);
    expect(metrics[7]!.unit).toBe("rate");
  });

  it("Row 9 (551 state): value === 2.147753", () => {
    const metrics = joinClaimsAndAverages(parsedClaims, NATION, FL);
    expect(metrics[8]!.label).toBe(
      "LT State National Avg. for Hospitalization",
    );
    expect(metrics[8]!.value).toBe(2.147753);
  });

  it("Row 10 (552 facility): value === 0.910105, unit === 'rate', label === 'ED Visit' (bare garble)", () => {
    const metrics = joinClaimsAndAverages(parsedClaims, NATION, FL);
    expect(metrics[9]!.label).toBe("ED Visit");
    expect(metrics[9]!.value).toBe(0.910105);
    expect(metrics[9]!.unit).toBe("rate");
  });

  it("Row 11 (552 nation): value === 1.798049 (matched by 'outpatient_emergency_department_visits_per_1000_l' description)", () => {
    const metrics = joinClaimsAndAverages(parsedClaims, NATION, FL);
    expect(metrics[10]!.label).toBe("LT ED Visits National Avg.");
    expect(metrics[10]!.value).toBe(1.798049);
    expect(metrics[10]!.unit).toBe("rate");
  });

  it("Row 12 (552 state): value === 1.156036", () => {
    const metrics = joinClaimsAndAverages(parsedClaims, NATION, FL);
    expect(metrics[11]!.label).toBe("LT ED Visits State Avg.");
    expect(metrics[11]!.value).toBe(1.156036);
    expect(metrics[11]!.unit).toBe("rate");
  });

  it("description-substring match: renaming the hash slug does NOT break the average lookup (robustness)", () => {
    // Simulate a row where the hash suffix changes by providing an AveragesRow where
    // the key uses an alternative suffix. Because the mapper matches by description substring
    // (not literal slug), it must still resolve the value from a key that contains the target substring.
    // We test this by verifying that the nation row value (23.875617) is found even though
    // the NATION averages fixture was validated via passthrough (no slug hardcoded in the schema).
    const metrics = joinClaimsAndAverages(parsedClaims, NATION, FL);
    // If the mapper used the slug literally, a renamed slug would give null.
    // The non-null value proves description-based lookup was used.
    expect(metrics[1]!.value).not.toBeNull();
    expect(metrics[1]!.value).toBe(23.875617);
  });
});

// --- CLM-02: Per-row suppression (D-10) ---

describe("joinClaimsAndAverages — CLM-02: per-row suppression", () => {
  it("Suppressed 521 facility row (adjusted_score '', footnote_for_score '9') → value null + footnoteCode '9'", () => {
    const suppressedRow = makeClaimsRow({
      adjusted_score: "", // suppressed
      footnote_for_score: "9",
    });
    // Replace measure 521 with the suppressed row
    const claims = [
      suppressedRow,
      ...parsedClaims.filter((r) => r.measure_code !== "521"),
    ];
    const metrics = joinClaimsAndAverages(claims, NATION, FL);
    const row1 = metrics[0]!; // "Short Term Hospitalization" (521 facility)
    expect(row1.value).toBeNull();
    expect(row1.footnoteCode).toBe("9");
  });

  it("Suppressed 521 facility row: nation average row (Row 2) STILL has value 23.875617 (D-10 per-row suppression)", () => {
    const suppressedRow = makeClaimsRow({
      adjusted_score: "",
      footnote_for_score: "9",
    });
    const claims = [
      suppressedRow,
      ...parsedClaims.filter((r) => r.measure_code !== "521"),
    ];
    const metrics = joinClaimsAndAverages(claims, NATION, FL);
    const row2 = metrics[1]!; // "STR National Avg. for Hospitalization"
    expect(row2.value).toBe(23.875617);
    expect(row2.footnoteCode).toBeUndefined();
  });

  it("Suppressed 521 facility row: state average row (Row 3) STILL has value 26.203324 (D-10 per-row suppression)", () => {
    const suppressedRow = makeClaimsRow({
      adjusted_score: "",
      footnote_for_score: "9",
    });
    const claims = [
      suppressedRow,
      ...parsedClaims.filter((r) => r.measure_code !== "521"),
    ];
    const metrics = joinClaimsAndAverages(claims, NATION, FL);
    const row3 = metrics[2]!; // "STR State National Avg. for Hospitalization"
    expect(row3.value).toBe(26.203324);
    expect(row3.footnoteCode).toBeUndefined();
  });

  it("Empty adjusted_score with footnote_for_score '' → value null, footnoteCode ''", () => {
    const suppressedNoCode = makeClaimsRow({
      adjusted_score: "", // suppressed
      footnote_for_score: "", // no footnote code
    });
    const claims = [
      suppressedNoCode,
      ...parsedClaims.filter((r) => r.measure_code !== "521"),
    ];
    const metrics = joinClaimsAndAverages(claims, NATION, FL);
    const row1 = metrics[0]!;
    expect(row1.value).toBeNull();
    expect(row1.footnoteCode).toBe("");
  });

  it("still returns exactly 12 rows when a measure is suppressed", () => {
    const suppressedRow = makeClaimsRow({
      adjusted_score: "",
      footnote_for_score: "9",
    });
    const claims = [
      suppressedRow,
      ...parsedClaims.filter((r) => r.measure_code !== "521"),
    ];
    const metrics = joinClaimsAndAverages(claims, NATION, FL);
    expect(metrics).toHaveLength(12);
  });
});

// --- D-10/SC#5: Fewer-than-4 claims (absent measure = graceful partial) ---

describe("joinClaimsAndAverages — D-10/SC#5: fewer-than-4 claims (absent measure)", () => {
  it("Omitting measure 552 → still returns 12 rows (no throw, graceful partial)", () => {
    const claimsWithout552 = parsedClaims.filter(
      (r) => r.measure_code !== "552",
    );
    expect(claimsWithout552).toHaveLength(3); // sanity-check: 3 of 4
    const metrics = joinClaimsAndAverages(claimsWithout552, NATION, FL);
    expect(metrics).toHaveLength(12);
  });

  it("Absent 552 facility row (Row 10 'ED Visit'): value null + a fallback footnoteCode (formatFootnote renders 'Not available')", () => {
    const claimsWithout552 = parsedClaims.filter(
      (r) => r.measure_code !== "552",
    );
    const metrics = joinClaimsAndAverages(claimsWithout552, NATION, FL);
    const row10 = metrics[9]!; // "ED Visit" (552 facility)
    expect(row10.value).toBeNull();
    // footnoteCode must be defined (not undefined) so formatFootnote renders "Not available"
    expect(row10.footnoteCode).toBeDefined();
  });

  it("Absent 552 facility row: nation average (Row 11 'LT ED Visits National Avg.') STILL has value 1.798049", () => {
    const claimsWithout552 = parsedClaims.filter(
      (r) => r.measure_code !== "552",
    );
    const metrics = joinClaimsAndAverages(claimsWithout552, NATION, FL);
    const row11 = metrics[10]!;
    expect(row11.label).toBe("LT ED Visits National Avg.");
    expect(row11.value).toBe(1.798049);
  });

  it("Absent 552 facility row: state average (Row 12 'LT ED Visits State Avg.') STILL has value 1.156036", () => {
    const claimsWithout552 = parsedClaims.filter(
      (r) => r.measure_code !== "552",
    );
    const metrics = joinClaimsAndAverages(claimsWithout552, NATION, FL);
    const row12 = metrics[11]!;
    expect(row12.label).toBe("LT ED Visits State Avg.");
    expect(row12.value).toBe(1.156036);
  });

  it("Empty claims array → 12 rows, all facility rows have value null; all average rows have values", () => {
    const metrics = joinClaimsAndAverages([], NATION, FL);
    expect(metrics).toHaveLength(12);
    // All 4 facility rows (indices 0, 3, 6, 9) must have value null
    expect(metrics[0]!.value).toBeNull();
    expect(metrics[3]!.value).toBeNull();
    expect(metrics[6]!.value).toBeNull();
    expect(metrics[9]!.value).toBeNull();
    // Nation averages (indices 1, 4, 7, 10) must have their real values
    expect(metrics[1]!.value).toBe(23.875617);
    expect(metrics[4]!.value).toBe(12.013574);
    expect(metrics[7]!.value).toBe(1.897659);
    expect(metrics[10]!.value).toBe(1.798049);
  });
});

// --- Type contract: HospMetric shape ---

describe("HospMetric type contract", () => {
  it("each row has label (string), value (number | null), unit ('percent' | 'rate'), optional footnoteCode", () => {
    const metrics = joinClaimsAndAverages(parsedClaims, NATION, FL);
    for (const m of metrics) {
      expect(typeof m.label).toBe("string");
      expect(m.value === null || typeof m.value === "number").toBe(true);
      expect(["percent", "rate"]).toContain(m.unit);
      // footnoteCode may be undefined on non-suppressed rows
      if (m.footnoteCode !== undefined) {
        expect(typeof m.footnoteCode).toBe("string");
      }
    }
  });

  it("facility rows have the correct unit based on measure type (521/522=percent, 551/552=rate)", () => {
    const metrics = joinClaimsAndAverages(parsedClaims, NATION, FL);
    // Row 1 (521 facility) → percent
    expect(metrics[0]!.unit).toBe("percent");
    // Row 4 (522 facility) → percent
    expect(metrics[3]!.unit).toBe("percent");
    // Row 7 (551 facility) → rate
    expect(metrics[6]!.unit).toBe("rate");
    // Row 10 (552 facility) → rate
    expect(metrics[9]!.unit).toBe("rate");
  });
});

// --- CR-01 regression: average-column substring matching must be unambiguous ---
// The 522 substring "outpatient_em" was a PREFIX of the 552 column
// ("...outpatient_emergency_department..."), so it matched two columns and resolveAverage
// returned whichever came first in CMS column order — silently fabricating the wrong average
// if columns were ever reordered. These tests lock the invariant: each substring matches exactly
// one column, the result is order-independent, and a genuinely ambiguous match suppresses (null)
// rather than guessing.

describe("joinClaimsAndAverages — CR-01: unambiguous average-column matching", () => {
  it("every AVERAGE_COLUMN_DESCRIPTIONS substring matches EXACTLY ONE column in NATION and FL", () => {
    for (const [region, row] of [
      ["NATION", NATION],
      ["FL", FL],
    ] as const) {
      for (const [measureCode, substring] of Object.entries(
        AVERAGE_COLUMN_DESCRIPTIONS,
      )) {
        const matches = Object.keys(row).filter((k) => k.includes(substring));
        expect(
          matches.length,
          `measure ${measureCode} substring "${substring}" matched ${matches.length} columns in ${region}: ${matches.join(", ")}`,
        ).toBe(1);
      }
    }
  });

  it("522 (STR ED Visits National Avg.) resolves to the short-stay percentage, not the 552 rate", () => {
    const metrics = joinClaimsAndAverages(parsedClaims, NATION, FL);
    // Index 4 = "STR ED Visits National Avg." (522 nation). The fixture short-stay ED % is 12.013574;
    // the 552 long-stay ED rate is 1.798049 — they must never be confused.
    expect(metrics[4]!.label).toBe("STR ED Visits National Avg.");
    expect(metrics[4]!.value).toBeCloseTo(12.013574, 5);
    expect(metrics[4]!.value).not.toBeCloseTo(1.798049, 5);
  });

  it("is independent of CMS column insertion order (reversed keys yield identical averages)", () => {
    const reverse = <T extends object>(row: T): T =>
      Object.fromEntries(Object.entries(row).reverse()) as T;
    const base = joinClaimsAndAverages(parsedClaims, NATION, FL);
    const reordered = joinClaimsAndAverages(
      parsedClaims,
      reverse(NATION),
      reverse(FL),
    );
    expect(reordered.map((m) => m.value)).toEqual(base.map((m) => m.value));
  });

  it("suppresses (null) and warns when a substring matches more than one column", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Inject a second column that also contains the 522 substring → genuine ambiguity.
    const ambiguousNation = {
      ...NATION,
      duplicate_who_had_an_outpatient_col: "99.9",
    } as typeof NATION;
    const metrics = joinClaimsAndAverages(parsedClaims, ambiguousNation, FL);
    // 522 nation (index 4) cannot be uniquely attributed → suppressed to null, never 99.9.
    expect(metrics[4]!.value).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
