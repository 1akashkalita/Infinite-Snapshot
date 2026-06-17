---
phase: 02-api-routes-view-model-config
reviewed: 2026-06-17T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - medelite-report/src/lib/cms/constants.ts
  - medelite-report/src/lib/cms/types.ts
  - medelite-report/src/lib/cms/errors.ts
  - medelite-report/src/lib/cms/mapper.ts
  - medelite-report/src/lib/cms/client.ts
  - medelite-report/src/app/api/facility/route.ts
  - medelite-report/src/lib/report/header.ts
  - medelite-report/src/lib/report/format.ts
  - medelite-report/src/lib/report/view-model.ts
  - medelite-report/src/app/api/export/pdf/route.ts
  - medelite-report/next.config.ts
findings:
  critical: 3
  warning: 2
  info: 3
  total: 8
status: resolved
resolution:
  resolved_in: 74f18e1
  critical_fixed: [CR-01, CR-02, CR-03]
  warning_fixed: [WR-01, WR-02]
  info_deferred: [IN-01, IN-02, IN-03]
  note: "Critical + Warning findings fixed with +7 tests; verify:full green (127 passed). Info findings deferred as cosmetic/low-impact."
---

# Phase 02: Code Review Report

> **Resolution (2026-06-17, commit 74f18e1):** All 3 Critical and 2 Warning findings fixed
> with test coverage; `npm run verify:full` green (127 tests, next build ok). The 3 Info
> findings (IN-01 dead `[a-z]` regex range, IN-02 redundant `.slice(0,20)`, IN-03 `formatDate`
> "Invalid Date" string) are deferred as cosmetic/low-impact.

**Reviewed:** 2026-06-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** resolved (was: issues_found)

## Summary

Reviewed the full Phase 02 source: CMS constants/types/errors/schema/mapper/client, the GET
`/api/facility` route, the report header/formatter/view-model layer, the POST
`/api/export/pdf` stub, and `next.config.ts`. Test files were skimmed for security-invariant
coverage (errors.test.ts, client.test.ts, facility.test.ts, export-pdf.test.ts,
view-model.test.ts, header.test.ts, format.test.ts).

The foundation is well-designed: Zod discriminated-union error taxonomy, SSRF-safe URL
construction, correct CCN filter field, D-05 leak prevention, assembleHeader with no
facility-name argument, and === null checks in formatters. Three blockers were found:

1. Two unhandled-exception paths that convert expected failure modes into raw 500s
   instead of typed 4xx/5xx responses (client.ts and pdf/route.ts).
2. The `careCompareUrl` field in `ReportViewModelSchema` accepts `javascript:` and
   `data:` URIs — verified live against Zod v4 — which will become an injection vector
   the moment Phase 4 renders it as a `<Link>` in the PDF.

**Summary count:** 3 Critical / 2 Warning / 3 Info — 8 total findings.

---

## Critical Issues

### CR-01: `resp.json()` outside try/catch — CMS non-JSON 200 response escapes as raw 500

**File:** `medelite-report/src/lib/cms/client.ts:73`

**Issue:** The `try/catch` block (lines 52–61) wraps only the `fetch()` call. The subsequent
`resp.json()` on line 73 is outside that guard. If CMS returns a 200 with a non-JSON body
(e.g. a maintenance page or a truncated response), `resp.json()` throws a `SyntaxError`. In
the route handler (`route.ts:76`) the catch tests `if (!(err instanceof CmsError)) throw err` —
a `SyntaxError` is not a `CmsError`, so it re-throws and Next.js returns a raw 500 with no
envelope. The established error taxonomy (D-01, D-18) breaks: callers receive an opaque 500
instead of a `cms_api_error` 502 with the standard `{ error: { kind, message } }` envelope.
No test covers this path.

**Fix:** Wrap the JSON parse and shape access in the same error classification block:

```typescript
// After resp.ok check, replace bare resp.json() with:
let json: { count: number; results: unknown[] };
try {
  const raw = await resp.json();
  if (
    raw === null ||
    typeof raw !== "object" ||
    !Array.isArray((raw as Record<string, unknown>).results)
  ) {
    throw new TypeError("Unexpected CMS response shape");
  }
  json = raw as { count: number; results: unknown[] };
} catch {
  throw new CmsError(
    "cms_api_error",
    "CMS returned an unexpected response — please try again.",
  );
}
```

