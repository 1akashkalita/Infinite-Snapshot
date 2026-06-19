// ReportPDF.tsx — Server-only react-pdf document mirroring ReportPreview.tsx 1:1 (D-01).
//
// Design constraints:
//   CLAUDE.md rule #2: The header block receives ONLY vm.header (platformLine/reportTitle/stateLine).
//     vm.facility.displayName NEVER appears in the header section — only in the body body rows.
//     The static branding is "INFINITE — Managed by MEDELITE" / "FACILITY ASSESSMENT SNAPSHOT" / state.
//
//   D-01: This document faithfully replicates ReportPreview.tsx — same 13-field body order with
//     verbatim labels, same static header block, same N/A semantics, same processing-date footer.
//     react-pdf has flexbox (Yoga) but NO CSS grid — the preview's <dl className="grid..."> becomes
//     a series of <View style={{ flexDirection: 'row' }}> rows (label left, value right).
//
//   D-03: Typography uses react-pdf built-in Helvetica family — NO Font.register this phase.
//     Rationale: PITFALLS.md #5 — Font.register with CDN URLs silently falls back on Vercel;
//     built-in fonts guarantee local == Vercel parity with zero render-time network dependency.
//     Bold labels via explicit fontFamily: "Helvetica-Bold" (Open Question 1 resolved).
//
//   D-04: Clickable Medicare link via <Link src={vm.facility.careCompareUrl}> — the URL is already
//     validated as https://www.medicare.gov/... by ReportViewModelSchema; do NOT reconstruct it.
//
//   D-02: Page format = US Letter portrait (612×792pt, <Page size="LETTER">).
//
//   NO "use client" directive — this file is server-only. Adding "use client" causes next build
//     to fail (PITFALLS #4: @react-pdf/renderer must not reach the client bundle).
//
//   Body field order (D-01/D-03 — verbatim labels from ReportPreview.tsx):
//     1.  Name of Facility   → vm.facility.displayName
//     2.  Location           → formatLocation(vm.facility.address)
//     3.  EMR                → vm.manual.emr ?? "—"
//     4.  Census Capacity    → formatBeds(vm.facility.certifiedBeds)
//     5.  Current Census     → currentCensus != null ? String(...) : "—"
//     6.  Type of Patient    → vm.manual.typeOfPatient ?? "—"
//     7.  Previous Coverage from Medelite        → vm.manual.previousCoverage ?? "—"
//     8.  Previous Provider Performance from Medelite → vm.manual.previousProviderPerformance ?? "—"
//     9.  Medical Coverage   → vm.manual.medicalCoverage ?? "—"
//     10. Overall Star Rating     → formatRating(vm.facility.starRatings.overall)
//     11. Health Inspection       → formatRating(vm.facility.starRatings.healthInspection)
//     12. Staffing                → formatRating(vm.facility.starRatings.staffing)
//     13. Quality of Resident Care → formatRating(vm.facility.starRatings.qualityCare)

import {
  Document,
  Page,
  View,
  Text,
  Link,
  StyleSheet,
} from "@react-pdf/renderer";
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
 * Renders a single HospMetric value applying D-10/D-11/D-12 rules (PDF mirror of ReportPreview):
 *   null → formatFootnote(m.footnoteCode) (suppressed / absent)
 *   unit === "percent" → formatPercent(m.value)
 *   unit === "rate" → formatRate(m.value)
 */
function renderMetricValue(m: HospMetric): string {
  if (m.value === null) return formatFootnote(m.footnoteCode);
  return m.unit === "percent" ? formatPercent(m.value) : formatRate(m.value);
}

