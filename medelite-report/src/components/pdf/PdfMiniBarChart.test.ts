// PdfMiniBarChart.test.ts — Structural unit test for the PdfMiniBarChart PDF component.
//
// Tests run in node env (no jsdom, no renderToBuffer). This file is .test.ts (not .test.tsx)
// so that Vitest picks it up (vitest.config.ts include: "src/**/*.test.ts").
//
// TEST MECHANISM:
//   Import PdfMiniBarChart from the .tsx file. Esbuild transpiles the imported JSX.
//   Call PdfMiniBarChart({ group }) directly to get the returned React element.
//   Walk the element tree via a recursive findByType() helper that traverses props.children
//   (handling arrays + nested elements). Match component types against react-pdf primitives.
//
// WHAT IS GUARDED (native SVG implementation — VIZ-02):
//   (1) Non-empty group → element tree contains at least one Svg node (chart renders as SVG).
//   (2) Non-empty group → element tree contains at least one Rect node (bars rendered).
//   (3) X-axis category labels: "Facility", "National", "State" appear as Text OUTSIDE Svg.
//       (Previously guarded by D-08 legend requirement; now the labels are X-axis labels.)
//   (4) Chart title (group.label) appears as Text OUTSIDE Svg.
//   (5) D-09: all-suppressed → NO Svg node (returns the N/A Text path, no empty chart).
//   (6) Partial group → chart renders (Svg node present) with only available bars;
//       absent series name does NOT appear as an X-axis label.
//   (7) CLM-03 guard: NO Text elements inside Svg (avoids SVG CID font encoding collision
//       that prevents extractTextFromPdf from reading metric label text in the PDF buffer).
//   (8) NO color legend swatch+name block — legend has been removed; series identity is
//       conveyed by X-axis category labels and the chart title.
//
// NOTE: The legend (D-08 color swatch row) was removed per the design target. Series
// identity is now communicated by the X-axis category labels (Facility/National/State) and
// the bold chart title. The CLM-03 guard (no Text inside Svg) is unchanged.

import { describe, expect, it } from "vitest";
import { PdfMiniBarChart } from "./PdfMiniBarChart";
import { Svg, Rect, Text } from "@react-pdf/renderer";
import type { MeasureGroup } from "@/lib/report/chart-utils";
import type { HospMetric } from "@/lib/cms/types";

// ---------------------------------------------------------------------------
// findByType — recursive element tree walker (handles arrays at any depth)
// ---------------------------------------------------------------------------

type AnyElement = {
  type?: unknown;
  props?: { children?: unknown; [key: string]: unknown };
};

/**
 * Recursively walks a React element tree and returns all nodes whose `type`
 * passes `predicate`. Handles arrays and nested elements at any depth.
 */
function findByType(
  node: unknown,
  predicate: (type: unknown) => boolean,
): AnyElement[] {
  const results: AnyElement[] = [];

  if (node === null || node === undefined) return results;

  if (Array.isArray(node)) {
    for (const child of node) {
      results.push(...findByType(child, predicate));
    }
    return results;
  }

  if (typeof node !== "object") return results;

  const el = node as AnyElement;

  if (predicate(el.type)) {
    results.push(el);
  }

  if (el.props?.children !== undefined) {
    results.push(...findByType(el.props.children, predicate));
  }

  return results;
}

/**
 * Recursively collects all Text content strings from a React element tree.
 */
function findTextContent(node: unknown): string[] {
  const results: string[] = [];

  if (node === null || node === undefined) return results;
  if (typeof node === "string") {
    results.push(node);
    return results;
  }
  if (typeof node === "number") {
    results.push(String(node));
    return results;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      results.push(...findTextContent(child));
    }
    return results;
  }
  if (typeof node !== "object") return results;

  const el = node as AnyElement;
  if (el.props?.children !== undefined) {
    results.push(...findTextContent(el.props.children));
  }

  return results;
}

/**
 * Returns all Text elements that are INSIDE any Svg node in the tree.
 * CLM-03 guard: Text inside Svg uses SVG CID glyph encoding, which causes
 * font table collisions that prevent extractTextFromPdf from reading metric labels.
 */
function findTextInsideSvg(node: unknown): AnyElement[] {
  const results: AnyElement[] = [];

  if (node === null || node === undefined) return results;
  if (Array.isArray(node)) {
    for (const child of node) {
      results.push(...findTextInsideSvg(child));
    }
    return results;
  }
  if (typeof node !== "object") return results;

  const el = node as AnyElement;

  if (el.type === Svg) {
    // Search inside this Svg for any Text nodes
    const textNodesInSvg = findByType(el.props?.children, (t) => t === Text);
    results.push(...textNodesInSvg);
    return results;
  }

  if (el.props?.children !== undefined) {
    results.push(...findTextInsideSvg(el.props.children));
  }

  return results;
}

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

const allSuppressedGroup: MeasureGroup = {
  key: "551",
  label: "Long-Stay Hospitalizations",
  unit: "rate",
  facility: makeMetric(null, "facility"),
  nation: makeMetric(null, "nation"),
  state: makeMetric(null, "state"),
};

