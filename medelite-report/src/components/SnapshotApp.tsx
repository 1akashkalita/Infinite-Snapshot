"use client";

// SnapshotApp.tsx — State owner: CCN submit → fetch → state cascade → render.
//
// Wave 3 (this plan) wires the fetch seam and error routing onto the Wave-2 skeleton shell.
// Wave 4 will bind the ManualInputsForm that populates manualInputs.
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
//   3a. Success: setFacilityData(json.data), setManualInputs({}), setFetchState('success')
//   3b. API error: setErrorState(json.error), setFacilityData(null), setFetchState('error')
//   3c. Network failure (catch): synthetic network_error, setFacilityData(null), setFetchState('error')
//
// D-11: manualInputs reset to {} ONLY on a successful fetch — preserves user work on error.
// D-12: assembleViewModel(facilityData, manualInputs, new Date()) — new Date() injected here.

import { useState, useCallback } from "react";
import type { FacilityData } from "@/lib/cms/types";
import type { CmsApiError } from "@/lib/cms/errors";
import { assertNever } from "@/lib/cms/errors";
import type { ManualInputs } from "@/lib/report/view-model";
import { assembleViewModel } from "@/lib/report/view-model";
import { getErrorPresentation } from "@/lib/ui/error-presentation";
import { CCNSearchBar } from "@/components/CCNSearchBar";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ManualInputsForm } from "@/components/ManualInputsForm";
import { ReportPreview } from "@/components/ReportPreview";

// FetchState drives both the skeleton and the button disabled state
type FetchState = "idle" | "loading" | "success" | "error";

/**
 * Determines whether an error kind maps to a banner (vs inline) placement.
 *
 * This is an exhaustive switch — any new CmsApiError kind added without a case
 * here causes a TypeScript compile error via assertNever(kind) (D-09/ERR-02).
 *
 * Mirror of getErrorPresentation(error).placement; kept local to SnapshotApp so
 * the rendering logic is explicit without calling getErrorPresentation twice.
 */
function isBannerError(kind: CmsApiError["kind"]): boolean {
  switch (kind) {
    case "network_error":
    case "cms_api_error":
    case "validation_error":
      return true;
    case "invalid_ccn":
    case "not_found":
      return false;
    default:
      // Pitfall 4: pass the discriminant (not the full error object)
      return assertNever(kind);
  }
}

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
      const json = (await res.json()) as
        | { data: FacilityData }
        | { error: CmsApiError };

      if ("data" in json) {
        // 3a. Success
        setFacilityData(json.data);
        setManualInputs({}); // D-11: reset ONLY on successful fetch
        setFetchState("success");
      } else {
        // 3b. API-level error (invalid_ccn, not_found, cms_api_error, validation_error)
        setErrorState(json.error);
        setFacilityData(null);
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
      setFetchState("error");
    }
  }, []);

  // ── View-model assembly ────────────────────────────────────────────────────
  // D-12: assembleViewModel gets new Date() from the caller, never internally
  const vm = facilityData
    ? assembleViewModel(facilityData, manualInputs, new Date())
    : null;

  // ── Error routing ──────────────────────────────────────────────────────────
  // D-07: split error kinds into banner vs inline
  const placement = errorState
    ? getErrorPresentation(errorState).placement
    : null;
  const bannerError =
    errorState && (placement === "banner" || isBannerError(errorState.kind))
      ? errorState
      : null;
  const inlineError = errorState && placement === "inline" ? errorState : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 min-h-screen bg-zinc-50">
      {/* Left pane — search + (Wave 4) manual inputs */}
      <div className="flex-1 flex flex-col gap-4 max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Infinite Snapshot
        </h1>
        <p className="text-sm text-zinc-500">
          Enter a CMS Certification Number (CCN) to generate a facility
          assessment snapshot.
        </p>

        {/* Banner errors ABOVE the form (D-07) */}
        {bannerError && <ErrorBanner error={bannerError} />}

        {/* CCN search form — inline errors routed through inlineError prop */}
        <CCNSearchBar
          onSearch={handleSearch}
          loading={fetchState === "loading"}
          inlineError={inlineError}
        />

        {/* ManualInputsForm — binds all six manual fields + name override (D-11/D-12/PREV-01) */}
        {/* disabled={!facilityData}: inputs are disabled until the first successful fetch (D-11) */}
        {/* onChange={setManualInputs}: re-runs assembleViewModel on every keystroke (PREV-01)     */}
        {/* No re-fetch on manual edits — only handleSearch fetches CMS data                       */}
        <ManualInputsForm
          inputs={manualInputs}
          onChange={setManualInputs}
          disabled={!facilityData}
        />
      </div>

      {/* Right pane — paper-like preview */}
      <div className="flex-1">
        <ReportPreview vm={vm} fetchState={fetchState} />
      </div>
    </div>
  );
}
