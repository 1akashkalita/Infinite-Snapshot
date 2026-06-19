import { describe, expect, it } from "vitest";
import { parseCMSRow } from "@/lib/cms/parse";
import { toFacilityData } from "@/lib/cms/mapper";
import {
  assembleViewModel,
  ReportViewModelSchema,
} from "@/lib/report/view-model";
import providerFixture from "../../fixtures/provider-686123.json";

// D-12: Use a fixed generatedAt for deterministic tests (no new Date() inside assembleViewModel).
// RPT-02: assembleViewModel(facility, manual, generatedAt) is pure/deterministic.
// NAME-02: displayName = manual.nameOverride?.trim() || facility.providerName — body only.
// RPT-01: static header is NEVER affected by manual.nameOverride.

// Build a real FacilityData from the captured 686123 fixture (D-11 / CLAUDE.md rule #3).
const facility = toFacilityData(parseCMSRow(providerFixture[0]));
const FIXED_DATE = "2026-06-17T12:00:00Z";
const FIXED_DATE_OBJ = new Date(FIXED_DATE);

describe("assembleViewModel — determinism (D-12/RPT-02)", () => {
  it("is deterministic: same args produce the same model", () => {
    const vm1 = assembleViewModel(facility, {}, FIXED_DATE_OBJ);
    const vm2 = assembleViewModel(facility, {}, FIXED_DATE_OBJ);
    expect(vm1).toEqual(vm2);
  });

  it("reflects the injected generatedAt as an ISO string (D-12 — not a fresh clock)", () => {
    const vm = assembleViewModel(facility, {}, FIXED_DATE_OBJ);
    expect(vm.generatedAt).toBe("2026-06-17T12:00:00.000Z");
  });

  it("also accepts a string generatedAt and preserves it", () => {
    const vm = assembleViewModel(facility, {}, FIXED_DATE);
    expect(vm.generatedAt).toBe(FIXED_DATE);
  });
});

describe("assembleViewModel — header (RPT-01)", () => {
  it("vm.header matches assembleHeader(facility.state) — state-only, no facility name", () => {
    const vm = assembleViewModel(facility, {}, FIXED_DATE_OBJ);
    expect(vm.header.platformLine).toBe("INFINITE — Managed by MEDELITE");
    expect(vm.header.reportTitle).toBe("FACILITY ASSESSMENT SNAPSHOT");
    expect(vm.header.stateLine).toBe("FL");
  });

  it("RPT-01: static header is not affected when nameOverride is set (NAME-02 isolation)", () => {
    const vm = assembleViewModel(
      facility,
      { nameOverride: "Custom Facility Name" },
      FIXED_DATE_OBJ,
    );
    expect(vm.header.platformLine).not.toContain("Custom Facility Name");
    expect(vm.header.platformLine).toBe("INFINITE — Managed by MEDELITE");
    expect(vm.header.reportTitle).toBe("FACILITY ASSESSMENT SNAPSHOT");
    expect(vm.header.stateLine).toBe("FL");
  });
});

describe("assembleViewModel — displayName (NAME-02)", () => {
  it("displayName defaults to facility.providerName when no override", () => {
    const vm = assembleViewModel(facility, {}, FIXED_DATE_OBJ);
    expect(vm.facility.displayName).toBe(
      "KENDALL LAKES HEALTHCARE AND REHAB CENTER",
    );
  });

  it("displayName uses manual.nameOverride when provided", () => {
    const vm = assembleViewModel(
      facility,
      { nameOverride: "Custom Name" },
      FIXED_DATE_OBJ,
    );
    expect(vm.facility.displayName).toBe("Custom Name");
  });

  it("displayName falls back to providerName when nameOverride is whitespace-only", () => {
    const vm = assembleViewModel(
      facility,
      { nameOverride: "   " },
      FIXED_DATE_OBJ,
    );
    expect(vm.facility.displayName).toBe(
      "KENDALL LAKES HEALTHCARE AND REHAB CENTER",
    );
  });

  it("displayName falls back to providerName when nameOverride is empty string", () => {
    const vm = assembleViewModel(
      facility,
      { nameOverride: "" },
      FIXED_DATE_OBJ,
    );
    expect(vm.facility.displayName).toBe(
      "KENDALL LAKES HEALTHCARE AND REHAB CENTER",
    );
  });
});

