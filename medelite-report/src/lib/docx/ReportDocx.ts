// ReportDocx.ts — Server-only docx Document builder mirroring ReportPDF.tsx 1:1 (D-06).
//
// Faithfully replicates the "Facility Assessment Snapshot" template as a Word document:
// a centered INFINITE logo, the "FACILITY ASSESSMENT SNAPSHOT" title + state, then a
// bordered 2-column table (bold label left, italic value right). 13 fixed body rows +
// 12 hospitalization/ED metric rows (or the D-09 degraded line if absent).
//
// Design constraints:
//   CLAUDE.md rule #2: header branding is the STATIC INFINITE / Managed-by-MEDELITE
//     logo image — NEVER the facility name. vm.facility.displayName appears ONLY in
//     the body "Name of Facility" row and the Document title metadata.
//
//   D-06: Faithful replica of ReportPDF layout using native docx primitives (bordered
//     Table, ImageRun for logo, ExternalHyperlink for Medicare link).
//
//   D-07: Hand-port of the 13 + 12 rows from ReportPDF — no shared cross-renderer
//     abstraction in Phase 6 (parity / low risk).
//
//   D-08: Same formatters and N/A/suppression semantics as ReportPDF: formatRating /
//     formatBeds / formatLocation / formatDate / formatPercent / formatRate / formatFootnote.
//     Manual fields fall back to "—" (em dash). null → "N/A" (via formatter).
//
//   D-09: When vm.hospMetrics === undefined, emit a single columnSpan:2 row with the
//     degraded text "Hospitalization & ED metrics are temporarily unavailable."
//
//   D-10: Clickable Medicare link via ExternalHyperlink with `link` (NOT `href`).
//
//   D-11: Document title = f.displayName (metadata only; absent from visible header).
//
//   NO "use client" — this file is server-only (PITFALLS #4: docx must not reach the
//     client bundle; `next build` fails if it does). Import only from the route handler.

import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  ExternalHyperlink,
  AlignmentType,
  WidthType,
  BorderStyle,
  PageOrientation,
} from "docx";
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// US-Letter portrait in twips (DXA): width=12240, height=15840 (1 inch = 1440 twips)
const PAGE_WIDTH_DXA = 12240;
const PAGE_HEIGHT_DXA = 15840;

// Table width in DXA (usable area: page - margins). ~9360 DXA matches ~6.5 inch usable.
const TABLE_WIDTH_DXA = 9360;

// Label cell width: ~42% of table width (mirroring ReportPDF "42%" label column).
const LABEL_CELL_WIDTH_DXA = Math.round(TABLE_WIDTH_DXA * 0.42);

// Value cell width: remainder
const VALUE_CELL_WIDTH_DXA = TABLE_WIDTH_DXA - LABEL_CELL_WIDTH_DXA;

// Logo dimensions in PIXELS — the docx `transformation` field takes pixels and multiplies
// by 9525 internally to produce EMU (1 px = 9525 EMU). Passing EMU values here produces
// extents ~1000× too large (e.g. wp:extent cx ≈ 17 billion EMU → Word rejects the file).
// Target: ~2 inches wide at 96 DPI (192 px); derive height proportionally.
const LOGO_DISPLAY_W_PX = 192; // ~2in at 96 DPI; docx converts px→EMU internally (×9525)
const LOGO_DISPLAY_H_PX = Math.round(
  (INFINITE_LOGO_HEIGHT / INFINITE_LOGO_WIDTH) * LOGO_DISPLAY_W_PX,
);

// All-borders style: single black line on every side of the table and cells.
const BORDER_OPT = {
  style: BorderStyle.SINGLE,
  size: 6,
  color: "000000",
} as const;
const ALL_BORDERS = {
  top: BORDER_OPT,
  bottom: BORDER_OPT,
  left: BORDER_OPT,
  right: BORDER_OPT,
  insideHorizontal: BORDER_OPT,
  insideVertical: BORDER_OPT,
} as const;

// ---------------------------------------------------------------------------
// Decode logo once at module load (Buffer.from is Node-only — server-side only)
// ---------------------------------------------------------------------------

const LOGO_B64 = INFINITE_LOGO_DATA_URI.replace(/^data:image\/png;base64,/, "");
const LOGO_BUFFER = Buffer.from(LOGO_B64, "base64");

// ---------------------------------------------------------------------------
// renderMetricValue — mirrors ReportPDF.tsx verbatim (D-08 / D-10 / D-11)
// ---------------------------------------------------------------------------

function renderMetricValue(m: HospMetric): string {
  if (m.value === null) return formatFootnote(m.footnoteCode);
  return m.unit === "percent" ? formatPercent(m.value) : formatRate(m.value);
}

// ---------------------------------------------------------------------------
// docRow — 2-cell TableRow helper (bold label left, italic value right)
// ---------------------------------------------------------------------------

function docRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: LABEL_CELL_WIDTH_DXA, type: WidthType.DXA },
        children: [
          new Paragraph({
            children: [new TextRun({ text: label, bold: true, size: 20 })],
          }),
        ],
      }),
      new TableCell({
        width: { size: VALUE_CELL_WIDTH_DXA, type: WidthType.DXA },
        children: [
          new Paragraph({
            children: [new TextRun({ text: value, italics: true, size: 20 })],
          }),
        ],
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// buildReportDocx — exported server-only builder (rule #2 / D-11 / PITFALLS #4)
// ---------------------------------------------------------------------------

/**
 * Builds a US-Letter Word Document from a validated ReportViewModel.
 *
 * Server-only: must never be imported by a client component.
 * Mirrors ReportPDF.tsx 1:1 in the docx idiom (D-06 / D-07).
 *
 * @param vm — The validated ReportViewModel (already passed through ReportViewModelSchema).
 * @returns A docx `Document` ready for `Packer.toBuffer(doc)`.
 */
export function buildReportDocx(vm: ReportViewModel): Document {
  const f = vm.facility;
  const m = vm.manual;

  // ---- Header: static INFINITE logo + reportTitle + stateLine (rule #2 — never f.displayName) ----
  const logoRun = new ImageRun({
    type: "png", // REQUIRED in docx v9 (RegularImageOptions)
    data: LOGO_BUFFER,
    transformation: {
      width: LOGO_DISPLAY_W_PX,
      height: LOGO_DISPLAY_H_PX,
    },
  });

  const logoParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [logoRun],
    spacing: { after: 120 },
  });

  const titleParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({ text: vm.header.reportTitle, bold: true, size: 26 }),
    ],
    spacing: { after: 40 },
  });

  const stateParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({ text: vm.header.stateLine, bold: true, size: 22 }),
    ],
    spacing: { after: 200 },
  });

  // ---- Body table: 13 fixed rows (template-exact order + labels) ----
  const bodyRows: TableRow[] = [
    docRow("Name of Facility", f.displayName),
    docRow("Location", formatLocation(f.address)),
    docRow("EMR", m.emr ?? "—"),
    docRow("Census Capacity", formatBeds(f.certifiedBeds)),
    docRow(
      "Current Census",
      m.currentCensus != null ? String(m.currentCensus) : "—",
    ),
    docRow("Type of Patient", m.typeOfPatient ?? "—"),
    docRow("Previous Coverage from Medelite", m.previousCoverage ?? "—"),
    docRow(
      "Previous Provider Performance from Medelite",
      m.previousProviderPerformance ?? "—",
    ),
    docRow("Medical Coverage", m.medicalCoverage ?? "—"),
    docRow("Overall Star Rating", formatRating(f.starRatings.overall)),
    docRow("Health Inspection", formatRating(f.starRatings.healthInspection)),
    docRow("Staffing", formatRating(f.starRatings.staffing)),
    docRow("Quality of Resident Care", formatRating(f.starRatings.qualityCare)),
  ];

  // ---- Hospitalization & ED metrics rows (12 rows or D-09 degraded line) ----
  let metricRows: TableRow[];
  if (vm.hospMetrics === undefined) {
    // D-09: single full-width degraded message row
    metricRows = [
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Hospitalization & ED metrics are temporarily unavailable.",
                    italics: true,
                    size: 20,
                    color: "6b7280",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ];
  } else {
    // 12 metric rows — use metric.label VERBATIM (D-04 garbled labels preserved)
    metricRows = vm.hospMetrics.map((metric) =>
      docRow(metric.label, renderMetricValue(metric)),
    );
  }

  const bodyTable = new Table({
    width: { size: TABLE_WIDTH_DXA, type: WidthType.DXA },
    borders: ALL_BORDERS,
    rows: [...bodyRows, ...metricRows],
  });

  // ---- Footer: clickable Medicare link (D-10) + CMS dataset processing date ----
  // ExternalHyperlink uses `link` (NOT `href`) in docx v9 — per 06-RESEARCH.
  // Both "Hyperlink" style AND explicit color/underline for Google Docs compatibility.
  const footerParagraph = new Paragraph({
    spacing: { before: 200 },
    children: [
      new ExternalHyperlink({
        link: f.careCompareUrl,
        children: [
          new TextRun({
            text: "View official CMS profile on Medicare.gov",
            style: "Hyperlink",
            color: "1d4ed8", // no leading "#" — docx hex convention
            underline: {},
          }),
        ],
      }),
      new TextRun({
        text: `   CMS dataset processing date: ${formatDate(f.processingDate)}`,
        color: "9ca3af",
        size: 18,
      }),
    ],
  });

  // ---- Assemble Document ----
  // D-11: title = f.displayName (document metadata only — absent from the visible header).
  return new Document({
    title: f.displayName,
    sections: [
      {
        properties: {
          page: {
            size: {
              width: PAGE_WIDTH_DXA,
              height: PAGE_HEIGHT_DXA,
              orientation: PageOrientation.PORTRAIT,
            },
          },
        },
        children: [
          logoParagraph,
          titleParagraph,
          stateParagraph,
          bodyTable,
          footerParagraph,
        ],
      },
    ],
  });
}
