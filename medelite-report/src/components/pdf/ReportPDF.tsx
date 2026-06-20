// ReportPDF.tsx — Server-only react-pdf document mirroring ReportPreview.tsx 1:1 (D-01).
//
// Faithfully replicates the official "Facility Assessment Snapshot" template: a centered
// INFINITE logo, the "FACILITY ASSESSMENT SNAPSHOT" title + state, then a bordered
// 2-column table (bold label left, italic value right). Only the right-column values are
// dynamic. Verified against the rendered example PDF (Kendall Lakes).
//
// Design constraints:
//   CLAUDE.md rule #2 (updated): header branding is the STATIC INFINITE / Managed-by-MEDELITE
//     logo image (vm.header.platformLine is its alt/label) — never the facility name.
//     vm.facility.displayName appears ONLY in the body rows.
//
//   D-01: Mirrors ReportPreview.tsx — same logo header, same 13 fixed fields + 12 metric rows,
//     same verbatim labels/order, same N/A semantics. react-pdf has flexbox (Yoga) but NO CSS
//     grid and NO border-collapse — the bordered table is built from per-cell borders:
//     the table View carries top+left borders; each cell carries bottom+right borders, so
//     adjacent cells share a single 1pt black line (a clean grid, no doubled borders).
//
//   D-03: Typography uses react-pdf built-in Helvetica family — NO Font.register (PITFALLS #5:
//     CDN font URLs silently fall back on Vercel). Bold labels = "Helvetica-Bold"; italic
//     values = "Helvetica-Oblique"; both are built-in so local == Vercel parity.
//
//   D-04 / rule #7: Clickable Medicare link via <Link src={vm.facility.careCompareUrl}> — the
//     URL is already validated as https://www.medicare.gov/... by ReportViewModelSchema.
//
//   D-02: Page format = US Letter portrait (612×792pt).
//
//   Template fidelity: the 12 hospitalization/ED rows are NOT highlighted (the blank template's
//     yellow shading was a fill-from-API marker, absent from the filled report).
//
//   NO "use client" — this file is server-only (PITFALLS #4: @react-pdf/renderer must not
//     reach the client bundle; `next build` fails if it does).

import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Link,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import { PdfStarRating } from "@/components/pdf/PdfStarRating";
import { PdfMiniBarChart } from "@/components/pdf/PdfMiniBarChart";
import { groupByMeasure } from "@/lib/report/chart-utils";
import {
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

const BORDER = "#000000";

const styles = StyleSheet.create({
  page: {
    paddingVertical: 32,
    paddingHorizontal: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
  },
  // ---- Header ----
  header: {
    alignItems: "center",
    marginBottom: 10,
  },
  logo: {
    width: INFINITE_LOGO_WIDTH,
    height: INFINITE_LOGO_HEIGHT,
    marginBottom: 6,
  },
  reportTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    letterSpacing: 1,
  },
  stateLine: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    marginTop: 2,
  },
  // ---- Table ----
  // Table carries top+left borders; each cell carries bottom+right borders → single-line grid.
  table: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: BORDER,
  },
  row: {
    flexDirection: "row",
  },
  labelCell: {
    width: "42%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    paddingVertical: 4,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  valueCell: {
    flex: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    paddingVertical: 4,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  // Full-width cell for the D-09 degraded message row.
  fullCell: {
    width: "100%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  labelText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: "#111827",
  },
  valueText: {
    fontFamily: "Helvetica-Oblique",
    fontSize: 10,
    color: "#111827",
  },
  degradedText: {
    fontFamily: "Helvetica-Oblique",
    fontSize: 10,
    color: "#6b7280",
  },
  // ---- Footer ----
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  linkText: {
    fontSize: 9,
    color: "#1d4ed8",
    textDecoration: "underline",
  },
  footerText: {
    fontSize: 9,
    color: "#9ca3af",
  },
});

/** One template table row: bold label (left) + italic value (right). */
function PdfRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.labelCell}>
        <Text style={styles.labelText}>{label}</Text>
      </View>
      <View style={styles.valueCell}>
        <Text style={styles.valueText}>{value}</Text>
      </View>
    </View>
  );
}

/**
 * Rating table row variant that accepts ReactNode in the value cell.
 * Used by the 4 star-rating rows (D-02) so <PdfStarRating> (returns a View)
 * can be placed directly in the value cell without a <Text> wrapper.
 * The existing PdfRow (string value) and 12 metric rows are UNCHANGED (Pitfall 4).
 */
function PdfRatingRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.labelCell}>
        <Text style={styles.labelText}>{label}</Text>
      </View>
      <View style={styles.valueCell}>{children}</View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ReportPDF — named export (server-only, no "use client")
// ---------------------------------------------------------------------------

