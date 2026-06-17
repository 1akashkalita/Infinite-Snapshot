---
phase: 01-foundation-cms-data-layer
reviewed: 2026-06-17T00:59:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - medelite-report/scripts/capture-fixture.ts
  - medelite-report/src/lib/cms/schema.ts
  - medelite-report/src/lib/cms/parse.ts
  - medelite-report/tests/lib/cms/schema.test.ts
  - medelite-report/vitest.config.ts
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-06-17T00:59:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 1 lays the CMS data layer: a fixture-capture script, a Zod v4 schema for
provider rows, typed parse wrappers, and a schema test suite. The fundamentals
are sound — Zod v4 APIs are used correctly (`.issues`, `z.prettifyError`), the
empty-string→null→coerce pipeline behaves as documented for the happy/suppressed/
zero cases, CCN and ZIP are preserved as strings, and all 8 schema tests pass.

The dominant defect is a **data-integrity hole in the `nullableNum` coercion
helper**: it only screens out empty strings before handing the value to
`z.coerce.number()`, so a malformed CMS response carrying a boolean or array in a
rating field is silently coerced to a number (`true → 1`, `false → 0`, `[] → 0`)
instead of being rejected. This violates the project's "unvalidated data must
never reach the UI/PDF" rule because invalid data passes validation as if it were
real. Secondary issues: `parse.ts` (the route-handler entry point) has zero test
coverage, the capture script's averages-keying and zero-result guards are fragile,
and required text fields accept empty/whitespace strings.

## Critical Issues

### CR-01: `nullableNum` silently coerces non-string, non-numeric JSON values into numbers

**File:** `medelite-report/src/lib/cms/schema.ts:19-22`
**Issue:** The preprocess step only converts empty/whitespace **strings** to null;
every other value falls straight through to `z.coerce.number()`, which runs JS
`Number()` semantics. Verified live against zod@4.4.3:

```
nullableNum.safeParse(true)  -> { success: true, data: 1 }
nullableNum.safeParse(false) -> { success: true, data: 0 }
nullableNum.safeParse([])    -> { success: true, data: 0 }
```

If a future CMS response (or a regression in the upstream API) returns a boolean
or empty array for `overall_rating` / `qm_rating` / `number_of_certified_beds`,
the schema accepts it and emits a fabricated value (e.g. a 0-star or 1-star
rating, or 0 certified beds) that flows into the ReportViewModel, the PDF, and the
.docx. CLAUDE.md rule #4 requires that unvalidated data never reach the UI/PDF;
this is exactly that — invalid data masquerading as valid. The fix should reject
anything that is not a string, a number, or null before coercion.

**Fix:**
```typescript
// Reject non-string, non-number, non-null inputs instead of silently coercing.
const nullableNum = z.preprocess((v) => {
  if (v === null || v === undefined) return v;
  if (typeof v === "string") return v.trim() === "" ? null : v;
  if (typeof v === "number") return v;
  // Anything else (boolean, array, object) is invalid CMS data — fail loud.
  return NaN; // z.coerce.number() rejects NaN with invalid_type
}, z.coerce.number().nullable());
```
(Alternatively gate the coerce with a `z.union([z.string(), z.number(), z.null()])`
input before the preprocess so booleans/arrays never reach `Number()`.)

## Warnings

### WR-01: `parse.ts` has no test coverage — route-handler entry point is unverified

**File:** `medelite-report/src/lib/cms/parse.ts:19-35`
**Issue:** `parseCMSRow` and `safeParseCMSRow` are the functions Phase 2's route
handler will call, yet there is no `parse.test.ts` (only `schema.test.ts` and
`smoke.test.ts` exist). The throwing path in `parseCMSRow` and its
`z.prettifyError(result.error)` call are never exercised by a test. CLAUDE.md rule
#6 requires every error path to be explicitly handled **and covered by tests**;
the human-readable-error path here is handled but uncovered. A typo or a Zod
behavior change in `prettifyError` would ship undetected.
**Fix:** Add `tests/lib/cms/parse.test.ts` asserting: (a) `parseCMSRow` returns the
typed row on valid input, (b) `parseCMSRow` throws an `Error` whose message is
non-empty on invalid input, and (c) `safeParseCMSRow` returns
`{ success: false }` with `error.issues.length > 0` on invalid input.

### WR-02: Capture script keys the averages object on raw CMS field value — silent overwrite on collision

**File:** `medelite-report/scripts/capture-fixture.ts:124-130`
**Issue:** For the multi-filter (`xcdc-v8bm`) path the output key is derived from
`row[f.property]` (the actual `state_or_nation` value in the returned row), not
from the filter value that was requested. If CMS returns the value in different
casing (`"Nation"` vs the requested `"NATION"`), an unexpected/empty value, or the
property is suppressed (`""`), the keyed object silently gets a wrong or empty key
— and two rows could collapse into one key, overwriting the first with no error.
The downstream consumer expects exactly `{ NATION, FL }`.
**Fix:** Key on the requested filter value and assert the row echoes it:
```typescript
const row = results[0] as Record<string, unknown>;
if (String(row[f.property] ?? "") !== f.value) {
  throw new Error(
    `Expected ${f.property}=${f.value}, got ${String(row[f.property])}`,
  );
}
output[f.value] = row;
```