This keeps the `results` access guarded (see CR-02) and extends the `cms_api_error` kind to
cover malformed JSON responses without widening the error taxonomy.

---

### CR-02: Unvalidated `json.results` shape — `TypeError` on access escapes as raw 500

**File:** `medelite-report/src/lib/cms/client.ts:73-76`

**Issue:** Line 73 uses a TypeScript type assertion (`as { count: number; results: unknown[] }`)
— this is not a runtime check. If CMS changes its response envelope (e.g. returns
`{ data: [...] }` instead of `{ results: [...] }`), `json.results` is `undefined` at runtime.
Line 76 then executes `json.results.length`, throwing `TypeError: Cannot read properties of
undefined`. Like CR-01, this `TypeError` is not a `CmsError`, so the route re-throws it and
Next.js produces a raw 500. The fix for CR-01 (structural check on `results` before
assignment) resolves this finding simultaneously.

**Fix:** Covered by the CR-01 fix — the `Array.isArray(raw.results)` guard makes the shape
check a runtime assertion rather than a TypeScript cast.

---

### CR-03: `ReportViewModelSchema` accepts `javascript:` and `data:` URIs in `careCompareUrl`

**File:** `medelite-report/src/lib/report/view-model.ts:81`

**Issue:** `careCompareUrl: z.string().url()` relies on Zod v4's `.url()` validator, which
delegates to the WHATWG URL constructor. Both `javascript:alert(1)` and
`data:text/html,<script>alert(1)</script>` parse as structurally valid URLs and pass the
schema — verified live against the installed Zod version:

```
PASS  javascript:alert(1)
PASS  data:text/html,<script>alert(1)</script>
```

The `POST /api/export/pdf` body is fully client-controlled: any caller can POST a valid
`ReportViewModel` with a modified `careCompareUrl`. When Phase 4 replaces the 501 stub with
`renderToBuffer` and renders `careCompareUrl` as a `<Link>` inside the PDF, an attacker can
produce a PDF containing a `javascript:` or `data:` link. Several PDF readers (including
Adobe Acrobat) execute `javascript:` links; `data:` URIs enable phishing and content
injection. The schema is the enforcement point — if it is not fixed before Phase 4 lands,
the injection surface is live on the first real PDF export.

**Fix:** Replace `z.string().url()` with a `.refine()` that enforces the exact expected
origin:

```typescript
careCompareUrl: z
  .string()
  .url()
  .refine(
    (u) => {
      try {
        const parsed = new URL(u);
        return (
          parsed.protocol === "https:" &&
          parsed.hostname === "www.medicare.gov" &&
          parsed.pathname.startsWith(
            "/care-compare/details/nursing-home/",
          )
        );
      } catch {
        return false;
      }
    },
    { message: "careCompareUrl must be a Medicare Care Compare facility URL" },
  ),
```

Additionally, `assembleViewModel` always constructs `careCompareUrl` from a Zod-validated
`facility.ccn`, so no legitimate caller should ever submit a different domain. This refine
enforces that invariant at the POST boundary.

---

## Warnings

### WR-01: `POST /api/export/pdf` — `request.json()` uncaught — malformed body returns raw 500 instead of 400

**File:** `medelite-report/src/app/api/export/pdf/route.ts:22`

**Issue:** `const body: unknown = await request.json()` is not wrapped in a `try/catch`. If
the POST body is not valid JSON (e.g. empty body, `Content-Type: text/plain` with arbitrary
text, or a truncated upload), `request.json()` throws a `SyntaxError` which propagates
unhandled and becomes a Next.js 500 Internal Server Error. The route's stated contract is
`400` for bad input; a raw 500 breaks the contract and potentially leaks a stack trace in
development. No test covers this path.

**Fix:**

```typescript
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { kind: "invalid_request", message: "Invalid report data." } },
      { status: 400 },
    );
  }

  const parseResult = ReportViewModelSchema.safeParse(body);
  // ... rest unchanged
}
```

---

### WR-02: Lowercase-alphanumeric CCN normalization test is vacuous

**File:** `medelite-report/tests/api/facility.test.ts:202-211`

