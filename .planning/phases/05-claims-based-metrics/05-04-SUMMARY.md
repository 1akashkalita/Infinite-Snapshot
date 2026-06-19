---
phase: 05-claims-based-metrics
plan: "04"
subsystem: web-ui, pdf-export, report-rendering
tags: [hospmetrics, report-preview, report-pdf, template-fidelity, logo, react-pdf, checkpoint, e2e-slice]
dependency_graph:
  requires:
    - "05-03: hospMetrics inside ReportViewModelSchema, assembleViewModel 4th param, GET /api/facility fan-out"
    - "05-02: HospMetric interface, joinClaimsAndAverages, verbatim labels"
    - "05-01: formatFootnote, ClaimsRowSchema, AveragesRowSchema"
    - "04-01/04-02: ReportPDF, POST /api/export/pdf, DownloadPdfButton"
    - "03-03: ReportPreview, ManualInputsForm, SnapshotApp"
  provides:
    - "hospMetrics threaded from /api/facility response through SnapshotApp into assembleViewModel (4th arg)"
    - "ReportPreview + ReportPDF rebuilt to replicate the official Facility Assessment Snapshot template"
    - "INFINITE logo image (src/lib/report/logo.ts data-URI) in web preview + PDF header"
    - "Bordered 2-column template table (25 rows) with the 12 verbatim hospitalization/ED metric rows"
    - "Visible end-to-end slice: CCN 686123 lookup renders all 12 data points in preview AND downloaded PDF"
  affects:
    - "Phase 6: DOCX renderer should mirror the same template table + logo header"
    - "Phase 7: charts/cards read the same vm.hospMetrics"
tech_stack:
  added: []
  patterns:
    - "Logo as base64 data-URI module (src/lib/report/logo.ts) — single Vercel-safe source for web <img> + react-pdf <Image>; no /public path lookup, no render-time fs/network"
    - "react-pdf bordered table: container View has top+left borders, each cell has bottom+right borders → single-line grid (no border-collapse in Yoga)"
    - "Bold labels = Helvetica-Bold, italic values = Helvetica-Oblique (built-in base-14 fonts — local==Vercel parity, no Font.register)"
    - "Web preview mirrors PDF 1:1 (D-01): HTML <table> with border-collapse, same logo/labels/order/values"
    - "Single-page US Letter: row paddingVertical 4 keeps all 25 rows + header + footer on page 1"
key_files:
  created:
    - medelite-report/src/lib/report/logo.ts
    - medelite-report/public/infinite-logo.png
  modified:
    - medelite-report/src/components/SnapshotApp.tsx
    - medelite-report/src/components/ReportPreview.tsx
    - medelite-report/src/components/pdf/ReportPDF.tsx
    - medelite-report/tests/api/export-pdf.test.ts
    - CLAUDE.md
decisions:
  - "DEC-TEMPLATE (05-04): preview + PDF replicate the official Facility Assessment Snapshot template (logo header, bordered 2-column table, verbatim labels/order). Reconstructed Phase-3 layout replaced. Source of truth: Downloads/Facility Assessment Snapshot.docx + the rendered example PDF."
  - "DEC-LOGO (05-04): header branding uses the INFINITE/Managed-by-MEDELITE LOGO IMAGE (template image1.png), inlined as a data URI (src/lib/report/logo.ts). Updates CLAUDE.md rule #2 (was: exact static string). Still never the facility name; assembleHeader still state-only; platformLine string survives as the logo alt text."
  - "DEC-NO-HIGHLIGHT (05-04): the 12 metric rows are NOT highlighted in the final report. The blank template's 12 yellow (ffff00) cells were a fill-from-API marker — the FILLED example PDF (rendered + inspected) has no highlight."
  - "DEC-MANUAL-FORM (05-04): the six manual fields stay form-entered (ManualInputsForm); they are NOT seeded with example values. User decision."
  - "DEC-ADDR-NAME-RAW (05-04): name + address remain raw CMS pass-through (UPPERCASE, '157 AVENUE', no ZIP) — NOT normalized to the example's Title Case. Reaffirms DEC-ADDR-PASSTHROUGH (03-03). User decision."
  - "Footer keeps the required clickable Medicare Care Compare link (rule #7) + CMS processing date, below the table (not part of the template, but rule #7 is non-negotiable)."
  - "Example-doc values (census 120, ratings 1/1/2/4, metrics 18.7%/1.86) are ILLUSTRATIVE. Live CMS + the Phase-1 captured fixture both give census 150 and ratings 5/5/2/5 — the app correctly shows live CMS truth (CLAUDE.md: match labels/order, not numbers)."
metrics:
  duration: "~75 min (incl. checkpoint resolution + template rebuild)"
  completed: "2026-06-19"
  tasks_completed: 3
  files_modified: 7
requirements: [CLM-01, CLM-02, CLM-03]
---

# Phase 05 Plan 04: Visible End-to-End Slice + Template Fidelity Summary

**One-liner:** Wired hospMetrics from the API through SnapshotApp into the view-model and rendered the 12 metric rows in preview + PDF — then, at the blocking visual checkpoint, rebuilt both renderers to faithfully replicate the official Facility Assessment Snapshot template (logo, bordered table, verbatim labels) with live CMS data.

## What Was Built

