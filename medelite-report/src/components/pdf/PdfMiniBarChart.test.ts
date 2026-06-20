// PdfMiniBarChart.test.ts — Structural unit test for the PdfMiniBarChart PDF component.
//
// Tests run in node env (no jsdom, no renderToBuffer). This file is .test.ts (not .test.tsx)
// so that Vitest picks it up (vitest.config.ts include: "src/**/*.test.ts").
//
// TEST MECHANISM (from PLAN.md <interfaces> section):
//   Import PdfMiniBarChart from the .tsx file. Esbuild transpiles the imported JSX.
//   Call PdfMiniBarChart({ group }) directly to get the returned React element.
//   Walk the element tree via a recursive findByType() helper that traverses props.children
//   (handling arrays + nested elements). Match component types against the imported
//   ReactPDFChart, Bar, and Legend references.
//
// WHAT IS GUARDED (Blocker 2):
//   (1) The element tree wraps chart content in ReactPDFChart (VIZ-02 adapter guard).
//   (2) Every <Bar> node carries isAnimationActive === false (Pitfall 1 / blank-chart guard).
//   (3) At least one <Legend> node is present (D-08 / Blocker 1 — PDF chart carries a legend).
//   (4) An all-suppressed group has NO <Bar> node (returns the N/A Text path).
//
// This structural test simultaneously guards Pitfall 1 and Blocker 1/D-08 without needing
// DOM rendering or renderToBuffer — it runs in ~100ms as a pure element-tree inspection.

import { describe, expect, it } from "vitest";
import { PdfMiniBarChart } from "./PdfMiniBarChart";
import type { MeasureGroup } from "@/lib/report/chart-utils";
import type { HospMetric } from "@/lib/cms/types";

// Import ReactPDFChart and recharts components to compare against element.type references.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ReactPDFChart = require("react-pdf-charts").default as unknown;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Bar, Legend } = require("recharts") as {
  Bar: unknown;
  Legend: unknown;
};

// ---------------------------------------------------------------------------
// findByType — recursive element tree walker (handles arrays at any depth)
// ---------------------------------------------------------------------------

type AnyElement = {
  type?: unknown;
  props?: { children?: unknown };
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

  // Handle arrays (e.g. data.map() returns an array of elements)
  if (Array.isArray(node)) {
    for (const child of node) {
      results.push(...findByType(child, predicate));
    }
    return results;
  }

  // Must be an object to be a React element
  if (typeof node !== "object") return results;

  const el = node as AnyElement;

  // Check this node
  if (predicate(el.type)) {
    results.push(el);
  }

  // Recurse into children
  if (el.props?.children !== undefined) {
    results.push(...findByType(el.props.children, predicate));
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

/** Full group with all three slots present and non-null. */
const fullGroup: MeasureGroup = {
  key: "521",
  label: "Short-Stay Rehospitalization",
  unit: "percent",
  facility: makeMetric(15.2, "facility"),
  nation: makeMetric(17.8, "nation"),
  state: makeMetric(16.5, "state"),
};

/** All-suppressed group — every value is null. */
const allSuppressedGroup: MeasureGroup = {
  key: "551",
  label: "Long-Stay Hospitalizations",
  unit: "rate",
  facility: makeMetric(null, "facility"),
  nation: makeMetric(null, "nation"),
  state: makeMetric(null, "state"),
};

/** Partial group — only facility and state present (national suppressed). */
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

  it("(VIZ-02) element tree contains at least one ReactPDFChart node", () => {
    const nodes = findByType(element, (t) => t === ReactPDFChart);
    expect(nodes.length).toBeGreaterThanOrEqual(1);
  });

  it("(Pitfall 1) element tree contains at least one Bar node", () => {
    const barNodes = findByType(element, (t) => t === Bar);
    expect(barNodes.length).toBeGreaterThanOrEqual(1);
  });

  it("(Pitfall 1) every Bar node has isAnimationActive === false", () => {
    const barNodes = findByType(element, (t) => t === Bar);
    expect(barNodes.length).toBeGreaterThanOrEqual(1);
    for (const barNode of barNodes) {
      expect(
        (barNode.props as Record<string, unknown>)?.isAnimationActive,
        "Bar.props.isAnimationActive must be false (MANDATORY — Pitfall 1)",
      ).toBe(false);
    }
  });

  it("(D-08 / Blocker 1) element tree contains at least one Legend node", () => {
    const legendNodes = findByType(element, (t) => t === Legend);
    expect(legendNodes.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Structural assertions — all-suppressed group (D-09 N/A path)
// ---------------------------------------------------------------------------

describe("PdfMiniBarChart — all-suppressed group (D-09 N/A path)", () => {
  const element = PdfMiniBarChart({ group: allSuppressedGroup });

  it("returns a non-null element (renders N/A path, not null)", () => {
    // The all-suppressed path returns a <View><Text>N/A</Text></View>, not null
    expect(element).not.toBeNull();
  });

  it("(D-09) element tree has NO Bar nodes for an all-suppressed group", () => {
    const barNodes = findByType(element, (t) => t === Bar);
    expect(barNodes).toHaveLength(0);
  });

  it("(D-09) element tree has NO ReactPDFChart nodes for an all-suppressed group", () => {
    const chartNodes = findByType(element, (t) => t === ReactPDFChart);
    expect(chartNodes).toHaveLength(0);
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

  it("partial group still has ReactPDFChart wrapper (chart renders with available bars)", () => {
    const chartNodes = findByType(element, (t) => t === ReactPDFChart);
    expect(chartNodes.length).toBeGreaterThanOrEqual(1);
  });

  it("partial group still has a Legend node (D-08)", () => {
    const legendNodes = findByType(element, (t) => t === Legend);
    expect(legendNodes.length).toBeGreaterThanOrEqual(1);
  });

  it("partial group's Bar node has isAnimationActive === false (Pitfall 1)", () => {
    const barNodes = findByType(element, (t) => t === Bar);
    expect(barNodes.length).toBeGreaterThanOrEqual(1);
    for (const barNode of barNodes) {
      expect(
        (barNode.props as Record<string, unknown>)?.isAnimationActive,
      ).toBe(false);
    }
  });
});
