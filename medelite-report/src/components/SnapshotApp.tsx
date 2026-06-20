"use client";

// SnapshotApp.tsx — State owner: CCN submit → fetch → state cascade → render.
//
// Wave 3 (this plan) wires the fetch seam and error routing onto the Wave-2 skeleton shell.
// Wave 4 will bind the ManualInputsForm that populates manualInputs.
// Phase 7 (Plan 03) adds useDebounce: manualInputs → debouncedManualInputs (300ms) → vm.
//   The debounce applies ONLY to the manualInputs→vm path (D-14).
//   ManualInputsForm stays bound to raw manualInputs/setManualInputs for immediate UI feedback.
//   handleSearch (the CMS fetch) is untouched — manual edits NEVER trigger a CMS re-fetch.
//
// Security:
//   T-03-09: NEVER import @/lib/cms/client or @react-pdf/renderer here — server-only modules.
//     These are caught by `next build` (bundler error) if added. Import only:
//       @/lib/cms/{errors,types}, @/lib/report/view-model, @/lib/ui/error-presentation,
//       and local component files.
//
// Error routing (D-07):
//   inline:  invalid_ccn, not_found  → passed to CCNSearchBar as inlineError prop
//   banner:  network_error, cms_api_error, validation_error → rendered by ErrorBanner above form
//
// State cascade per search:
//   1. setFetchState('loading'), setErrorState(null)  ← clear stale state (Pitfall 3)
//   2. fetch /api/facility?ccn=<normalized>
//   3a. Success: setFacilityData(json.data), setHospMetrics(json.hospMetrics), setManualInputs({}), setFetchState('success')
//   3b. API error: setErrorState(json.error), setFacilityData(null), setHospMetrics(undefined), setFetchState('error')
//   3c. Network failure (catch): synthetic network_error, setFacilityData(null), setHospMetrics(undefined), setFetchState('error')
//
// D-11: manualInputs reset to {} ONLY on a successful fetch — preserves user work on error.
// D-12: assembleViewModel(facilityData, debouncedManualInputs, new Date(), hospMetrics) — new Date() injected here.
// D-14: debouncedManualInputs trails manualInputs by 300ms — preview updates ~300ms after last keystroke.
// Phase 5: hospMetrics captured from json.hospMetrics on success; cleared to undefined on every error/network branch.

import { useState, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import type { FacilityData, HospMetric } from "@/lib/cms/types";
import type { CmsApiError } from "@/lib/cms/errors";
import { CmsApiErrorSchema } from "@/lib/cms/errors";
import type { ManualInputs } from "@/lib/report/view-model";
import { assembleViewModel } from "@/lib/report/view-model";
import { getErrorPresentation } from "@/lib/ui/error-presentation";
import { CCNSearchBar } from "@/components/CCNSearchBar";
import { ExportControls } from "@/components/ExportControls";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ManualInputsForm } from "@/components/ManualInputsForm";
import { ReportPreview } from "@/components/ReportPreview";
import {
  INFINITE_LOGO_DATA_URI,
  INFINITE_LOGO_WIDTH,
  INFINITE_LOGO_HEIGHT,
} from "@/lib/report/logo";

// FetchState drives both the skeleton and the button disabled state
type FetchState = "idle" | "loading" | "success" | "error";

/**
 * SnapshotApp — Root client component.
 *
 * Owns the fetch lifecycle, error routing, and view-model assembly.
 * Renders the two-pane layout: left pane (search + upcoming manual inputs),
 * right pane (paper-like preview).
 */
