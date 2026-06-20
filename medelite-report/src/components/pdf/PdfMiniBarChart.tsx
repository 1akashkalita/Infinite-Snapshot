// PdfMiniBarChart.tsx — PDF grouped bar chart for one hospitalization/ED measure group.
//
// Renders a native react-pdf bar chart using @react-pdf/renderer's SVG primitives (Svg, Rect,
// Line, G) for bars and axis lines, and react-pdf <View>/<Text> for all text labels (title,
// Y-axis tick labels, X-axis category labels). Text is deliberately kept OUTSIDE the <Svg>
// element to avoid react-pdf's SVG font encoding, which uses glyph IDs in a separate CID font
// map rather than the standard ASCII TJ operator path used by react-pdf's regular Text elements.
// Mixing SVG-encoded and standard-encoded text in a single PDF page causes font table collisions
// that can prevent text extraction from the page content stream (the standard content stream
// falls back to a non-ASCII glyph-ID encoding that defeats the extractTextFromPdf helper in
// the existing CLM-03 test assertions).
//
// Layout (outside-Svg text, inside-Svg geometry):
//   [bold Title text]
//   [Y-axis labels column (right-aligned)] | [Svg: bars + axis lines + tick marks]
//   [spacer row of Y_LABEL_W] | [X-axis category labels: flexbox row, each label centered]
//
// X-axis labels use a flexbox row of equal-width Views (no absolute positioning — react-pdf
// Yoga does not support absolute positioning the same way as CSS, and mixing it with normal
// flow causes labels to appear out of document order).
//
// D-09 suppression: empty data → <Text>N/A</Text> (no empty chart frame).
//
// NO "use client" — server-only. Never import from a client component.

import React from "react";
import { G, Svg, Rect, Line } from "@react-pdf/renderer";
import { View, Text } from "@react-pdf/renderer";
import { buildChartData } from "@/lib/charts/chart-data";
import type { MeasureGroup } from "@/lib/report/chart-utils";

interface Props {
  group: MeasureGroup;
}

/**
 * PDF grouped-bar chart for one hospitalization/ED measure group.
 *
 * D-07: up to 3 bars — Facility (blue) / National (green) / State (amber).
 * Series identity conveyed by X-axis category labels (Facility/National/State) and chart title.
 * No separate legend key — matches the canonical web-preview design target.
 * D-09: all-suppressed → N/A Text; partial → only present bars rendered.
 * VIZ-02: native react-pdf SVG primitives for bars; standard Text outside SVG for labels.
 * CLM-03: NO Text inside Svg (avoids SVG CID font encoding collision).
 */
