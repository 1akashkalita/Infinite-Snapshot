---
phase: "06-docx-export"
plan: "03"
subsystem: "export-controls"
tags: ["ExportControls", "docx", "DOCX-01", "template-fill", "JSZip", "OOXML", "D-06", "D-07", "D-08", "D-09", "yellow-stripped", "label-parity", "no-residual-placeholders", "footer-hyperlink", "cms-link", "rule-7", "CR-01-fixed", "WR-01-fixed", "callback-form-replace", "field-length-cap"]
dependency_graph:
  requires:
    - "POST /api/export/docx — 06-02"
    - "POST /api/export/pdf — Phase 04"
    - "ReportViewModel — Phase 02"
    - "claims-mapper labels — Phase 05"
  provides:
    - "buildReportDocxBuffer(vm): Promise<Uint8Array> — template-fill docx builder"
    - "DOCX-01 fully closed: template fidelity guaranteed by filling official .docx"
    - "jszip as direct dependency (was transitive via docx)"
    - "FACILITY_TEMPLATE_DOCX_BASE64 in template.ts (Vercel-safe inline)"
    - "0 residual placeholders; yellow shading stripped; label-parity guard"
    - "Footer paragraph: clickable hyperlink to Medicare Care Compare + CMS dataset processing date (rule #7)"
  affects:
    - "medelite-report/src/lib/docx/ReportDocx.ts"
    - "medelite-report/src/lib/docx/template.ts"
    - "medelite-report/src/lib/docx/facility-assessment-snapshot.template.docx"
    - "medelite-report/src/app/api/export/docx/route.ts"
    - "medelite-report/tests/api/export-docx.test.ts"
    - "medelite-report/package.json"
tech_stack:
  added:
    - "jszip (direct dep, was transitive) — OOXML zip manipulation for template-fill"
  patterns:
    - "Template-fill pattern: decode base64 template → JSZip → XML label-match → fill → re-serialize"
    - "Vercel-safe base64 inlining (same rationale as logo.ts — no filesystem reads in serverless)"
    - "OOXML yellow-strip: regex delete w:fill=\"ffff00\" shading elements before fill"
    - "2-cell row detection: rows with exactly 2 <w:t> tags are label|value rows"
    - "D-09 degraded: hospMetrics undefined → metric rows default to em dash"
    - "Label-parity guard test: all 12 claims-mapper labels must appear in filled output"
key_files:
  created:
    - "medelite-report/src/lib/docx/template.ts"
    - "medelite-report/src/lib/docx/facility-assessment-snapshot.template.docx"
  modified:
    - "medelite-report/src/lib/docx/ReportDocx.ts"
    - "medelite-report/src/app/api/export/docx/route.ts"
    - "medelite-report/tests/api/export-docx.test.ts"
    - "medelite-report/package.json"
    - "medelite-report/package-lock.json"
decisions:
  - "PIVOT: from-scratch docx-primitive builder replaced by template-fill approach (user directive)"
  - "JSZip OOXML manipulation: decode base64 template, regex-fill XML, re-serialize — no docx primitives"
  - "Yellow shading stripped (12x w:fill=ffff00) for visual parity with PDF/web preview"
  - "buildReportDocxBuffer returns Uint8Array; route wraps with Buffer.from() for BodyInit TS compatibility"
  - "Route drops Packer import; docx package retained in package.json (harmless, not removed)"
  - "Task 3 human UAT: NOT marked passed — orchestrator specified human re-verifies rendered output"
  - "FOOTER: clickable Medicare Care Compare hyperlink injected before body sectPr (user chose; CLAUDE.md rule #7 requires clickable CMS link in every export)"
  - "rIdCmsLink guard: assert Id not already present before adding relationship — fails loudly if template changes"
  - "formatDate used for processing date in footer (UTC-safe, D-13)"
  - "CR-01: all dynamic .replace() calls use callback form — string-form replacement-string metacharacters ($&, $1, etc.) cannot corrupt OOXML"
  - "WR-01: manual free-text fields capped at .max(500) / .max(2000); displayName also capped; yields clean 400 on excess"
metrics:
  duration: "~55 minutes"
  completed: "2026-06-20T03:05:00Z"
  tasks: 3
  files: 5
---

# Phase 06 Plan 03: Template-Fill DOCX Builder Summary

## One-liner

