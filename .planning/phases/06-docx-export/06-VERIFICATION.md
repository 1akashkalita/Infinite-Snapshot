---
phase: 06-docx-export
verified: 2026-06-20T11:35:00Z
status: human_needed
score: 3/3 must-haves verified
overrides_applied: 0
re_verification: null
gaps: []
human_verification:
  - test: "Download DOCX triggers a direct browser download that opens cleanly in Microsoft Word or Google Docs"
    expected: "The .docx file opens without a repair prompt; the static INFINITE / FACILITY ASSESSMENT SNAPSHOT / FL header is present (from the committed template image, not the facility name); all 13 body rows show correct values; all 12 hospitalization/ED metric rows are present with the reference labels and order; the footer shows a blue underlined clickable link 'View official CMS profile on Medicare.gov' that opens https://www.medicare.gov/care-compare/details/nursing-home/686123, and a grey 'CMS dataset processing date:' line right-aligned"
    why_human: "Application rendering fidelity in Word / Google Docs cannot be verified by grep or unit tests; the template-fill approach relies on OOXML XML being accepted by two distinct rendering engines — only a live open of the downloaded file confirms this"
  - test: "The .docx content matches the live web preview for the same CCN 686123 inputs"
    expected: "Facility name, location, star ratings, manual inputs (including blank-field em dashes), and all 12 claims metric values in the .docx match what the web preview shows for the same search"
    why_human: "Cross-output consistency (docx vs. web preview vs. PDF) requires visual comparison; the unit tests confirm structure but cannot assert visual rendering parity"
  - test: "Switching the toggle back to PDF after a DOCX download still works"
    expected: "The PDF route continues to produce a valid PDF download; no regression in the existing PDF export after ExportControls replaced DownloadPdfButton"
    why_human: "Integration behavior across both export formats in the same browser session cannot be tested programmatically in the current test harness"
---

# Phase 6: .docx Export Verification Report

**Phase Goal:** A user can click "Download DOCX" and receive a Word document with content matching the live preview, generated server-side, well under the 4.5 MB Vercel response limit.
**Verified:** 2026-06-20T11:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Implementation Note

The phase delivered via an intentional pivot from the originally-planned `docx`-primitive from-scratch builder to a template-fill approach (JSZip + OOXML XML manipulation on the committed official template). This pivot was user-directed after the from-scratch approach repeatedly produced format bugs (EMU/px error, tblGrid column collapse). The assessment below evaluates the actual implementation against the phase goal and DOCX-01 requirement, not against the original mechanism.

## Goal Achievement

### Observable Truths (ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Clicking "Download DOCX" triggers a direct browser download of a `.docx` file that opens cleanly in Microsoft Word or Google Docs | VERIFIED (automated) + HUMAN NEEDED (rendering) | `ExportControls` wired in `SnapshotApp` (line 37 import, line 198 `<ExportControls vm={vm} />`); POST to `/api/export/docx` returns 200 with PK ZIP magic bytes proven by test; human visual rendering in Word/Docs required |
| 2 | The .docx content matches the web preview: static header block, facility data, all manual inputs, and the claims metrics section | VERIFIED (structural) + HUMAN NEEDED (visual parity) | 13 body-row labels in `buildValueMap`, 12 metric rows via `vm.hospMetrics`, template-fill assertions confirm all 12 claims-mapper labels present and facility name filled; visual parity requires human check |
| 3 | Route handler test asserts `Buffer.byteLength(docxBuffer) < 4_500_000` and correct `Content-Type` / `Content-Disposition` headers | VERIFIED | `tests/api/export-docx.test.ts` line 138: `expect(Buffer.byteLength(buf)).toBeLessThan(4_500_000)` — passes; OOXML MIME and `.docx` Content-Disposition both asserted and green |

