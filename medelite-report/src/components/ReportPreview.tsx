"use client";

// ReportPreview.tsx — Paper-like preview of the assembled report view-model.
//
// Design constraints:
//   CLAUDE.md rule #2: The header block is STATIC — vm.header.platformLine/reportTitle/stateLine.
//     The facility name (displayName) ONLY appears in the body under "Name of Facility".
//     Never put displayName in the header section.
//
//   D-10 / format.ts: All number|null fields pass through formatRating/formatBeds/formatLocation.
//     The formatters use === null (not falsiness), so a real 0 renders "0" (valid data).
//     Do NOT use || or ! to fall back to "N/A" — use the provided formatter functions.
//
//   D-03: Body field order matches the reference report EXACTLY — labels are verbatim from the
//     reference PDF/DOCX; CMS and manual fields are INTERLEAVED (NOT grouped by source):
//     1.  Name of Facility (displayName — body only, never in header)
//     2.  Location (formatLocation — raw CMS pass-through, no ZIP; see README "Data & presentation
//         decisions" for the address-normalisation decision)
//     3.  EMR (manual input — em-dash until Wave 4)
//     4.  Census Capacity (CMS certifiedBeds; null → "N/A", D-10)
//     5.  Current Census (manual input)
//     6.  Type of Patient (manual input)
//     7.  Previous Coverage from Medelite (manual — Yes/No)
//     8.  Previous Provider Performance from Medelite (manual — INPT-01; label includes
//         "from Medelite" suffix, verbatim from reference)
//     9.  Medical Coverage (manual free-text; its own field, NOT part of Medelite History)
//     10. Overall Star Rating (CMS overall_rating)
//     11. Health Inspection (CMS health_inspection_rating; label is "Health Inspection", NOT
//         "Health Inspection Rating" — verbatim from reference)
//     12. Staffing (CMS staffing_rating; label is "Staffing", NOT "Staffing Rating" — verbatim)
//     13. Quality of Resident Care (CMS qm_rating, NOT longstay/shortstay qm)
//
//   D-06: Shows an animate-pulse skeleton when fetchState is 'idle' or 'loading'.
//     The skeleton reuses the structure from SnapshotApp's Wave-2 placeholder.
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

/**
 * Renders the assembled report as a paper-like preview panel.
 *
 * Shows a greyed skeleton when fetchState is 'idle' or 'loading'.
 * When vm is provided, renders the full static header + report body.
 * Null number fields render via the null-safe formatters (N/A per D-10).
 */
