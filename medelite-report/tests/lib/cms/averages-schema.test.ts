import { describe, expect, it } from "vitest";
import { AveragesRowSchema } from "@/lib/cms/averages-schema";
import averagesFixture from "../../fixtures/averages-xcdc.json";

// Inline malformed fixtures as typed unknowns (RESEARCH.md Pitfall-6 / D-12).

const missingStateOrNation: unknown = {
  processing_date: "2026-05-01",
  overall_rating: "3.0",
  // deliberately missing state_or_nation
};

describe("AveragesRowSchema", () => {
  // Happy-path: parse the NATION row from the averages fixture
  it("parses the captured NATION row from averages-xcdc.json successfully", () => {
    const result = AveragesRowSchema.safeParse(averagesFixture.NATION);
    expect(result.success).toBe(true);
  });

  // Typed output: state_or_nation === "NATION" preserved
  it("preserves state_or_nation === 'NATION' from the NATION row", () => {
    const result = AveragesRowSchema.safeParse(averagesFixture.NATION);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.state_or_nation).toBe("NATION");
    }
  });

  // Happy-path: parse the FL row from the averages fixture
  it("parses the captured FL row from averages-xcdc.json successfully", () => {
    const result = AveragesRowSchema.safeParse(averagesFixture.FL);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.state_or_nation).toBe("FL");
    }
  });

  // .passthrough() behavior: hash-suffixed average columns are preserved, not stripped
  it("passthrough preserves hash-suffixed average column so mapper can key-scan it", () => {
    const result = AveragesRowSchema.safeParse(averagesFixture.NATION);
    expect(result.success).toBe(true);
    if (result.success) {
      // The hash-suffixed column for STR rehospitalization must pass through
      const row = result.data as Record<string, unknown>;
      expect(row["percentage_of_short_stay_residents_who_were_rehospitalized__1d02"]).toBeDefined();
      expect(row["percentage_of_short_stay_residents_who_were_rehospitalized__1d02"]).not.toBeUndefined();
    }
  });

  // .passthrough() behavior: other unstable hash-suffixed columns also pass through
  it("passthrough preserves the STR ED average column", () => {
    const result = AveragesRowSchema.safeParse(averagesFixture.NATION);
    expect(result.success).toBe(true);
    if (result.success) {
      const row = result.data as Record<string, unknown>;
      expect(row["percentage_of_short_stay_residents_who_had_an_outpatient_em_d911"]).toBeDefined();
    }
  });

  // D-05: A row missing state_or_nation must fail safeParse
  it("fails safeParse when state_or_nation is missing", () => {
    const result = AveragesRowSchema.safeParse(missingStateOrNation);
    expect(result.success).toBe(false);
    // Zod v4: use result.error.issues (NOT result.error.errors — undefined in v4)
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });
});