describe("assembleViewModel — facility fields", () => {
  it("careCompareUrl contains the correct CCN as a string (D-16)", () => {
    const vm = assembleViewModel(facility, {}, FIXED_DATE_OBJ);
    expect(vm.facility.careCompareUrl).toBe(
      "https://www.medicare.gov/care-compare/details/nursing-home/686123",
    );
  });

  it("processingDate matches the CMS processing date field (D-12)", () => {
    const vm = assembleViewModel(facility, {}, FIXED_DATE_OBJ);
    expect(vm.facility.processingDate).toBe("2026-05-01");
  });

  it("providerName is the CMS operating name (provider_name, not legal_business_name)", () => {
    const vm = assembleViewModel(facility, {}, FIXED_DATE_OBJ);
    expect(vm.facility.providerName).toBe(
      "KENDALL LAKES HEALTHCARE AND REHAB CENTER",
    );
    expect(vm.facility.providerName).not.toContain(", LLC");
  });

  it("facility.ccn is the CCN string", () => {
    const vm = assembleViewModel(facility, {}, FIXED_DATE_OBJ);
    expect(vm.facility.ccn).toBe("686123");
  });

  it("starRatings carry raw number | null (D-08 — not pre-formatted strings)", () => {
    const vm = assembleViewModel(facility, {}, FIXED_DATE_OBJ);
    // For 686123: overall=5, healthInspection=5, staffing=2, qualityCare=5
    expect(typeof vm.facility.starRatings.overall).toBe("number");
    expect(vm.facility.starRatings.overall).toBe(5);
    expect(vm.facility.starRatings.staffing).toBe(2);
  });

  it("certifiedBeds carries raw number | null (D-08)", () => {
    const vm = assembleViewModel(facility, {}, FIXED_DATE_OBJ);
    expect(vm.facility.certifiedBeds).toBe(150);
  });

  it("address has no ZIP field", () => {
    const vm = assembleViewModel(facility, {}, FIXED_DATE_OBJ);
    const addr = vm.facility.address as Record<string, unknown>;
    expect("zip" in addr).toBe(false);
    expect("zipCode" in addr).toBe(false);
    expect("zip_code" in addr).toBe(false);
  });
});

describe("assembleViewModel — manual inputs", () => {
  it("manual fields are empty object when no overrides provided", () => {
    const vm = assembleViewModel(facility, {}, FIXED_DATE_OBJ);
    expect(vm.manual.emr).toBeUndefined();
    expect(vm.manual.currentCensus).toBeUndefined();
    expect(vm.manual.typeOfPatient).toBeUndefined();
    expect(vm.manual.medicalCoverage).toBeUndefined();
    expect(vm.manual.previousCoverage).toBeUndefined();
    expect(vm.manual.previousProviderPerformance).toBeUndefined();
  });

  it("manual fields are populated when provided", () => {
    const vm = assembleViewModel(
      facility,
      {
        emr: "PointClickCare",
        currentCensus: 120,
        typeOfPatient: "SNF",
        medicalCoverage: "Optometry, PCP, Podiatry",
        previousCoverage: "Yes",
        previousProviderPerformance: "Strong outcomes",
      },
      FIXED_DATE_OBJ,
    );
    expect(vm.manual.emr).toBe("PointClickCare");
    expect(vm.manual.currentCensus).toBe(120);
    expect(vm.manual.typeOfPatient).toBe("SNF");
    expect(vm.manual.medicalCoverage).toBe("Optometry, PCP, Podiatry");
    expect(vm.manual.previousCoverage).toBe("Yes");
    expect(vm.manual.previousProviderPerformance).toBe("Strong outcomes");
  });

  // CR-01 regression: currentCensus = 0 must survive the model unchanged and render "0",
  // not be collapsed to null / "—" by a falsiness gate (D-10 / CLAUDE.md standing rule).
  it("CR-01: currentCensus = 0 is preserved as 0, not coerced to null (D-10 footgun)", () => {
    const vm = assembleViewModel(
      facility,
      { currentCensus: 0 },
      FIXED_DATE_OBJ,
    );
    // The view-model must carry 0, not null
    expect(vm.manual.currentCensus).toBe(0);
    expect(vm.manual.currentCensus).not.toBeNull();
    // The schema must accept 0 as a valid census value
    const result = ReportViewModelSchema.safeParse(vm);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.manual.currentCensus).toBe(0);
    }
  });

  it("CR-01: currentCensus = 0 renders as '0', not '—' (ReportPreview render path)", () => {
    // Simulates what ReportPreview.tsx line 137-139 does:
    //   vm.manual.currentCensus != null ? String(vm.manual.currentCensus) : "—"
    // With currentCensus = 0, the != null check is true (0 != null), so it renders "0".
    const vm = assembleViewModel(
      facility,
      { currentCensus: 0 },
      FIXED_DATE_OBJ,
    );
    const rendered =
      vm.manual.currentCensus != null ? String(vm.manual.currentCensus) : "—";
    expect(rendered).toBe("0");
    expect(rendered).not.toBe("—");
  });

  it("previousProviderPerformance round-trips through ReportViewModelSchema (INPT-01)", () => {
    const vm = assembleViewModel(
      facility,
      { previousProviderPerformance: "Strong outcomes" },
      FIXED_DATE_OBJ,
    );
    expect(vm.manual.previousProviderPerformance).toBe("Strong outcomes");
    const result = ReportViewModelSchema.safeParse(vm);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.manual.previousProviderPerformance).toBe(
        "Strong outcomes",
      );
    }
  });
});

