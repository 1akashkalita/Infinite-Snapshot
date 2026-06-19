import { describe, expect, it } from "vitest";
import { ClaimsRowSchema } from "@/lib/cms/claims-schema";
import claimsFixture from "../../fixtures/claims-686123.json";

// Inline malformed fixtures as typed unknowns (RESEARCH.md Pitfall-6 / D-12).
// Using inline constants avoids TypeScript JSON-import type-inference edge cases.

const missingRequiredKey: unknown = {
  provider_name: "Test Facility",
  adjusted_score: "25.0",
  // deliberately missing measure_code and other required keys
};

const suppressedRow: unknown = {
  cms_certification_number_ccn: "686123",
  measure_code: "521",
  measure_description: "Percentage of short-stay residents who were rehospitalized after a nursing home admission",
  resident_type: "Short Stay",
  adjusted_score: "",       // suppressed — must become null
  footnote_for_score: "9",  // footnote code 9 = "Not reported (small sample)"
  processing_date: "2026-05-01",
};

const zeroScoreRow: unknown = {
  cms_certification_number_ccn: "686123",
  measure_code: "521",
  measure_description: "Percentage of short-stay residents who were rehospitalized after a nursing home admission",
  resident_type: "Short Stay",
  adjusted_score: "0",      // real zero — must be preserved as 0, not null
  footnote_for_score: "",
  processing_date: "2026-05-01",
};

const nonNumericRow: unknown = {
  cms_certification_number_ccn: "686123",
  measure_code: "521",
  measure_description: "Percentage of short-stay residents who were rehospitalized after a nursing home admission",
  resident_type: "Short Stay",
  adjusted_score: "abc",    // non-numeric string — must fail safeParse
  footnote_for_score: "",
  processing_date: "2026-05-01",
};

describe("ClaimsRowSchema", () => {
  // Happy-path: parse against the captured 686123 fixture
  it("parses the captured 686123 claims fixture row[0] successfully", () => {
    const result = ClaimsRowSchema.safeParse(claimsFixture[0]);
    expect(result.success).toBe(true);
  });

  // Typed output fields from the fixture parse
  it("returns correctly typed values from the 686123 fixture row[0]", () => {
    const result = ClaimsRowSchema.safeParse(claimsFixture[0]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.measure_code).toBe("521");
      expect(typeof result.data.adjusted_score).toBe("number");
      expect(result.data.adjusted_score).toBeCloseTo(25.575578, 5);
    }
  });

  // D-08: Suppressed empty-string adjusted_score must become null, NOT 0
  it("maps a suppressed empty-string adjusted_score to null, not 0", () => {
    const result = ClaimsRowSchema.safeParse(suppressedRow);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.adjusted_score).toBeNull();
    }
  });

  // D-09: A real "0" adjusted_score must be preserved as 0, not become null
  it('preserves "0" adjusted_score as 0 (real zero is not suppressed)', () => {
    const result = ClaimsRowSchema.safeParse(zeroScoreRow);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.adjusted_score).toBe(0);
    }
  });

  // footnote_for_score is preserved as a string
  it("preserves footnote_for_score as a string (empty passes; '9' passes)", () => {
    const resultEmpty = ClaimsRowSchema.safeParse(zeroScoreRow);
    expect(resultEmpty.success).toBe(true);
    if (resultEmpty.success) {
      expect(resultEmpty.data.footnote_for_score).toBe("");
    }

    const resultNine = ClaimsRowSchema.safeParse(suppressedRow);
    expect(resultNine.success).toBe(true);
    if (resultNine.success) {
      expect(resultNine.data.footnote_for_score).toBe("9");
    }
  });

  // D-05: A row missing a required key must fail safeParse loudly
  it("fails safeParse when a required key (measure_code) is missing", () => {
    const result = ClaimsRowSchema.safeParse(missingRequiredKey);
    expect(result.success).toBe(false);
    // Zod v4: use result.error.issues (NOT result.error.errors — undefined in v4)
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  // CR-01: A non-numeric string in adjusted_score must fail loudly
  it("CR-01: rejects a non-numeric string in adjusted_score", () => {
    const result = ClaimsRowSchema.safeParse(nonNumericRow);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  // DATA-06: Every field declared in ClaimsRowSchema must exist as a key in the captured fixture.
  // This test is schema-derived (not a hand-copied list) — a future field name typo in the
  // schema that diverges from the fixture causes this test to fail loudly.
  it("DATA-06: every schema-declared required field exists as a key in claims-686123.json[0]", () => {
    const fixtureRow = claimsFixture[0] as Record<string, unknown>;
    const schemaShape = ClaimsRowSchema.shape;
    const missingKeys: string[] = [];
    for (const key of Object.keys(schemaShape)) {
      if (!(key in fixtureRow)) {
        missingKeys.push(key);
      }
    }
    expect(missingKeys).toEqual([]);
  });
});