Template-fill DOCX builder with CR-01/WR-01 code-review fixes: callback-form replace() prevents $ in user input from corrupting OOXML, field-length caps bound client-controlled export body; 278 tests green including 4 new footgun regression tests (document.xml + rels xmllint well-formed with $-laden input).

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Add jszip dep + commit official template asset | 87f06a8 | `package.json`, `facility-assessment-snapshot.template.docx` |
| 2 | Generate base64 template module (Vercel-safe inlining) | 9eebf3b | `src/lib/docx/template.ts` |
| 3 | Fill official .docx template instead of building from scratch | 2345206 | `src/lib/docx/ReportDocx.ts`, `src/app/api/export/docx/route.ts` |
| 4 | Assert template fill — values present, no residual placeholders, yellow stripped | 3e53f3e | `tests/api/export-docx.test.ts`, `src/lib/docx/template.ts` (base64 fix) |
| 5 | Add clickable Medicare Care Compare link footer to docx (rule #7) | 29a205a | `src/lib/docx/ReportDocx.ts` |
| 6 | Assert docx footer hyperlink + rels relationship | 042e143 | `tests/api/export-docx.test.ts` |
| 7 | Human UAT | — | awaiting re-verification |
| CR-01 | Callback-form replace — $ in input cannot corrupt OOXML | 972b6dc | `src/lib/docx/ReportDocx.ts` |
| WR-01 | Cap manual free-text field lengths to bound DoS surface | 3bfe567 | `src/lib/report/view-model.ts` |
| REG | Footgun regression: dollar-sign input survives docx fill verbatim | d65230e | `tests/api/export-docx.test.ts` |

## What Was Built

### Template-fill approach

The previous from-scratch builder (`buildReportDocx(vm): Document`) used docx primitives and kept producing format bugs (image EMU/px error, tblGrid column collapse). Per user directive, replaced with a template-fill builder (`buildReportDocxBuffer(vm): Promise<Uint8Array>`) that:

1. Decodes `FACILITY_TEMPLATE_DOCX_BASE64` (inlined in `template.ts`) into a Node Buffer.
2. Opens the zip with JSZip; reads `word/document.xml`.
3. Strips the 12 `w:fill="ffff00"` yellow shading markers (CMS fill-from-API markers) for visual parity with the PDF/web preview.
4. Regex-matches each 2-cell table row (`<w:tr>` with exactly 2 `<w:t>` tags) and replaces the value cell content using the MAP built from ReportViewModel.
5. Replaces the standalone `{STATE}` placeholder paragraph.
6. Re-serializes the zip and returns a `Uint8Array`.

MAP covers 13 fixed body rows + 12 metric rows (if `vm.hospMetrics` is defined). D-09 degraded path: unmatched rows default to "—" (em dash).

6. Injects a footer paragraph immediately before the body-level `<w:sectPr>` containing:
   - A blue underlined `<w:hyperlink r:id="rIdCmsLink">` with text "View official CMS profile on Medicare.gov"
   - A grey run with "   CMS dataset processing date: {formatted date}" using `formatDate` (UTC-safe, D-13)
7. Adds a `TargetMode="External"` hyperlink relationship `rIdCmsLink` to `word/_rels/document.xml.rels` pointing to `vm.facility.careCompareUrl`. A guard asserts `rIdCmsLink` is not already present before injection — fails loudly if the template ever changes.
8. Re-serializes the zip and returns a `Uint8Array`.

### Template asset and base64 module

- Committed the official template to `src/lib/docx/facility-assessment-snapshot.template.docx` for provenance.
- Created `src/lib/docx/template.ts` exporting `FACILITY_TEMPLATE_DOCX_BASE64` (27160-char base64, 20370-byte decoded) with regeneration instructions.

### Route update

Replaced `Packer.toBuffer(buildReportDocx(vm))` with `Buffer.from(await buildReportDocxBuffer(vm))`. Dropped the `docx` Packer import. HTTP contract (400 envelopes, MIME type, Content-Disposition, runtime=nodejs) unchanged.

### Tests

Removed obsolete from-scratch guards (wp:extent EMU test, w:gridCol collapse test). Added 10 new template-fill assertions via JSZip unzip of the 200 response:
- Facility name present (`KENDALL LAKES HEALTHCARE AND REHAB CENTER`)
- At least one metric % value present
- 7 specific residual placeholder checks (all absent)
- Yellow markers stripped
- Label-parity guard: all 12 claims-mapper labels present as filled rows

Total: 278 tests passing, 0 failing (up from 274; 4 new CR-01 footgun regression tests added in code-review fix round).

## Code Review Fixes (06-REVIEW.md — CR-01 and WR-01)

### CR-01 Fixed: Callback-form replace — $ in user input cannot corrupt OOXML

**Commit:** 972b6dc

**Issue (confirmed blocker):** `xmlEsc()` escapes the 5 XML special chars (`& < > " '`) but not `$`. The escaped value was placed into the replacement-string argument of `.replace()`, where JS metacharacters `$&`, `$1`, `$$`, `$\``, `$'` are expanded against the match. A user typing `"Cost: $5/visit"` in any free-text field would produce corrupt, unbalanced OOXML that Word refuses to open.

**Fix:** Converted all four dynamic `.replace()` calls to callback (function) form — the callback's return value is always taken verbatim with no `$` interpretation:
1. Value-cell fill inner call: `(_m, open, close) => \`${open}${xmlEsc(value)}${close}\``
2. Value-cell fill outer call: `() => newValTag`
3. Footer sectPr injection: `() => footerP + "<w:sectPr>"`
4. Rels relationship injection: `() => relXml + "</Relationships>"`
The `{STATE}` replacement uses `split().join()` which is already literal-safe and was left unchanged.

**Verification:** xmllint confirmed document.xml and rels well-formed with `$&`-containing input; 4 footgun regression tests (see REG commit d65230e) all pass.

### WR-01 Fixed: Manual free-text field length caps

**Commit:** 3bfe567

**Issue:** `emr`, `typeOfPatient`, `medicalCoverage`, `previousProviderPerformance`, and the client-controlled `displayName` (derived from `nameOverride`) were bare `z.string()` with no upper bound. The full ReportViewModel is POSTed by the client to `/api/export/docx`; a multi-megabyte string would be accepted, embedded into document XML, and zipped server-side.

**Fix:** Added `.max()` to each free-text field in `ReportViewModelSchema` — generous-but-bounded limits that yield the existing clean 400 envelope on excess:
- `manual.emr`: `.max(500)`
- `manual.typeOfPatient`: `.max(500)`
- `manual.medicalCoverage`: `.max(2000)`
- `manual.previousProviderPerformance`: `.max(2000)`
- `facility.displayName`: `.max(500)`
Field optionality/nullability and all report logic unchanged. No existing test values exceed these caps.

### WR-02 Mitigated: Residual-placeholder test covers current template

WR-02 (multi-run row silently skips) is a latent trap if the template is re-saved from Word. The existing no-residual-placeholder tests provide a runtime guard: any unfilled row would leave its original XML placeholder visible. Tracked as a follow-up item; current template uses single-run cells.

### WR-03 / WR-04 Accepted as-is

WR-03 (`formatBeds` locale-grouped digits) and WR-04 (`formatDate` "Invalid Date" on bad format) are pre-existing formatter behaviors. `processingDate` comes from a verified CMS fixture string. Both are deferred as follow-up improvements; they do not affect correctness under normal CMS data.

### IN-01 / IN-02 / IN-03 Style accepted

IN-01 (duplicated `renderMetricValue`), IN-02 (hardcoded format list), IN-03 (hardcoded footer colors) are acknowledged style items. Kept as-is for now; refactoring deferred to a future polish pass.

## Deviations from Plan

### Template-fill pivot (user directive — replaces D-06/D-07 from-scratch approach)

**Found during:** Prior human UAT rounds (repeated format bugs with docx primitives)
**Issue:** The from-scratch approach using `docx` library primitives kept producing format bugs: EMU/px confusion on logo, tblGrid column collapse. The user proved the template-fill approach works via a standalone prototype.
**Fix:** Replaced the entire `buildReportDocx` builder with `buildReportDocxBuffer` using JSZip + OOXML XML manipulation on the official template. All 25 rows filled correctly (0 unmatched, 0 residual placeholders) and rendered correctly in the verified prototype.
**Decision tag:** PIVOT — replaces D-06/D-07 decisions

### Yellow shading stripped (per proven_template_facts)

**Found during:** Template analysis
**Why:** The template's 12 metric rows have `w:fill="ffff00"` (yellow) as CMS fill-from-API markers. The PDF/web preview have no yellow. Stripping them for visual parity.
**Impact:** No functional change — purely cosmetic. Matches PDF output.

### Buffer.from() cast for BodyInit TypeScript constraint

**Found during:** TypeScript check
**Issue:** JSZip's `generateAsync({ type: "uint8array" })` returns `Uint8Array<ArrayBufferLike>`, which TypeScript strict lib does not accept as `BodyInit`.
**Fix:** `Buffer.from(await buildReportDocxBuffer(vm))` — Buffer extends `Uint8Array<ArrayBuffer>` and satisfies BodyInit (same cast as PDF route uses for pdfBuffer).

## Checkpoint: Human UAT Required

Task 7 is a `checkpoint:human-verify` gate. The orchestrator explicitly specified: **do NOT mark the human-UAT passed — the human re-verifies the rendered output.**

**Re-verification steps:**
1. From `medelite-report/`, run `npm run dev` and open http://localhost:3000.
2. Enter CCN `686123`, submit, wait for the preview to populate.
3. Flip the toggle to DOCX, click "Download DOCX".
4. Open the downloaded `.docx` in Microsoft Word or Google Docs.
5. Confirm: static INFINITE/Medelite header + "FACILITY ASSESSMENT SNAPSHOT" branding visible (from template logo — not derived from facility name per CLAUDE.md rule #2); 13 body rows + 12 metric rows filled with correct values; no yellow shading; no residual placeholders; state line (FL) present.
6. Confirm the footer below the table: a blue underlined clickable "View official CMS profile on Medicare.gov" link that opens https://www.medicare.gov/care-compare/details/nursing-home/686123, plus a grey "CMS dataset processing date: ..." line.
7. Confirm content matches the live web preview.

**Status:** Awaiting human re-verification.

## Known Stubs

None. `buildReportDocxBuffer` is fully functional. All 25 template rows filled.

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundary changes. Template fill is entirely server-side (route handler only). The base64-inlined template adds no runtime filesystem access.

## Deviations — Footer Addition

### User-directed footer: clickable Medicare Care Compare link (CLAUDE.md rule #7)

**Found during:** Human review / user explicit choice
**Issue:** The official template has no footer, but CLAUDE.md rule #7 requires a clickable CMS link in the .docx export (consistent with the PDF). The project's core value is "Enter a CCN → instantly get an accurate, polished, downloadable facility snapshot" — the clickable Medicare link is a core correctness requirement.
**Fix:** Inject a footer paragraph (blue underlined hyperlink + grey processing date) before the body-level `<w:sectPr>` and add `rIdCmsLink` External relationship to `word/_rels/document.xml.rels`. Proven via LibreOffice render before productionization. Guard added to fail loudly if template ever pre-assigns `rIdCmsLink`.
**Decision:** User explicitly chose to add this (confirmed in orchestrator objective).

## Polish Fixes (post-approval)

Three small targeted fixes applied after the user approved the .docx output:

### Fix 1: Right-align docx footer processing date

**File:** `medelite-report/src/lib/docx/ReportDocx.ts`

Added a right tab stop at `w:pos="9600"` (table width in dxa) to the footer paragraph's `<w:pPr>` and replaced the three leading-space padding in the date run with a `<w:tab/>` element. The `<w:tab/>` jumps to the right tab stop so the date text right-aligns to the table's right edge. The hyperlink on the left is unchanged.

Test assertion added: the generated `document.xml` must contain `w:val="right"` and `w:pos="9600"` in a tab stop element.

**Commit:** 8f9d2d0

### Fix 2: Equal-width PDF/DOCX toggle buttons

**File:** `medelite-report/src/components/ExportControls.tsx`

Added `flex-1 text-center` to each toggle button's className. The container is already `flex overflow-hidden`, so `flex-1` on each button makes PDF and DOCX split the container 50/50 regardless of label character count.

**Commit:** 86f9288

### Fix 3: CCN input/placeholder text styling matches other fields

**File:** `medelite-report/src/components/CCNSearchBar.tsx`

Added `text-zinc-900 placeholder:text-zinc-400` to the CCN `<input>` className. ManualInputsForm already uses these classes; the CCN input now matches. Box dimensions, border, and focus ring are unchanged.

**Commit:** f0512c1

## Self-Check: PASSED

- `medelite-report/src/lib/docx/facility-assessment-snapshot.template.docx` — exists (committed)
- `medelite-report/src/lib/docx/template.ts` — exists (base64 27160 chars, PK-magic verified)
- `medelite-report/src/lib/docx/ReportDocx.ts` — exists (buildReportDocxBuffer with callback-form replace, CR-01 fix)
- `medelite-report/src/lib/report/view-model.ts` — exists (manual field .max() caps, WR-01 fix)
- `medelite-report/src/app/api/export/docx/route.ts` — exists (uses buildReportDocxBuffer)
- `medelite-report/tests/api/export-docx.test.ts` — exists (278 tests all passing, 4 new footgun regression tests)
- Commits: 87f06a8, 9eebf3b, 2345206, 3e53f3e, 29a205a, 042e143, bace7f2, 972b6dc, 3bfe567, d65230e
- `npm run verify` — exit 0 (278 tests passed, 1 skipped)
- `xmllint --noout` on generated document.xml and rels with $-laden input — WELL-FORMED
- Literal `$&`, `$1`, `$$` survive in document.xml verbatim (XML-escaped form)
- `</Relationships>` appears exactly once in rels with $-laden careCompareUrl
