---
phase: 05-claims-based-metrics
plan: "01"
subsystem: cms-data-layer
tags: [claims-schema, averages-schema, zod-validation, format-helpers, dataset-constants, tdd]
dependency_graph:
  requires:
    - "01-03: CMSRowSchema + nullableNum pattern (replicated inline)"
    - "02-03: format.ts formatter family (extended)"
  provides:
    - "ClaimsRowSchema (ijh5-nb2v row validator)"
    - "AveragesRowSchema (xcdc-v8bm row validator)"
    - "DATASET_CLAIMS, DATASET_AVERAGES, AVERAGES_FILTER_FIELD constants"
    - "formatFootnote(code) — Table-15 suppression-message helper"
  affects:
    - "05-02: joinClaimsAndAverages mapper consumes ClaimsRow + AveragesRow"
    - "05-03: route.ts uses DATASET_CLAIMS, DATASET_AVERAGES, AVERAGES_FILTER_FIELD"
    - "05-04: ReportPreview + ReportPDF call formatFootnote at render time"
tech_stack:
  added: []
  patterns:
    - "nullableNum inline replication (empty-string → null coercion, real-0 preserved)"
    - ".passthrough() AveragesRowSchema — hash-suffixed average columns preserved for mapper key scan"
    - "FOOTNOTE_MESSAGES Record<string, string> + ?? FOOTNOTE_FALLBACK pattern"
    - "formatFootnote truthy-check guard: !footnoteCode || footnoteCode === '' → fallback"
key_files:
  created: []
  modified:
    - medelite-report/src/lib/cms/constants.ts
    - medelite-report/src/lib/cms/claims-schema.ts
    - medelite-report/src/lib/cms/averages-schema.ts
    - medelite-report/src/lib/report/format.ts
    - medelite-report/tests/lib/cms/claims-schema.test.ts
    - medelite-report/tests/lib/cms/averages-schema.test.ts
    - medelite-report/tests/lib/report/format.test.ts
decisions:
  - "Inline nullableNum replication in each schema file — not extracted to a shared import (avoids circular deps + matches existing schema.ts pattern)"
  - "AveragesRowSchema uses .passthrough() with only state_or_nation + processing_date typed — mapper does runtime description-based key scan (D-14, hash slug rotation safety)"
  - "FOOTNOTE_MESSAGES uses object key lookup with ?? fallback — falsy check covers both undefined and empty string in one branch"
  - "formatFootnote placed in format.ts (not a new claims-format.ts) — co-located with formatPercent/formatRate per RESEARCH.md Open Question 3 resolution"
metrics:
  duration: "~12 min (continuation: Task 2 only)"
  completed: "2026-06-19"
  tasks_completed: 2
  files_modified: 7
requirements: [CLM-02]
---

# Phase 05 Plan 01: Data Primitives (Claims/Averages Schemas + formatFootnote) Summary

**One-liner:** Zod validators for ijh5-nb2v/xcdc-v8bm CMS datasets plus a Table-15 footnote-code-to-message helper, all with alongside tests.

## What Was Built

Three production-primitive layers that Plans 02-04 depend on:

