---
phase: 05-claims-based-metrics
plan: "03"
subsystem: cms-data-layer, api-route, view-model
tags: [hospmetrics, view-model, route-handler, allsettled, graceful-degrade, tdd, zod-schema]
dependency_graph:
  requires:
    - "05-01: ClaimsRowSchema, AveragesRowSchema, formatFootnote, dataset constants"
    - "05-02: HospMetric interface, joinClaimsAndAverages, fetchClaimsMeasures, fetchAverages"
    - "02-01: CmsError taxonomy, fetchFacility, FacilityData"
  provides:
    - "HospMetricSchema inside ReportViewModelSchema (D-13 — PDF re-validation path)"
    - "hospMetrics: z.array(HospMetricSchema).optional() replacing z.unknown().optional() stub"
    - "assembleViewModel 4th optional param hospMetrics?: HospMetric[]"
    - "GET /api/facility 3-dataset Promise.allSettled fan-out returning data + hospMetrics"
    - "Graceful degrade: hospMetrics absent on claims/averages rejection (D-09)"
    - "Partial claims (< 4 measures) yields per-row suppression not whole-section degrade (D-10/SC#5)"
  affects:
    - "05-04: ReportPreview + ReportPDF consume vm.hospMetrics from the assembled view-model"
    - "POST /api/export/pdf re-validates hospMetrics automatically (D-13 — lives inside ReportViewModelSchema)"
    - "Phase 6: DOCX renderer reads hospMetrics from the shared view-model"
tech_stack:
  added: []
  patterns:
    - "HospMetricSchema: z.object({ label, value: z.number().nullable(), unit: z.enum, footnoteCode?.optional() })"
    - "Promise.allSettled([fetchClaimsMeasures, fetchAverages]) after fetchFacility resolves (state-timing Pitfall 2)"
    - "allSettled fulfilled/rejected as the sole degrade gate (D-09) — not a mapper undefined return or a claims row count"
    - "assembleViewModel 4th optional param threads hospMetrics passthrough (D-12 pure/deterministic unchanged)"
    - "Response.json({ data: facility, hospMetrics }) — undefined omitted from JSON at runtime"
key_files:
  created: []
  modified:
    - medelite-report/src/lib/report/view-model.ts
    - medelite-report/src/app/api/facility/route.ts
    - medelite-report/tests/lib/report/view-model.test.ts
    - medelite-report/tests/api/facility.test.ts
decisions:
  - "HospMetricSchema lives inside ReportViewModelSchema (D-13) — ensures POST /api/export/pdf auto-validates hospMetrics via the same re-validation pass it already does for facility + manual fields"
  - "No .length(12) / .min(12) / .max(12) on hospMetrics array (Zod v4 Pitfall 4 — no array.length()); mapper in Plan 02 enforces the 12-row count"
  - "Route returns { data: FacilityData, hospMetrics } — not an assembled ReportViewModel; assembleViewModel stays client-side (SnapshotApp.tsx, Plan 04 wires hospMetrics into the client assemble call)"
  - "allSettled degrade gate is fulfilled/rejected status ONLY — a fewer-than-4 claims count (partial) does NOT trigger D-09; it yields per-row null via the mapper (D-10/SC#5)"
  - "D-09 degrade is signaled by undefined hospMetrics in the JSON response — JSON.stringify omits undefined keys automatically, so no explicit null or error flag needed"
  - "Existing uppercases-CCN test updated to account for the new 4-call fan-out pattern; test still proves CCN normalization by inspecting the provider URL specifically"
metrics:
  duration: "~18 min"
  completed: "2026-06-19"
  tasks_completed: 2
  files_modified: 4
requirements: [CLM-01]
---

# Phase 05 Plan 03: View-Model + Route Fan-Out (hospMetrics end-to-end at the data boundary) Summary

**One-liner:** Real HospMetricSchema inside ReportViewModelSchema with Promise.allSettled 3-dataset fan-out in GET /api/facility returning 12-row hospMetrics on success and graceful degrade on claims/averages rejection.

## What Was Built

Two production changes that complete the server-side CLM-01 data pipeline:

### 1. `HospMetricSchema` + `hospMetrics` in `ReportViewModelSchema` (view-model.ts)