export function PdfMiniBarChart({ group }: Props) {
  const data = buildChartData(group);

  // D-09: all bars suppressed → N/A text (no empty chart frame)
  if (data.length === 0) {
    return (
      <View style={{ paddingVertical: 4 }}>
        <Text
          style={{
            fontSize: 7,
            fontFamily: "Helvetica-Bold",
            color: "#374151",
            marginBottom: 2,
          }}
        >
          {group.label}
        </Text>
        <Text
          style={{
            fontSize: 8,
            color: "#9ca3af",
            fontFamily: "Helvetica-Oblique",
          }}
        >
          N/A
        </Text>
      </View>
    );
  }

  // ---- Layout constants ----
  // SVG holds only bar geometry + axis lines (no Text inside Svg — CLM-03).
  // Y_LABEL_W: width of the Y-axis tick label column (react-pdf Text, outside Svg).
  const Y_LABEL_W = 22;
  const SVG_W = 210;
  const SVG_H = 75;
  const PAD_LEFT = 4; // small left pad inside SVG (y-axis line is at x=PAD_LEFT)
  const PAD_RIGHT = 4;
  const PAD_TOP = 4;
  const PAD_BOTTOM = 4;
  const CHART_W = SVG_W - PAD_LEFT - PAD_RIGHT;
  const CHART_H = SVG_H - PAD_TOP - PAD_BOTTOM;
  const n = data.length;
  const BAR_W = Math.floor((CHART_W / n) * 0.6);
  const BAR_GAP = Math.floor((CHART_W / n) * 0.4);

  // Y-axis scale
  const maxVal = Math.max(...data.map((d) => d.value));
  const yMax = maxVal <= 0 ? 1 : Math.ceil(maxVal * 1.1);

  // Y coordinate (SVG y grows downward)
  const toY = (v: number) =>
    PAD_TOP + CHART_H - Math.round((v / yMax) * CHART_H);

  // Y-axis tick values: 0, midpoint, max
  const yTickValues = [0, yMax / 2, yMax];

  // Slot width per bar category (equal division of chart width)
  const slotW = CHART_W / n;

  return (
    <View style={{ marginBottom: 4 }}>
      {/* Bold chart title — outside Svg (CLM-03 / standard TJ encoding) */}
      <Text
        style={{
          fontSize: 7,
          fontFamily: "Helvetica-Bold",
          color: "#374151",
          marginBottom: 2,
        }}
      >
        {group.label}
      </Text>

      {/* Row: [Y-axis tick labels column] + [SVG chart area] */}
      <View style={{ flexDirection: "row" }}>
        {/* Y-axis tick labels — right-aligned column of Text nodes, outside Svg.
            Rendered top-to-bottom: yMax at top, 0 at bottom, to match SVG y-axis direction. */}
        <View
          style={{
            width: Y_LABEL_W,
            height: SVG_H,
            flexDirection: "column",
            justifyContent: "space-between",
            paddingTop: PAD_TOP,
            paddingBottom: PAD_BOTTOM,
          }}
        >
          {[...yTickValues].reverse().map((v) => {
            const label = v % 1 === 0 ? String(Math.round(v)) : v.toFixed(1);
            return (
              <Text
                key={v}
                style={{
                  fontSize: 6,
                  color: "#6b7280",
                  fontFamily: "Helvetica",
                  textAlign: "right",
                  width: Y_LABEL_W - 2,
                }}
              >
                {label}
              </Text>
            );
          })}
        </View>

        {/* Pure SVG geometry: bars + axis lines + tick marks only (NO Text inside Svg) */}
        <Svg
          width={SVG_W}
          height={SVG_H}
          style={{ backgroundColor: "#ffffff" }}
        >
          {/* Y-axis line */}
          <Line
            x1={PAD_LEFT}
            y1={PAD_TOP}
            x2={PAD_LEFT}
            y2={PAD_TOP + CHART_H}
            stroke="#9ca3af"
            strokeWidth={1}
          />
          {/* Baseline (X-axis) */}
          <Line
            x1={PAD_LEFT}
            y1={PAD_TOP + CHART_H}
            x2={PAD_LEFT + CHART_W}
            y2={PAD_TOP + CHART_H}
            stroke="#9ca3af"
            strokeWidth={1}
          />

          {/* Bars */}
          {data.map((d, i) => {
            const x =
              PAD_LEFT +
              Math.round((i * CHART_W) / n) +
              Math.round(BAR_GAP / 2);
            const y = toY(d.value);
            const barH = Math.max(1, PAD_TOP + CHART_H - y);
            return (
              <Rect
                key={i}
                x={x}
                y={y}
                width={BAR_W}
                height={barH}
                fill={d.color}
              />
            );
          })}

          {/* Y-axis tick marks (geometry only — no text inside Svg) */}
          {yTickValues.map((v) => {
            const y = toY(v);
            return (
              <G key={v}>
                <Line
                  x1={PAD_LEFT - 3}
                  y1={y}
                  x2={PAD_LEFT}
                  y2={y}
                  stroke="#9ca3af"
                  strokeWidth={1}
                />
              </G>
            );
          })}
        </Svg>
      </View>

      {/* X-axis category labels — flexbox row outside Svg, aligned under each bar.
          The row is indented by Y_LABEL_W + PAD_LEFT so labels sit under their bars.
          Each label is in a View of width=slotW, text-align center. */}
      <View
        style={{
          flexDirection: "row",
          marginLeft: Y_LABEL_W + PAD_LEFT,
          width: SVG_W - PAD_LEFT - PAD_RIGHT,
          marginTop: 1,
        }}
      >
        {data.map((d, i) => (
          <View
            key={i}
            style={{
              width: slotW,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 6,
                color: "#374151",
                fontFamily: "Helvetica",
                textAlign: "center",
              }}
            >
              {d.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