1. **`constants.ts` (3 new exports):** `DATASET_CLAIMS = "ijh5-nb2v"`, `DATASET_AVERAGES = "xcdc-v8bm"`, `AVERAGES_FILTER_FIELD = "state_or_nation"` — each with a JSDoc traceability comment anchored to the CMS metastore re-confirm (2026-06-18, HTTP 200, expected fields) and the captured fixtures (CLAUDE.md rule #3 / D-16).

2. **`claims-schema.ts` (new file):** `ClaimsRowSchema` with inline `nullableNum` helper — required string fields `cms_certification_number_ccn`, `measure_code`, `measure_description`, `resident_type`, `footnote_for_score`, `processing_date`, plus `adjusted_score: nullableNum` (coerces `""` → null, `"0"` → 0, rejects non-numeric strings). `.passthrough()` preserves unmodeled columns. Exports `ClaimsRow` type. Field names traced to `claims-686123.json` fixture.

3. **`averages-schema.ts` (new file):** `AveragesRowSchema` with only `state_or_nation: z.string()` and `processing_date: z.string()` as typed keys; `.passthrough()` keeps all ~45 hash-suffixed average columns for Plan-02's runtime description-based key scan (D-14 slug-rotation safety). Exports `AveragesRow` type.

4. **`format.ts` (extended):** `formatFootnote(footnoteCode: string | undefined): string` with module-private `FOOTNOTE_MESSAGES` record (codes 1/2/7/9/10/28 → human-readable strings per NH_Data_Dictionary Table 15 via FEATURES.md) and `FOOTNOTE_FALLBACK = "Not available"`. Returns fallback for falsy/empty/unknown codes.

## Tests

| File | New Tests | Approach |
|------|-----------|----------|
| `tests/lib/cms/claims-schema.test.ts` | 8 cases | Happy path, empty→null, real-0, missing-key fail, non-numeric fail, footnote passthrough, DATA-06 every-shape-key-exists |
| `tests/lib/cms/averages-schema.test.ts` | 4 cases | Happy path, state_or_nation preserved, passthrough column accessible, missing-key fail |
| `tests/lib/report/format.test.ts` | +9 cases (formatFootnote describe block) | All 6 known codes + unknown ("99") + empty ("") + undefined |

Total: 182 tests pass (1 skipped — live-API integration test gated by env flag).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed prettier formatting on Task-1 test files (claims-schema.test.ts + averages-schema.test.ts)**
- **Found during:** Task 2 (running `npm run verify` after Task 2 implementation)
- **Issue:** `format:check` failed on the two test files committed in Task 1 (`1f7a1fc`) — prettier style issues (trailing commas, quote style). The verify gate rejected the tree.
- **Fix:** Ran `npx prettier --write` on both files; staged and committed alongside Task 2 files.
- **Files modified:** `tests/lib/cms/averages-schema.test.ts`, `tests/lib/cms/claims-schema.test.ts`
- **Commit:** `9f889af`

## TDD Gate Compliance

Plan has `tdd="true"` on Task 2. Gate sequence for Task 2:

- **RED:** Added `formatFootnote` to import list in `format.test.ts` + appended 9 failing `describe("formatFootnote", ...)` tests → `npx vitest run tests/lib/report/format.test.ts` → 9 tests fail (`formatFootnote is not a function`). RED gate confirmed.
- **GREEN:** Appended `FOOTNOTE_MESSAGES`, `FOOTNOTE_FALLBACK`, and `formatFootnote` to `format.ts` → all 34 tests pass. GREEN gate confirmed.

## Known Stubs

None. All produced exports are fully implemented and tested. No placeholder values, hardcoded empty arrays, or TODO comments in produced files.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond what the plan's threat model already covers.

## Quality Gate

`npm run verify` green: typecheck PASS, lint PASS, format:check PASS, test PASS (182 tests, 1 skipped).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 (prior executor) | `1f7a1fc` | feat(05-01): add ClaimsRowSchema, AveragesRowSchema, and dataset constants |
| Task 1a | (checkpoint — approved) | Dataset IDs ijh5-nb2v + xcdc-v8bm re-confirmed live (HTTP 200, expected fields) |
| Task 2 + Rule 1 fix | `9f889af` | feat(05-01): add formatFootnote + Table-15 message map to format.ts |

## Self-Check: PASSED

- `medelite-report/src/lib/report/format.ts` exports `formatFootnote` — FOUND
- `medelite-report/src/lib/cms/claims-schema.ts` exports `ClaimsRowSchema` — FOUND (committed `1f7a1fc`)
- `medelite-report/src/lib/cms/averages-schema.ts` exports `AveragesRowSchema` — FOUND (committed `1f7a1fc`)
- `medelite-report/src/lib/cms/constants.ts` exports `DATASET_CLAIMS`, `DATASET_AVERAGES`, `AVERAGES_FILTER_FIELD` — FOUND (committed `1f7a1fc`)
- Commits `1f7a1fc` and `9f889af` exist in git log — VERIFIED
- `npm run verify` green — VERIFIED (182/183 tests pass, 1 skipped)