Replaced the Phase 2 `z.unknown().optional()` stub with a real, field-for-field validated schema:

```typescript
const HospMetricSchema = z.object({
  label: z.string(),
  value: z.number().nullable(),         // rejects strings — T-05-PDF security (D-13)
  unit: z.enum(["percent", "rate"]),    // rejects arbitrary strings
  footnoteCode: z.string().optional(),  // present on facility rows, absent on average rows
});

// Inside ReportViewModelSchema:
hospMetrics: z.array(HospMetricSchema).optional(),
// .optional() keeps degraded state (absent hospMetrics) valid (D-09/D-13)
```

**Key constraints:**
- No `.length(12)` / `.min(12)` — Zod v4 has no `ZodArray.length()`; the mapper in Plan 02 enforces the 12-row count (Pitfall 4).
- Lives INSIDE `ReportViewModelSchema` (D-13) — `POST /api/export/pdf` re-validates the full posted model and therefore validates `hospMetrics` automatically.

### 2. `assembleViewModel` 4th optional param

Updated signature:
```typescript
export function assembleViewModel(
  facility: FacilityData,
  manual: ManualInputs,
  generatedAt: Date | string,
  hospMetrics?: HospMetric[],   // NEW — absent = degraded state (D-09)
): ReportViewModel
```

The function remains pure/deterministic (D-12): `hospMetrics` is a passthrough — `undefined` when not supplied, never `new Date()` called internally.

### 2. GET /api/facility 3-dataset fan-out (route.ts)

Extended the try block to fan out to claims + averages AFTER `fetchFacility` resolves (hard dependency — D-07):

```typescript
const facility = await fetchFacility(ccn); // throws on failure — existing taxonomy unchanged

const [claimsResult, averagesResult] = await Promise.allSettled([
  fetchClaimsMeasures(ccn),
  fetchAverages(facility.state),   // needs facility.state — only known after provider resolves
]);

let hospMetrics: HospMetric[] | undefined;
if (claimsResult.status === "fulfilled" && averagesResult.status === "fulfilled") {
  hospMetrics = joinClaimsAndAverages(
    claimsResult.value,
    averagesResult.value.nation,
    averagesResult.value.state,
  );
}
// Either rejected → hospMetrics stays undefined (D-09 degrade)

return Response.json({ data: facility, hospMetrics }, { status: 200 });
```

