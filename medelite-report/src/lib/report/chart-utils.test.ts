// chart-utils.test.ts — unit tests for groupByMeasure()
// Vitest node env — no DOM/jsdom required.

import { describe, it, expect } from "vitest";
import { groupByMeasure, type MeasureKey } from "./chart-utils";
import { ReportViewModelSchema } from "@/lib/report/view-model";

// Helper to build a minimal HospMetric for testing.
// All 12 rows = 4 measures × 3 sources.
function makeMetric(
  measureKey: MeasureKey,
  source: "facility" | "nation" | "state",
  value: number | null = 1.5,
  unit: "percent" | "rate" = "percent",
) {
  return {
    label: `${measureKey}-${source} label`,
    value,
    unit,
    measureKey,
    source,
  };
}

// Build the canonical 12-row fixture (all 4 measures × 3 sources).
function make12Rows() {
  const rows = [];
  for (const key of ["521", "522", "551", "552"] as MeasureKey[]) {
    const unit = key === "521" || key === "522" ? "percent" : "rate";
    for (const src of ["facility", "nation", "state"] as const) {
      rows.push(makeMetric(key, src, 1.5, unit as "percent" | "rate"));
    }
  }
  return rows;
}

describe("groupByMeasure — canonical 12-row input", () => {
  it("returns exactly 4 MeasureGroup objects", () => {
    const groups = groupByMeasure(make12Rows());
    expect(groups).toHaveLength(4);
  });

  it("groups are returned in fixed canonical order: 521, 522, 551, 552", () => {
    const groups = groupByMeasure(make12Rows());
    expect(groups[0]!.key).toBe("521");
    expect(groups[1]!.key).toBe("522");
    expect(groups[2]!.key).toBe("551");
    expect(groups[3]!.key).toBe("552");
  });

  it("each group has correct label and unit", () => {
    const groups = groupByMeasure(make12Rows());
    expect(groups[0]!.label).toBe("Short-Stay Rehospitalization");
    expect(groups[0]!.unit).toBe("percent");
    expect(groups[1]!.label).toBe("Short-Stay ED Visits");
    expect(groups[1]!.unit).toBe("percent");
    expect(groups[2]!.label).toBe("Long-Stay Hospitalizations");
    expect(groups[2]!.unit).toBe("rate");
    expect(groups[3]!.label).toBe("Long-Stay ED Visits");
    expect(groups[3]!.unit).toBe("rate");
  });

  it("each group has facility/nation/state slots populated", () => {
    const groups = groupByMeasure(make12Rows());
    for (const group of groups) {
      expect(group.facility).toBeDefined();
      expect(group.nation).toBeDefined();
      expect(group.state).toBeDefined();
    }
  });

  it("facility slot contains the facility HospMetric for that measure", () => {
    const groups = groupByMeasure(make12Rows());
    expect(groups[0]!.facility!.source).toBe("facility");
    expect(groups[0]!.facility!.measureKey).toBe("521");
  });

  it("nation slot contains the nation HospMetric for that measure", () => {
    const groups = groupByMeasure(make12Rows());
    expect(groups[0]!.nation!.source).toBe("nation");
    expect(groups[0]!.nation!.measureKey).toBe("521");
  });

  it("state slot contains the state HospMetric for that measure", () => {
    const groups = groupByMeasure(make12Rows());
    expect(groups[0]!.state!.source).toBe("state");
    expect(groups[0]!.state!.measureKey).toBe("521");
  });
});