// ---------------------------------------------------------------------------
// Styles — react-pdf StyleSheet (no Tailwind in PDF — web only)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
  },
  // ---- Header ----
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    marginBottom: 12,
    paddingBottom: 8,
    alignItems: "center",
  },
  platformLine: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    letterSpacing: 2,
  },
  reportTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 1,
    color: "#52525b",
  },
  stateLine: {
    fontSize: 9,
    color: "#71717a",
  },
  // ---- Body rows ----
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  label: {
    width: "45%",
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: "#374151",
  },
  value: {
    flex: 1,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#18181b",
  },
  // ---- Footer ----
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    marginTop: 12,
    paddingTop: 6,
  },
  footerText: {
    fontSize: 9,
    color: "#a1a1aa",
    textAlign: "right",
  },
  linkText: {
    fontSize: 9,
    color: "#1d4ed8",
    textDecoration: "underline",
  },
});

// ---------------------------------------------------------------------------
// ReportPDF — named export (server-only, no "use client")
// ---------------------------------------------------------------------------

/**
 * Server-only react-pdf Document that mirrors ReportPreview.tsx 1:1 (D-01).
 *
 * Renders a single US-Letter portrait page with:
 * - Static branding header (rule #2 — vm.header only, never displayName in header)
 * - 13 body fields in verbatim label order (D-01/D-03)
 * - Footer with CMS processing date + clickable Medicare Care Compare link (D-04)
 *
 * @param vm — The validated ReportViewModel (already passed through ReportViewModelSchema).
 */
