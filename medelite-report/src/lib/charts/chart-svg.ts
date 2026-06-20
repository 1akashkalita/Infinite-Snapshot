// chart-svg.ts — Server-only SVG chart generator for server-side rendering and docx rasterization.
//
// NO "use client" — this file is server-only. Import only from route handlers or server modules.
// The react-dom/server renderToStaticMarkup API is Node-only in this context; never include
// in client bundles.
//
// buildChartData: maps a MeasureGroup to the ChartDatum[] array consumed by chart components.
//   - Filters out slots whose value is null (D-09 suppression — omit bar, not "0" bar).
//   - Colors come from the shared CHART_SERIES constants (D-08: series identity, NOT performance bands).
//
// renderChartSvgString: calls renderToStaticMarkup (react-dom/server) on a minimal recharts
//   <BarChart> to produce an SVG string. Used by the docx rasterizer (svgToPngBuffer) to
//   generate chart PNGs for ImageRun embedding. isAnimationActive={false} is MANDATORY — without
//   it, recharts animation code runs during renderToStaticMarkup and may produce empty/partial
//   SVG (Pitfall 1 / RESEARCH.md §Common Pitfalls). This also serves as the Open Question 1
//   smoke-test: if renderToStaticMarkup throws on recharts in node env, the unit test catches
//   it here, not silently in production.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CHART_SERIES } from "@/lib/report/colors";
import type { MeasureGroup } from "@/lib/report/chart-utils";

// ---------------------------------------------------------------------------
// ChartDatum — the data shape consumed by both MiniBarChart and renderChartSvgString
// ---------------------------------------------------------------------------

/** One bar in a grouped bar chart: a named data point with a value and series color. */
export interface ChartDatum {
  /** Series name — "Facility", "National", or "State". */
  name: string;
  /** Numeric value (already filtered — never null in a ChartDatum). */
  value: number;
  /** Series color hex — from CHART_SERIES (D-08 series identity, not performance band). */
  color: string;
}

// ---------------------------------------------------------------------------
// buildChartData — map a MeasureGroup to ChartDatum[], filtering suppressed slots (D-09)
// ---------------------------------------------------------------------------

/**
 * Maps a MeasureGroup to a ChartDatum array for chart rendering.
 *
 * Slots where value === null are filtered OUT (D-09 suppression rule — omit bar entirely,
 * do not render a "0" bar). A partially-suppressed group returns only the available bars.
 * An all-suppressed group returns [] (caller renders an N/A indication per D-09).
 *
 * Colors come from CHART_SERIES (D-08: series identity — facility=blue, national=green, state=amber;
 * these are NOT performance indicators — always render with a legend so readers know what each
 * color means).
 *
 * @param group — A MeasureGroup from groupByMeasure(vm.hospMetrics).
 * @returns ChartDatum[] with only non-null slots (may be empty for all-suppressed groups).
 */
export function buildChartData(group: MeasureGroup): ChartDatum[] {
  const candidates: ChartDatum[] = [];

  if (group.facility !== undefined && group.facility.value !== null) {
    candidates.push({
      name: "Facility",
      value: group.facility.value,
      color: CHART_SERIES.facility,
    });
  }
  if (group.nation !== undefined && group.nation.value !== null) {
    candidates.push({
      name: "National",
      value: group.nation.value,
      color: CHART_SERIES.nation,
    });
  }
  if (group.state !== undefined && group.state.value !== null) {
    candidates.push({
      name: "State",
      value: group.state.value,
      color: CHART_SERIES.state,
    });
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// renderChartSvgString — server-side SVG via renderToStaticMarkup + recharts
// ---------------------------------------------------------------------------

// Recharts components imported via require + typed as ComponentType<Record<string,unknown>>
// to avoid TypeScript strict overload checking on createElement. Recharts v2 class
// components have `defaultProps` whose inferred types (e.g. `layout: string`) are wider
// than their declared prop union (`"horizontal" | "vertical" | undefined`), causing TS2769
// with React.createElement's strict overloads. Using `Record<string,unknown>` props type
// routes through the widest createElement overload and preserves all runtime prop passing.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { BarChart, Bar, XAxis, YAxis, Cell } = require("recharts") as {
  BarChart: React.ComponentType<Record<string, unknown>>;
  Bar: React.ComponentType<Record<string, unknown>>;
  XAxis: React.ComponentType<Record<string, unknown>>;
  YAxis: React.ComponentType<Record<string, unknown>>;
  Cell: React.ComponentType<Record<string, unknown>>;
};

/**
 * Renders a ChartDatum[] into an SVG string using recharts and react-dom/server.
 *
 * Used by the docx rasterizer to produce SVG before @resvg/resvg-js rasterizes it to PNG.
 * This function also serves as the Open Question 1 smoke test: calling it from a unit test
 * (chart-svg.test.ts) proves that recharts renderToStaticMarkup works in node env without
 * DOM errors before the PDF chart component is built.
 *
 * IMPORTANT: isAnimationActive={false} is MANDATORY on every <Bar>. Without it, recharts
 * animation code runs during renderToStaticMarkup and may produce empty or partial SVG output
 * (RESEARCH.md Pitfall 1 / react-pdf-charts Known Issues).
 *
 * @param data — ChartDatum array from buildChartData (filtered, non-null values only).
 * @param width — SVG width in px (default 300; keep small for docx DOCX-01 size budget).
 * @param height — SVG height in px (default 140; ~120 chart + 20 legend headroom).
 * @returns SVG markup string (non-empty if data is non-empty; contains <svg and bar geometry).
 */
export function renderChartSvgString(
  data: ChartDatum[],
  width = 300,
  height = 140,
): string {
  if (data.length === 0) return "";

  // Build recharts element tree using React.createElement.
  // isAnimationActive={false} is MANDATORY on Bar (Pitfall 1).
  const barElement = React.createElement(
    Bar,
    { dataKey: "value", isAnimationActive: false },
    ...data.map((d, i) => React.createElement(Cell, { key: i, fill: d.color })),
  );

  const chartElement = React.createElement(
    BarChart,
    { width, height, data },
    React.createElement(XAxis, { dataKey: "name" }),
    React.createElement(YAxis, null),
    barElement,
  );

  return renderToStaticMarkup(chartElement as React.ReactElement);
}