export function ReportPreview({ vm, fetchState }: Props) {
  // Skeleton — show for idle (no search yet) and loading (fetch in progress)
  if (fetchState === "idle" || fetchState === "loading") {
    return (
      <div className="bg-white rounded shadow p-8 animate-pulse space-y-4">
        {/* Header block skeleton */}
        <div className="h-6 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="h-px bg-gray-100 my-4" />
        {/* Facility info skeleton */}
        <div className="h-4 bg-gray-200 rounded w-2/3" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="h-px bg-gray-100 my-4" />
        {/* Star ratings skeleton */}
        <div className="h-4 bg-gray-200 rounded w-3/5" />
        <div className="h-4 bg-gray-200 rounded w-2/5" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="h-4 bg-gray-200 rounded w-2/5" />
        <div className="h-px bg-gray-100 my-4" />
        {/* Manual fields skeleton */}
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-2/3" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
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

  // Success — render the full report
  return (
    <article className="bg-white rounded shadow p-8 space-y-6 text-sm text-zinc-800">
      {/* ------------------------------------------------------------------ */}
      {/* STATIC HEADER BLOCK — rule #2: never the facility name here         */}
      {/* vm.header.platformLine = "INFINITE — Managed by MEDELITE"           */}
      {/* vm.header.reportTitle  = "FACILITY ASSESSMENT SNAPSHOT"             */}
      {/* vm.header.stateLine    = e.g. "FL"                                  */}
      {/* ------------------------------------------------------------------ */}
      <header className="border-b pb-4 text-center space-y-1">
        <p className="text-base font-bold tracking-widest uppercase text-zinc-900">
          {vm.header.platformLine}
        </p>
        <p className="text-xs font-semibold tracking-widest uppercase text-zinc-600">
          {vm.header.reportTitle}
        </p>
        <p className="text-xs tracking-widest font-medium text-zinc-500">
          {vm.header.stateLine}
        </p>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* REPORT BODY — D-03 field order per CLAUDE.md                       */}
      {/* ------------------------------------------------------------------ */}
      <dl className="grid grid-cols-[1fr_1.5fr] gap-x-4 gap-y-2">
        {/* 1. Name of Facility — displayName (body only, never in header) */}
        <dt className="font-semibold text-zinc-700">Name of Facility</dt>
        <dd className="text-zinc-900">{vm.facility.displayName}</dd>

        {/* 2. Location — composed street, city, state; NO ZIP. Raw CMS string,
            intentionally NOT normalized to the reference's title-case/ordinal
            presentation (see README "Data & presentation decisions"). */}
        <dt className="font-semibold text-zinc-700">Location</dt>
        <dd className="text-zinc-900">{formatLocation(vm.facility.address)}</dd>

        {/* 3. EMR — manual input (em-dash until Wave 4 binds it) */}
        <dt className="font-semibold text-zinc-700">EMR</dt>
        <dd className="text-zinc-900">{vm.manual.emr ?? "—"}</dd>

        {/* 4. Census Capacity — CMS certifiedBeds, null → "N/A" (D-10) */}
        <dt className="font-semibold text-zinc-700">Census Capacity</dt>
        <dd className="text-zinc-900">
          {formatBeds(vm.facility.certifiedBeds)}
        </dd>

        {/* 5. Current Census — manual input */}
        <dt className="font-semibold text-zinc-700">Current Census</dt>
        <dd className="text-zinc-900">
          {vm.manual.currentCensus != null
            ? String(vm.manual.currentCensus)
            : "—"}
        </dd>

        {/* 6. Type of Patient — manual input */}
        <dt className="font-semibold text-zinc-700">Type of Patient</dt>
        <dd className="text-zinc-900">{vm.manual.typeOfPatient ?? "—"}</dd>

        {/* 7. Previous Coverage from Medelite — Yes/No (manual) */}
        <dt className="font-semibold text-zinc-700">
          Previous Coverage from Medelite
        </dt>
        <dd className="text-zinc-900">{vm.manual.previousCoverage ?? "—"}</dd>

        {/* 8. Previous Provider Performance from Medelite — manual input (INPT-01) */}
        <dt className="font-semibold text-zinc-700">
          Previous Provider Performance from Medelite
        </dt>
        <dd className="text-zinc-900">
          {vm.manual.previousProviderPerformance ?? "—"}
        </dd>

        {/* 9. Medical Coverage — its own free-text field (not part of Medelite History) */}
        <dt className="font-semibold text-zinc-700">Medical Coverage</dt>
        <dd className="text-zinc-900">{vm.manual.medicalCoverage ?? "—"}</dd>

        {/* 10. Overall Star Rating — CMS overall_rating */}
        <dt className="font-semibold text-zinc-700">Overall Star Rating</dt>
        <dd className="text-zinc-900">
          {formatRating(vm.facility.starRatings.overall)}
        </dd>

        {/* 11. Health Inspection — CMS health_inspection_rating */}
        <dt className="font-semibold text-zinc-700">Health Inspection</dt>
        <dd className="text-zinc-900">
          {formatRating(vm.facility.starRatings.healthInspection)}
        </dd>

        {/* 12. Staffing — CMS staffing_rating */}
        <dt className="font-semibold text-zinc-700">Staffing</dt>
        <dd className="text-zinc-900">
          {formatRating(vm.facility.starRatings.staffing)}
        </dd>

        {/* 13. Quality of Resident Care — CMS qm_rating (NOT longstay/shortstay qm) */}
        <dt className="font-semibold text-zinc-700">
          Quality of Resident Care
        </dt>
        <dd className="text-zinc-900">
          {formatRating(vm.facility.starRatings.qualityCare)}
        </dd>

        {/* ---------------------------------------------------------------- */}
        {/* Hospitalization & ED metrics — Phase 5 (CLM-01/02/03)            */}
        {/* 12 rows (4 measures × facility/national/state) appended after     */}
        {/* row 13 per D-03/D-05. Labels verbatim from reference (D-04).      */}
        {/* D-09 degraded: hospMetrics === undefined → single concise line.   */}
        {/* D-10 per-row: null value → formatFootnote; averages still render. */}
        {/* React.Fragment key={m.label}: Pitfall 6 — keyed Fragment required */}
        {/* so each dt/dd pair has a stable identity in the list.             */}
        {/* ---------------------------------------------------------------- */}
        {vm.hospMetrics === undefined ? (
          <dt className="col-span-2 text-zinc-500 italic">
            Hospitalization &amp; ED metrics are temporarily unavailable.
          </dt>
        ) : (
          vm.hospMetrics.map((m) => (
            <React.Fragment key={m.label}>
              <dt className="font-semibold text-zinc-700">{m.label}</dt>
              <dd className="text-zinc-900">{renderMetricValue(m)}</dd>
            </React.Fragment>
          ))
        )}
      </dl>

      {/* CMS data freshness note — formatDate applies UTC timezone to avoid midnight off-by-one (D-13) */}
      <footer className="border-t pt-3 text-xs text-zinc-400 text-right">
        CMS processing date: {formatDate(vm.facility.processingDate)}
      </footer>
    </article>
  );
}
