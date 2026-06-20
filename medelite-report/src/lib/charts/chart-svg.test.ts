// chart-svg.test.ts — Unit tests for buildChartData and renderChartSvgString.
//
// Tests run in node env (no jsdom). The core assertions:
//  1. buildChartData null-filtering (D-09): null-valued slots are omitted from the output array.
//  2. renderChartSvgString returns a non-empty string containing "<svg" (smoke test).
//  3. Full group → 3 data points (Facility/National/State) with correct colors.
//  4. Partial group → only non-null slots in the output.
//  5. All-suppressed group → empty array [] → renderChartSvgString returns "".
//  6. Title: when label param provided, SVG contains the label text.
//  7. No legend: SVG must NOT contain the word "legend" or separate swatch rects for series names
//     (series identity is conveyed by X-axis category labels, not a legend block).
//  8. X-axis category labels: SVG contains "Facility", "National", "State" text elements.
//  9. Y-axis tick labels: SVG contains numeric tick labels.

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
// renderChartSvgString tests
// ---------------------------------------------------------------------------

describe("renderChartSvgString", () => {
  it("non-empty data → returns a non-empty string", () => {
    const data = buildChartData(fullGroup);
    const svg = renderChartSvgString(data);
    expect(svg).toBeTruthy();
    expect(svg.length).toBeGreaterThan(0);
  });

  it("non-empty data → SVG string contains '<svg'", () => {
    const data = buildChartData(fullGroup);
    const svg = renderChartSvgString(data);
    expect(svg).toContain("<svg");
  });

  it("non-empty data → SVG string contains bar geometry (<rect elements)", () => {
    const data = buildChartData(fullGroup);
    const svg = renderChartSvgString(data);
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

  // ---- Title ----
  it("label param → SVG contains the label text as a title element", () => {
    const data = buildChartData(fullGroup);
    const svg = renderChartSvgString(
      data,
      300,
      140,
      "Short-Stay Rehospitalization",
    );
    expect(svg).toContain("Short-Stay Rehospitalization");
    // The title must appear in a text element, not just as an attribute
    expect(svg).toMatch(/<text[^>]*>Short-Stay Rehospitalization<\/text>/);
  });

  it("no label param → SVG does not contain an empty text element for title", () => {
    const data = buildChartData(fullGroup);
    const svg = renderChartSvgString(data, 300, 140);
    // With no label, no title <text> element should be generated
    // (the only text elements should be Y-axis ticks and X-axis labels)
    expect(svg).not.toContain('font-weight="bold"');
  });

  // ---- X-axis category labels ----
  it("SVG contains 'Facility' as an X-axis category label", () => {
    const data = buildChartData(fullGroup);
    const svg = renderChartSvgString(data);
    expect(svg).toContain(">Facility<");
  });

  it("SVG contains 'National' as an X-axis category label", () => {
    const data = buildChartData(fullGroup);
    const svg = renderChartSvgString(data);
    expect(svg).toContain(">National<");
  });

  it("SVG contains 'State' as an X-axis category label", () => {
    const data = buildChartData(fullGroup);
    const svg = renderChartSvgString(data);
    expect(svg).toContain(">State<");
  });

  // ---- Y-axis tick labels ----
  it("SVG contains Y-axis numeric tick label for 0", () => {
    const data = buildChartData(fullGroup);
    const svg = renderChartSvgString(data);
    // Y-axis has a tick at 0
    expect(svg).toContain(">0<");
  });

  it("SVG contains Y-axis numeric tick labels (3 ticks: 0, mid, max)", () => {
    const data = buildChartData(fullGroup);
    const svg = renderChartSvgString(data);
    // There should be exactly 3 Y-axis tick text elements (via text-anchor="end")
    const tickMatches = svg.match(/text-anchor="end"/g) ?? [];
    expect(tickMatches.length).toBe(3);
  });

  // ---- No legend ----
  it("SVG does NOT contain a separate legend block (legend removed)", () => {
    const data = buildChartData(fullGroup);
    const svg = renderChartSvgString(data, 300, 140);
    // The old legend had a legendY variable placing swatch rects near the bottom.
    // Verify no text element appears at or near the legend Y position (height-10 = 130).
    // More robustly: verify 'Facility' only appears once (as an X-axis label, not also in a legend).
    const facilityOccurrences = (svg.match(/Facility/g) ?? []).length;
    expect(facilityOccurrences).toBe(1);
    const nationalOccurrences = (svg.match(/National/g) ?? []).length;
    expect(nationalOccurrences).toBe(1);
    const stateOccurrences = (svg.match(/State/g) ?? []).length;
    expect(stateOccurrences).toBe(1);
  });

  // ---- Baseline (X-axis line) ----
  it("SVG contains a baseline X-axis line element", () => {
    const data = buildChartData(fullGroup);
    const svg = renderChartSvgString(data);
    // Both Y-axis line and X-axis baseline should be present
    const lineMatches = svg.match(/<line /g) ?? [];
    expect(lineMatches.length).toBeGreaterThanOrEqual(2);
  });
});
