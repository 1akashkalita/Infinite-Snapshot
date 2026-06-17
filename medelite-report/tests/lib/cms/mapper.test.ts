import { describe, expect, it } from "vitest";
import { toFacilityData } from "@/lib/cms/mapper";
import { parseCMSRow } from "@/lib/cms/parse";
import providerFixture from "../../fixtures/provider-686123.json";

// Tests for toFacilityData — the single CMS→domain mapping point.
// All assertions anchored to tests/fixtures/provider-686123.json (CLAUDE.md rule #3).
// Field name decisions: D-15 (provider_name NOT legal_business_name),
// D-16 (qm_rating NOT longstay_qm_rating/shortstay_qm_rating), DATA-03 (no ZIP).

describe("toFacilityData", () => {
  // NAME-01 / D-15: Operating name, NOT the legal name with ", LLC"
  it("maps provider_name to providerName (NOT legal_business_name)", () => {
    const parsed = parseCMSRow(providerFixture[0]);
    const facility = toFacilityData(parsed);
    expect(facility.providerName).toBe(
      "KENDALL LAKES HEALTHCARE AND REHAB CENTER",
    );
    // NOT "KENDALL LAKES HEALTHCARE AND REHAB CENTER, LLC"
    expect(facility.providerName).not.toContain(", LLC");
  });

  // DATA-04 / D-16: qualityCare comes from qm_rating (value 5), NOT shortstay_qm_rating (3)
  it("maps qm_rating to starRatings.qualityCare (NOT shortstay or longstay variant)", () => {
    const parsed = parseCMSRow(providerFixture[0]);
    const facility = toFacilityData(parsed);
    // qm_rating = "5" in fixture; shortstay_qm_rating = "3" — these differ, proving correct field used
    expect(facility.starRatings.qualityCare).toBe(5);
  });

  // DATA-05: certifiedBeds from number_of_certified_beds
  it("maps number_of_certified_beds to certifiedBeds as a number", () => {
    const parsed = parseCMSRow(providerFixture[0]);
    const facility = toFacilityData(parsed);
    expect(facility.certifiedBeds).toBe(150);
  });

  // staffing discriminates from other ratings (staffing_rating = 2, not 5)
  it("maps staffing_rating to starRatings.staffing (discriminates from overall/healthInspection)", () => {
    const parsed = parseCMSRow(providerFixture[0]);
    const facility = toFacilityData(parsed);
    expect(facility.starRatings.staffing).toBe(2);
    // Overall and health inspection are 5, confirming different fields
    expect(facility.starRatings.overall).toBe(5);
    expect(facility.starRatings.healthInspection).toBe(5);
  });

  // DATA-03: address composed from provider_address + citytown + state, NO zip
  it("maps address from provider_address, citytown, state — no zip property", () => {
    const parsed = parseCMSRow(providerFixture[0]);
    const facility = toFacilityData(parsed);
    expect(facility.address).toEqual({
      street: "5280 SW 157 AVENUE",
      city: "MIAMI",
      state: "FL",
    });
    // No zip key anywhere on address or facility
    expect("zip" in facility.address).toBe(false);
    expect("zip_code" in facility.address).toBe(false);
  });

  // D-12: processingDate is preserved as string; ccn preserved as string
  it("maps processingDate and ccn as strings", () => {
    const parsed = parseCMSRow(providerFixture[0]);
    const facility = toFacilityData(parsed);
    expect(facility.processingDate).toBe("2026-05-01");
    expect(facility.ccn).toBe("686123");
    expect(typeof facility.ccn).toBe("string");
  });

  // D-14: output object has NO snake_case keys and NO zip
  it("output has no snake_case keys and no zip", () => {
    const parsed = parseCMSRow(providerFixture[0]);
    const facility = toFacilityData(parsed);

    const topKeys = Object.keys(facility);
    const addressKeys = Object.keys(facility.address);
    const starKeys = Object.keys(facility.starRatings);

    // No snake_case at top level
    for (const key of [...topKeys, ...addressKeys, ...starKeys]) {
      expect(key).not.toMatch(/_/);
    }

    // No zip/zip_code anywhere
    const facilityStr = JSON.stringify(facility);
    expect(facilityStr).not.toContain('"zip"');
    expect(facilityStr).not.toContain('"zip_code"');
    expect(facilityStr).not.toContain('"zipCode"');
    // No legal_business_name leak
    expect(facilityStr).not.toContain("legal");
    expect(facilityStr).not.toContain(", LLC");
  });

  // state top-level field (for assembleHeader(state))
  it("maps state at top level for assembleHeader(state)", () => {
    const parsed = parseCMSRow(providerFixture[0]);
    const facility = toFacilityData(parsed);
    expect(facility.state).toBe("FL");
  });
});
