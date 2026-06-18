---
phase: 03-web-ui-core-flow-deployment
plan: 03
subsystem: ui
tags: [react, next.js, tailwind, ccn-lookup, error-handling, report-preview, vercel]

# Dependency graph
requires:
  - phase: 03-01
    provides: CCN normalize/validate (ccn.ts), exhaustive error-kind mapping (error-presentation.ts), ManualInputs/ReportViewModelSchema with previousProviderPerformance
  - phase: 03-02
    provides: SnapshotApp client shell, page.tsx thin server shell, Vercel live deploy

provides:
  - CCNSearchBar component (form + Enter-to-submit + client-side CCN pre-check + inline error region)
  - ErrorBanner component (top banner for network/cms/validation errors)
  - ReportPreview component (paper-like header + body, N/A render path, skeleton/loading, reference-exact interleaved layout)
  - SnapshotApp wired with fetch seam, state cascade, and inline/banner error routing
  - Report body locked to reference-exact interleaved order with verbatim labels

affects: [03-04, 04-PDF-export, all phases using ReportPreview/SnapshotApp]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fetch-seam pattern: SnapshotApp owns fetch + state; components receive typed props"
    - "Error routing via getErrorPresentation(error).placement: 'inline' | 'banner'"
    - "Formatter-gated renders: all number|null CMS fields pass formatRating/formatBeds/formatLocation"
    - "Report body: reference-exact interleaved layout (CMS + manual fields mixed, no source groups)"

key-files:
  created:
    - medelite-report/src/components/CCNSearchBar.tsx
    - medelite-report/src/components/ErrorBanner.tsx
    - medelite-report/src/components/ReportPreview.tsx
  modified:
    - medelite-report/src/components/SnapshotApp.tsx
    - medelite-report/README.md

key-decisions:
  - "DEC-LAYOUT (03-03): Report body field order locked to reference-exact interleaved layout. CMS and manual fields interleaved, not grouped by source. Verbatim labels: 'Health Inspection' (not '...Rating'), 'Staffing' (not '...Rating'), 'Previous Provider Performance from Medelite' (with suffix). Two source-group separator rows removed."
  - "DEC-ADDR-PASSTHROUGH (03-03): Address displayed as raw CMS pass-through (street + city + state, no ZIP). NOT normalized to reference's title-case/ordinal/abbreviated form. Rationale: address is a value governed by the API; lossy normalization risks corrupting regulated source data (CLAUDE.md rule #3). Reversible if normalized presentation later preferred."
  - "DEC-VALUES-GOVERNS (03-03): Reference PDF governs layout/labels only. Its 120 beds / '5280 SW 157th Ave' are illustrative. Real values come from the live CMS API / fixture (150 certified beds, '5280 SW 157 AVENUE, MIAMI, FL'). Do not correct live values to match the reference PDF."

patterns-established:
  - "Inline vs banner error split: getErrorPresentation(error).placement drives which surface renders; never bleed error kinds"
  - "assembleViewModel called in SnapshotApp on success, never inside view components (D-12)"
  - "D-11: manualInputs reset only on success, not on error, preserving prior manual values during error states"
  - "Report body: ONE continuous dl, fields interleaved by reference order, no source-group separators"

requirements-completed: [LOOK-01, LOOK-02, LOOK-03, ERR-01, ERR-02]

# Metrics
duration: 25min
completed: 2026-06-17
---

# Phase 3 Plan 03: Core Slice — CCN lookup → live report preview with reference-exact layout

**Full end-to-end CCN search flow: enter 686123, see populated report preview with reference-exact interleaved body layout, verbatim labels, and all three distinct error states, live on Vercel.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-17
- **Completed:** 2026-06-17
- **Tasks:** 4 (3 build tasks + 1 human-verify checkpoint resolved by continuation agent)
- **Files modified:** 5

## Accomplishments

