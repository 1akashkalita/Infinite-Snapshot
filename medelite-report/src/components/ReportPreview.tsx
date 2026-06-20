"use client";

// ReportPreview.tsx — Paper-like preview of the assembled report view-model.
//
// This component faithfully replicates the official "Facility Assessment Snapshot"
// template (Downloads/Facility Assessment Snapshot.docx): a centered INFINITE logo,
// the "FACILITY ASSESSMENT SNAPSHOT" title + state, then a bordered 2-column table
// (bold label left, value right). Only the right-column values are dynamic — the
// structure, labels, and order are fixed to the template. Mirrors ReportPDF.tsx 1:1.
//
// Design constraints:
//   CLAUDE.md rule #2 (updated): the header branding is the STATIC INFINITE /
//     Managed-by-MEDELITE logo image — never derived from or replaced by the facility
//     name. The facility name (displayName) appears ONLY in the body under "Name of
//     Facility". assembleHeader still takes no facility-name argument (state only).
//
//   Template fidelity (verified against the rendered example PDF, Kendall Lakes):
//     - The 12 hospitalization/ED rows are NOT highlighted in the FILLED report — the
//       yellow shading in the blank template was a "fill-from-the-API" marker only.
//     - Star ratings render as plain numbers (formatRating), matching the example.
//     - Name/Location are raw CMS pass-through (UPPERCASE, no ZIP) per DEC-ADDR-PASSTHROUGH.
//
//   D-10 / format.ts: number|null fields pass through formatRating/formatBeds/formatLocation.
//     Formatters use === null (not falsiness) so a real 0 renders "0". Never use || / ! here.
//
//   D-03: Body field order matches the template EXACTLY (labels verbatim):
//     1 Name of Facility · 2 Location · 3 EMR · 4 Census Capacity · 5 Current Census ·
//     6 Type of Patient · 7 Previous Coverage from Medelite ·
//     8 Previous Provider Performance from Medelite · 9 Medical Coverage ·
//     10 Overall Star Rating · 11 Health Inspection · 12 Staffing ·
//     13 Quality of Resident Care · then the 12 hospitalization/ED metric rows.
//
//   D-06: Shows an animate-pulse skeleton when fetchState is 'idle' or 'loading'.
//
//   No assembleViewModel call here — the parent passes the assembled vm (RPT-02).

import React from "react";
import {
  formatRating,
  formatBeds,
  formatLocation,
  formatDate,
  formatPercent,
  formatRate,
  formatFootnote,
} from "@/lib/report/format";
import {
  INFINITE_LOGO_DATA_URI,
  INFINITE_LOGO_WIDTH,
  INFINITE_LOGO_HEIGHT,
} from "@/lib/report/logo";
import type { ReportViewModel } from "@/lib/report/view-model";
import type { HospMetric } from "@/lib/cms/types";

/**
 * Renders a single HospMetric value applying D-10/D-11/D-12 rules:
 *   null → formatFootnote(m.footnoteCode) (suppressed / absent)
 *   unit === "percent" → formatPercent(m.value)
 *   unit === "rate" → formatRate(m.value)
 */
function renderMetricValue(m: HospMetric): string {
  if (m.value === null) return formatFootnote(m.footnoteCode);
  return m.unit === "percent" ? formatPercent(m.value) : formatRate(m.value);
}

interface Props {
  vm: ReportViewModel | null;
  fetchState: "idle" | "loading" | "success" | "error";
}

/** Shared cell classes — single black grid border, matching the template table. */
const LABEL_CELL =
  "border border-black px-3 py-2 align-middle font-bold text-zinc-900 w-2/5";
const VALUE_CELL =
  "border border-black px-3 py-2 align-middle italic text-zinc-900";

/** One template table row: bold label (left) + italic value (right). */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <th scope="row" className={`${LABEL_CELL} text-left`}>
        {label}
      </th>
      <td className={VALUE_CELL}>{value}</td>
    </tr>
  );
}

/**
 * Renders the assembled report as a paper-like preview matching the template.
 *
 * Shows a greyed skeleton when fetchState is 'idle' or 'loading'.
 * When vm is provided, renders the logo header + bordered 2-column table.
 * Null number fields render via the null-safe formatters (N/A per D-10).
 */
