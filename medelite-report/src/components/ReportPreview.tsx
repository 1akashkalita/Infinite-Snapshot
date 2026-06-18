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
//   D-03: Body field order follows the CLAUDE.md field mapping table:
//     1. Name of Facility (displayName)
//     2. Location (formatLocation)
//     3. Census Capacity (formatBeds)
//     4. Overall Star Rating (formatRating)
//     5. Health Inspection Rating (formatRating)
//     6. Staffing Rating (formatRating)
//     7. Quality of Resident Care (formatRating)
//     8–13. Manual fields: EMR, Current Census, Type of Patient, Medical Coverage,
//            Previous Provider Performance, Previous Coverage from Medelite
//
//   D-06: Shows an animate-pulse skeleton when fetchState is 'idle' or 'loading'.
//     The skeleton reuses the structure from SnapshotApp's Wave-2 placeholder.
//
//   No assembleViewModel call here — the parent passes the assembled vm (RPT-02).

import { formatRating, formatBeds, formatLocation } from "@/lib/report/format";
import type { ReportViewModel } from "@/lib/report/view-model";

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

        {/* 2. Location — composed from address components, no ZIP (DATA-03) */}
        <dt className="font-semibold text-zinc-700">Location</dt>
        <dd className="text-zinc-900">{formatLocation(vm.facility.address)}</dd>

        {/* 3. Census Capacity — certifiedBeds, null → "N/A" (D-10) */}
        <dt className="font-semibold text-zinc-700">Census Capacity</dt>
        <dd className="text-zinc-900">
          {formatBeds(vm.facility.certifiedBeds)}
        </dd>

        {/* Separator */}
        <dt className="col-span-2 border-t my-1" aria-hidden="true" />

        {/* 4. Overall Star Rating */}
        <dt className="font-semibold text-zinc-700">Overall Star Rating</dt>
        <dd className="text-zinc-900">
          {formatRating(vm.facility.starRatings.overall)}
        </dd>

        {/* 5. Health Inspection Rating */}
        <dt className="font-semibold text-zinc-700">
          Health Inspection Rating
        </dt>
        <dd className="text-zinc-900">
          {formatRating(vm.facility.starRatings.healthInspection)}
        </dd>

        {/* 6. Staffing Rating */}
        <dt className="font-semibold text-zinc-700">Staffing Rating</dt>
        <dd className="text-zinc-900">
          {formatRating(vm.facility.starRatings.staffing)}
        </dd>

        {/* 7. Quality of Resident Care — qm_rating (D-16, NOT longstay_qm_rating) */}
        <dt className="font-semibold text-zinc-700">
          Quality of Resident Care
        </dt>
        <dd className="text-zinc-900">
          {formatRating(vm.facility.starRatings.qualityCare)}
        </dd>

        {/* Separator */}
        <dt className="col-span-2 border-t my-1" aria-hidden="true" />

        {/* 8. EMR — manual input (Wave 4 wires the input; em-dash fallback for now) */}
        <dt className="font-semibold text-zinc-700">EMR</dt>
        <dd className="text-zinc-900">{vm.manual.emr ?? "—"}</dd>

        {/* 9. Current Census — manual input */}
        <dt className="font-semibold text-zinc-700">Current Census</dt>
        <dd className="text-zinc-900">
          {vm.manual.currentCensus != null
            ? String(vm.manual.currentCensus)
            : "—"}
        </dd>

        {/* 10. Type of Patient — manual input */}
        <dt className="font-semibold text-zinc-700">Type of Patient</dt>
        <dd className="text-zinc-900">{vm.manual.typeOfPatient ?? "—"}</dd>

        {/* 11. Medical Coverage — its own free-text field (not part of Medelite History) */}
        <dt className="font-semibold text-zinc-700">Medical Coverage</dt>
        <dd className="text-zinc-900">{vm.manual.medicalCoverage ?? "—"}</dd>

        {/* 12. Previous Provider Performance — manual input (INPT-01) */}
        <dt className="font-semibold text-zinc-700">
          Previous Provider Performance
        </dt>
        <dd className="text-zinc-900">
          {vm.manual.previousProviderPerformance ?? "—"}
        </dd>

        {/* 13. Previous Coverage from Medelite — Yes/No (manual) */}
        <dt className="font-semibold text-zinc-700">
          Previous Coverage from Medelite
        </dt>
        <dd className="text-zinc-900">{vm.manual.previousCoverage ?? "—"}</dd>
      </dl>

      {/* CMS data freshness note */}
      <footer className="border-t pt-3 text-xs text-zinc-400 text-right">
        CMS processing date: {vm.facility.processingDate}
      </footer>
    </article>
  );
}