/**
 * Server-only react-pdf Document that mirrors ReportPreview.tsx 1:1 (D-01).
 *
 * @param vm — The validated ReportViewModel (already passed through ReportViewModelSchema).
 */
export function ReportPDF({ vm }: { vm: ReportViewModel }) {
  const f = vm.facility;
  const m = vm.manual;

  return (
    <Document title={f.displayName}>
      <Page size="LETTER" style={styles.page}>
        {/* HEADER — INFINITE logo (rule #2 static branding) + title + state */}
        <View style={styles.header}>
          {/* The data-URI logo is the INFINITE / Managed-by-MEDELITE brand mark. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf <Image> is not an HTML <img>; it has no alt prop */}
          <Image style={styles.logo} src={INFINITE_LOGO_DATA_URI} />
          <Text style={styles.reportTitle}>{vm.header.reportTitle}</Text>
          <Text style={styles.stateLine}>{vm.header.stateLine}</Text>
        </View>

        {/* BODY — bordered 2-column table (template-exact order + labels) */}
        <View style={styles.table}>
          <PdfRow label="Name of Facility" value={f.displayName} />
          <PdfRow label="Location" value={formatLocation(f.address)} />
          <PdfRow label="EMR" value={m.emr ?? "—"} />
          <PdfRow label="Census Capacity" value={formatBeds(f.certifiedBeds)} />
          <PdfRow
            label="Current Census"
            value={m.currentCensus != null ? String(m.currentCensus) : "—"}
          />
          <PdfRow label="Type of Patient" value={m.typeOfPatient ?? "—"} />
          <PdfRow
            label="Previous Coverage from Medelite"
            value={m.previousCoverage ?? "—"}
          />
          <PdfRow
            label="Previous Provider Performance from Medelite"
            value={m.previousProviderPerformance ?? "—"}
          />
          <PdfRow label="Medical Coverage" value={m.medicalCoverage ?? "—"} />
          <PdfRatingRow label="Overall Star Rating">
            <PdfStarRating rating={f.starRatings.overall} />
          </PdfRatingRow>
          <PdfRatingRow label="Health Inspection">
            <PdfStarRating rating={f.starRatings.healthInspection} />
          </PdfRatingRow>
          <PdfRatingRow label="Staffing">
            <PdfStarRating rating={f.starRatings.staffing} />
          </PdfRatingRow>
          <PdfRatingRow label="Quality of Resident Care">
            <PdfStarRating rating={f.starRatings.qualityCare} />
          </PdfRatingRow>

          {/* Hospitalization & ED metrics — Phase 5 (CLM-01/02/03). 12 rows in
              template order, verbatim labels (D-04). react-pdf has NO keyed Fragment —
              use key={i} on <View>. D-09 degraded: single full-width row. */}
          {vm.hospMetrics === undefined ? (
            <View style={styles.row}>
              <View style={styles.fullCell}>
                <Text style={styles.degradedText}>
                  Hospitalization &amp; ED metrics are temporarily unavailable.
                </Text>
              </View>
            </View>
          ) : (
            vm.hospMetrics.map((metric, i) => (
              <PdfRow
                key={i}
                label={metric.label}
                value={renderMetricValue(metric)}
              />
            ))
          )}
        </View>

        {/* CHARTS — 4 mini grouped-bar charts in a 2×2 GRID below the metric rows.  */}
        {/* D-07: facility/national/state bars. No legend — series identity conveyed  */}
        {/* by X-axis category labels (Facility/National/State) and chart title.      */}
        {/* VIZ-02: PdfMiniBarChart uses native react-pdf SVG primitives.             */}
        {/* react-pdf has NO keyed Fragment — key the wrapping View.                  */}
        {vm.hospMetrics && vm.hospMetrics.length > 0 && (
          <View
            style={{
              marginTop: 8,
              flexDirection: "row",
              flexWrap: "wrap",
            }}
          >
            {groupByMeasure(vm.hospMetrics).map((group, i) => (
              <View
                key={i}
                style={{
                  width: "50%",
                  paddingRight: i % 2 === 0 ? 4 : 0,
                  paddingLeft: i % 2 === 1 ? 4 : 0,
                  marginBottom: 4,
                }}
              >
                <PdfMiniBarChart group={group} />
              </View>
            ))}
          </View>
        )}

        {/* FOOTER — required clickable Medicare link (rule #7) + CMS dataset processing date */}
        <View style={styles.footer}>
          {/* D-04: clickable PDF link annotation — src prop, not href. Already validated. */}
          <Link src={f.careCompareUrl}>
            <Text style={styles.linkText}>
              View official CMS profile on Medicare.gov
            </Text>
          </Link>
          <Text style={styles.footerText}>
            CMS dataset processing date: {formatDate(f.processingDate)}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