export function ReportPDF({ vm }: { vm: ReportViewModel }) {
  return (
    <Document title={vm.facility.displayName}>
      <Page size="LETTER" style={styles.page}>
        {/* ---------------------------------------------------------------- */}
        {/* STATIC HEADER BLOCK — rule #2: only vm.header.*, never displayName */}
        {/* vm.header.platformLine = "INFINITE — Managed by MEDELITE"        */}
        {/* vm.header.reportTitle  = "FACILITY ASSESSMENT SNAPSHOT"          */}
        {/* vm.header.stateLine    = e.g. "FL"                               */}
        {/* ---------------------------------------------------------------- */}
        <View style={styles.header}>
          <Text style={styles.platformLine}>{vm.header.platformLine}</Text>
          <Text style={styles.reportTitle}>{vm.header.reportTitle}</Text>
          <Text style={styles.stateLine}>{vm.header.stateLine}</Text>
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* REPORT BODY — D-01/D-03: verbatim label order from ReportPreview */}
        {/* Flexbox rows (react-pdf has NO CSS grid — D-01 note)             */}
        {/* Formatters use === null (D-10): real 0 → "0", null → "N/A"      */}
        {/* ---------------------------------------------------------------- */}

        {/* 1. Name of Facility — displayName (body only, never in header) */}
        <View style={styles.row}>
          <Text style={styles.label}>Name of Facility</Text>
          <Text style={styles.value}>{vm.facility.displayName}</Text>
        </View>

        {/* 2. Location — composed street, city, state; NO ZIP (DATA-03) */}
        <View style={styles.row}>
          <Text style={styles.label}>Location</Text>
          <Text style={styles.value}>
            {formatLocation(vm.facility.address)}
          </Text>
        </View>

        {/* 3. EMR — manual input */}
        <View style={styles.row}>
          <Text style={styles.label}>EMR</Text>
          <Text style={styles.value}>{vm.manual.emr ?? "—"}</Text>
        </View>

        {/* 4. Census Capacity — CMS certifiedBeds, null → "N/A" (D-10) */}
        <View style={styles.row}>
          <Text style={styles.label}>Census Capacity</Text>
          <Text style={styles.value}>
            {formatBeds(vm.facility.certifiedBeds)}
          </Text>
        </View>

        {/* 5. Current Census — manual input */}
        <View style={styles.row}>
          <Text style={styles.label}>Current Census</Text>
          <Text style={styles.value}>
            {vm.manual.currentCensus != null
              ? String(vm.manual.currentCensus)
              : "—"}
          </Text>
        </View>

        {/* 6. Type of Patient — manual input */}
        <View style={styles.row}>
          <Text style={styles.label}>Type of Patient</Text>
          <Text style={styles.value}>{vm.manual.typeOfPatient ?? "—"}</Text>
        </View>

        {/* 7. Previous Coverage from Medelite — Yes/No (manual) */}
        <View style={styles.row}>
          <Text style={styles.label}>Previous Coverage from Medelite</Text>
          <Text style={styles.value}>{vm.manual.previousCoverage ?? "—"}</Text>
        </View>

        {/* 8. Previous Provider Performance from Medelite — manual input (INPT-01) */}
        <View style={styles.row}>
          <Text style={styles.label}>
            Previous Provider Performance from Medelite
          </Text>
          <Text style={styles.value}>
            {vm.manual.previousProviderPerformance ?? "—"}
          </Text>
        </View>

        {/* 9. Medical Coverage — free-text field (not part of Medelite History) */}
        <View style={styles.row}>
          <Text style={styles.label}>Medical Coverage</Text>
          <Text style={styles.value}>{vm.manual.medicalCoverage ?? "—"}</Text>
        </View>

        {/* 10. Overall Star Rating — CMS overall_rating */}
        <View style={styles.row}>
          <Text style={styles.label}>Overall Star Rating</Text>
          <Text style={styles.value}>
            {formatRating(vm.facility.starRatings.overall)}
          </Text>
        </View>

        {/* 11. Health Inspection — CMS health_inspection_rating */}
        {/* Label is "Health Inspection" NOT "Health Inspection Rating" (verbatim from reference) */}
        <View style={styles.row}>
          <Text style={styles.label}>Health Inspection</Text>
          <Text style={styles.value}>
            {formatRating(vm.facility.starRatings.healthInspection)}
          </Text>
        </View>

        {/* 12. Staffing — CMS staffing_rating */}
        {/* Label is "Staffing" NOT "Staffing Rating" (verbatim from reference) */}
        <View style={styles.row}>
          <Text style={styles.label}>Staffing</Text>
          <Text style={styles.value}>
            {formatRating(vm.facility.starRatings.staffing)}
          </Text>
        </View>

        {/* 13. Quality of Resident Care — CMS qm_rating (NOT longstay/shortstay qm) */}
        <View style={styles.row}>
          <Text style={styles.label}>Quality of Resident Care</Text>
          <Text style={styles.value}>
            {formatRating(vm.facility.starRatings.qualityCare)}
          </Text>
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* Hospitalization & ED metrics — Phase 5 (CLM-01/02/03)            */}
        {/* Mirrors ReportPreview.tsx 1:1 (D-01/D-03/D-05).                  */}
        {/* react-pdf has NO keyed Fragment — use key={i} on <View> (Pitfall 6). */}
        {/* NO "use client" — this file is server-only (T-05-BUNDLE).        */}
        {/* D-09 degraded: hospMetrics === undefined → single full-width row. */}
        {/* D-10 per-row: null value → formatFootnote; averages still render. */}
        {/* ---------------------------------------------------------------- */}
        {vm.hospMetrics === undefined ? (
          <View style={styles.row}>
            <Text style={[styles.value, { flex: 2 }]}>
              Hospitalization &amp; ED metrics are temporarily unavailable.
            </Text>
          </View>
        ) : (
          vm.hospMetrics.map((m, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.label}>{m.label}</Text>
              <Text style={styles.value}>{renderMetricValue(m)}</Text>
            </View>
          ))
        )}

        {/* ---------------------------------------------------------------- */}
        {/* FOOTER — CMS processing date + Medicare Care Compare link (D-04) */}
        {/* ---------------------------------------------------------------- */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            CMS processing date: {formatDate(vm.facility.processingDate)}
          </Text>
          {/* D-04: clickable PDF link annotation — src prop, not href (RESEARCH Pattern 3) */}
          {/* The URL is already validated in the model — do NOT reconstruct it here */}
          <Link src={vm.facility.careCompareUrl}>
            <Text style={styles.linkText}>
              View official CMS profile on Medicare.gov
            </Text>
          </Link>
        </View>
      </Page>
    </Document>
  );
}
