---
phase: 02-api-routes-view-model-config
plan: "03"
subsystem: report-view-model
tags: [view-model, header, formatters, pdf-stub, next-config, zod, tdd, phase-gate]
dependency_graph:
  requires:
    - medelite-report/src/lib/cms/types.ts
    - medelite-report/src/lib/cms/schema.ts
    - medelite-report/src/lib/cms/parse.ts
    - medelite-report/src/lib/cms/mapper.ts
  provides:
    - medelite-report/src/lib/report/header.ts
    - medelite-report/src/lib/report/format.ts
    - medelite-report/src/lib/report/view-model.ts
    - medelite-report/src/app/api/export/pdf/route.ts
    - medelite-report/next.config.ts (serverExternalPackages)
  affects: [03-ui-preview, 04-pdf-export, 06-docx-export]
tech_stack:
  added: []
  patterns:
    - assembleHeader(state) state-only param enforces RPT-01 at compile time
    - formatter family with shared PLACEHOLDER and === null check (D-10)
    - assembleViewModel(facility, manual, generatedAt) pure/deterministic with injected timestamp (D-12)
    - ReportViewModelSchema as THE canonical Zod schema for all three render targets
    - Route handler POST stub with Zod validation — 400/501 pattern (D-20/D-21)
    - serverExternalPackages defensive config against Turbopack bug #88844
key_files:
  created:
    - medelite-report/src/lib/report/header.ts
    - medelite-report/src/lib/report/format.ts
    - medelite-report/src/lib/report/view-model.ts
    - medelite-report/src/app/api/export/pdf/route.ts
    - medelite-report/tests/lib/report/header.test.ts
    - medelite-report/tests/lib/report/format.test.ts
    - medelite-report/tests/lib/report/view-model.test.ts
    - medelite-report/tests/api/export-pdf.test.ts
  modified:
    - medelite-report/next.config.ts
decisions:
  - "RPT-01: assembleHeader(state) has exactly one string param — TypeScript enforces no facility-name arg at compile time"
  - "D-10: all formatters check === null (not falsiness) — formatRating(0)='0', formatBeds(0)='0', formatPercent(0)='0.0%', formatRate(0)='0.00'"
  - "D-09: single module-private PLACEHOLDER='N/A' shared by all formatters"
  - "D-12: assembleViewModel is pure/deterministic — generatedAt is injected by caller, never new Date() internally"
  - "NAME-02: displayName = manual.nameOverride?.trim() || facility.providerName — static header is unaffected"
  - "D-16: careCompareUrl = https://www.medicare.gov/care-compare/details/nursing-home/{ccn} with CCN as string"
  - "D-13: formatDate uses timeZone:'UTC' to prevent midnight off-by-one between server and client"
  - "D-25: serverExternalPackages: ['@react-pdf/renderer'] — explicit despite auto-opt-out list, defensive against Turbopack #88844"
  - "D-21: ReportViewModelSchema is THE canonical render contract — pdf route, Phase 4 PDF, Phase 6 docx all validate against it"
  - "Test D-10 fix: formatRate(1.865) was expected to be 1.87 but JS floating-point gives 1.86; changed test to use 1.8651 for unambiguous rounding"
metrics:
  duration: "~10 minutes"
  completed_date: "2026-06-17"
  tasks_completed: 3
  files_created: 8
  files_modified: 1
---

# Phase 02 Plan 03: FacilityData → ReportViewModel (Header, Formatters, View Model, PDF Stub) Summary

**One-liner:** assembleHeader(state-only), null-safe formatter family (=== null / D-10), pure assembleViewModel with injected generatedAt, POST /api/export/pdf Zod-validates 400/501 stub, serverExternalPackages config — `npm run verify:full` including `next build` green (phase gate).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | assembleHeader + formatter family (TDD) | 0bfa699 | header.ts, format.ts, header.test.ts, format.test.ts |
| 2 | ReportViewModelSchema + assembleViewModel (TDD) | fde0479 | view-model.ts, view-model.test.ts |
| 3 | PDF export stub + serverExternalPackages (TDD, phase gate) | 025ca8d | pdf/route.ts, next.config.ts, export-pdf.test.ts |

## What Was Built

### Task 1: `header.ts` and `format.ts`

