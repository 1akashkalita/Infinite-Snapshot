---
phase: 04-pdf-export
reviewed: 2026-06-18T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - medelite-report/src/lib/report/slug.ts
  - medelite-report/tests/lib/slug.test.ts
  - medelite-report/src/components/pdf/ReportPDF.tsx
  - medelite-report/src/app/api/export/pdf/route.tsx
  - medelite-report/tests/api/export-pdf.test.ts
  - medelite-report/src/components/DownloadPdfButton.tsx
  - medelite-report/src/components/SnapshotApp.tsx
findings:
  critical: 1
  warning: 3
  info: 4
  total: 8
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-06-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the PDF-export slice: the `slugFilename` helper and its tests, the server-only `ReportPDF` document, the `POST /api/export/pdf` route, the route tests, the client `DownloadPdfButton`, and the `SnapshotApp` orchestrator.

The server-only / client-bundle discipline (rule #4 / PITFALLS #4) is correctly honored: `DownloadPdfButton` and `SnapshotApp` import `ReportViewModel` only as a type and never reach for `@react-pdf/renderer` or `ReportPDF`. The static header block (rule #2) is wired with `vm.header.*` only and never `displayName`. The route validates the body with `ReportViewModelSchema` and returns a clean envelope with no Zod internals. `next.config.ts` carries `serverExternalPackages`.

However, there is one real, exploitable defect: the **`Content-Disposition` header-injection guarantee is false for the CCN fallback path**. The slug helper sanitizes `displayName` but emits the CCN *verbatim* when the display slug is empty, and `ccn` is validated only as `z.string()` against a fully client-controlled POST body. That is a BLOCKER. Three warnings concern a missing cross-field check (`careCompareUrl` vs `ccn`), a fragile non-`await` revoke ordering interplay, and a stale/misleading test contract comment that masks the gap.

## Critical Issues

### CR-01: Content-Disposition header injection via verbatim CCN fallback

**File:** `medelite-report/src/lib/report/slug.ts:38` and `medelite-report/src/app/api/export/pdf/route.tsx:66-74`
**Issue:**
`slugFilename` sanitizes `displayName` (strips every non-`[a-z0-9]` run to hyphens), but when the resulting slug is empty it falls back to `` `${ccn}-Snapshot.pdf` `` using the CCN **verbatim** (line 38). The route then interpolates that filename directly into a raw header string at route.tsx:74:

```
"Content-Disposition": `attachment; filename="${filename}"`
```

The CCN reaching this path comes from the **client-controlled POST body** and is validated only as `ccn: z.string()` in `ReportViewModelSchema` (view-model.ts:60) — no length, charset, or pattern constraint. A crafted body that (a) sets `displayName` to all-special-chars (e.g. `"!!!"`) so the slug empties and the fallback fires, and (b) sets `ccn` to a string containing a double-quote, CR, or LF — e.g. `x"\r\nSet-Cookie: evil=1` — injects arbitrary bytes into the response header. This is a classic HTTP response-header / Content-Disposition injection (header splitting, filename spoofing, cookie injection depending on the downstream HTTP stack).

The header comment in slug.ts:14-17 explicitly *claims* injection-safety ("quotes, CRLF, slashes, `..`, and other header-injection / path-traversal payloads cannot survive") and points to the test as proof — but that test (`tests/lib/slug.test.ts:34-40`) only exercises the **displayName** path. The CCN-fallback path has no sanitization and no test. The security note is therefore false as written.

Note: `careCompareUrl` being independently constrained to `www.medicare.gov` (view-model.ts:89-105) does NOT mitigate this — nothing ties `ccn` to `careCompareUrl`, so a clean URL and a malicious `ccn` coexist in the same valid body (see WR-01).

**Fix:** Sanitize the CCN in the fallback the same way the displayName is sanitized (it is also ASCII-alphanumeric in practice — CMS CCNs are 6-char alphanumerics). At minimum, restrict to a safe charset in `slugFilename`, and/or tighten the schema. Both layers are cheap:

```ts
// slug.ts
export function slugFilename(displayName: string, ccn: string): string {
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // Sanitize the CCN fallback too — never emit a client-controlled string verbatim
  // into the Content-Disposition header (RFC 6266 token / header-injection safety).
  const safeCcn = ccn.replace(/[^A-Za-z0-9]/g, "");
  const stem = slug || safeCcn || "facility";
  return `${stem}-Snapshot.pdf`;
}
```

```ts
// view-model.ts — defense in depth at the validation boundary
ccn: z.string().regex(/^[A-Za-z0-9]{1,12}$/, "ccn must be alphanumeric"),
```

Add a test asserting the CCN fallback strips quotes/CRLF (mirror the existing T-04-03 displayName case for the `ccn` argument).

## Warnings

### WR-01: No cross-field check that careCompareUrl matches the posted ccn

**File:** `medelite-report/src/lib/report/view-model.ts:60,89-105`
**Issue:** The schema validates `ccn` and `careCompareUrl` independently. In the normal `assembleViewModel` path the URL is derived from the CCN, but `POST /api/export/pdf` validates an arbitrary client body — there is no `.refine` linking the two. A caller can submit a valid `www.medicare.gov` URL with a totally unrelated (or malicious, per CR-01) `ccn`. Beyond the CR-01 injection angle, this also lets the rendered PDF's clickable link point at a different facility than the filename/body imply — a correctness/integrity gap for a route whose whole contract is "this PDF describes facility X."
**Fix:** Add a `superRefine` (or object-level `.refine`) asserting `careCompareUrl` ends with `/nursing-home/${ccn}`, so the two fields cannot diverge in a posted body:

```ts
}).refine(
  (m) => m.facility.careCompareUrl.endsWith(`/nursing-home/${m.facility.ccn}`),
  { message: "careCompareUrl must reference the posted ccn" },
);
```

### WR-02: Object URL revocation races the download in some browsers

**File:** `medelite-report/src/components/DownloadPdfButton.tsx:60-68`
**Issue:** `URL.revokeObjectURL(url)` runs synchronously on the line immediately after `a.click()` (and after `removeChild`). For same-tick anchor downloads this is usually fine, but several browsers (notably older Safari/WebKit and some mobile engines) start fetching the object URL asynchronously after the click handler returns; revoking in the same synchronous frame can cancel or corrupt the download. The blob is also never released on the early-`return`/error paths (acceptable, since `createObjectURL` isn't called there), but the success path's revoke timing is the live risk.
**Fix:** Defer the revoke (and DOM cleanup) so the navigation/download starts first:

```ts
a.click();
// Defer cleanup so the browser begins the download before the URL is revoked.
setTimeout(() => {
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}, 0);
```

### WR-03: Stale test-contract comments describe a 501 stub that no longer exists

**File:** `medelite-report/tests/api/export-pdf.test.ts:8-11` (and the block header at 79-84)
**Issue:** The file-level comment still states the contract as "Valid ReportViewModel → 501 { error: { kind: 'not_implemented' } }" and lines 83-84 claim the Phase-4 block "is RED against the current 501 stub." The route now returns 200 with a PDF (route.tsx:65-76); these comments are factually wrong. This is more than cosmetic: a reviewer or future maintainer trusting these comments would believe a not_implemented contract is still in force and could mis-scope changes. More importantly, the comments document the *intended* behavior of the route, and stale intent-documentation is how the CR-01 gap survived — the tests assert only the happy path and the displayName injection case, never the CCN-fallback injection that the slug.ts comment promised was covered.
**Fix:** Update the file-level and block comments to describe the shipped 200/`application/pdf` contract, and add the missing adversarial test for a malicious `ccn` in the fallback path (drive a body with all-special-char `displayName` + a CCN containing `"` / `\r\n`, assert the resulting `Content-Disposition` contains neither).

## Info

### IN-01: formatLocation does not guard against empty address parts

**File:** `medelite-report/src/lib/report/format.ts:55-61`
**Issue:** `formatLocation` always joins `street, city, state` with `", "`. If CMS returns an empty string for, say, `street` (suppressed/missing), the PDF renders a leading `, Miami, FL`. The schema types these as `z.string()` (view-model.ts:67-69), so `""` is valid and reaches here. Not a correctness bug in the common case, but a cosmetic defect on sparse records.
**Fix:** Filter empties before joining: `[street, city, state].filter(Boolean).join(", ")`.

### IN-02: Document title metadata carries the raw facility name unbounded

**File:** `medelite-report/src/components/pdf/ReportPDF.tsx:142`
**Issue:** `<Document title={vm.facility.displayName}>` writes the client-controllable display name verbatim into the PDF Info dictionary (the test at export-pdf.test.ts:141 even asserts it appears uncompressed). `@react-pdf/renderer` escapes PDF string syntax, so this is not an injection, but it is worth noting that the title is the one place the body name is fully uncontrolled in length/content. Low risk; flagged for awareness only.
**Fix:** None required; optionally cap length for tidy metadata.

### IN-03: `a.download = "report.pdf"` hint diverges from the server filename

**File:** `medelite-report/src/components/DownloadPdfButton.tsx:64`
**Issue:** The anchor sets a static `download="report.pdf"` hint while the server sends the real slugged filename via `Content-Disposition`. For same-origin fetch-then-blob downloads, the `a.download` attribute generally wins over the response header (the blob URL has no header context), so the user may receive `report.pdf` rather than `kendall-lakes-...-Snapshot.pdf`. The code comment claims "the server Content-Disposition controls the real filename," which is typically not true for blob-URL anchor downloads.
**Fix:** Either parse the filename from the response `Content-Disposition` and set `a.download` to it, or accept the static name and correct the comment so it doesn't assert behavior the browser won't honor.

### IN-04: Empty-catch swallows the export failure cause with no diagnostics

**File:** `medelite-report/src/components/DownloadPdfButton.tsx:69-72`
**Issue:** The `catch {}` discards the error entirely and shows a fixed string. That is correct for user-facing messaging (D-08), but it leaves zero client-side breadcrumb for debugging a genuine failure (e.g. a 500 with a useful body, a thrown TypeError). Not a correctness defect.
**Fix:** Optionally `catch (err) { console.error("PDF export failed", err); ... }` to retain a dev console trail without surfacing internals to the user.

---

_Reviewed: 2026-06-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
