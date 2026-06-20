// chart-svg.test.ts — Unit tests for buildChartData and renderChartSvgString.
//
// Tests run in node env (no jsdom). The core assertions:
//  1. buildChartData null-filtering (D-09): null-valued slots are omitted from the output array.
//  2. renderChartSvgString returns a non-empty string containing "<svg" (Open Question 1 resolved:
//     recharts renderToStaticMarkup works server-side in node env with isAnimationActive=false).
//  3. Full group → 3 data points (Facility/National/State) with correct colors.
//  4. Partial group → only non-null slots in the output.
//  5. All-suppressed group → empty array [] → renderChartSvgString returns "".
//
// See RESEARCH.md Open Question 1 for the smoke-test rationale.

import { describe, expect, it } from "vitest";
import { buildChartData, renderChartSvgString } from "./chart-svg";
import { CHART_SERIES } from "@/lib/report/colors";
import type { MeasureGroup } from "@/lib/report/chart-utils";
import type { HospMetric } from "@/lib/cms/types";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeMetric(
  value: number | null,
  source: "facility" | "nation" | "state",
): HospMetric {
  return {
    label: `Test ${source}`,
    value,
    unit: "percent",
    footnoteCode: value === null ? "1" : undefined,
    measureKey: "521",
    source,
  };
}

const fullGroup: MeasureGroup = {
  key: "521",
  label: "Short-Stay Rehospitalization",
  unit: "percent",
  facility: makeMetric(15.2, "facility"),
  nation: makeMetric(17.8, "nation"),
  state: makeMetric(16.5, "state"),
};

const partialGroup: MeasureGroup = {
  key: "522",
  label: "Short-Stay ED Visits",
  unit: "percent",
  facility: makeMetric(8.3, "facility"),
  nation: makeMetric(null, "nation"), // suppressed
  state: makeMetric(9.1, "state"),
};

const allSuppressedGroup: MeasureGroup = {
  key: "551",
  label: "Long-Stay Hospitalizations",
  unit: "rate",
  facility: makeMetric(null, "facility"),
  nation: makeMetric(null, "nation"),
  state: makeMetric(null, "state"),
};

const noSlotsGroup: MeasureGroup = {
  key: "552",
  label: "Long-Stay ED Visits",
  unit: "rate",
  // All slots undefined (not present at all)
};

// ---------------------------------------------------------------------------
// buildChartData tests
// ---------------------------------------------------------------------------

describe("buildChartData", () => {
  it("full group → 3 entries in Facility/National/State order", () => {
    const data = buildChartData(fullGroup);
    expect(data).toHaveLength(3);
    expect(data[0].name).toBe("Facility");
    expect(data[1].name).toBe("National");
    expect(data[2].name).toBe("State");
  });

  it("full group → values match the fixture metrics", () => {
    const data = buildChartData(fullGroup);
    expect(data[0].value).toBe(15.2);
    expect(data[1].value).toBe(17.8);
    expect(data[2].value).toBe(16.5);
  });

  it("full group → colors match CHART_SERIES (D-08 series identity)", () => {
    const data = buildChartData(fullGroup);
    expect(data[0].color).toBe(CHART_SERIES.facility);
    expect(data[1].color).toBe(CHART_SERIES.nation);
    expect(data[2].color).toBe(CHART_SERIES.state);
  });

  it("partial group → null-valued slot is filtered OUT (D-09)", () => {
    const data = buildChartData(partialGroup);
    // National was null — must not appear
    expect(data).toHaveLength(2);
    expect(data.map((d) => d.name)).toEqual(["Facility", "State"]);
  });

  it("partial group → remaining entries have correct values", () => {
    const data = buildChartData(partialGroup);
    expect(data[0].value).toBe(8.3);
    expect(data[1].value).toBe(9.1);
  });

  it("all-suppressed group (null values) → empty array (D-09)", () => {
    const data = buildChartData(allSuppressedGroup);
    expect(data).toHaveLength(0);
  });

  it("all-slots-undefined group → empty array (D-09 absent slots)", () => {
    const data = buildChartData(noSlotsGroup);
    expect(data).toHaveLength(0);
  });

  it("only facility slot present → 1 entry (D-09 partial chart)", () => {
    const facilityOnlyGroup: MeasureGroup = {
      key: "521",
      label: "Short-Stay Rehospitalization",
      unit: "percent",
      facility: makeMetric(12.5, "facility"),
      // nation and state absent
    };
    const data = buildChartData(facilityOnlyGroup);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Facility");
    expect(data[0].value).toBe(12.5);
  });
});

// ---------------------------------------------------------------------------
// renderChartSvgString tests — Open Question 1 smoke test
// ---------------------------------------------------------------------------

describe("renderChartSvgString", () => {
  it("non-empty data → returns a non-empty string (Open Question 1)", () => {
    const data = buildChartData(fullGroup);
    const svg = renderChartSvgString(data);
    expect(svg).toBeTruthy();
    expect(svg.length).toBeGreaterThan(0);
  });

  it("non-empty data → SVG string contains '<svg' (recharts renderToStaticMarkup works server-side)", () => {
    const data = buildChartData(fullGroup);
    const svg = renderChartSvgString(data);
    expect(svg).toContain("<svg");
  });

  it("non-empty data → SVG string contains bar geometry (rect or path elements)", () => {
    const data = buildChartData(fullGroup);
    const svg = renderChartSvgString(data);
    // recharts BarChart renders bars as <rect> elements in the SVG
    expect(svg).toMatch(/<rect|<path/);
  });

  it("empty data → returns empty string (all-suppressed path)", () => {
    const data = buildChartData(allSuppressedGroup);
    const svg = renderChartSvgString(data);
    expect(svg).toBe("");
  });

  it("accepts custom width and height without throwing", () => {
    const data = buildChartData(fullGroup);
    expect(() => renderChartSvgString(data, 200, 100)).not.toThrow();
  });
});