`header.ts` exports `interface HeaderData` and `assembleHeader(state: string): HeaderData`. The function has exactly one parameter — TypeScript enforces that a facility-name argument is a compile error (RPT-01 / CLAUDE.md rule #2). Returns the exact static strings `"INFINITE — Managed by MEDELITE"` and `"FACILITY ASSESSMENT SNAPSHOT"` with `stateLine: state.toUpperCase()`.

`format.ts` exports the null-safe formatter family: `formatRating`, `formatBeds`, `formatPercent`, `formatRate`, `formatLocation`, `formatDate`. All four numeric formatters share one module-private `PLACEHOLDER = 'N/A'` (D-09) and open with `if (value === null) return PLACEHOLDER` — never `if (!value)` (D-10). `formatLocation` composes `${street}, ${city}, ${state}` with no ZIP (DATA-03). `formatDate` uses `timeZone: 'UTC'` to prevent the midnight off-by-one between server and client rendering (D-13).

32 tests: zero-is-real-data coverage for every formatter; TZ-stability of `formatDate('2026-05-01')` asserts May 1 not April 30; RPT-01 negative asserts "Kendall" never appears in the static header.

### Task 2: `view-model.ts`

Exports `ManualInputs` interface (six manual fields: nameOverride, emr, currentCensus, typeOfPatient, medicalCoverage, previousCoverage). Exports `ReportViewModelSchema` — the canonical Zod schema that Phase 4 PDF and Phase 6 docx render straight from (RPT-02). Exports `ReportViewModel = z.infer<...>`. Exports pure `assembleViewModel(facility, manual, generatedAt)`:
- Calls `assembleHeader(facility.state)` — state-only (rule #2)
- `displayName = manual.nameOverride?.trim() || facility.providerName` (NAME-02)
- `careCompareUrl = https://www.medicare.gov/care-compare/details/nursing-home/${facility.ccn}` (D-16)
- Stores `generatedAt` as a string (`.toISOString()` if Date) — no `new Date()` internally (D-12)
- Raw `number | null` for ratings/beds — formatters run at render time (D-08)
- `hospMetrics: z.unknown().optional()` — Phase 5 fills this

22 tests: determinism with fixed `generatedAt`; NAME-02 override and whitespace-trim fallback; NAME-02 isolation (override never appears in header); careCompareUrl string; processingDate; schema accept/reject.

### Task 3: `pdf/route.ts` + `next.config.ts`

`src/app/api/export/pdf/route.ts`: `export const runtime = 'nodejs'` (D-25); `POST(request: Request)` validates body with `ReportViewModelSchema.safeParse(body)` → 400 `{ error: { kind: 'invalid_request', message } }` on failure (no Zod internals), 501 `{ error: { kind: 'not_implemented', message } }` on success. Phase 4 swaps the 501 for `renderToBuffer`.

`next.config.ts`: added `serverExternalPackages: ['@react-pdf/renderer']` — explicit despite being on NJS16's auto-opt-out list (defensive against Turbopack bug #88844). Key name verified against installed `serverExternalPackages.md` (not the NJS14 name `serverComponentsExternalPackages`).

8 tests: 400 for bad shape with `kind: 'invalid_request'`; no Zod internals in 400 body; exact envelope shape (`{ error: { kind, message } }` only); 501 for valid vm with `kind: 'not_implemented'`.

**Phase gate:** `npm run verify:full` (typecheck → lint → format:check → test → `next build`) green. Build output confirms `/api/export/pdf` is a dynamic route.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed floating-point rounding test for formatRate**
- **Found during:** Task 1 GREEN phase
- **Issue:** Test expected `formatRate(1.865).toBe('1.87')` but JavaScript's `toFixed(2)` returns `'1.86'` for `1.865` due to binary floating-point representation (`1.865` is stored as `1.8649999...`). This is correct language behavior, not an implementation bug.
- **Fix:** Changed test input from `1.865` to `1.8651` — unambiguously rounds to `1.87` without floating-point ambiguity.
- **Files modified:** `tests/lib/report/format.test.ts`
- **Commit:** 0bfa699

## Known Stubs

- `POST /api/export/pdf` returns 501 `not_implemented` for all valid requests. This is intentional — Phase 4 will replace the 501 with `renderToBuffer`. The route exists to establish the Zod-validated contract that Phase 4 renders from.

## Threat Flags

No new threat surface beyond the plan's threat model. All three STRIDE mitigations implemented:

| Threat | Status |
|--------|--------|
| T-02-POST: POST body untrusted → Zod-validated | Implemented — `ReportViewModelSchema.safeParse(body)` |
| T-02-LEAK2: 400 body has no Zod internals | Implemented — body is exactly `{ error: { kind, message } }` |
| T-02-BRAND: assembleHeader rejects facility-name | Implemented — one param, TypeScript compile-time enforced |
| T-02-BUILD: serverExternalPackages explicitly set | Implemented — verified by `next build` in phase gate |
| T-02-SC: no new npm installs | Confirmed — zero package-manager installs in this plan |

## Self-Check: PASSED

Files created/modified:
- medelite-report/src/lib/report/header.ts — FOUND
- medelite-report/src/lib/report/format.ts — FOUND
- medelite-report/src/lib/report/view-model.ts — FOUND
- medelite-report/src/app/api/export/pdf/route.ts — FOUND
- medelite-report/next.config.ts — FOUND (contains serverExternalPackages)
- medelite-report/tests/lib/report/header.test.ts — FOUND
- medelite-report/tests/lib/report/format.test.ts — FOUND
- medelite-report/tests/lib/report/view-model.test.ts — FOUND
- medelite-report/tests/api/export-pdf.test.ts — FOUND

Commits verified:
- 0bfa699 (Task 1: assembleHeader + formatters)
- fde0479 (Task 2: ReportViewModelSchema + assembleViewModel)
- 025ca8d (Task 3: PDF stub + serverExternalPackages, phase gate)

`npm run verify:full` final run: all checks passed (12 test files, 120 tests, 1 skipped; `next build` green with /api/export/pdf as dynamic route).