**Issue:** The test titled `"uppercases lowercase CCN before passing to fetch"` is described
as covering alphanumeric state codes (e.g. `"ab1234"` uppercased to `"AB1234"`) but actually
submits CCN `686123` — a purely numeric string for which `toUpperCase()` is a no-op. The
test passes trivially and provides zero coverage of the actual normalization being tested:
that a lowercase alpha-CCN like `"ab1234"` is uppercased to `"AB1234"` before the CMS
condition value is set. If the route's `.toUpperCase()` call were removed, this test would
still pass.

**Fix:** Replace with a test that uses an alphanumeric CCN with lowercase letters:

```typescript
it("uppercases lowercase CCN before passing to fetch: ab1234 → AB1234", async () => {
  const capturedUrls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      capturedUrls.push(url);
      return Promise.resolve(
        new Response(JSON.stringify({ count: 0, results: [] }), { status: 200 }),
      );
    }),
  );
  const req = new NextRequest("http://localhost/api/facility?ccn=ab1234");
  await GET(req);
  // The CMS condition value must be AB1234, not ab1234
  expect(capturedUrls[0]).toContain("AB1234");
  expect(capturedUrls[0]).not.toContain("ab1234");
});
```

---

## Info

### IN-01: Lowercase character class `[a-z]` in CCN regex is dead code after `.toUpperCase()`

**File:** `medelite-report/src/app/api/facility/route.ts:55,58`

**Issue:** Line 55 calls `.toUpperCase()` before line 58 tests `/^[A-Za-z0-9]{6}$/`. After
uppercasing, no character in `ccn` can be `[a-z]`, making the lowercase half of the character
class unreachable. This is harmless (the regex still accepts the right inputs) but is
misleading to readers and inconsistent — the comment says `[A-Za-z0-9]` but only `[A-Z0-9]`
is actually possible at that point.

**Fix:** Either use `/^[A-Z0-9]{6}$/` in the gate (matching the uppercased string), or move
the gate before `.toUpperCase()` and use `/^[A-Za-z0-9]{6}$/i`. The former is simpler:

```typescript
const ccn = raw.trim().toUpperCase().slice(0, 20);
if (!/^[A-Z0-9]{6}$/.test(ccn)) {
```

---

### IN-02: `.slice(0, 20)` cap on CCN is redundant with the `{6}` length gate

**File:** `medelite-report/src/app/api/facility/route.ts:55`

**Issue:** The comment says the `.slice(0, 20)` "ensures we only echo a short safe string
(D-07)". However, the subsequent `/^[A-Za-z0-9]{6}$/` gate rejects anything that is not
exactly 6 characters. A 21-character input fails the gate regardless of the slice; a
6-character input passes regardless of the slice. The slice therefore has no effect on the
final echoed value and adds false confidence. The echoed `ccn` in the `not_found` response
(line 90) is always the gate-passed 6-character string.

**Fix:** Remove the `.slice(0, 20)`:

```typescript
const ccn = raw.trim().toUpperCase();
```

The `{6}` length constraint in the regex is the correct and sufficient guard.

---

### IN-03: `formatDate` silently produces `"Invalid Date"` for non-date strings

**File:** `medelite-report/src/lib/report/format.ts:71`

**Issue:** `formatDate` calls `new Date(value)` on its string argument and immediately calls
`.toLocaleDateString()`. If `value` is not a recognizable date string (e.g. a CMS field that
ships a human-readable string like `"N/A"` or a mis-mapped column), `new Date(value)` returns
an `Invalid Date` object and `.toLocaleDateString()` returns the string `"Invalid Date"` in
most environments. The `processingDate` field in `CMSRowSchema` is typed `z.string()` (no
date-format constraint), so a malformed CMS value would propagate silently to the rendered
output. No test covers this path.

**Fix (option A — guard in formatter):**

```typescript
export function formatDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return PLACEHOLDER; // treat invalid date as N/A
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
```

**Fix (option B — tighten schema):** Add a `.regex(/^\d{4}-\d{2}-\d{2}/)` constraint to
`processing_date` in `CMSRowSchema` so non-date strings are caught at the Zod boundary rather
than silently rendered. Both fixes together are strongest.

---

_Reviewed: 2026-06-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