**Key design points:**
- `fetchAverages` runs AFTER `fetchFacility` (needs `facility.state` — state-timing Pitfall 2)
- `allSettled` absorbs claim/averages rejections; they never reach the existing `CmsError` switch
- The degrade gate is the `allSettled` status ONLY — a partial claims count (< 4 measures) is NOT a degrade; the mapper returns per-row null (D-10/SC#5)
- Route does NOT call `assembleViewModel` — returns `FacilityData` + `hospMetrics`, not a view-model
- `export const runtime = "nodejs"` retained

## Tests

| File | New Tests | Approach |
|------|-----------|----------|
| `tests/lib/report/view-model.test.ts` | +6 cases | Schema accepts 12-item array, schema accepts absent (degraded), schema rejects bad unit, schema rejects string value; assembleViewModel threads array through, yields undefined when omitted |
| `tests/api/facility.test.ts` | +6 cases | Happy path 12-item array + no header/generatedAt in data; allSettled URL capture (4 fetches); D-10/SC#5 partial claims (3 measures → 12 rows, missing facility value null, averages still numeric); D-09 claims rejection; D-09 averages rejection; D-07 provider failure unchanged taxonomy |
| `tests/api/facility.test.ts` | 1 updated | uppercases-CCN test updated to account for 4-call fan-out (now inspects the provider URL specifically) |

Total test count: 236 pass (1 skipped — live-API integration test gated by env flag).

## TDD Gate Compliance

Plan has `tdd="true"` on Task 1. Gate sequence:

- **RED:** Added `describe("ReportViewModelSchema — hospMetrics")` block with 6 tests importing `assembleViewModel` with 4 args → 4 tests fail (`assembleViewModel` ignores 4th arg, `hospMetrics: z.unknown()` accepts any type). RED gate confirmed (4 failing).
- **GREEN:** Added `HospMetricSchema`, replaced `z.unknown().optional()`, updated `assembleViewModel` signature + return → 35 tests pass. GREEN gate confirmed.
- **REFACTOR:** None required — implementation was clean.

Task 2 follows the Plan 02 fetch-pattern analog (no TDD flag — implementation-first with tests extended alongside).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed prettier formatting on route.ts and facility.test.ts before commit (Task 2)**
- **Found during:** Running `npm run verify` after Task 2 implementation
- **Issue:** `format:check` failed on `src/app/api/facility/route.ts` (import block multi-line formatting) and `tests/api/facility.test.ts` (trailing whitespace, inline expression formatting)
- **Fix:** `npx prettier --write` on both files before committing
- **Files modified:** `src/app/api/facility/route.ts`, `tests/api/facility.test.ts`
- **Commit:** `03c992d`

**2. [Rule 1 - Bug] Updated existing uppercases-CCN test to match new 4-call fan-out (Task 2)**
- **Found during:** Running `npx vitest run tests/api/facility.test.ts` after route implementation
- **Issue:** The test asserted `capturedUrls.length === 1`; with the allSettled fan-out the route now issues 4 fetches (provider + claims + NATION + FL). The test was testing the wrong invariant — it was checking total call count, not CCN normalization.
- **Fix:** Updated the test to check the provider URL specifically (`u.includes("4pq5-n9py")`), proving CCN normalization without asserting total call count. Still proves the invariant correctly.
- **Files modified:** `tests/api/facility.test.ts`
- **Commit:** `03c992d`

## Known Stubs

None. All produced exports are fully implemented and tested. `assembleViewModel` threads `hospMetrics` through; the route returns the real 12-row array. Plan 04 wires `hospMetrics` into the client-side assemble call and renders the rows in preview + PDF.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond what the plan's threat model already covers:

| Flag | File | Description |
|------|------|-------------|
| threat_flag: T-05-PDF mitigated | view-model.ts | hospMetrics now inside ReportViewModelSchema — `value: z.number().nullable()` rejects string injection; `unit: z.enum` rejects arbitrary strings; a crafted PDF-export body cannot inject arbitrary metric content (D-13) |
| threat_flag: T-05-DOS mitigated | route.ts | Each bonus fetch has AbortSignal.timeout(8000); allSettled absorbs rejections; a hung claims/averages call degrades (D-09) rather than holding the request past the Vercel wall |

## Quality Gate

`npm run verify` green: typecheck PASS, lint PASS, format:check PASS, test PASS (236 tests, 1 skipped).
`npm run build` exits 0 — bundle integrity verified in-wave.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 (HospMetricSchema + assembleViewModel) | `1b4812b` | feat(05-03): add HospMetricSchema + hospMetrics to ReportViewModelSchema; thread through assembleViewModel |
| Task 2 (route allSettled fan-out) | `03c992d` | feat(05-03): extend GET /api/facility with 3-dataset Promise.allSettled fan-out (CLM-01) |

## Self-Check: PASSED

- `medelite-report/src/lib/report/view-model.ts` exports `HospMetricSchema` (line 50) and `hospMetrics: z.array(HospMetricSchema).optional()` (line 148) — FOUND
- `medelite-report/src/lib/report/view-model.ts` has NO `z.unknown().optional()` for hospMetrics — VERIFIED (grep returned no match)
- `medelite-report/src/lib/report/view-model.ts` has NO `.length(` / `.min(12)` / `.max(12)` — VERIFIED
- `medelite-report/src/app/api/facility/route.ts` contains `Promise.allSettled` (line 94) — FOUND
- `medelite-report/src/app/api/facility/route.ts` imports `fetchClaimsMeasures, fetchAverages, joinClaimsAndAverages` — FOUND
- `medelite-report/src/app/api/facility/route.ts` does NOT call `assembleViewModel` — VERIFIED
- `export const runtime = "nodejs"` retained in route.ts — VERIFIED
- Commits `1b4812b` and `03c992d` exist in git log — VERIFIED
- `npm run verify` green (236 tests pass, 1 skipped) — VERIFIED
- `npm run build` exits 0 — VERIFIED