### WR-03: Zero-results guard trusts `json.count` instead of the actual results array

**File:** `medelite-report/scripts/capture-fixture.ts:86-92`
**Issue:** The guard is `if (json.count === 0)`, but the data actually written is
`json.results`. If the API returns a non-zero `count` with an empty or missing
`results` array (pagination edge, partial response, schema drift), the guard
passes and `results[0]` at line 127 is `undefined`, so `row[f.property]` throws an
opaque `TypeError` ("Cannot read properties of undefined") instead of the intended
clear "Zero results" message. The single-filter path would silently write `[]`.
**Fix:** Guard on the array that is consumed:
```typescript
if (!Array.isArray(json.results) || json.results.length === 0) {
  throw new Error(`Zero results: dataset=${datasetId} / ${property}=${value}`);
}
```

### WR-04: Required text fields accept empty/whitespace strings as valid

**File:** `medelite-report/src/lib/cms/schema.ts:34-37`
**Issue:** `provider_name`, `legal_business_name`, `provider_address`, `citytown`,
and `state` are `z.string()` with no non-empty constraint. Verified that
`z.string()` accepts `""` and `"   "`. CMS suppresses values by returning empty
strings (per CLAUDE.md), so a row where, e.g., `legal_business_name` is suppressed
to `""` validates successfully and a blank facility name flows into the report
body under "Name of Facility". This is the textual analogue of the rating-
suppression handling that the numeric fields go to lengths to catch.
**Fix:** Apply `.min(1)` (or `.trim().min(1)`) to fields that must be present for a
usable report — at minimum `state` (drives the header) and the name fields:
```typescript
provider_name: z.string().trim().min(1),
legal_business_name: z.string().trim().min(1),
state: z.string().trim().min(1),
```
If suppressed text must be tolerated, model it explicitly (nullable + downstream
fallback) rather than letting `""` pass as a real value.

### WR-05: `safeParseCMSRow` has no explicit return type — leaks inferred Zod internals across the module boundary

**File:** `medelite-report/src/lib/cms/parse.ts:33-35`
**Issue:** `safeParseCMSRow` relies on TypeScript inference for its return type.
Its documented purpose is to be the public, structured-error API for callers, yet
its signature is whatever Zod's `safeParse` happens to infer this version. Under
`isolatedModules` + strict mode this compiles, but it makes the API contract
version-fragile (a Zod minor bump that changes the `SafeParseReturnType` shape
silently changes this function's public type) and harder to consume from Phase 2.
**Fix:** Annotate the return type explicitly:
```typescript
import type { ZodSafeParseResult } from "zod";
export function safeParseCMSRow(
  raw: unknown,
): ZodSafeParseResult<ParsedProvider> {
  return CMSRowSchema.safeParse(raw);
}
```

## Info

### IN-01: No test exercises the "missing key" vs "null value" distinction for D-05

**File:** `medelite-report/tests/lib/cms/schema.test.ts:54-64`
**Issue:** D-05's stated contract is "required keys with nullable values — a
**missing key** fails loud." Tests cover empty-string→null (suppressed) and a
fully missing-key object, but none asserts that an explicit `null` value for a
rating is accepted while the same key being *absent* is rejected. This is the
exact line the design draws, and it is the behavior most likely to regress if the
schema is later switched to `.optional()`.
**Fix:** Add a test with `overall_rating: null` (expect success, value null) paired
with one omitting the key entirely (expect failure), so the missing-vs-null
boundary is pinned.

### IN-02: No test covers the boolean/array coercion hole flagged in CR-01

**File:** `medelite-report/tests/lib/cms/schema.test.ts`
**Issue:** Once CR-01 is fixed, lock the behavior with a regression test so the
coercion hole cannot silently reopen.
**Fix:** After fixing CR-01, add a test asserting
`CMSRowSchema.safeParse({ ...validRow, overall_rating: true }).success === false`
(and similarly for `[]`).

### IN-03: `captureFixtures` is exported but the file also self-invokes on import

**File:** `medelite-report/scripts/capture-fixture.ts:97, 140-143`
**Issue:** `captureFixtures` is `export`ed (good for `isolatedModules`/testing), but
the module unconditionally calls `captureFixtures().catch(... process.exit(1))` at
load time. Any test or tooling that imports this module to reach the exported
function would trigger a live CMS fetch and a `process.exit(1)` on failure. Today
nothing imports it, so this is informational, but the self-invocation should be
guarded if the function is ever unit-tested.
**Fix:** Gate the auto-run, e.g. run it only when invoked as the entry script, or
move the invocation into a thin separate bin file that imports `captureFixtures`.

---

_Reviewed: 2026-06-17T00:59:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