describe("groupByMeasure — partial array (D-09 support)", () => {
  it("returns 4 groups even when only 2 metrics are provided", () => {
    const partial = [
      makeMetric("521", "facility"),
      makeMetric("521", "nation"),
    ];
    const groups = groupByMeasure(partial);
    expect(groups).toHaveLength(4);
  });

  it("521 group has facility+nation set, state undefined when state row absent", () => {
    const partial = [
      makeMetric("521", "facility"),
      makeMetric("521", "nation"),
    ];
    const groups = groupByMeasure(partial);
    expect(groups[0]!.facility).toBeDefined();
    expect(groups[0]!.nation).toBeDefined();
    expect(groups[0]!.state).toBeUndefined();
  });

  it("522, 551, 552 groups all have undefined slots when no rows provided for them", () => {
    const partial = [
      makeMetric("521", "facility"),
      makeMetric("521", "nation"),
    ];
    const groups = groupByMeasure(partial);
    expect(groups[1]!.facility).toBeUndefined();
    expect(groups[1]!.nation).toBeUndefined();
    expect(groups[1]!.state).toBeUndefined();
    expect(groups[2]!.facility).toBeUndefined();
    expect(groups[3]!.facility).toBeUndefined();
  });

  it("empty array → 4 groups all with undefined slots", () => {
    const groups = groupByMeasure([]);
    expect(groups).toHaveLength(4);
    for (const group of groups) {
      expect(group.facility).toBeUndefined();
      expect(group.nation).toBeUndefined();
      expect(group.state).toBeUndefined();
    }
  });
});

describe("groupByMeasure — labels and units match MEASURE_SEEDS", () => {
  it("521 group label is 'Short-Stay Rehospitalization' and unit is 'percent'", () => {
    const groups = groupByMeasure([]);
    expect(groups[0]!.label).toBe("Short-Stay Rehospitalization");
    expect(groups[0]!.unit).toBe("percent");
  });

  it("552 group label is 'Long-Stay ED Visits' and unit is 'rate'", () => {
    const groups = groupByMeasure([]);
    expect(groups[3]!.label).toBe("Long-Stay ED Visits");
    expect(groups[3]!.unit).toBe("rate");
  });
});

// -----------------------------------------------------------------------
// HospMetricSchema validation tests (D-15 closed enum enforcement — T-7-01)
// Use ReportViewModelSchema to validate a full vm with hospMetrics that
// have invalid measureKey/source fields. This tests the schema gate without
// needing to export the internal HospMetricSchema.
// -----------------------------------------------------------------------

describe("HospMetricSchema (via ReportViewModelSchema) — D-15 closed enum enforcement", () => {
  // We use ReportViewModelSchema.shape.hospMetrics to access the array schema,
  // which in turn uses HospMetricSchema for each element.
  const hospMetricsSchema = ReportViewModelSchema.shape.hospMetrics;

  const validMetric = {
    label: "Short Term Hospitalization",
    value: 25.5,
    unit: "percent",
    measureKey: "521",
    source: "facility",
  };

  it("accepts a valid HospMetric with measureKey and source", () => {
    const result = hospMetricsSchema.safeParse([validMetric]);
    expect(result.success).toBe(true);
  });

  it("rejects a HospMetric missing measureKey", () => {
    const { measureKey: _, ...noKey } = validMetric;
    const result = hospMetricsSchema.safeParse([noKey]);
    expect(result.success).toBe(false);
  });

  it("rejects a HospMetric missing source", () => {
    const { source: _, ...noSource } = validMetric;
    const result = hospMetricsSchema.safeParse([noSource]);
    expect(result.success).toBe(false);
  });

  it("rejects measureKey '999' (not in closed enum)", () => {
    const bad = { ...validMetric, measureKey: "999" };
    const result = hospMetricsSchema.safeParse([bad]);
    expect(result.success).toBe(false);
  });

  it("rejects source 'county' (not in closed enum)", () => {
    const bad = { ...validMetric, source: "county" };
    const result = hospMetricsSchema.safeParse([bad]);
    expect(result.success).toBe(false);
  });

  it("accepts all 4 valid measureKey values", () => {
    for (const key of ["521", "522", "551", "552"]) {
      const result = hospMetricsSchema.safeParse([
        { ...validMetric, measureKey: key },
      ]);
      expect(result.success).toBe(true);
    }
  });

  it("accepts all 3 valid source values", () => {
    for (const src of ["facility", "nation", "state"]) {
      const result = hospMetricsSchema.safeParse([
        { ...validMetric, source: src },
      ]);
      expect(result.success).toBe(true);
    }
  });
});
