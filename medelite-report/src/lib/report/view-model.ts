// view-model.ts — ReportViewModel: the single shared render contract (RPT-02).
//
// Design decisions:
//   RPT-02: assembleViewModel(facility, manual, generatedAt) is pure and deterministic.
//           generatedAt is INJECTED by the caller — never new Date() internally (D-12).
//           The route handler passes new Date(); tests pass a fixed value.
//   NAME-02: displayName = manual.nameOverride?.trim() || facility.providerName.
//             nameOverride affects ONLY the body displayName; the static header is unaffected.
//   RPT-01: assembleHeader is called with facility.state ONLY (no facility-name arg, rule #2).
//   D-08: ReportViewModel carries raw number | null — formatters run at render time.
//         Charts (Phase 7) also read raw values; never pre-stringify in the model.
//   D-16: careCompareUrl = https://www.medicare.gov/care-compare/details/nursing-home/{ccn}
//   D-12: Two dates — generatedAt (when snapshot was generated) + processingDate (CMS freshness).
//   D-21: ReportViewModelSchema is THE canonical Zod schema — POST /api/export/pdf validates
//         against it; Phase 4 renders straight from the parsed model.

import { z } from "zod";
import { type FacilityData, type HospMetric } from "@/lib/cms/types";
import { assembleHeader } from "@/lib/report/header";

// ---------------------------------------------------------------------------
// ManualInputs — operational fields the user enters that don't exist in CMS.
// Six manual fields (+ Yes/No previousCoverage) per CLAUDE.md field mapping.
// ---------------------------------------------------------------------------

export interface ManualInputs {
  /** Optional manual override for the facility name — body display only (NAME-02). */
  nameOverride?: string;
  /** Electronic Medical Record system in use. */
  emr?: string;
  /** Current census (occupied beds). */
  currentCensus?: number | null;
  /** Type of patient population (e.g. "SNF", "ALF"). */
  typeOfPatient?: string;
  /** Medical coverage provided (e.g. "Optometry, PCP, Podiatry"). */
  medicalCoverage?: string;
  /** Whether this facility has had previous Medelite coverage. */
  previousCoverage?: "Yes" | "No" | null;
  /** Previous provider performance notes (e.g. "Strong outcomes"). */
  previousProviderPerformance?: string;
}

// ---------------------------------------------------------------------------
// HospMetricSchema — validates one of the 12 hospitalization/ED data points.
// Added in Phase 5 (D-13). Must live inside ReportViewModelSchema because
// POST /api/export/pdf re-validates the full posted view-model against it.
// Field-for-field aligned with HospMetric interface from types.ts (Plan 02).
// ---------------------------------------------------------------------------

const HospMetricSchema = z.object({
  /** Verbatim label from the reference template (D-04 — garbles preserved). */
  label: z.string(),
  /**
   * Facility adjusted score or average value. null when CMS suppressed or absent.
   * z.number().nullable() — rejects strings (even numeric ones) (T-05-PDF).
   */
  value: z.number().nullable(),
  /** Formatter kind: "percent" | "rate" — drives which formatter runs at render time. */
  unit: z.enum(["percent", "rate"]),
  /** CMS footnote code. Present on facility rows with suppression; absent on average rows. */
  footnoteCode: z.string().optional(),
});

// ---------------------------------------------------------------------------
// ReportViewModelSchema — THE canonical Zod schema for the shared model (D-21).
// POST /api/export/pdf validates the incoming body against this schema.
// Phase 4 PDF renderer and Phase 6 docx renderer consume the parsed output.
// ---------------------------------------------------------------------------