**Score:** 3/3 truths verified at automation level; 2/3 have human-only components (rendering fidelity)

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `medelite-report/src/lib/docx/ReportDocx.ts` | Template-fill docx builder returning `Promise<Uint8Array>` | VERIFIED | Exists, 225 lines; exports `buildReportDocxBuffer`; imports JSZip, format helpers, template base64; no `"use client"` |
| `medelite-report/src/lib/docx/template.ts` | Base64-inlined Word template (Vercel-safe, no filesystem reads) | VERIFIED | Exists, 28 KB; exports `FACILITY_TEMPLATE_DOCX_BASE64`; decoded size is 20,370 bytes |
| `medelite-report/src/lib/docx/facility-assessment-snapshot.template.docx` | Committed official template for provenance | VERIFIED | Exists, 20,370 bytes |
| `medelite-report/src/app/api/export/docx/route.ts` | POST handler: validate → buildReportDocxBuffer → headers | VERIFIED | Exists; `export const runtime = "nodejs"`; `ReportViewModelSchema.safeParse`; `slugFilename(..., ".docx")`; clean 400 envelope |
| `medelite-report/tests/api/export-docx.test.ts` | Full DOCX-01 route test suite | VERIFIED | Exists; 33 tests (13 route + 10 template-fill + 4 CR-01 footgun regression + 6 additional asserts); all 33 pass |
| `medelite-report/src/components/ExportControls.tsx` | Unified client export control (PDF|DOCX toggle + Download button) | VERIFIED | Exists; `"use client"`; only imports `ReportViewModel` as a type; `aria-pressed`; `format` state defaults to `"pdf"`; button label tracks format |
| `medelite-report/src/components/SnapshotApp.tsx` | Wired to ExportControls | VERIFIED | Line 37: `import { ExportControls } from "@/components/ExportControls"`; line 198: `<ExportControls vm={vm} />` |
| `medelite-report/src/lib/report/slug.ts` | `slugFilename(name, ccn, ext=".pdf")` generalized | VERIFIED | `ext = ".pdf"` default; no bare `-Snapshot.pdf` literals; backward-compatible |
| `medelite-report/src/lib/report/view-model.ts` | Manual field `.max()` caps (WR-01 fix) | VERIFIED | `displayName: .max(500)`; `emr: .max(500)`; `typeOfPatient: .max(500)`; `medicalCoverage: .max(2000)`; `previousProviderPerformance: .max(2000)` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ExportControls.tsx` | `/api/export/${format}` | `fetch POST → Blob → silent anchor download` | VERIFIED | Line 62: `fetch(\`/api/export/${format}\`, ...)`; blob handling and deferred `revokeObjectURL` present |
| `SnapshotApp.tsx` | `ExportControls.tsx` | `import + <ExportControls vm={vm} />` | VERIFIED | Import line 37; JSX line 198 |
| `route.ts` | `ReportDocx.ts` | `buildReportDocxBuffer` import | VERIFIED | Line 18: `import { buildReportDocxBuffer } from "@/lib/docx/ReportDocx"`; line 71: called with `parseResult.data` |
| `route.ts` | `view-model.ts` | `ReportViewModelSchema.safeParse(body)` | VERIFIED | Line 50: `ReportViewModelSchema.safeParse(body)` — Zod validation on untrusted POST body |
| `route.ts` | `slug.ts` | `slugFilename(displayName, ccn, ".docx")` | VERIFIED | Lines 72-76: `slugFilename(parseResult.data.facility.displayName, parseResult.data.facility.ccn, ".docx")` |
| `ReportDocx.ts` | `template.ts` | `FACILITY_TEMPLATE_DOCX_BASE64` import | VERIFIED | Line 36: `import { FACILITY_TEMPLATE_DOCX_BASE64 } from "@/lib/docx/template"` |
| `ReportDocx.ts` | `format.ts` | format helpers (rating, beds, location, percent, rate, footnote, date) | VERIFIED | Lines 27-35: all 7 format helpers imported |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `buildReportDocxBuffer` | `MAP` (label→value record) | `buildValueMap(vm)` uses `vm.facility`, `vm.manual`, `vm.hospMetrics` | Yes — all fields derived from Zod-validated `ReportViewModel` passed from `ReportViewModelSchema.safeParse(body)` in the route | FLOWING |
| `route.ts` | `docxBuffer` | `await buildReportDocxBuffer(parseResult.data)` | Yes — real OOXML bytes returned; PK magic bytes asserted by test | FLOWING |
| `ExportControls.tsx` | blob response | `fetch POST → resp.blob()` | Yes — only called when `vm` is non-null (D-07 guard); response is real OOXML from the server route | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 33 DOCX route + template-fill tests pass | `npx vitest run tests/api/export-docx.test.ts` | 33/33 passed | PASS |
| 11 slug tests pass (including .docx backward-compat) | `npx vitest run tests/lib/slug.test.ts` | 11/11 passed | PASS |
| Full verify gate (typecheck + lint + format:check + 278 tests) | `npm run verify` | All checks passed | PASS |
| ExportControls has no server-only imports | `grep "^import" ExportControls.tsx` | Only `useState` from react and `import type { ReportViewModel }` | PASS |
| CR-01: callback-form replace on all 4 dynamic .replace() calls | `grep "() =>" ReportDocx.ts` | Lines 169, 173, 195, 217 — all use callback form | PASS |
| WR-01: manual field .max() bounds present | `grep ".max(" view-model.ts` | `.max(500)` / `.max(2000)` on all 5 free-text fields | PASS |
| No server-only modules in client bundle (no "use client" in ReportDocx.ts) | `grep "use client" ReportDocx.ts` | No match — server-only confirmed | PASS |

### Probe Execution

No probe scripts declared for this phase. Step 7c: SKIPPED (no probe files found under `scripts/*/tests/probe-*.sh`).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DOCX-01 | 06-01, 06-02, 06-03 | User can download a `.docx` version of the report alongside the PDF, with matching content | SATISFIED | Route exists and returns valid OOXML; ExportControls wired in SnapshotApp; 33 tests green; size < 4.5 MB confirmed |

**Orphaned requirements:** None. REQUIREMENTS.md maps only DOCX-01 to Phase 6; it is fully claimed and covered.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `ReportDocx.ts` lines 14, 149, 156, 176 | "placeholder" word in comments | Info | These are comments about the Word template's fill-target markers — not code stubs. The word "placeholder" describes what the template CONTAINS, not what the code is. No stub behavior present. |

No `TBD`, `FIXME`, or `XXX` markers in any phase-modified file. No `return null` / `return []` / `return {}` stubs in implementation files. No empty handlers in ExportControls — `handleDownload` has full fetch + blob + anchor download logic.

**WR-02 acknowledged (not a blocker):** The 2-cell `<w:t>` row matching in `ReportDocx.ts` (lines 151-165) silently skips rows where a label or value is split across multiple OOXML runs. This works today because the committed template uses single-run cells. The template-fill assertions (no residual placeholders, facility name present) provide a runtime guard — any unfilled row would leave its original placeholder text visible in the test output. Tracked as latent; not a current defect.

**WR-03, WR-04 accepted as-is:** `formatBeds` locale dependency and `formatDate` "Invalid Date" on non-date strings are pre-existing behaviors, not introduced by this phase. `processingDate` comes from a verified CMS response. Not a blocker.

### Human Verification Required

#### 1. .docx Opens Cleanly in Word and Google Docs

**Test:** From `medelite-report/`, run `npm run dev`, open http://localhost:3000, enter CCN `686123`, submit, flip the toggle to DOCX, click "Download DOCX". Open the downloaded `.docx` in Microsoft Word AND in Google Docs.

**Expected:** The file opens without a repair/recovery prompt in both applications. The document shows: (1) the static INFINITE / Managed by MEDELITE logo image and "FACILITY ASSESSMENT SNAPSHOT" header at the top from the committed template — not the facility name; (2) "FL" state abbreviation; (3) all 13 body rows filled with facility data and em dashes for blank manual fields; (4) all 12 hospitalization/ED metric rows with their exact reference labels; (5) a blue underlined footer hyperlink "View official CMS profile on Medicare.gov" that opens `https://www.medicare.gov/care-compare/details/nursing-home/686123`; (6) a grey "CMS dataset processing date:" line right-aligned in the footer.

**Why human:** OOXML template-fill rendering in Word / Google Docs requires a live application open. The unit tests confirm PK ZIP magic bytes, XML structure, filled values in `document.xml`, and rels relationship wiring — but cannot assert that Word's renderer accepts the OOXML without a repair prompt or that Google Docs renders the hyperlink correctly.

#### 2. .docx Content Matches the Live Web Preview

**Test:** While the web preview for CCN 686123 is visible, compare the downloaded .docx side-by-side: facility name, location, all 4 star ratings, all 12 hospitalization/ED values (facility value, national avg, state avg for each of the 4 measures).

**Expected:** All values in the .docx match the web preview for the same lookup. No "N/A" vs "—" mismatches; no metric rows showing em dashes when the preview shows real values.

**Why human:** Cross-output consistency requires visual comparison. The unit tests confirm structural correctness (label-parity, value fills) but cannot assert that the specific numeric values rendered in the .docx match those shown in the preview for a live lookup.

#### 3. PDF Export Regression Check

**Test:** After downloading a .docx, flip the ExportControls toggle back to "PDF" and click "Download PDF".

**Expected:** A valid PDF downloads with the same content as before. No regression introduced by the replacement of `DownloadPdfButton` with `ExportControls`.

**Why human:** The PDF route and `@react-pdf/renderer` integration require a live browser download to confirm the blob is a valid PDF that opens correctly. The test suite covers the PDF route in isolation but not the ExportControls-initiated PDF flow end-to-end.

### Gaps Summary

No automated gaps. All 3 ROADMAP success criteria are verified at the automation level (route test suite, structural fill assertions, size guard, header wiring). The 3 human verification items above are required for the rendering fidelity and cross-output consistency claims in SC#1 and SC#2. The phase is blocked at `human_needed` pending those checks.

---

_Verified: 2026-06-20T11:35:00Z_
_Verifier: Claude (gsd-verifier)_