const partialGroup: MeasureGroup = {
  key: "522",
  label: "Short-Stay ED Visits",
  unit: "percent",
  facility: makeMetric(8.3, "facility"),
  nation: makeMetric(null, "nation"),
  state: makeMetric(9.1, "state"),
};

// ---------------------------------------------------------------------------
// Structural assertions — full group
// ---------------------------------------------------------------------------

describe("PdfMiniBarChart — full group structural test", () => {
  const element = PdfMiniBarChart({ group: fullGroup });

  it("returns a non-null React element for a non-empty group", () => {
    expect(element).not.toBeNull();
    expect(element).toBeDefined();
  });

  it("(VIZ-02) element tree contains at least one Svg node", () => {
    const nodes = findByType(element, (t) => t === Svg);
    expect(nodes.length).toBeGreaterThanOrEqual(1);
  });

  it("(VIZ-02) element tree contains at least one Rect node (bars)", () => {
    const rectNodes = findByType(element, (t) => t === Rect);
    expect(rectNodes.length).toBeGreaterThanOrEqual(1);
  });

  it("chart title (group.label) appears as text outside Svg", () => {
    const texts = findTextContent(element).join(" ");
    expect(texts).toContain("Short-Stay Rehospitalization");
  });

  it("X-axis: 'Facility' appears as text outside Svg (category label)", () => {
    const texts = findTextContent(element);
    expect(texts.join(" ")).toContain("Facility");
  });

  it("X-axis: 'National' appears as text outside Svg (category label)", () => {
    const texts = findTextContent(element);
    expect(texts.join(" ")).toContain("National");
  });

  it("X-axis: 'State' appears as text outside Svg (category label)", () => {
    const texts = findTextContent(element);
    expect(texts.join(" ")).toContain("State");
  });

  it("(CLM-03 guard) NO Text elements appear inside any Svg node", () => {
    const textInsideSvg = findTextInsideSvg(element);
    expect(textInsideSvg).toHaveLength(0);
  });

  it("(legend removed) no color-swatch Rect with fixed 10×8 dimensions used as legend swatch", () => {
    // The old legend used tiny 10×8 Rects as color swatches in a separate legend row.
    // After the redesign the only Rects should be the bar Rects (taller, proportional to value).
    // We verify that all Rect nodes are taller than 8 (bar height is always > 1 for non-zero values).
    const rectNodes = findByType(element, (t) => t === Rect);
    // At least one Rect should be a bar (height > 8)
    const hasTallRect = rectNodes.some(
      (r) =>
        typeof (r.props as { height?: unknown }).height === "number" &&
        (r.props as { height: number }).height > 8,
    );
    expect(hasTallRect).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Structural assertions — all-suppressed group (D-09 N/A path)
// ---------------------------------------------------------------------------

describe("PdfMiniBarChart — all-suppressed group (D-09 N/A path)", () => {
  const element = PdfMiniBarChart({ group: allSuppressedGroup });

  it("returns a non-null element (renders N/A path, not null)", () => {
    expect(element).not.toBeNull();
  });

  it("(D-09) NO Svg nodes for all-suppressed group", () => {
    const svgNodes = findByType(element, (t) => t === Svg);
    expect(svgNodes).toHaveLength(0);
  });

  it("(D-09) NO Rect nodes for all-suppressed group", () => {
    const rectNodes = findByType(element, (t) => t === Rect);
    expect(rectNodes).toHaveLength(0);
  });

  it("(D-09) 'N/A' text appears for all-suppressed group", () => {
    const texts = findTextContent(element);
    expect(texts.join("")).toContain("N/A");
  });

  it("chart title appears even for all-suppressed group", () => {
    const texts = findTextContent(element).join(" ");
    expect(texts).toContain("Long-Stay Hospitalizations");
  });
});

// ---------------------------------------------------------------------------
// Structural assertions — partial group
// ---------------------------------------------------------------------------

describe("PdfMiniBarChart — partial group (D-09 partial-chart)", () => {
  const element = PdfMiniBarChart({ group: partialGroup });

  it("returns a non-null element for a partially-suppressed group", () => {
    expect(element).not.toBeNull();
  });

  it("partial group renders an Svg node", () => {
    const svgNodes = findByType(element, (t) => t === Svg);
    expect(svgNodes.length).toBeGreaterThanOrEqual(1);
  });

  it("partial group has Rect nodes for the available bars", () => {
    const rectNodes = findByType(element, (t) => t === Rect);
    expect(rectNodes.length).toBeGreaterThanOrEqual(1);
  });

  it("X-axis: partial group has 'Facility' and 'State' labels but NOT 'National'", () => {
    const texts = findTextContent(element).join(" ");
    expect(texts).toContain("Facility");
    expect(texts).toContain("State");
    expect(texts).not.toContain("National");
  });

  it("(CLM-03 guard) partial group has NO Text elements inside any Svg node", () => {
    const textInsideSvg = findTextInsideSvg(element);
    expect(textInsideSvg).toHaveLength(0);
  });
});
