---
phase: 03-web-ui-core-flow-deployment
reviewed: 2026-06-17T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - medelite-report/src/app/layout.tsx
  - medelite-report/src/app/page.tsx
  - medelite-report/src/components/CCNSearchBar.tsx
  - medelite-report/src/components/ErrorBanner.tsx
  - medelite-report/src/components/ManualInputsForm.tsx
  - medelite-report/src/components/ReportPreview.tsx
  - medelite-report/src/components/SnapshotApp.tsx
  - medelite-report/src/lib/report/view-model.ts
  - medelite-report/src/lib/ui/ccn.ts
  - medelite-report/src/lib/ui/error-presentation.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-06-17
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the Phase 3 web-UI core flow: root layout, page, the CCN search bar, error banner, manual-inputs form, report preview, the SnapshotApp state owner, the view-model assembler, and the two UI helper modules (CCN normalize/validate, error presentation). I traced the fetch → error-routing → view-model → preview data flow and cross-referenced the supporting layer (`@/lib/cms/errors`, `@/lib/cms/types`, `@/lib/report/format`, `@/lib/report/header`, and the `/api/facility` route handler).

The client/server boundary is respected (no `@/lib/cms/client` or `@react-pdf/renderer` imported into client components), the static-header rule is honored (`assembleHeader` is called with state only; `displayName` never reaches the header), URL hardening on `careCompareUrl` is correct, and React inputs are properly controlled. JSX auto-escaping covers XSS for the rendered manual fields.

One real correctness bug stands out and directly violates a documented project invariant: the `currentCensus` numeric field uses `|| null`, which collapses a legitimately-entered `0` to `null` (renders `—`). The same class of issue the project's `=== null` formatter rule exists to prevent. Several robustness/a11y warnings follow.

## Critical Issues

### CR-01: `currentCensus` `|| null` discards a legitimate census of 0

**File:** `medelite-report/src/components/ManualInputsForm.tsx:99-104`
**Issue:** The numeric `currentCensus` handler uses `e.target.valueAsNumber || null`. Because `0` is falsy, a user who types `0` (a real, valid census — e.g. a newly licensed or fully discharged wing) produces `0 || null === null`, which the view-model stores as `null` and the preview renders as `—` (ReportPreview.tsx:137-139, `!= null` check). The user's entered `0` silently vanishes and cannot be represented.

This is the exact falsiness-vs-`=== null` trap the project's standing rule warns about ("a real 0 renders '0', null renders 'N/A'; flag any `||` fallback that would turn 0 into N/A"). The field comment at lines 16-17 even claims "non-numeric entry resolves to null rather than NaN" — but the chosen operator over-reaches and also nukes `0`.

Note `valueAsNumber` returns `NaN` (not `0`) for empty/non-numeric input, so the fix must guard `NaN` explicitly rather than relying on falsiness.

**Fix:**
```tsx
onChange={(e) => {
  const n = e.target.valueAsNumber;
  onChange({
    ...inputs,
    currentCensus: Number.isNaN(n) ? null : n,
  });
}}
```

## Warnings

### WR-01: `not_found` inline error never clears after a successful re-search

**File:** `medelite-report/src/components/CCNSearchBar.tsx:64-68`, `medelite-report/src/components/SnapshotApp.tsx:84-104`
**Issue:** `displayedError` is `localError ?? (inlineError ? ... : null)`. `inlineError` is derived from the parent's `errorState`. On a new search, `handleSearch` sets `setErrorState(null)` at the start (SnapshotApp.tsx:85), so a prior inline `not_found` does clear during the request — good. However, the inline error does NOT clear on keystroke the way `localError` does: typing in the box runs `setLocalError(null)` (line 86) but leaves the parent's `errorState`/`inlineError` intact. So after a `not_found`, as the user edits the CCN to correct it, the stale `No facility found for CCN "…"` message stays pinned under the field until they actually submit. This is a confusing UX state (the message references a CCN no longer in the box). Recommend clearing the parent inline error on edit, e.g. lifting an `onInputChange`/`onDirty` callback so the parent can `setErrorState(null)`.
**Fix:** Add a prop the input calls on change to let the parent reset the server inline error:
```tsx
onChange={(e) => {
  setCcn(e.target.value);
  setLocalError(null);
  onInputChange?.(); // parent: setErrorState(null) so stale not_found clears
}}
```

### WR-02: `handleSearch` trusts response shape without checking `res.ok` or `error` presence

