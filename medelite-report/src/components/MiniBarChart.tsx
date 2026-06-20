"use client";

// MiniBarChart.tsx — Web (browser) grouped bar chart for one hospitalization/ED measure group.
//
// Renders a recharts v2 BarChart with facility/national/state bars in blue/green/amber (D-08).
// MUST include a <Legend> so readers know which color represents which series — the green bar
// is series identity (National average), NOT a performance indicator (D-08 warning).
//
// D-09 suppression: an all-suppressed group (all values null) renders a small "N/A" indication,
// NOT an empty chart frame. A partially-suppressed group renders only the available bars.
//
// Props: { group: MeasureGroup } — the caller provides a single MeasureGroup from groupByMeasure().
//
// "use client" — recharts v2 requires a browser DOM for animation and SVG rendering.
// MiniBarChart must only be imported by client components (e.g. ReportPreview.tsx).

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { buildChartData } from "@/lib/charts/chart-svg";
import type { MeasureGroup } from "@/lib/report/chart-utils";

interface Props {
  group: MeasureGroup;
}

/**
 * Web grouped-bar chart for one hospitalization/ED measure group.
 *
 * D-07: 3 bars per chart — Facility (blue) / National (green) / State (amber).
 * D-08: MUST carry a legend to disambiguate series identity from performance bands.
 * D-09: all-suppressed → "N/A" span; partial → only present bars rendered.
 */
export function MiniBarChart({ group }: Props) {
  const data = buildChartData(group);

  // D-09: all bars suppressed → small N/A indicator (no empty chart frame)
  if (data.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold text-zinc-600 truncate">
          {group.label}
        </h3>
        <span className="text-xs text-zinc-400">N/A</span>
      </div>
    );
  }

  const formatter = (v: number) =>
    group.unit === "percent" ? `${v.toFixed(1)}%` : v.toFixed(2);

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold text-zinc-600 truncate">
        {group.label}
      </h3>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
          <YAxis tick={{ fontSize: 9 }} width={36} />
          <Tooltip formatter={formatter} />
          {/* D-08: Legend REQUIRED — green "National" is a series identity, NOT "good" performance */}
          <Legend wrapperStyle={{ fontSize: 9 }} />
          <Bar dataKey="value" name="Value">
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
