import { describe, expect, it } from "vitest";
import { CMSRowSchema } from "@/lib/cms/schema";
import providerFixture from "../../fixtures/provider-686123.json";

// Inline malformed fixtures as typed unknowns (RESEARCH.md Pitfall-6 / D-12).
// Using inline constants avoids TypeScript JSON-import type-inference edge cases.

const missingRequiredKey: unknown = {
  provider_name: "Test Facility",
  overall_rating: "4",
  // deliberately missing cms_certification_number_ccn and other required keys
};

const suppressedRow: unknown = {
  cms_certification_number_ccn: "000001",
  provider_name: "New Facility",
  legal_business_name: "New Facility LLC",
  provider_address: "123 Main St",
  citytown: "Anytown",
  state: "TX",
  zip_code: "75001",
  number_of_certified_beds: "30",
  overall_rating: "",
  health_inspection_rating: "",
  qm_rating: "",
  staffing_rating: "",
  processing_date: "2026-01-01",
};

const wrongShape: unknown = {
  error: "invalid_ccn",
  message: "No matching records",
};

describe("CMSRowSchema", () => {
  // DATA-02: Happy-path parse against the captured 686123 fixture
  it("parses the captured 686123 provider fixture successfully", () => {
    const result = CMSRowSchema.safeParse(providerFixture[0]);
    expect(result.success).toBe(true);
  });

  // DATA-02: Verify typed output fields from the fixture parse
  it("returns correctly typed values from the 686123 fixture", () => {
    const result = CMSRowSchema.safeParse(providerFixture[0]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cms_certification_number_ccn).toBe("686123");
      expect(result.data.state).toBe("FL");
      expect(typeof result.data.overall_rating).toBe("number");
      expect(typeof result.data.number_of_certified_beds).toBe("number");
    }
  });

  // DATA-02 / D-08: Suppressed empty-string rating must become null, NOT 0
  it("maps a suppressed empty-string rating to null, not 0", () => {
    const result = CMSRowSchema.safeParse(suppressedRow);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.overall_rating).toBeNull();
      expect(result.data.health_inspection_rating).toBeNull();
      expect(result.data.qm_rating).toBeNull();
      expect(result.data.staffing_rating).toBeNull();
    }
  });

  // DATA-02 / D-09: A real "0" rating must be preserved as 0, not become null
  it('preserves "0" as 0 (real zero is not the same as suppressed)', () => {
    const zeroRatingRow: unknown = {
      cms_certification_number_ccn: "000002",
      provider_name: "Zero Star Facility",
      legal_business_name: "Zero Star Facility LLC",
      provider_address: "456 Any Ave",
      citytown: "Somewhere",
      state: "CA",
      zip_code: "90001",
      number_of_certified_beds: "50",
      overall_rating: "0",
      health_inspection_rating: "0",
      qm_rating: "0",
      staffing_rating: "0",
      processing_date: "2026-01-01",
    };
    const result = CMSRowSchema.safeParse(zeroRatingRow);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.overall_rating).toBe(0);
    }
  });

  // DATA-02 / D-05: A row missing a required key must fail safeParse loudly
  it("fails safeParse when a required key is missing", () => {
    const result = CMSRowSchema.safeParse(missingRequiredKey);
    expect(result.success).toBe(false);
    // Zod v4: use result.error.issues (NOT result.error.errors — undefined in v4)
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  // DATA-02 / D-12: A wrong-shape object (no required keys at all) fails safeParse
  it("fails safeParse for a wrong-shape object (error/message structure)", () => {
    const result = CMSRowSchema.safeParse(wrongShape);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  // DATA-02 / D-10: CCN and ZIP preserve leading zeros as strings (never coerced)
  it("preserves leading zeros in CCN and ZIP as strings", () => {
    const leadingZeroRow: unknown = {
      cms_certification_number_ccn: "056789",
      provider_name: "Leading Zero Facility",
      legal_business_name: "Leading Zero Facility LLC",
      provider_address: "789 Zero St",
      citytown: "Zeroton",
      state: "NY",
      zip_code: "075001",
      number_of_certified_beds: "20",
      overall_rating: "3",
      health_inspection_rating: "3",
      qm_rating: "3",
      staffing_rating: "3",
      processing_date: "2026-01-01",
    };
    const result = CMSRowSchema.safeParse(leadingZeroRow);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cms_certification_number_ccn).toBe("056789");
      expect(result.data.zip_code).toBe("075001");
    }
  });

  // DATA-06: Every field declared in CMSRowSchema must exist as a key in the captured fixture.
  // This test is schema-derived (not a hand-copied list) — a future field name typo in the
  // schema that diverges from the fixture causes this test to fail loudly.
  it("DATA-06: every schema-declared required field exists as a key in provider-686123.json", () => {
    const fixtureRow = providerFixture[0] as Record<string, unknown>;
    const schemaShape = CMSRowSchema.shape;
    const missingKeys: string[] = [];
    for (const key of Object.keys(schemaShape)) {
      if (!(key in fixtureRow)) {
        missingKeys.push(key);
      }
    }
    expect(missingKeys).toEqual([]);
  });
});
