// chart-svg.ts — Server-only SVG chart generator for docx rasterization.
//
// NO "use client" — this file is server-only. Import only from route handlers or server modules.
// This module must NOT be transitively imported by any "use client" component.
//
// buildChartData / ChartDatum live in chart-data.ts (shared, no server-only imports) so that
// client components (MiniBarChart.tsx) can import the data builder without pulling in
// server-only APIs. This file re-exports them for backward-compat so server-only callers
// (ReportDocx.ts, PdfMiniBarChart.tsx) can continue to import from one place.
//
// renderChartSvgString: builds a minimal grouped bar chart SVG using raw SVG geometry (no
//   recharts, no react-dom/server). This approach avoids two Turbopack pitfalls:
//   1. react-dom/server is blocked as a static top-level import in Route Handler bundles.
//   2. recharts (a React class-component library) breaks when bundled into server chunks
//      ("Super expression must either be null or a function" — class inheritance in server env).
//   The hand-crafted SVG is deterministic and @resvg/resvg-js compatible without any
//   DOM or React runtime dependency.

// Re-export shared types so server-only callers don't need to change import paths.
export type { ChartDatum } from "@/lib/charts/chart-data";
export { buildChartData } from "@/lib/charts/chart-data";
import type { ChartDatum } from "@/lib/charts/chart-data";

// ---------------------------------------------------------------------------
// renderChartSvgString — hand-crafted SVG bar chart (no recharts, no react-dom)
// ---------------------------------------------------------------------------

/**
 * Renders a ChartDatum[] into a minimal grouped bar chart SVG string.
 *
 * Used by the docx rasterizer (svgToPngBuffer) to generate chart PNGs for docx embedding.
 * Does NOT use recharts or react-dom/server — generates raw SVG geometry for full
 * server-side compatibility (Turbopack + @resvg/resvg-js).
 *
 * Layout:
 *   - Optional bold title at the top.
 *   - Bars drawn left-to-right, one per datum (1 bar per series: Facility/National/State).
 *   - Y-axis on the left with numeric tick labels, X-axis category labels below the bars.
 *   - NO legend — series identity conveyed by X-axis labels and the chart title.
 *   - Bar height is proportional to value / maxValue * chartH (linear scale).
 *
 * @param data — ChartDatum array from buildChartData (filtered, non-null values only).
 * @param width — SVG width in px (default 300).
 * @param height — SVG height in px (default 140).
 * @param label — Optional chart title rendered as a bold text element at the top of the SVG.
 * @returns SVG markup string with xmlns (non-empty if data is non-empty).
 */
export function renderChartSvgString(
  data: ChartDatum[],
  width = 300,
  height = 140,
  label = "",
): string {
  if (data.length === 0) return "";

  // Layout constants
  const PAD_LEFT = 36; // y-axis label area
  const PAD_RIGHT = 8;
  const TITLE_H = label ? 16 : 0; // space for bold title at top
  const PAD_TOP = TITLE_H + 8;
  const PAD_BOTTOM = 20; // x labels below bars (no legend)
  const chartW = width - PAD_LEFT - PAD_RIGHT;
  const chartH = height - PAD_TOP - PAD_BOTTOM;
  const n = data.length;
  const barW = Math.floor((chartW / n) * 0.6);
  const barGap = Math.floor((chartW / n) * 0.4);

  // Y-axis: scale from 0 to max value (rounded up to a nice tick)
  const maxVal = Math.max(...data.map((d) => d.value));
  // Nice ceiling: round up to at least 1
  const yMax = maxVal <= 0 ? 1 : Math.ceil(maxVal * 1.1);

  // Helper: value → Y coordinate (SVG y grows downward)
  const toY = (v: number) => PAD_TOP + chartH - Math.round((v / yMax) * chartH);

  // ---- Optional bold title ----
  const titleEl = label
    ? `<text x="${PAD_LEFT}" y="${TITLE_H - 2}" font-size="10" font-weight="bold" fill="#111827">${escSvgText(label)}</text>`
    : "";

  // ---- Bars + X-axis category labels ----
  const bars = data
    .map((d, i) => {
      const x =
        PAD_LEFT + Math.round((i * chartW) / n) + Math.round(barGap / 2);
      const y = toY(d.value);
      const barH = PAD_TOP + chartH - y;
      return (
        `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${escSvgAttr(d.color)}"/>` +
        `<text x="${x + Math.round(barW / 2)}" y="${PAD_TOP + chartH + 12}" ` +
        `font-size="9" text-anchor="middle" fill="#374151">${escSvgText(d.name)}</text>`
      );
    })
    .join("\n  ");

  // ---- Y-axis ticks (3 ticks: 0, yMax/2, yMax) ----
  const yTicks = [0, yMax / 2, yMax]
    .map((v) => {
      const y = toY(v);
      const label = v % 1 === 0 ? String(Math.round(v)) : v.toFixed(1);
      return (
        `<line x1="${PAD_LEFT - 4}" y1="${y}" x2="${PAD_LEFT}" y2="${y}" stroke="#9ca3af" stroke-width="1"/>` +
        `<text x="${PAD_LEFT - 6}" y="${y + 4}" font-size="8" text-anchor="end" fill="#6b7280">${escSvgText(label)}</text>`
      );
    })
    .join("\n  ");

  // ---- Y-axis line ----
  const axisLine = `<line x1="${PAD_LEFT}" y1="${PAD_TOP}" x2="${PAD_LEFT}" y2="${PAD_TOP + chartH}" stroke="#9ca3af" stroke-width="1"/>`;
  // ---- Baseline (X-axis) ----
  const baseLine = `<line x1="${PAD_LEFT}" y1="${PAD_TOP + chartH}" x2="${PAD_LEFT + chartW}" y2="${PAD_TOP + chartH}" stroke="#9ca3af" stroke-width="1"/>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="background:#ffffff">` +
    (titleEl ? `\n  ${titleEl}` : "") +
    `\n  ${axisLine}` +
    `\n  ${baseLine}` +
    `\n  ${yTicks}` +
    `\n  ${bars}` +
    `\n</svg>`
  );
}

// ---------------------------------------------------------------------------
// SVG safety helpers — escape values before interpolation into SVG attributes/text
// ---------------------------------------------------------------------------

/** Escape a string for safe use inside an SVG attribute value (double-quoted). */
function escSvgAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Escape a string for safe use inside SVG text content. */
function escSvgText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