export function SnapshotApp() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [facilityData, setFacilityData] = useState<FacilityData | null>(null);
  const [hospMetrics, setHospMetrics] = useState<HospMetric[] | undefined>(
    undefined,
  );
  const [errorState, setErrorState] = useState<CmsApiError | null>(null);
  const [manualInputs, setManualInputs] = useState<ManualInputs>({});

  // ── Fetch handler ──────────────────────────────────────────────────────────
  const handleSearch = useCallback(async (ccn: string) => {
    // 1. Transition to loading, clear stale error (Pitfall 3)
    setFetchState("loading");
    setErrorState(null);

    try {
      // 2. Call /api/facility — server-side route handles CMS fetch + Zod validation
      const res = await fetch(`/api/facility?ccn=${encodeURIComponent(ccn)}`);
      // WR-02: check res.ok before trusting json shape; a non-ok + unexpected body
      // would push undefined into errorState and crash getErrorPresentation (ERR-03).
      const json = (await res.json()) as unknown;

      if (
        json !== null &&
        typeof json === "object" &&
        "data" in (json as Record<string, unknown>)
      ) {
        // 3a. Success — capture both facility data and optional hospMetrics (Phase 5)
        const successJson = json as {
          data: FacilityData;
          hospMetrics?: HospMetric[];
        };
        setFacilityData(successJson.data);
        setHospMetrics(successJson.hospMetrics); // undefined if absent (D-09 degraded state)
        setManualInputs({}); // D-11: reset ONLY on successful fetch
        setFetchState("success");
      } else if (
        json !== null &&
        typeof json === "object" &&
        "error" in (json as Record<string, unknown>)
      ) {
        // 3b. API-level error — validate shape before trusting it (WR-02)
        const parsed = CmsApiErrorSchema.safeParse(
          (json as Record<string, unknown>).error,
        );
        setErrorState(
          parsed.success
            ? parsed.data
            : { kind: "cms_api_error", message: "Unexpected error response." },
        );
        setFacilityData(null);
        setHospMetrics(undefined); // clear stale metrics on error
        setFetchState("error");
      } else {
        // 3b'. Unexpected envelope (proxy/CDN error, shape drift) — never push undefined
        setErrorState({
          kind: "cms_api_error",
          message: "Unexpected response from server.",
        });
        setFacilityData(null);
        setHospMetrics(undefined); // clear stale metrics on error
        setFetchState("error");
      }
    } catch {
      // 3c. Network-level failure (DNS, timeout, offline)
      // Build a synthetic network_error so the banner renders (D-07)
      const networkErr: CmsApiError = {
        kind: "network_error",
        message: "Network failure — could not reach the server.",
      };
      setErrorState(networkErr);
      setFacilityData(null);
      setHospMetrics(undefined); // clear stale metrics on network failure
      setFetchState("error");
    }
  }, []);

  // ── Debounce manual inputs (D-14) ─────────────────────────────────────────
  // Debounce the manualInputs→vm path: preview and export update ~300ms after
  // the last keystroke, not on every keystroke. Uses explicit setTimeout/clearTimeout
  // (NOT useDeferredValue — no guaranteed minimum delay in React 19 concurrent mode).
  // ManualInputsForm stays bound to raw manualInputs/setManualInputs for immediate
  // UI field feedback. handleSearch (CMS fetch) is untouched — manual edits NEVER
  // trigger a CMS re-fetch (D-14 anti-pattern guard).
  const debouncedManualInputs = useDebounce(manualInputs, 300);

  // ── View-model assembly ────────────────────────────────────────────────────
  // D-12: assembleViewModel gets new Date() from the caller, never internally
  // D-14: assembles from debouncedManualInputs (not raw manualInputs) — the
  //       same debounced vm drives both ReportPreview and ExportControls (RPT-02).
  // Phase 5: hospMetrics passed as the 4th arg — undefined = D-09 degraded state
  const vm = facilityData
    ? assembleViewModel(
        facilityData,
        debouncedManualInputs,
        new Date(),
        hospMetrics,
      )
    : null;

  // ── Error routing ──────────────────────────────────────────────────────────
  // D-07: split error kinds into banner vs inline.
  // WR-03: getErrorPresentation is the single source of truth for placement —
  // the former local isBannerError mirror has been removed to prevent divergence.
  const placement = errorState
    ? getErrorPresentation(errorState).placement
    : null;
  const bannerError = placement === "banner" ? errorState : null;
  const inlineError = placement === "inline" ? errorState : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 min-h-screen bg-zinc-50">
      {/* Left pane — search + (Wave 4) manual inputs */}
      <div className="flex-1 flex flex-col gap-4 max-w-sm">
        <h1>
          {/* eslint-disable-next-line @next/next/no-img-element -- data-URI logo, no Next/Image optimization needed */}
          <img
            src={INFINITE_LOGO_DATA_URI}
            alt="INFINITE — Managed by MEDELITE"
            width={INFINITE_LOGO_WIDTH}
            height={INFINITE_LOGO_HEIGHT}
          />
        </h1>
        <p className="text-sm text-zinc-500">
          Enter a CMS Certification Number (CCN) to generate a facility
          assessment snapshot.
        </p>

        {/* Banner errors ABOVE the form (D-07) */}
        {bannerError && <ErrorBanner error={bannerError} />}

        {/* CCN search form — inline errors routed through inlineError prop */}
        {/* WR-01: onInputChange clears stale server inline error (e.g. not_found) when user edits CCN */}
        <CCNSearchBar
          onSearch={handleSearch}
          loading={fetchState === "loading"}
          inlineError={inlineError}
          onInputChange={() => setErrorState(null)}
        />

        {/* ManualInputsForm — binds all six manual fields + name override (D-11/D-12/PREV-01) */}
        {/* disabled={!facilityData}: inputs are disabled until the first successful fetch (D-11) */}
        {/* onChange={setManualInputs}: updates raw manualInputs on every keystroke (immediate    */}
        {/*   field feedback); debouncedManualInputs → vm updates ~300ms later (D-14).           */}
        {/* No re-fetch on manual edits — only handleSearch fetches CMS data (D-14 anti-pattern) */}
        <ManualInputsForm
          inputs={manualInputs}
          onChange={setManualInputs}
          disabled={!facilityData}
        />

        {/* Export controls — D-01..D-05 / D-07 / D-08 (Plan 06-03).                    */}
        {/* Reads the already-assembled vm from state — no re-fetch, no re-assemble.     */}
        {/* When vm is null (no successful fetch yet), renders disabled (D-07).          */}
        {/* Safe import: ExportControls is "use client" and never imports                */}
        {/* docx, @react-pdf/renderer, or ReportPDF (T-06-08 discipline preserved).     */}
        <ExportControls vm={vm} />
      </div>

      {/* Right pane — paper-like preview */}
      <div className="flex-1">
        <ReportPreview vm={vm} fetchState={fetchState} />
      </div>
    </div>
  );
}