### Task 1 — hospMetrics through SnapshotApp (commit `5ab5e15`)
`SnapshotApp.tsx` gained a `hospMetrics` state slot. On a successful fetch it captures `json.hospMetrics` alongside `setFacilityData`; on every error/network branch it clears to `undefined` (D-09 degraded state). The `assembleViewModel(...)` call passes `hospMetrics` as the 4th arg.

### Task 2 — 12 metric rows in preview + PDF (commit `094dd37`)
Both `ReportPreview.tsx` and `ReportPDF.tsx` appended the 12 verbatim-labeled rows after "Quality of Resident Care" (or the single degraded line when `hospMetrics === undefined`). The PDF export test was extended with `extractTextFromPdf` (decompresses the FlateDecode content stream, decodes hex-encoded TJ glyph operators) to assert both a clean label ("Short Term Hospitalization") and a garbled label ("STR State National Avg. for Hospitalization") render in the PDF buffer (CLM-03 garble fidelity).

### Task 3 — blocking visual checkpoint → template-fidelity rebuild (commit `2e90fb8`)
The `autonomous: false` checkpoint required human visual verification. The user provided the **official template** (`Facility Assessment Snapshot.docx`) and the **filled example** (`Kendall Lakes Healthcare and Rehab Center.pdf`) and flagged that the output did not replicate the template. Investigation (extracted docx table/highlights, rendered the example PDF, cross-checked the live API and Phase-1 fixture) established:

- The report had never been built to the actual template — Phase 3 reconstructed the field list (correct labels/order) but rendered a clean modern layout, not the template's bordered table.
- The 12 metric rows must NOT be highlighted (the blank template's yellow was a fill-from-API marker; the filled example has none).
- All CMS value differences vs. the example are the example being illustrative (census 150 not 120, ratings 5/5/2/5 not 1/1/2/4 — confirmed in BOTH the live API and the captured fixture).

Rebuild (after three user decisions — logo image, form-entered manual fields, raw CMS name/address):
- New `src/lib/report/logo.ts` — the INFINITE/Managed-by-MEDELITE logo (from the template's `image1.png`, 224×51) as a base64 data URI; single Vercel-safe source for web `<img>` and react-pdf `<Image>`.
- `ReportPreview.tsx` — logo header + "FACILITY ASSESSMENT SNAPSHOT" + state + bordered HTML `<table>` (bold labels, italic values), 25 rows, footer link.
- `ReportPDF.tsx` — same in react-pdf: `<Image>` logo, per-cell-bordered table (single-line grid), Helvetica-Bold labels / Helvetica-Oblique values, single US-Letter page (row paddingVertical 4), kept the clickable Medicare `<Link>` (rule #7).
- `CLAUDE.md` rule #2 updated: branding is the static logo image.

## Verification

- `npm run verify` green: typecheck, lint, format:check, test (238 tests, 1 skipped — env-gated live API test).
- **Live E2E:** `GET /api/facility?ccn=686123` against the real CMS API returned all 12 hospMetrics with correct verbatim labels, units (rows 1–6 percent, 7–12 rate), and live values.
- **Rendered PDF inspected** (pdftoppm): single page, logo + centered title/state, full bordered 25-row table, no yellow highlight, footer with Medicare link + processing date. Matches the template structure; values are live CMS.
- **User approved** the visual checkpoint after reviewing the rendered output.

## Deviations from Plan

**[Scope expansion — template fidelity] The checkpoint surfaced that the entire report body (Phase 3/4 rendering) did not replicate the official template.** Resolution exceeded the original plan's "append 12 rows" scope: both renderers were rebuilt (table + logo + single-page layout) and CLAUDE.md rule #2 was amended (logo image). Three product decisions were taken with the user (logo image; manual fields stay form-entered; name/address stay raw CMS). The 12-metric data path itself (Tasks 1–2) was unaffected and correct.

## Tests

| File | Change | Approach |
|------|--------|----------|
| `tests/api/export-pdf.test.ts` | +2 cases (Task 2) | `extractTextFromPdf` asserts clean + garbled metric labels render in the PDF buffer (CLM-03) |

The export-pdf suite still pins the invariants the rebuild had to preserve: Medicare URL present (rule #7), Helvetica-Bold present (bold rendering), facility name in Document title metadata (rule #2), and the verbatim metric labels.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `5ab5e15` | feat(05-04): thread hospMetrics from API response through SnapshotApp into assembleViewModel |
| Task 2 | `094dd37` | feat(05-04): append 12 verbatim metric rows to ReportPreview + ReportPDF; extend PDF test (CLM-01/02/03) |
| Task 3 | `2e90fb8` | fix(05-04): render preview + PDF as the Facility Assessment Snapshot template |

## Self-Check: PASSED

- `src/lib/report/logo.ts` exports `INFINITE_LOGO_DATA_URI` — FOUND
- `ReportPreview.tsx` renders the logo, a bordered `<table>`, and iterates `vm.hospMetrics` — VERIFIED
- `ReportPDF.tsx` uses `<Image>` logo, per-cell borders, keeps `<Link src={f.careCompareUrl}>` (rule #7) — VERIFIED
- 12 metric rows render with live values for CCN 686123 (live E2E) — VERIFIED
- No yellow highlight on metric rows (matches filled example) — VERIFIED (rendered PDF)
- CLAUDE.md rule #2 updated to logo image — VERIFIED
- Commits `5ab5e15`, `094dd37`, `2e90fb8` exist — VERIFIED
- `npm run verify` green (238 tests, 1 skipped) — VERIFIED