export const ReportViewModelSchema = z.object({
  /** Static branding header (RPT-01). */
  header: z.object({
    platformLine: z.string(),
    reportTitle: z.string(),
    stateLine: z.string(),
  }),

  /** Facility fields derived from CMS + the computed displayName and careCompareUrl. */
  facility: z.object({
    /** CMS certification number — preserved as string (leading zeros). */
    ccn: z.string(),
    /** CMS operating name (provider_name). */
    providerName: z.string(),
    /** Display name: manual.nameOverride?.trim() || providerName (NAME-02). */
    displayName: z.string(),
    /** Composed address (no ZIP — DATA-03). */
    address: z.object({
      street: z.string(),
      city: z.string(),
      state: z.string(),
    }),
    /** Star ratings — raw number | null (D-08). */
    starRatings: z.object({
      overall: z.number().nullable(),
      healthInspection: z.number().nullable(),
      staffing: z.number().nullable(),
      qualityCare: z.number().nullable(),
    }),
    /** Census capacity — raw number | null (D-08). */
    certifiedBeds: z.number().nullable(),
    /** CMS data freshness date (processing_date — D-12). */
    processingDate: z.string(),
    /**
     * Clickable link to the official Medicare Care Compare profile (D-16).
     * Hardened: `z.string().url()` alone accepts `javascript:`/`data:` URIs (WHATWG URL
     * parses them). Since this model is validated from the client-controlled POST body and
     * Phase 4 renders the link into a PDF, constrain it to an https://www.medicare.gov URL
     * so a crafted body cannot inject an executable link (defense-in-depth for the PDF route).
     */
    careCompareUrl: z
      .string()
      .url()
      .refine(
        (u) => {
          try {
            const parsed = new URL(u);
            return (
              parsed.protocol === "https:" &&
              parsed.hostname === "www.medicare.gov"
            );
          } catch {
            return false;
          }
        },
        { message: "careCompareUrl must be an https://www.medicare.gov URL" },
      ),
  }),

  /** Manual operational inputs that don't live in CMS. */
  manual: z.object({
    emr: z.string().optional(),
    currentCensus: z.number().nullable().optional(),
    typeOfPatient: z.string().optional(),
    medicalCoverage: z.string().optional(),
    previousCoverage: z.enum(["Yes", "No"]).nullable().optional(),
    previousProviderPerformance: z.string().optional(),
  }),

  /** ISO string of when this snapshot was generated (injected by caller — D-12). */
  generatedAt: z.string(),

  /**
   * Hospitalization/ED metrics from CMS claims datasets (Phase 5).
   * Optional — absent when the claims/averages fetch was rejected (D-09 degraded state).
   * Lives inside this schema (D-13) so POST /api/export/pdf re-validates it automatically.
   * No .min(12).max(12): Zod v4 has no array .length(); the mapper enforces the 12-row count.
   */
  hospMetrics: z.array(HospMetricSchema).optional(),
});

/** Inferred TypeScript type from ReportViewModelSchema (D-21). */
export type ReportViewModel = z.infer<typeof ReportViewModelSchema>;

// ---------------------------------------------------------------------------
// assembleViewModel — pure, deterministic view-model assembler (RPT-02 / D-12).
// ---------------------------------------------------------------------------

/**
 * Assembles the shared ReportViewModel from CMS facility data and manual inputs.
 *
 * Pure / deterministic: given the same arguments, always returns the same result.
 * The timestamp is injected — never `new Date()` internally (D-12).
 * The name override flows to displayName (body) only — the static header is unaffected (NAME-02).
 *
 * @param facility     — Validated CMS data (FacilityData).
 * @param manual       — User-supplied operational inputs.
 * @param generatedAt  — Snapshot timestamp, injected by the caller (Date or ISO string).
 * @param hospMetrics  — Optional 12-row hospitalization/ED metrics (Phase 5, D-13).
 *                       Absent when the claims/averages fetch was rejected (D-09 degraded state).
 */
export function assembleViewModel(
  facility: FacilityData,
  manual: ManualInputs,
  generatedAt: Date | string,
  hospMetrics?: HospMetric[],
): ReportViewModel {
  // RPT-01 / CLAUDE.md rule #2: assembleHeader takes ONLY a state code — no facility name.
  const header = assembleHeader(facility.state);

  // NAME-02: nameOverride → displayName (body only); empty/whitespace falls back to providerName.
  const displayName = manual.nameOverride?.trim() || facility.providerName;

  // D-16: careCompareUrl uses the CCN string (preserves leading zeros).
  const careCompareUrl = `https://www.medicare.gov/care-compare/details/nursing-home/${facility.ccn}`;

  // D-12: store generatedAt as a string (toISOString if Date); no new Date() here.
  const generatedAtStr =
    generatedAt instanceof Date ? generatedAt.toISOString() : generatedAt;

  return {
    header,
    facility: {
      ccn: facility.ccn,
      providerName: facility.providerName,
      displayName,
      address: facility.address,
      starRatings: facility.starRatings, // raw number | null (D-08 — formatters run at render time)
      certifiedBeds: facility.certifiedBeds,
      processingDate: facility.processingDate,
      careCompareUrl,
    },
    manual: {
      emr: manual.emr,
      currentCensus: manual.currentCensus,
      typeOfPatient: manual.typeOfPatient,
      medicalCoverage: manual.medicalCoverage,
      previousCoverage: manual.previousCoverage,
      previousProviderPerformance: manual.previousProviderPerformance,
    },
    generatedAt: generatedAtStr,
    // hospMetrics: passed through directly; undefined when not supplied (D-09 degraded state)
    hospMetrics,
  };
}