- Built CCNSearchBar with Enter-to-submit, client-side CCN format pre-check (returns before fetch on malformed CCN), inline error region beneath the field (D-05, LOOK-02)
- Built ErrorBanner for banner-kind errors (network/cms/validation), ensuring error kinds never bleed (LOOK-03, ERR-01)
- Built ReportPreview with static header (rule #2), reference-exact interleaved body (D-03), null-safe formatters (D-10), skeleton/loading states (D-06)
- Wired SnapshotApp: fetch seam with encodeURIComponent, state cascade (idle→loading→success/error), assembleViewModel on success, inline/banner error routing via getErrorPresentation, manualInputs reset only on success (D-11)
- Applied human-verify checkpoint outcome: reordered body to reference-exact interleaved layout, fixed three verbatim label mismatches ("Health Inspection Rating"→"Health Inspection"; "Staffing Rating"→"Staffing"; "Previous Provider Performance"→"Previous Provider Performance from Medelite"), removed two source-group separator rows, documented address pass-through decision in README
- Deployed to https://infinite-snapshot.vercel.app via git push → Vercel auto-deploy

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CCNSearchBar + ErrorBanner** - `49b93c8` (feat)
2. **Task 2: Create ReportPreview** - `6dbd8ac` (feat)
3. **Task 3: Wire SnapshotApp fetch seam** - `0534618` (feat)
4. **Checkpoint resolution: reference-exact reorder + verbatim labels + README** - `7cc5646` (fix)

## Files Created/Modified

- `medelite-report/src/components/CCNSearchBar.tsx` - CCN form + Enter-to-submit + inline validation + error region
- `medelite-report/src/components/ErrorBanner.tsx` - Top banner for network/cms/validation errors (role="alert")
- `medelite-report/src/components/ReportPreview.tsx` - Paper-like preview: static header + reference-exact interleaved body + skeleton
- `medelite-report/src/components/SnapshotApp.tsx` - State owner: fetch seam, error routing, assembleViewModel, two-pane layout
- `medelite-report/README.md` - Project intro + "Data & presentation decisions" section (values-vs-reference + address pass-through)

## Deviations from Plan

### Checkpoint outcome: reference changes applied (not "approved as-is")

**Found during:** Task 4 (human-verify checkpoint)
**Issue:** User did NOT approve the original body layout (Task 2 used the CLAUDE.md fallback order, CMS fields grouped first then manual fields). User provided the reference report and required the reference-exact interleaved order with verbatim labels.
**Fix:**
1. Reordered dl body to reference-exact interleaved layout (13 fields, CMS + manual interleaved)
2. Fixed three verbatim label mismatches: "Health Inspection Rating"→"Health Inspection"; "Staffing Rating"→"Staffing"; "Previous Provider Performance"→"Previous Provider Performance from Medelite"
3. Removed two `<dt className="col-span-2 border-t my-1" aria-hidden="true" />` separator rows
4. Updated D-03 comment block to document reference-exact order, verbatim labels, and interleaved layout
5. Updated README with project intro and "Data & presentation decisions" section
**Files modified:** `medelite-report/src/components/ReportPreview.tsx`, `medelite-report/README.md`
**Commit:** `7cc5646`

### Values not changed to match reference

Per the values guardrail: certified beds remain 150 (live CMS), address remains "5280 SW 157 AVENUE, MIAMI, FL" (raw CMS). The reference's 120 beds / "5280 SW 157th Ave" are illustrative — governs labels/order only.

## Known Stubs

Manual fields (EMR, Current Census, Type of Patient, Previous Coverage from Medelite, Previous Provider Performance from Medelite, Medical Coverage) render em-dash placeholders — Wave 4 (03-04) wires them. These are intentional stubs per the plan; Plan 03-04 will resolve them.

## Self-Check: PASSED

- `medelite-report/src/components/CCNSearchBar.tsx` — exists
- `medelite-report/src/components/ErrorBanner.tsx` — exists
- `medelite-report/src/components/ReportPreview.tsx` — exists
- `medelite-report/src/components/SnapshotApp.tsx` — exists, modified
- `medelite-report/README.md` — exists, rewritten
- Commit `49b93c8` — verified in git log
- Commit `6dbd8ac` — verified in git log
- Commit `0534618` — verified in git log
- Commit `7cc5646` — verified in git log
- `npm run verify` — GREEN (typecheck PASS, lint PASS, format:check PASS, test PASS — 145 tests)
