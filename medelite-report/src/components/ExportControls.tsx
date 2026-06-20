"use client";

// ExportControls.tsx — Unified export control component (D-01..D-05 / D-07 / D-08).
//
// D-01: Single Download button + a PDF | DOCX segmented toggle above it.
//   One format is always visibly selected; switching format is allowed only when idle.
//
// D-02: Replaces DownloadPdfButton. This single "use client" component owns the
//   selected-format state plus the shared loading/error logic. SnapshotApp swaps
//   <DownloadPdfButton vm={vm} /> for <ExportControls vm={vm} />.
//
// D-03: PDF is the pre-selected (default) format. The toggle starts on PDF.
//
// D-04: The Download button label tracks the selected format — reads "Download PDF" /
//   "Download DOCX", and shows "Generating…" while a request is in flight.
//
// D-05: Preserves Phase-4 download mechanics for BOTH formats.
//   Client fetch POST → Blob → silent anchor download (URL.createObjectURL +
//   programmatic <a download> click + deferred revokeObjectURL). Button disabled until
//   vm is non-null (D-07). On any export failure, a single inline role="alert" message
//   below the control; button stays enabled to retry (D-08). Never routed through ErrorBanner.
//
// Security (T-06-08 / PITFALLS #4):
//   This file MUST NOT import docx, Packer, buildReportDocx, @react-pdf/renderer,
//   or @/components/pdf/ReportPDF. Those are server-only modules; importing them here
//   causes `next build` to fail (bundler error). The only export-related import is
//   `ReportViewModel` as a *type* (import type).

import { useState } from "react";
import type { ReportViewModel } from "@/lib/report/view-model";

type Format = "pdf" | "docx";

interface Props {
  /** The assembled view-model to export. Null when no successful fetch exists. */
  vm: ReportViewModel | null;
}

/**
 * Unified export control component.
 *
 * Renders a PDF | DOCX segmented toggle (PDF default, D-03) above a Download button
 * whose label tracks the selected format (D-04). On click, POSTs the assembled
 * ReportViewModel to /api/export/pdf or /api/export/docx (D-05) and triggers a
 * silent anchor download of the response blob. Handles D-07 loading states and
 * D-08 inline retry error.
 *
 * NEVER imports docx, Packer, buildReportDocx, @react-pdf/renderer, or ReportPDF
 * (T-06-08 / PITFALLS #4).
 */
export function ExportControls({ vm }: Props) {
  const [loading, setLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [format, setFormat] = useState<Format>("pdf"); // D-03: PDF default

  async function handleDownload(): Promise<void> {
    // D-07: guard — nothing to export without a vm
    if (!vm) return;
    setLoading(true);
    setExportError(null);
    try {
      const resp = await fetch(`/api/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vm),
      });
      if (!resp.ok) {
        throw new Error(`${format.toUpperCase()} generation failed`);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Fallback download hint — the server Content-Disposition controls the real filename (D-06)
      a.download = format === "pdf" ? "report.pdf" : "report.docx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // WR-02: revoke on a later task, not this synchronous frame. Some WebKit/mobile
      // engines abort an in-flight blob download if its object URL is revoked before the
      // click has committed. Deferring keeps the URL alive long enough to start the save.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      // D-08: surface a fixed UI-authored string; never the raw server response or Zod internals.
      // Keep button enabled for retry (loading will be cleared in finally).
      setExportError(
        `Couldn't generate ${format.toUpperCase()} — try again.`,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {/* D-01: PDF | DOCX segmented toggle — keyboard-operable, aria-pressed indicates selection */}
      <div
        role="group"
        aria-label="Export format"
        className="flex rounded-md border border-zinc-300 overflow-hidden"
      >
        {(["pdf", "docx"] as Format[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFormat(f)}
            aria-pressed={format === f}
            disabled={loading}
            className={[
              "px-3 py-1 text-sm font-medium transition-colors",
              format === f
                ? "bg-blue-600 text-white"
                : "bg-white text-zinc-700 hover:bg-zinc-50",
              loading ? "cursor-not-allowed opacity-50" : "",
            ].join(" ")}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* D-04: Download button — label tracks selected format; D-07: disabled until vm exists */}
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading || !vm}
        className={[
          "rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors",
          loading || !vm
            ? "cursor-not-allowed bg-blue-300"
            : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800",
        ].join(" ")}
      >
        {loading ? "Generating…" : `Download ${format.toUpperCase()}`}
      </button>

      {/* D-08: inline error below the control — NOT ErrorBanner */}
      {exportError && (
        <p role="alert" className="text-sm text-red-600 mt-1">
          {exportError}
        </p>
      )}
    </div>
  );
}
