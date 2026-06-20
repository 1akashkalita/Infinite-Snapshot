---
phase: "06-docx-export"
plan: "01"
subsystem: "docx-export"
tags: ["docx", "slug", "server-only", "D-13", "DOCX-01"]
dependency_graph:
  requires: []
  provides:
    - "slugFilename(name, ccn, ext) with ext defaulting to .pdf — backward-compatible"
    - "buildReportDocx(vm): Document — server-only docx builder twin of ReportPDF"
  affects:
    - "medelite-report/src/lib/report/slug.ts"
    - "medelite-report/src/lib/docx/ReportDocx.ts"
tech_stack:
  added:
    - "docx v9 primitives: Document, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, ExternalHyperlink, AlignmentType, WidthType, BorderStyle, PageOrientation"
  patterns:
    - "Server-only module discipline (no 'use client', imported only by route)"
    - "Hand-port of ReportPDF rows to docx idiom (D-07 — no shared abstraction)"
    - "EMU dimensions for ImageRun (1 inch = 914400 EMU)"
    - "link: (not href:) on ExternalHyperlink per docx v9 API"
key_files:
  created:
    - "medelite-report/src/lib/docx/ReportDocx.ts"
  modified:
    - "medelite-report/src/lib/report/slug.ts"
    - "medelite-report/tests/lib/slug.test.ts"
decisions:
  - "D-13: ext param on slugFilename defaults to .pdf so all existing PDF callers are unaffected; ext is route-supplied (never user input) so no sanitization needed"
  - "Logo EMU target: 1_828_800 EMU wide (~2 inches); height derived proportionally from INFINITE_LOGO_HEIGHT/INFINITE_LOGO_WIDTH"
  - "ALL_BORDERS applied at table level (insideHorizontal + insideVertical) for clean single-line grid without per-cell border duplication"
  - "Packer lives in the route (Plan 02), not in the builder — buildReportDocx returns Document only"
metrics:
  duration: "~13 minutes"
  completed: "2026-06-20T00:57:11Z"
  tasks: 2
  files: 3
---

# Phase 06 Plan 01: Slug Generalization + ReportDocx Builder Summary

## One-liner

Generalized `slugFilename` with `ext` param (D-13) and built `ReportDocx.ts`, a server-only `docx` v9 Document builder that faithfully twins `ReportPDF.tsx` — static INFINITE logo header, 13 body rows + 12 metric rows, `ExternalHyperlink` Medicare link.

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Generalize slugFilename with ext param (D-13) | de58017 | `src/lib/report/slug.ts`, `tests/lib/slug.test.ts` |
| 2 | Build ReportDocx.ts — server-only docx builder | 0429d87 | `src/lib/docx/ReportDocx.ts` |

## What Was Built

### Task 1: slugFilename ext parameter (D-13)

Changed the signature of `slugFilename` from `(displayName, ccn)` to `(displayName, ccn, ext = ".pdf")`. Both hardcoded `-Snapshot.pdf` literals in the if-branch and CCN-fallback branch were replaced with `-Snapshot${ext}`. All existing sanitization logic (CR-01 / T-04-03 allowlist) was left exactly as-is.

Added 3 new assertions to `tests/lib/slug.test.ts`:
- D-13: `.docx` extension with a real facility name
- D-13: `.docx` extension with blank displayName (CCN fallback carries the ext)
- D-13: no third arg defaults to `.pdf` (backward-compat)

All 11 slug tests pass. Zero existing PDF assertions changed.

### Task 2: ReportDocx.ts builder

Created `src/lib/docx/ReportDocx.ts` exporting `buildReportDocx(vm: ReportViewModel): Document`:

**Header (rule #2 static branding):**
- `ImageRun` with `type: "png"` (required in docx v9), base64 decoded from `INFINITE_LOGO_DATA_URI`, dimensions in EMU (~2 inches wide = 1_828_800 EMU, height proportional)
- `vm.header.reportTitle` (bold, size 26) and `vm.header.stateLine` (bold, size 22), both centered
- `f.displayName` never appears in the header — only in the body and Document title metadata (D-11)

**Body table:**
- `Table` with `ALL_BORDERS` (single 6-twip black lines on all 6 border keys including insideHorizontal/insideVertical)
- Width: 9360 DXA; label cell: ~42% (3931 DXA), value cell: remainder
- 13 rows in template-exact order with verbatim labels, same formatters and em-dash fallbacks as `ReportPDF.tsx`
- 12 metric rows using `metric.label` verbatim (D-04 garbled labels preserved); degraded single `columnSpan: 2` row when `vm.hospMetrics === undefined` (D-09)
- `renderMetricValue` helper copied verbatim from `ReportPDF.tsx`

**Footer:**
- `ExternalHyperlink` with `link:` (not `href:`) — per docx v9 `IExternalHyperlinkOptions`
- `style: "Hyperlink"` AND explicit `color: "1d4ed8"`, `underline: {}` for Google Docs compat
- Label text "View official CMS profile on Medicare.gov" verbatim (D-10)
- CMS processing date via `formatDate(f.processingDate)` in grey

## Verification

- `npx vitest run tests/lib/slug.test.ts` — 11/11 pass (GREEN)
- `npx tsc --noEmit` — 0 errors
- `npm run verify` — all 4 checks pass (typecheck + lint + format + 245 tests)
- `grep -n '"use client"' src/lib/docx/ReportDocx.ts` — no result (server-only)
- `grep "Packer" src/lib/docx/ReportDocx.ts` — only in JSDoc comment, no import

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. `buildReportDocx` is a complete server-side builder consuming real `ReportViewModel` data.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The `slugFilename` generalization does not touch sanitization logic (CR-01 / T-04-03 preserved). `ReportDocx.ts` is server-only — no client bundle surface.

## Self-Check: PASSED

- `medelite-report/src/lib/report/slug.ts` — exists, modified
- `medelite-report/tests/lib/slug.test.ts` — exists, extended
- `medelite-report/src/lib/docx/ReportDocx.ts` — exists, created
- Commit de58017 — `git log --oneline | grep de58017` — found
- Commit 0429d87 — `git log --oneline | grep 0429d87` — found
