---
phase: 01-foundation-cms-data-layer
plan: "02"
subsystem: cms-data-layer
tags: [fixture-capture, cms-api, data-integrity]
dependency_graph:
  requires: []
  provides:
    - medelite-report/tests/fixtures/provider-686123.json
    - medelite-report/tests/fixtures/claims-686123.json
    - medelite-report/tests/fixtures/averages-xcdc.json
  affects:
    - plan-03 (provider CMSRowSchema anchors to provider-686123.json)
    - plan-05 (claims/averages schemas anchor to claims/averages fixtures)
tech_stack:
  added: []
  patterns:
    - Dataset registry pattern (REGISTRY array + DatasetCapture interface)
    - Metastore ID validation before fetch (D-03)
    - CMS conditions filter with single "=" operator (not "==")
    - Keyed averages object { NATION, FL } vs array for O(1) Phase 5 access
key_files:
  created:
    - medelite-report/tests/fixtures/provider-686123.json
    - medelite-report/tests/fixtures/claims-686123.json
    - medelite-report/tests/fixtures/averages-xcdc.json
  modified:
    - medelite-report/scripts/capture-fixture.ts
decisions:
  - "D-01: Captured all three CMS datasets (provider 4pq5-n9py, claims ijh5-nb2v, averages xcdc-v8bm) for CCN 686123"
  - "D-02: Claims/averages fixtures captured but their Zod schemas deferred to Phase 5 — only provider schema in Phase 1"
  - "D-03: Dataset registry (id -> output path) with metastore ID re-resolution at capture time"
  - "D-11: Committed fixtures are single source of truth for unit tests; live CMS calls confined to npm run fixture:capture"
metrics:
  duration: "~8 minutes"
  completed_date: "2026-06-17"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 1
---

# Phase 01 Plan 02: CMS Fixture Capture Summary

**One-liner:** Dataset-registry capture script + three committed CMS fixtures (provider 1 row, claims 4 rows, averages NATION+FL keyed object) from the live CMS Provider Data Catalog API for CCN 686123 (Kendall Lakes, FL).

## What Was Built

### Task 1: Dataset-registry capture script (`medelite-report/scripts/capture-fixture.ts`)

Replaced the no-op placeholder with a fully typed capture script:

- **REGISTRY**: Three typed `DatasetCapture` entries for `4pq5-n9py` (provider), `ijh5-nb2v` (claims), and `xcdc-v8bm` (averages).
- **`validateDatasetIds()`**: Fetches the CMS metastore and confirms all three dataset IDs are present before any data fetch. Throws if any ID has been retired/renamed (D-03 / CLAUDE.md rule #3).
- **`queryCMS()`**: Builds a URL against the stable `/datastore/query/{id}/0` endpoint, sets `conditions[0][operator]` to a single `"="` (not `"=="` which returns HTTP 400 per RESEARCH.md Pitfall 3), throws on non-ok HTTP or zero results.
- **`captureFixtures()`**: Orchestrates validate → mkdirSync → REGISTRY loop. Provider/claims write the full `results` array; averages writes a keyed object `{ NATION: row, FL: row }` for O(1) Phase 5 access.
- All Node built-ins use the `node:` prefix (convention from `scripts/verify.mjs`).
- `captureFixtures()` is exported and invoked at module bottom — satisfies `isolatedModules`.

### Task 2: Three captured fixture files from the live CMS API

| File | Shape | Key Contents |
|------|-------|--------------|
| `provider-686123.json` | Array (1 element) | CCN `686123`, Kendall Lakes Healthcare and Rehab Center, FL, ratings overall=5 health=5 qm=5 staffing=2 |
| `claims-686123.json` | Array (4 elements) | measure_codes 521, 522, 551, 552 with adjusted/observed/expected scores |
| `averages-xcdc.json` | Keyed object | Top-level keys `NATION` and `FL`, each containing the full state/national averages row for the 4 hospitalization/ED measures |

All fixtures formatted with `npm run format` and verified clean by `npm run verify`.

## Acceptance Criteria Verification

- [x] `npm run fixture:capture` runs without error and writes three fixtures
- [x] `provider-686123.json` contains a row with `cms_certification_number_ccn` = `"686123"`
- [x] `claims-686123.json` has exactly 4 rows with measure codes `521, 522, 551, 552`
- [x] `averages-xcdc.json` is a keyed object with `NATION` and `FL` top-level keys
- [x] Capture script re-resolves dataset IDs via the CMS metastore before any fetch
- [x] Script sets `conditions[0][operator]` to single `"="` (not `"=="`)
- [x] `mkdirSync(FIXTURES_DIR, { recursive: true })` called before any write
- [x] `captureFixtures()` is exported and invoked at module bottom
- [x] `npx tsc --noEmit` clean
- [x] `npm run verify` exits 0 (typecheck, lint, format:check, test all PASS)

## Threat Mitigations Applied

- **T-02-01 (Stale dataset IDs):** Mitigated — `validateDatasetIds()` queries the CMS metastore and throws if any of the three IDs is absent before any data fetch.
- **T-02-03 (Empty/failed CMS response):** Mitigated — `queryCMS()` throws on non-ok HTTP and on `count === 0`, producing a loud failure instead of an empty fixture.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all fixture data is real CMS API data for CCN 686123.

## Threat Flags

None — capture script only fetches a fixed public allowlist (three CMS dataset IDs + metastore), dev-time only.

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement dataset-registry capture script | d045981 | `scripts/capture-fixture.ts` |
| 2 | Run fixture:capture and commit three fixtures | 5471292 | `tests/fixtures/provider-686123.json`, `tests/fixtures/claims-686123.json`, `tests/fixtures/averages-xcdc.json` |

## Self-Check: PASSED

- [x] `medelite-report/scripts/capture-fixture.ts` — exists, compiles, all patterns present
- [x] `medelite-report/tests/fixtures/provider-686123.json` — exists with CCN 686123
- [x] `medelite-report/tests/fixtures/claims-686123.json` — exists with 4 rows (521/522/551/552)
- [x] `medelite-report/tests/fixtures/averages-xcdc.json` — exists with NATION and FL keys
- [x] Commit d045981 — Task 1 capture script
- [x] Commit 5471292 — Task 2 fixture files
- [x] `npm run verify` green