describe("ReportViewModelSchema — hospMetrics (D-13 / Phase 5)", () => {
  // Build a valid HospMetric array (12 items) for schema testing.
  const makeHospMetric = (i: number) => ({
    label: `Metric ${i}`,
    value: i % 3 === 0 ? null : i * 1.5,
    unit: i < 6 ? ("percent" as const) : ("rate" as const),
    footnoteCode: i % 3 === 0 ? "9" : undefined,
  });
  const hospMetrics12 = Array.from({ length: 12 }, (_, i) => makeHospMetric(i));

  it("schema accepts a model with hospMetrics: 12-item array (D-13)", () => {
    const vm = assembleViewModel(facility, {}, FIXED_DATE_OBJ, hospMetrics12);
    const result = ReportViewModelSchema.safeParse(vm);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hospMetrics).toHaveLength(12);
    }
  });

  it("schema accepts a model with hospMetrics absent (degraded state valid — D-09/D-13)", () => {
    const vm = assembleViewModel(facility, {}, FIXED_DATE_OBJ);
    const result = ReportViewModelSchema.safeParse(vm);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hospMetrics).toBeUndefined();
    }
  });

  it("schema rejects a hospMetrics item with invalid unit (not percent|rate)", () => {
    const badMetrics = [{ label: "Test", value: 1.5, unit: "bogus" }];
    const vm = assembleViewModel(facility, {}, FIXED_DATE_OBJ);
    const badVm = { ...vm, hospMetrics: badMetrics };
    const result = ReportViewModelSchema.safeParse(badVm);
    expect(result.success).toBe(false);
  });

  it("schema rejects a hospMetrics item where value is a string (not number|null)", () => {
    const badMetrics = [{ label: "Test", value: "25.6%", unit: "percent" }];
    const vm = assembleViewModel(facility, {}, FIXED_DATE_OBJ);
    const badVm = { ...vm, hospMetrics: badMetrics };
    const result = ReportViewModelSchema.safeParse(badVm);
    expect(result.success).toBe(false);
  });

  it("assembleViewModel threads hospMetrics through when supplied as 4th arg", () => {
    const vm = assembleViewModel(facility, {}, FIXED_DATE_OBJ, hospMetrics12);
    expect(vm.hospMetrics).toEqual(hospMetrics12);
  });

  it("assembleViewModel yields hospMetrics === undefined when 4th arg is omitted", () => {
    const vm = assembleViewModel(facility, {}, FIXED_DATE_OBJ);
    expect(vm.hospMetrics).toBeUndefined();
  });
});

describe("ReportViewModelSchema", () => {
  it("accepts a well-formed ReportViewModel", () => {
    const vm = assembleViewModel(facility, {}, FIXED_DATE_OBJ);
    const result = ReportViewModelSchema.safeParse(vm);
    expect(result.success).toBe(true);
  });

  it("rejects an empty object", () => {
    const result = ReportViewModelSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects a partial object (missing facility)", () => {
    const result = ReportViewModelSchema.safeParse({
      header: {
        platformLine: "INFINITE — Managed by MEDELITE",
        reportTitle: "FACILITY ASSESSMENT SNAPSHOT",
        stateLine: "FL",
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an object with invalid careCompareUrl (not a URL)", () => {
    const vm = assembleViewModel(facility, {}, FIXED_DATE_OBJ);
    const badVm = {
      ...vm,
      facility: { ...vm.facility, careCompareUrl: "not-a-url" },
    };
    const result = ReportViewModelSchema.safeParse(badVm);
    expect(result.success).toBe(false);
  });

  // CR-03: z.string().url() alone accepts javascript:/data: URIs (WHATWG parses them).
  // The hardened refine must reject anything that is not an https://www.medicare.gov URL,
  // since this model is validated from the client-controlled PDF-export body.
  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "http://www.medicare.gov/care-compare/details/nursing-home/686123", // not https
    "https://evil.example.com/care-compare/details/nursing-home/686123", // wrong host
  ])("rejects a non-medicare/non-https careCompareUrl: %s", (badUrl) => {
    const vm = assembleViewModel(facility, {}, FIXED_DATE_OBJ);
    const badVm = {
      ...vm,
      facility: { ...vm.facility, careCompareUrl: badUrl },
    };
    const result = ReportViewModelSchema.safeParse(badVm);
    expect(result.success).toBe(false);
  });
});