export function ReportPreview({ vm, fetchState }: Props) {
  // Skeleton — show for idle (no search yet) and loading (fetch in progress)
  if (fetchState === "idle" || fetchState === "loading") {
    return (
      <div className="bg-white rounded shadow p-8 animate-pulse space-y-4">
        <div className="h-12 bg-gray-200 rounded w-1/2 mx-auto" />
        <div className="h-5 bg-gray-200 rounded w-2/3 mx-auto" />
        <div className="h-px bg-gray-100 my-4" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 bg-gray-100 rounded w-full" />
        ))}
      </div>
    );
  }

  // Error state with no vm — show a minimal placeholder (ErrorBanner is rendered separately)
  if (!vm) {
    return (
      <div className="bg-white rounded shadow p-8 text-sm text-zinc-400 min-h-[200px] flex items-center justify-center">
        Enter a CCN above to generate the report preview.
      </div>
    );
  }

  const f = vm.facility;
  const m = vm.manual;

  // Success — render the full template
  return (
    <article className="bg-white rounded shadow p-8 text-sm text-zinc-800">
      {/* ------------------------------------------------------------------ */}
      {/* HEADER — INFINITE logo image (rule #2: static branding, never the   */}
      {/* facility name) + report title + dynamic state. Centered.           */}
      {/* alt text is vm.header.platformLine ("INFINITE — Managed by MEDELITE")*/}
      {/* ------------------------------------------------------------------ */}
      <header className="text-center space-y-1 mb-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- data-URI logo, no Next/Image optimization needed */}
        <img
          src={INFINITE_LOGO_DATA_URI}
          alt={vm.header.platformLine}
          width={INFINITE_LOGO_WIDTH}
          height={INFINITE_LOGO_HEIGHT}
          className="mx-auto"
        />
        <p className="text-base font-bold tracking-wide text-zinc-900 pt-1">
          {vm.header.reportTitle}
        </p>
        <p className="text-sm font-bold text-zinc-700">{vm.header.stateLine}</p>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* BODY — bordered 2-column table (template-exact order + labels)      */}
      {/* ------------------------------------------------------------------ */}
      <table className="w-full border-collapse border border-black">
        <tbody>
          <Row label="Name of Facility" value={f.displayName} />
          <Row label="Location" value={formatLocation(f.address)} />
          <Row label="EMR" value={m.emr ?? "—"} />
          <Row label="Census Capacity" value={formatBeds(f.certifiedBeds)} />
          <Row
            label="Current Census"
            value={m.currentCensus != null ? String(m.currentCensus) : "—"}
          />
          <Row label="Type of Patient" value={m.typeOfPatient ?? "—"} />
          <Row
            label="Previous Coverage from Medelite"
            value={m.previousCoverage ?? "—"}
          />
          <Row
            label="Previous Provider Performance from Medelite"
            value={m.previousProviderPerformance ?? "—"}
          />
          <Row label="Medical Coverage" value={m.medicalCoverage ?? "—"} />
          <Row
            label="Overall Star Rating"
            value={formatRating(f.starRatings.overall)}
          />
          <Row
            label="Health Inspection"
            value={formatRating(f.starRatings.healthInspection)}
          />
          <Row label="Staffing" value={formatRating(f.starRatings.staffing)} />
          <Row
            label="Quality of Resident Care"
            value={formatRating(f.starRatings.qualityCare)}
          />

          {/* Hospitalization & ED metrics — Phase 5 (CLM-01/02/03). 12 rows in
              template order, verbatim labels (D-04). D-09 degraded: hospMetrics
              undefined → single full-width row. D-10: null value → formatFootnote. */}
          {vm.hospMetrics === undefined ? (
            <tr>
              <td
                colSpan={2}
                className="border border-black px-3 py-2 text-zinc-500 italic"
              >
                Hospitalization &amp; ED metrics are temporarily unavailable.
              </td>
            </tr>
          ) : (
            vm.hospMetrics.map((metric) => (
              <Row
                key={metric.label}
                label={metric.label}
                value={renderMetricValue(metric)}
              />
            ))
          )}
        </tbody>
      </table>

      {/* ------------------------------------------------------------------ */}
      {/* FOOTER — required clickable Medicare Care Compare link (rule #7) +            */}
      {/* CMS dataset processing date. Sits below the table; not part of the template. */}
      {/* ------------------------------------------------------------------ */}
      <footer className="pt-3 mt-3 text-xs text-zinc-500 flex justify-between">
        <a
          href={f.careCompareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-700 underline"
        >
          View official CMS profile on Medicare.gov
        </a>
        <span>CMS dataset processing date: {formatDate(f.processingDate)}</span>
      </footer>
    </article>
  );
}