**File:** `medelite-report/src/components/SnapshotApp.tsx:89-104`
**Issue:** The handler never inspects `res.ok`/`res.status` and discriminates purely on `"data" in json`. If the route ever returns a JSON body that is neither `{ data }` nor `{ error: {...} }` (shape drift, a proxy/CDN injecting a JSON error envelope, a future route bug), the `else` branch runs `setErrorState(json.error)` with `json.error === undefined`. That pushes `undefined` into `errorState`, and the downstream `getErrorPresentation(errorState)` (SnapshotApp.tsx:127) would dereference `undefined.kind` and crash the render. The happy path is fine for the current controlled route, but the client should validate the envelope it receives (the project validates CMS data with Zod on the server; the client should at least narrow the error before trusting it).
**Fix:** Guard the error branch and/or validate with `CmsApiErrorSchema`:
```tsx
} else if (json && typeof json === "object" && "error" in json && json.error) {
  const parsed = CmsApiErrorSchema.safeParse(json.error);
  setErrorState(parsed.success ? parsed.data : NETWORK_FALLBACK);
  setFacilityData(null);
  setFetchState("error");
} else {
  // Unexpected shape — treat as a transient error, never push undefined
  setErrorState({ kind: "cms_api_error", message: "Unexpected response." });
  setFacilityData(null);
  setFetchState("error");
}
```

### WR-03: Redundant/divergent error-placement logic can silently disagree

**File:** `medelite-report/src/components/SnapshotApp.tsx:52-65, 126-133`
**Issue:** Placement is computed two ways: `getErrorPresentation(errorState).placement` (the canonical mapping) and a locally duplicated `isBannerError(kind)` switch. Line 130 ORs them: `placement === "banner" || isBannerError(errorState.kind)`. If the two ever disagree (e.g. a future kind is added to `error-presentation.ts` as `inline` but the local switch defaults it to banner, or vice versa), the banner uses one rule and `inlineError` (line 133, which relies solely on `placement === "inline"`) uses the other — producing an error that renders in BOTH places or NEITHER. The comment at lines 47-50 admits `isBannerError` is "a mirror of getErrorPresentation(...).placement," which is duplicated source-of-truth. Drop the local mirror and route entirely off `placement`.
**Fix:**
```tsx
const bannerError = placement === "banner" ? errorState : null;
const inlineError = placement === "inline" ? errorState : null;
// delete isBannerError() entirely — getErrorPresentation is the single source of truth
```

### WR-04: `formatDate(new Date("YYYY-MM-DD"))` / unused `generatedAt` round-trip risk is not exercised, and preview shows a raw processingDate

**File:** `medelite-report/src/components/ReportPreview.tsx:192-194`
**Issue:** The preview footer prints `vm.facility.processingDate` directly as a raw string (e.g. `2026-05-01`) instead of routing it through the existing `formatDate` helper that was built specifically for this (with explicit `timeZone: "UTC"` to avoid the midnight off-by-one, per format.ts:63-78). Using the raw ISO date is inconsistent with the formatter discipline applied to every other field in this component (`formatRating`/`formatBeds`/`formatLocation`) and ships a less-polished date string than the helper produces. Low-severity correctness/consistency gap, not a crash.
**Fix:**
```tsx
import { formatRating, formatBeds, formatLocation, formatDate } from "@/lib/report/format";
// ...
CMS processing date: {formatDate(vm.facility.processingDate)}
```

## Info

### IN-01: Two disabled mechanisms applied redundantly to manual inputs

**File:** `medelite-report/src/components/ManualInputsForm.tsx:42-43, 65, 81, 105, ...`
**Issue:** The `<fieldset disabled={disabled}>` already disables every nested control natively, yet each `<input>`/`<select>` also passes `disabled={disabled}` individually. Harmless and arguably defensive, but redundant — the per-control props can be removed since `fieldset[disabled]` is sufficient and the `disabled:` Tailwind variants still apply.
**Fix:** Optionally drop the per-control `disabled={disabled}` props and rely on the fieldset.

### IN-02: `<input maxLength={10}>` diverges from the documented 6-char gate

**File:** `medelite-report/src/components/CCNSearchBar.tsx:89`
**Issue:** The CCN input caps at `maxLength={10}`, but `isValidCcnFormat` requires exactly 6 chars and the server slices to 20 then gates on `{6}`. The `10` is a magic number that matches neither the 6-char format nor the server's 20-char cap; its only effect is to let users type up to 10 chars that will always fail the 6-char check. Not a bug (the gate still rejects), but the cap is arbitrary. Consider `maxLength={6}` to match the actual format, or document why 10.
**Fix:** `maxLength={6}` (or a named constant shared with `CCN_REGEX`).

### IN-03: `vm` re-assembled on every render without memoization

**File:** `medelite-report/src/components/SnapshotApp.tsx:120-122`
**Issue:** `assembleViewModel(facilityData, manualInputs, new Date())` runs on every render (every keystroke), and because it passes a fresh `new Date()` each call, the returned object identity always changes — so any future `React.memo`/`useMemo`-based child optimization on `vm` would be defeated. Functionally correct today (the assembler is pure and cheap, and per D-12 `new Date()` is legitimately injected here), and performance is out of v1 scope, but worth a `useMemo` keyed on `[facilityData, manualInputs]` if/when preview cost grows. Flagged as info only.
**Fix:** Optionally `const vm = useMemo(() => facilityData ? assembleViewModel(facilityData, manualInputs, new Date()) : null, [facilityData, manualInputs]);`

---

_Reviewed: 2026-06-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
