// PdfMiniBarChart.tsx — PDF grouped bar chart for one hospitalization/ED measure group.
//
// Wraps recharts v2 <BarChart> inside <ReactPDFChart> (react-pdf-charts adapter) so that
// react-pdf-charts can call renderToStaticMarkup on the recharts tree, convert the resulting
// SVG to react-pdf <Svg>/<Path>/<Rect> primitives, and render charts inside @react-pdf/renderer.
//
// CRITICAL: isAnimationActive={false} is MANDATORY on every <Bar>. Without it, recharts
// animation code runs during renderToStaticMarkup and may produce empty or partial SVG output
// (RESEARCH.md Pitfall 1 / react-pdf-charts Known Issues). This is guarded by PdfMiniBarChart.test.ts.
//
// D-08: <Legend> is REQUIRED in the PDF chart (same as the web chart) so readers know that
//   green = National series identity, NOT "good" performance. react-pdf-charts passes the
//   recharts <Legend> through renderToStaticMarkup into react-pdf SVG primitives.
//
// D-09 suppression: empty data → returns <Text>N/A</Text> (no empty chart frame).
//
// NO "use client" — this file is server-only (react-pdf-charts runs server-side via
//   renderToStaticMarkup; @react-pdf/renderer must not reach the client bundle).
//   Never import this file from a client component.

import React from "react";
import ReactPDFChart from "react-pdf-charts";
import { BarChart, Bar, XAxis, YAxis, Cell, Legend } from "recharts";
import { View, Text } from "@react-pdf/renderer";
import { buildChartData } from "@/lib/charts/chart-svg";
import type { MeasureGroup } from "@/lib/report/chart-utils";

interface Props {
  group: MeasureGroup;
}

/**
 * PDF grouped-bar chart for one hospitalization/ED measure group.
 *
 * D-07: 3 bars per chart — Facility (blue) / National (green) / State (amber).
 * D-08: <Legend> REQUIRED — PDF chart carries the same facility/national/state legend
 *   as the web chart; react-pdf-charts renders the recharts <Legend> into react-pdf SVG.
 * D-09: all-suppressed → returns N/A Text; partial → only present bars rendered.
 * VIZ-02: react-pdf-charts wrapper ensures charts render as SVG primitives in the PDF,
 *   never as blank rectangles (the blank-chart failure mode when using recharts directly).
 *
 * Structural test: see PdfMiniBarChart.test.ts — asserts ReactPDFChart wrapper,
 *   isAnimationActive=false on every Bar, and Legend present in the element tree.
 */
export function PdfMiniBarChart({ group }: Props) {
  const data = buildChartData(group);

  // D-09: all bars suppressed → N/A text (no empty chart frame)
  if (data.length === 0) {
    return (
      <View style={{ paddingVertical: 4 }}>
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

  return (
    <View style={{ marginBottom: 6 }}>
      {/* D-08: Legend REQUIRED in PDF chart — green = National series identity (NOT "good") */}
      {/* react-pdf-charts passes recharts <Legend> through renderToStaticMarkup to react-pdf SVG */}
      <ReactPDFChart>
        <BarChart width={300} height={140} data={data}>
          <XAxis dataKey="name" tick={{ fontSize: 7 }} />
          <YAxis tick={{ fontSize: 7 }} width={28} />
          {/* D-08: Legend must be present (Blocker 1) */}
          <Legend wrapperStyle={{ fontSize: 7 }} />
          {/* isAnimationActive={false} is MANDATORY (Pitfall 1 / VIZ-02 blank-chart guard) */}
          <Bar dataKey="value" isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ReactPDFChart>
    </View>
  );
}
