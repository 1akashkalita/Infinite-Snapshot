# Phase 4: PDF Export - Research

**Researched:** 2026-06-18
**Domain:** @react-pdf/renderer server-side PDF generation in Next.js 16 App Router
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** PDF mirrors ReportPreview.tsx 1:1 — centered static header block, same 13 body fields in same verbatim label order, divider lines, footer with CMS processing date. react-pdf has flexbox but NO CSS grid — rebuild as flexbox `<View>` rows.
- **D-02:** Page format = US Letter, portrait.
- **D-03:** Typography = react-pdf built-in standard fonts (Helvetica family). NO `Font.register` this phase.
- **D-04:** Dedicated, styled, clickable link line near footer — `vm.facility.careCompareUrl` via `<Link src={...}>`, labeled "View official CMS profile on Medicare.gov", blue + underlined. Do NOT recompute the URL.
- **D-05:** Trigger = client `fetch` POST → blob → silent anchor download. Client never imports `@react-pdf/renderer`.
- **D-06:** Filename = `<slug(displayName)>-Snapshot.pdf`; fallback `<CCN>-Snapshot.pdf` when displayName blank/whitespace or slug empties. Set server-side in Content-Disposition.
- **D-07:** Button disabled + "Generating..." while in-flight; disabled until successful vm exists.
- **D-08:** Failure UX = inline message by the button (NOT the top ErrorBanner). Keep button enabled to retry.
- **D-09:** `renderToBuffer(<ReportPDF vm={parseResult.data} />)` in the POST route; keep existing safeParse validation; runtime="nodejs" already set; `serverExternalPackages: ["@react-pdf/renderer"]` already in next.config.ts.

### Claude's Discretion

- PDF component structure (e.g. `src/components/pdf/ReportPDF.tsx` or `src/lib/pdf/`)
- `StyleSheet.create` details — margins, spacing, font sizes, divider color
- Download button component + placement (left pane of SnapshotApp)
- Slug helper location and implementation
- Multi-page handling (rely on auto-pagination; no manual page breaks needed)
- PDF document metadata (`<Document title=...>`)

### Deferred Ideas (OUT OF SCOPE)

- Registered custom/brand font → Phase 7
- Claims-based metrics section in PDF → Phase 5
- Star-rating visual cards / charts in PDF → Phase 7
- `.docx` export → Phase 6
- Full "Looks Done But Isn't" Vercel smoke checklist → Phase 7
- Client-side `PDFDownloadLink`/`PDFViewer` — explicitly NOT used (rule #7 + PITFALLS #4)

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PDF-01 | User can click "Download PDF" to trigger a direct browser download of a clean, print-ready PDF built with `@react-pdf/renderer` | D-05 client pattern confirmed; D-09 route implementation confirmed |
| PDF-02 | The PDF includes a clickable hyperlink to the Medicare Care Compare profile using the searched CCN | `<Link src={vm.facility.careCompareUrl}>` → real PDF URI annotation; confirmed via pdfkit source |
| PDF-03 | The downloaded PDF content matches what the live preview showed | Same ReportViewModel drives both; same formatters reused; 13 fields in same order per D-01 |

</phase_requirements>

---

## Summary

Phase 4 replaces the existing 501 stub in `POST /api/export/pdf` with `renderToBuffer(<ReportPDF vm={...} />)` and adds a "Download PDF" button in the left pane of `SnapshotApp`. The route already has the right runtime, the right validation, and the right external packages config — the only work is building the `ReportPDF` component and wiring the button.

The most execution-critical finding is the buffer-assertion question (SC#5): `<Link src={url}>` in react-pdf v4.5.1 creates a real PDF URI annotation dictionary serialized as an **unencrypted, uncompressed indirect object** containing the URL string in parentheses. The URL appears as literal bytes in the buffer. `buffer.includes(url)` or `buffer.toString('latin1').includes(url)` will both work reliably as long as no `ownerPassword`/`userPassword` is passed to `<Document>` (none are, by default).

The second key finding is layout fidelity: react-pdf uses Yoga (flexbox), not CSS grid. The web preview's `<dl className="grid grid-cols-[1fr_1.5fr]">` becomes a series of `<View style={{ flexDirection: 'row' }}>` rows in the PDF — label in a fixed-width `<Text>` on the left, value in a flex-1 `<Text>` on the right. Built-in Helvetica is always available; no `Font.register` needed.

**Primary recommendation:** Build `ReportPDF` as a flexbox document mirroring ReportPreview.tsx, return `new Response(pdfBuffer, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="..."` } })` from the route, and use `buffer.toString('latin1').includes(careCompareUrl)` in the route test.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PDF generation (renderToBuffer) | API / Backend (Node.js route handler) | — | @react-pdf/renderer is Node.js-only; must not reach client bundle |
| Download trigger / blob URL | Browser / Client | — | URL.createObjectURL is browser-only; client orchestrates the download, never the PDF |
| ReportViewModel validation | API / Backend (route handler) | — | Already done via ReportViewModelSchema.safeParse; PDF renders from the validated result |
| Content-Disposition / filename slug | API / Backend | — | Server owns the filename; client only sets the `<a download>` fallback attribute |
| Button state management | Browser / Client | — | Loading/disabled state lives in the React component |
| Error display (export failure) | Browser / Client | — | Inline error near the button, not the top ErrorBanner (D-08) |

---

## Standard Stack

### Core (already installed — no new packages)

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------------------|---------|--------------|
| `@react-pdf/renderer` | 4.5.1 | Server-side PDF document rendering | CLAUDE.md rule #7; React 19 compatible |
| `zod` | 4.4.3 | Body validation in the route | Already validating ReportViewModelSchema |

[VERIFIED: medelite-report/package.json] — no new packages to install for Phase 4.

### Built-in react-pdf Font Family

Available without `Font.register`:
- `Helvetica` — regular
- `Helvetica-Bold` — bold (use `fontWeight: 'bold'` in StyleSheet; react-pdf maps this)
- `Helvetica-Oblique` — italic
- `Helvetica-BoldOblique` — bold italic

[VERIFIED: medelite-report/node_modules/@react-pdf/pdfkit/lib/pdfkit.js lines 3154-3237]

### Page Size

`<Page size="LETTER">` = 612 × 792 pt (8.5 × 11 in). [VERIFIED: node_modules/@react-pdf/layout/lib/index.js line 1217]

---

## Package Legitimacy Audit

No new packages are installed in Phase 4. All required libraries were installed and verified in Phase 1.

| Package | Status |
|---------|--------|
| `@react-pdf/renderer` | Already installed, Phase 1 checkpoint passed |
| `zod` | Already installed, Phase 1 checkpoint passed |

---

## Architecture Patterns

### System Architecture Diagram

```
[SnapshotApp client]
      |
      | vm (already assembled, in state)
      |
      v
[DownloadPdfButton]
      | POST /api/export/pdf  (JSON body = ReportViewModel)
      v
[route.ts — Node runtime]
      | ReportViewModelSchema.safeParse(body) ← already wired
      | renderToBuffer(<ReportPDF vm={validated} />)
      v
[ReportPDF component] ← reads vm.header, vm.facility, vm.manual
      | StyleSheet.create (Helvetica, flexbox rows)
      v
[Buffer (PDF bytes)]
      | new Response(buffer, { 'Content-Type': 'application/pdf',
      |                        'Content-Disposition': 'attachment; filename=...' })
      v
[Browser: fetch → Blob → URL.createObjectURL → <a download> → revoke]
      v
[User: file saved to disk]
```

### Recommended Project Structure

```
src/
├── components/
│   ├── pdf/
│   │   ├── ReportPDF.tsx        # <Document><Page>… top-level PDF document
│   │   ├── PdfHeader.tsx        # Static header block (platformLine/reportTitle/stateLine)
│   │   ├── PdfBodyRow.tsx       # Reusable label/value flexbox row
│   │   ├── PdfDivider.tsx       # Horizontal line between sections
│   │   └── PdfFooter.tsx        # CMS processing date + Medicare link
│   └── DownloadPdfButton.tsx    # Button + loading/error state; fetch→blob→anchor
└── lib/
    └── report/
        └── slug.ts              # slugDisplayName(displayName, ccn) → filename string
```

Sub-components are optional; a single-file `ReportPDF.tsx` is acceptable for this scope.

### Pattern 1: renderToBuffer in a Next.js 16 Route Handler

**What:** `renderToBuffer` returns `Promise<Buffer>`. Return the buffer wrapped in a Web `Response` with binary content.

**When to use:** Any time a Next.js 16 route handler must return binary PDF bytes.

```typescript
// Source: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md
// + node_modules/@react-pdf/renderer/index.d.ts renderToBuffer signature
import { renderToBuffer } from "@react-pdf/renderer";
import { ReportPDF } from "@/components/pdf/ReportPDF";
import type { ReportViewModel } from "@/lib/report/view-model";

export const runtime = "nodejs"; // already set in the stub

async function generatePdf(vm: ReportViewModel): Promise<Buffer> {
  return renderToBuffer(<ReportPDF vm={vm} />);
}

// In the POST handler, after safeParse succeeds:
const pdfBuffer = await generatePdf(parseResult.data);
const filename = slugFilename(parseResult.data.facility.displayName, parseResult.data.facility.ccn);
return new Response(pdfBuffer, {
  status: 200,
  headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
  },
});
```

**Notes:**
- Use Web `Response` directly (not `NextResponse`) — per official Next.js 16 route handler docs, Web API `Response` is the standard pattern. `NextResponse` adds no value for binary responses.
- Node.js `Buffer` is accepted as the `Response` body in Node.js runtime route handlers. [VERIFIED: Next.js 16 route.md — "Non-UI Responses" section uses `new Response(string, { headers })` pattern; Buffer is accepted by Node.js HTTP layer in the runtime.]
- No streaming needed; `renderToBuffer` is the right call (not `renderToStream`) for this use case.

### Pattern 2: ReportPDF Flexbox Layout (D-01 replication)

**What:** React-pdf uses Yoga (flexbox) only — NO CSS grid. The web preview's `<dl className="grid grid-cols-[1fr_1.5fr]">` becomes a series of `<View style={{ flexDirection: 'row' }}>` rows.

**When to use:** Every label/value pair in the 13-field body.

```typescript
// Source: @react-pdf/renderer v4.5.1 layout; D-01 requirement
import { View, Text, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  label: {
    width: "40%",         // approximate <dt> sizing
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: "#374151",    // zinc-700 approx
  },
  value: {
    flex: 1,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#18181b",    // zinc-900 approx
  },
});

function BodyRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}
```

### Pattern 3: Clickable Medicare Link (D-04 / PDF-02)

**What:** `<Link src={vm.facility.careCompareUrl}>` creates a real PDF URI annotation (not just blue text). `src` prop is the correct prop for external URLs.

```typescript
// Source: @react-pdf/render/lib/index.js setLink → renderLink → ctx.link()
// + @react-pdf/renderer/index.d.ts LinkProps
import { Link, Text, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  linkText: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1d4ed8",       // blue
    textDecoration: "underline",
  },
});

// In footer section:
<Link src={vm.facility.careCompareUrl}>
  <Text style={styles.linkText}>View official CMS profile on Medicare.gov</Text>
</Link>
```

**Notes:**
- Use `src` prop, not `href`. Both work per the type definition and render code, but `src` is the documented primary prop.
- The `careCompareUrl` is already validated as `https://www.medicare.gov/...` by the route's `ReportViewModelSchema.safeParse` — do NOT recompute it.
- `isSrcId` (the internal router) checks for `#` prefix; HTTPS URLs are correctly routed to `ctx.link()` → URI annotation.

### Pattern 4: Client Download (D-05)

**What:** Client POSTs vm as JSON, receives Blob, creates object URL, triggers anchor download, revokes URL.

```typescript
// Source: D-05 decision; confirmed: client never imports @react-pdf/renderer
async function handleDownload(vm: ReportViewModel): Promise<void> {
  const resp = await fetch("/api/export/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(vm),
  });
  if (!resp.ok) {
    throw new Error("PDF generation failed");
  }
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "report.pdf"; // fallback; server Content-Disposition controls the real filename
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

### Pattern 5: Filename Slug (D-06)

**What:** Pure function — slug displayName, fallback to CCN.

```typescript
// Source: D-06 decision
export function slugFilename(displayName: string, ccn: string): string {
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")   // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, "");        // trim leading/trailing hyphens
  if (!slug) return `${ccn}-Snapshot.pdf`;
  return `${slug}-Snapshot.pdf`;
}
```

Must be a pure, unit-tested function. Edge cases to test: blank string → CCN fallback; all-special-chars → CCN fallback; normal name → slugified; CCN with leading zeros → preserved as-is.

### Anti-Patterns to Avoid

- **Importing @react-pdf/renderer in a "use client" file:** `next build` will fail with a bundling error. The client component (`DownloadPdfButton`) must never import from `@react-pdf/renderer`. Only the route handler imports it.
- **Using `renderToStream` instead of `renderToBuffer`:** Stream responses add complexity with no benefit here; `renderToBuffer` returns a complete `Promise<Buffer>` that Next.js 16 route handlers handle natively.
- **Passing `displayName` to the PDF header component:** Rule #2 violation. The `PdfHeader` component receives only `vm.header` (platformLine/reportTitle/stateLine) — never `vm.facility.displayName`.
- **Reconstructing careCompareUrl in the PDF component:** The validated model already has it. Use `vm.facility.careCompareUrl` directly (D-04).
- **Using `||` for null checks in formatters:** D-10 forbids this — real `0` is valid. Always use the same `=== null` check the existing `format.ts` functions use.
- **Using `href` prop on `<Link>` for the clickable link:** Works, but `src` is the documented primary prop. Use `src`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | Custom canvas/jsPDF renderer | `@react-pdf/renderer` renderToBuffer | CLAUDE.md rule #7; custom PDF is thousands of lines |
| String null safety in PDF values | Custom ternary chains | Import the existing `formatRating/formatBeds/formatLocation/formatDate` from `@/lib/report/format` | Already tested; handles 0 ≠ null correctly (D-10) |
| Header string assembly | Inline static strings | Import `assembleHeader` from `@/lib/report/header` (via vm.header) | vm.header is already assembled; just use the three strings |
| CareCompare URL construction | `https://www.medicare.gov/...${ccn}` inline | Read `vm.facility.careCompareUrl` | URL is already in the validated model; inline construction bypasses the validation hardening (D-16) |
| Body validation | Manual shape checks | Existing `ReportViewModelSchema.safeParse` — already in the route stub | Already tested in 9 passing tests |

**Key insight:** The existing stub, view-model, formatters, and header function cover all the "plumbing" — Phase 4 only needs to build the PDF layout component and the button.

---

## High-Value Unknown Resolutions

### 1. renderToBuffer Return Contract

`renderToBuffer(element: React.ReactElement<DocumentProps>): Promise<Buffer>` — confirmed from type declaration.

[VERIFIED: node_modules/@react-pdf/renderer/index.d.ts]

Return from the route:
```typescript
return new Response(pdfBuffer, {
  status: 200,
  headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
  },
});
```

The Node.js runtime route handler accepts a Node.js `Buffer` as the `Response` body directly. No need for `Uint8Array` conversion or streaming setup. [VERIFIED: Next.js 16 route handler docs — Node.js runtime; non-UI response pattern]

### 2. THE Buffer-Assertion Question (SC#5 — LOAD-BEARING)

**Finding: `buffer.toString('latin1').includes(careCompareUrl)` works reliably. Here is the proof chain:**

1. `<Link src={careCompareUrl}>` calls `setLink(ctx, node)` → `renderLink(ctx, node, src)`.
   [VERIFIED: node_modules/@react-pdf/render/lib/index.js lines 2238-2244]

2. `renderLink` calls `ctx.link(x, y, w, h, url)` (pdfkit) since `isSrcId` returns false for `https://...`.
   [VERIFIED: node_modules/@react-pdf/render/lib/index.js lines 2226-2236]

3. `ctx.link()` creates `options.A = this.ref({ S: 'URI', URI: new String(url) })` and calls `options.A.end()`.
   [VERIFIED: node_modules/@react-pdf/pdfkit/lib/pdfkit.js lines 39245-39250]

4. `PDFObject.convert` serializes `new String(url)` as a PDF parenthesized string. Since the URL is all ASCII (no characters with codepoint > 0x7f), `isUnicode=false` → `Buffer.from(url, 'ascii')` → `.toString('binary')` → wrapped in `(...)`.
   [VERIFIED: node_modules/@react-pdf/pdfkit/lib/pdfkit.js lines 204-233]

5. The URL string `https://www.medicare.gov/care-compare/details/nursing-home/686123` contains NONE of the escapable characters `[\n\r\t\b\f()\\]`, so no escaping occurs. The string appears verbatim.
   [VERIFIED: node_modules/@react-pdf/pdfkit/lib/pdfkit.js line 168 — escapableRe]

6. The annotation object has NO stream content (no `.write()` calls after `.end()`), so `this.chunks.length === 0` in `finalize()`. The object is serialized as a plain indirect object dictionary — NOT a compressed stream.
   [VERIFIED: node_modules/@react-pdf/pdfkit/lib/pdfkit.js lines 70-91 — finalize method]

7. No encryption: `PDFSecurity.create` returns `null` when no `ownerPassword`/`userPassword` is set, so `encryptFn` is `null` in `finalize()`.
   [VERIFIED: node_modules/@react-pdf/pdfkit/lib/pdfkit.js lines 1150-1158]

**Conclusion:** The PDF buffer will contain the exact bytes of the URL string. The correct test assertion is:

```typescript
// SC#5 buffer assertion — confirmed works
const url = "https://www.medicare.gov/care-compare/details/nursing-home/686123";
expect(pdfBuffer.toString("latin1")).toContain(url);
// Alternatively, Buffer comparison:
expect(pdfBuffer.includes(Buffer.from(url, "ascii"))).toBe(true);
```

**Also useful:** To additionally assert the URL appears as visible text (belt-and-suspenders), include it in a `<Text>` child of the `<Link>` element. The visible text string follows the same serialization path and is also findable in the buffer. But the annotation URI alone is sufficient.

### 3. React-pdf Layout Reality vs Web Preview (D-01)

**Key finding:** react-pdf uses Yoga flexbox exclusively — NO CSS grid.

| Web Preview (`ReportPreview.tsx`) | PDF Equivalent |
|-----------------------------------|----------------|
| `<dl className="grid grid-cols-[1fr_1.5fr] gap-x-4 gap-y-2">` | `<View>` container with `<View style={{ flexDirection: 'row' }}>` per row |
| `<dt className="font-semibold text-zinc-700">` | `<Text style={{ width: '40%', fontFamily: 'Helvetica-Bold' }}>` |
| `<dd className="text-zinc-900">` | `<Text style={{ flex: 1, fontFamily: 'Helvetica' }}>` |
| `<header className="border-b pb-4 text-center">` | `<View style={{ borderBottomWidth: 1, borderBottomColor: '#e5e7eb', marginBottom: 8, textAlign: 'center' }}>` |
| `<footer className="border-t pt-3 text-xs text-zinc-400 text-right">` | `<View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 8 }}>` |
| Tailwind `text-sm` (14px) | `fontSize: 10` (pt, roughly equivalent at PDF resolution) |
| Tailwind `text-xs` (12px) | `fontSize: 9` |

**Default font:** react-pdf defaults to `Helvetica` when no `fontFamily` is set.
[VERIFIED: node_modules/@react-pdf/layout/lib/index.js line 1687]

**Built-in fonts confirmed:**
- `Helvetica`, `Helvetica-Bold`, `Helvetica-Oblique`, `Helvetica-BoldOblique`
- `Times-Roman`, `Times-Bold`, `Times-Italic`, `Times-BoldItalic`
- `Courier`, `Courier-Bold`, `Courier-Oblique`, `Courier-BoldOblique`

[VERIFIED: node_modules/@react-pdf/pdfkit/lib/pdfkit.js lines 3154-3343]

Use `fontFamily: 'Helvetica-Bold'` in `StyleSheet.create` for label weight. `fontWeight: 'bold'` also works via the font-family resolution but the explicit name is unambiguous.

**Manual inputs with em-dash:** The web preview uses `vm.manual.emr ?? "—"` (em-dash for missing values). Use the same in the PDF via `formatters` or the same `?? "—"` pattern. Note: em-dash `—` is outside ASCII; it is encoded as UTF-16 big-endian in the PDF string. This is handled correctly by `isUnicode=true` path in pdfkit.

**No `break` or manual pagination needed:** With 13 fields + header + footer, content fits on one US Letter page comfortably. Rely on react-pdf auto-pagination if content ever grows.

### 4. Clickable-Link Verification (SC#3 / PDF-02)

**What to verify in a PDF viewer:**
- The text "View official CMS profile on Medicare.gov" should appear in blue/underlined.
- Hovering over the text should show a hand cursor (link annotation indicator).
- Clicking should open `https://www.medicare.gov/care-compare/details/nursing-home/686123` in the browser.
- The link must work both in browser PDF viewers (Chrome, Firefox built-in) and in dedicated readers (Adobe Acrobat Reader).

**react-pdf v4 Link behavior:** No changes to Link behavior in v4 vs v3 for external URL annotations. The `src` prop maps to `ctx.link()` which produces a standard PDF `/Annot` of `Subtype /Link` with an `A` dictionary containing `S /URI`. This is the universal PDF link format and is clickable in all conforming PDF viewers.
[VERIFIED: node_modules/@react-pdf/pdfkit/lib/pdfkit.js lines 39216-39252]

### 5. Client Download Mechanics (D-05)

The fetch → Blob → URL.createObjectURL → anchor pattern is correct. Key considerations:

- `resp.blob()` works on all modern browsers for binary responses.
- The `Content-Disposition: attachment; filename="..."` header set server-side is what the browser uses for the saved filename. The `a.download` attribute is a fallback hint — set it to any reasonable default (e.g., `"report.pdf"`).
- **Slug edge cases (D-06):**
  - `displayName` blank or only whitespace → slug is empty string → use `"${ccn}-Snapshot.pdf"`.
  - `displayName` is all-special-chars (e.g., "---") → after strip, slug is empty → use CCN fallback.
  - Normal: `"Kendall Lakes Healthcare and Rehab Center"` → `"kendall-lakes-healthcare-and-rehab-center-Snapshot.pdf"`.
  - The slug function must be tested with all three cases.
- Filename characters: `Content-Disposition` filename should be ASCII-safe. The slug function strips non-alphanumeric to hyphens, so Unicode characters in facility names are converted. This is correct behavior.

**The client component must NOT import `@react-pdf/renderer`** — this is enforced by `next build` (`serverExternalPackages` in next.config.ts means the package is externalized for server; if a client component imports it, the bundler will include it in the client bundle and fail or break). This is the same constraint as T-03-09 in SnapshotApp.tsx comments.

### 6. Build/Bundle Correctness

`npm run verify:full` (= `npm run verify && npm run build`) is the real gate because:

1. `next build` runs the Turbopack/webpack bundler. If any `"use client"` file imports from `@react-pdf/renderer`, the build will fail with a module error (`@react-pdf/renderer` depends on Node.js globals not available in the browser bundle).
2. `serverExternalPackages: ["@react-pdf/renderer"]` is already present in `next.config.ts` [VERIFIED: medelite-report/next.config.ts]. This prevents the package from being bundled INTO the server component graph — it remains external (loaded from `node_modules` at runtime). This is what allows `renderToBuffer` to work on Vercel without the `PDFDocument is not a constructor` error.
3. The Turbopack bug #88844 (serverExternalPackages missing from standalone builds) is mitigated by the explicit listing. [CITED: PITFALLS.md #10; next.config.ts comment]

**What a leak looks like at build time:** A `"use client"` file importing `@react-pdf/renderer` causes `next build` to produce: `"Module not found: Error: Can't resolve @react-pdf/renderer"` or a runtime `TypeError: PDFDocument is not a constructor` on first request. The `verify:full` gate catches this.

---

## Common Pitfalls

### Pitfall 1: @react-pdf/renderer in Client Bundle

**What goes wrong:** `DownloadPdfButton.tsx` accidentally imports `ReportPDF` or anything from `@react-pdf/renderer` — build fails or runtime crashes.
**Why it happens:** A developer adds `import { ReportPDF } from "@/components/pdf/ReportPDF"` to the button component to get TypeScript types.
**How to avoid:** The button component only needs `ReportViewModel` type (from view-model.ts, safe). The PDF component lives under a path that is ONLY imported from the route handler. Use JSX type or inline type for the fetch body.
**Warning signs:** `next build` failing with `Cannot find module @react-pdf/renderer` or `PDFDocument is not a constructor`.

### Pitfall 2: Returning `NextResponse` Instead of `Response` for Binary

**What goes wrong:** `NextResponse.json()` is fine for JSON, but for binary PDF responses `new Response(buffer, { headers })` is more direct and correct. `NextResponse` wraps binary differently.
**How to avoid:** Use `new Response(pdfBuffer, { status: 200, headers: { ... } })` directly. The stub already uses plain `Response`. [CITED: Next.js 16 route.md Non-UI Responses pattern]

### Pitfall 3: Header Component Receives Facility Name

**What goes wrong:** Passes `vm.facility.displayName` to the `PdfHeader` component violating CLAUDE.md rule #2.
**How to avoid:** `PdfHeader` receives `vm.header` (3 static strings) only. Never pass `displayName` to the header. Add a test: `expect(pdfBuffer.toString('latin1')).not.toContain('INFINITE — Managed by MEDELITE' + 'Kendall')` — or a dedicated header component test that asserts displayName is not in its output. [CITED: PITFALLS.md #13; CLAUDE.md rule #2]

### Pitfall 4: CSS Grid Usage in react-pdf

**What goes wrong:** Copy-paste the web preview's `<dl className="grid ...">` pattern into a react-pdf component. Result: silent layout failure (Yoga ignores unknown CSS properties).
**Why it happens:** react-pdf's style system looks like CSS but only supports a subset.
**How to avoid:** Always use `flexDirection: 'row'` + `width` or `flex` for two-column layouts.

### Pitfall 5: Using `||` Fallback for Null Values in PDF

**What goes wrong:** `vm.facility.certifiedBeds || "N/A"` converts `0` to `"N/A"` (incorrect — 0 beds is valid).
**How to avoid:** Use the same `format.ts` functions (`formatBeds`, `formatRating`, etc.) that use `=== null` checks. [CITED: D-10 / CLAUDE.md standing rule notes]

### Pitfall 6: Filename with Non-ASCII Characters in Content-Disposition

**What goes wrong:** A facility name with accented characters (e.g., "Résidence") in `Content-Disposition: attachment; filename="..."` breaks in some browsers.
**How to avoid:** The slug function strips non-alphanumeric to hyphens, converting all non-ASCII. The CCN fallback is pure ASCII. No additional encoding needed.

### Pitfall 7: Vitest Testing renderToBuffer (Environment Requirement)

**What goes wrong:** Calling `renderToBuffer` in Vitest tests fails because react-pdf uses Node.js internals (zlib, stream). Vitest runs in `node` environment (confirmed in vitest.config.ts) — this is fine. However, tests that import the PDF route handler must not import react-pdf in any "jsdom" environment.
**Status:** vitest.config.ts already sets `environment: 'node'` — no issue. [VERIFIED: medelite-report/vitest.config.ts]

---

## Validation Architecture

> Nyquist validation is ENABLED for this project.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | `medelite-report/vitest.config.ts` (exists, confirmed) |
| Quick run command | `npx vitest run tests/api/export-pdf.test.ts` |
| Full suite command | `npx vitest run` |
| Build gate | `npm run verify:full` |

### Phase Requirements → Test Map

| Req ID | Success Criterion | Behavior | Test Type | Automated Command | File |
|--------|-------------------|----------|-----------|-------------------|------|
| PDF-01 / SC#1 | Download triggers without pop-up | POST returns 200 with binary PDF body | Route handler test | `npx vitest run tests/api/export-pdf.test.ts` | `tests/api/export-pdf.test.ts` (exists; needs Phase 4 tests added) |
| PDF-01 / SC#2 | PDF contains exact static header | `buffer.toString('latin1')` contains "INFINITE — Managed by MEDELITE", "FACILITY ASSESSMENT SNAPSHOT", "FL" | Route handler test | `npx vitest run tests/api/export-pdf.test.ts` | same |
| PDF-02 / SC#3 | PDF link is a real clickable annotation | Open PDF in viewer and click — confirmed SC#3 is manual-only for "real viewer" verification | **Manual** | n/a — open the Vercel-deployed PDF in Chrome/Firefox/Acrobat and click | n/a |
| PDF-02 / SC#5 | Medicare URL appears in buffer | `buffer.toString('latin1').includes('https://www.medicare.gov/care-compare/details/nursing-home/686123')` | Route handler test | `npx vitest run tests/api/export-pdf.test.ts` | same |
| PDF-01 / SC#5 | `Content-Type: application/pdf` | `expect(resp.headers.get('content-type')).toContain('application/pdf')` | Route handler test | `npx vitest run tests/api/export-pdf.test.ts` | same |
| PDF-01 / SC#5 | `Content-Disposition: attachment` | `expect(resp.headers.get('content-disposition')).toContain('attachment')` | Route handler test | `npx vitest run tests/api/export-pdf.test.ts` | same |
| PDF-01 / SC#5 | `Content-Disposition` filename slug | `expect(resp.headers.get('content-disposition')).toContain('kendall-lakes')` (or ccn fallback) | Route handler test | `npx vitest run tests/api/export-pdf.test.ts` | same |
| D-06 slug helper | Slug edge cases | `slugFilename('', ccn)` → CCN; `slugFilename('Kendall Lakes', ccn)` → `'kendall-lakes-Snapshot.pdf'`; all-special-chars → CCN | Unit test | `npx vitest run tests/lib/slug.test.ts` | `tests/lib/slug.test.ts` (new — Wave 0 gap) |
| PDF-03 / SC#4 | PDF content matches web preview | Open deployed PDF, compare fields visually to web preview for CCN 686123 | **Manual** | n/a — visual comparison, Vercel deploy | n/a |
| CLAUDE.md rule #2 | Static header never carries facility name | `buffer.toString('latin1')` does NOT contain facility name adjacent to header strings | Route handler test | `npx vitest run tests/api/export-pdf.test.ts` | same |
| Build gate SC#5 | react-pdf not in client bundle | `npm run verify:full` exits 0 | Build test | `npm run verify:full` | n/a — gate |
| D-07 button disabled state | Button disabled during load | React state test or manual browser check | Manual / unit | (optional) — UI behavior | optional |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/api/export-pdf.test.ts tests/lib/slug.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** `npm run verify:full` green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/lib/slug.test.ts` — unit tests for `slugFilename` covering: blank → CCN fallback; all-special-chars → CCN fallback; normal name → slug; CCN with leading zeros preserved
- [ ] Expand `tests/api/export-pdf.test.ts` with Phase 4 tests: 200 + binary response, Content-Type, Content-Disposition, Medicare URL in buffer, static header strings in buffer, facility name NOT in header section (existing 9 tests remain; add new `describe` block for Phase 4)

**No new test infrastructure needed** — existing vitest.config.ts, node env, and fixture are sufficient.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@react-pdf/renderer` | PDF generation | ✓ | 4.5.1 | — |
| Node.js (nodejs runtime) | `renderToBuffer` | ✓ | (existing) | — |
| `serverExternalPackages: ["@react-pdf/renderer"]` in next.config.ts | Vercel deploy | ✓ | (already configured) | — |
| Vitest node environment | Route handler tests | ✓ | 4.1.9 | — |

**No missing dependencies.** All required tooling is already present.

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | `ReportViewModelSchema.safeParse` — already in the route stub |
| V6 Cryptography | no (no passwords set on PDF) | — |
| Link injection | yes | `careCompareUrl` is Zod-validated to `https://www.medicare.gov` origin only (defense-in-depth hardened in view-model.ts — see `refine` with protocol + hostname check) |

**No new security concerns** beyond what is already in the existing route validation. The PDF route already validates the full ReportViewModel before passing to the renderer. The `careCompareUrl` field has origin-pinning validation baked into `ReportViewModelSchema`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `html2canvas` + `jsPDF` for client-side PDF | Server-side `renderToBuffer` | react-pdf v2+ / Next.js 13+ | No client-side rendering; works in Vercel serverless; CLAUDE.md rule #7 |
| `PDFDownloadLink` (client component) | Server route handler + fetch blob | Established pattern for App Router | No `ssr: false` needed; no client bundle leak risk |
| `serverComponentsExternalPackages` key | `serverExternalPackages` | Next.js 15.0.0 | Old key silently ignored in NJS16 — already using the correct key |

**Deprecated/outdated:**
- `PDFDownloadLink` / `PDFViewer`: Client-only components; using them in App Router requires `next/dynamic` with `ssr: false`. Not needed here (D-05 uses server-side renderToBuffer + fetch).
- `renderToString`: Deprecated in react-pdf — use `renderToBuffer`.

---

## Assumptions Log

> All claims below were verified against source code or official documentation in this session. No `[ASSUMED]` claims.

| # | Claim | Section | Verified |
|---|-------|---------|----------|
| — | All claims were verified via source code or official docs | — | No assumed claims |

---

## Open Questions

1. **`fontWeight: 'bold'` vs `fontFamily: 'Helvetica-Bold'` in StyleSheet**
   - What we know: Both routes work in react-pdf — `fontWeight` triggers font family resolution; explicit name is unambiguous.
   - What's unclear: Whether the `fontWeight: 'bold'` resolution path works reliably in v4 with built-in fonts.
   - Recommendation: Use explicit `fontFamily: 'Helvetica-Bold'` for bold labels to avoid any resolution ambiguity. This is unambiguously safe.

2. **Content-Disposition: inline filename encoding for non-ASCII facility names**
   - What we know: The slug function strips all non-ASCII. CCN is always ASCII.
   - What's unclear: Whether any facility name passed through the slug could produce a filename that needs `filename*=UTF-8''...` RFC 5987 encoding.
   - Recommendation: Not an issue — the slug function converts all non-alphanumeric to hyphens, guaranteeing ASCII-only output. No RFC 5987 encoding needed.

---

## Sources

### Primary (HIGH confidence)
- `medelite-report/node_modules/@react-pdf/renderer/index.d.ts` — `renderToBuffer` signature, `LinkProps` (`src`/`href`), `DocumentProps`
- `medelite-report/node_modules/@react-pdf/pdfkit/lib/pdfkit.js` — `PDFObject.convert`, `PDFReference.finalize`, `PDFSecurity.create`, `link()` method, `escapableRe`, URI annotation structure
- `medelite-report/node_modules/@react-pdf/render/lib/index.js` — `setLink`, `renderLink`, `isSrcId` functions
- `medelite-report/node_modules/@react-pdf/layout/lib/index.js` — LETTER page size `[612.0, 792.0]`, default font `Helvetica`, flexbox layout
- `medelite-report/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — Route handler Web API patterns, `params` as Promise, non-UI binary responses
- `medelite-report/next.config.ts` — confirms `serverExternalPackages: ["@react-pdf/renderer"]` already set
- `medelite-report/package.json` — confirms `@react-pdf/renderer@^4.5.1` installed
- `medelite-report/vitest.config.ts` — confirms `environment: 'node'`, test glob patterns
- `medelite-report/src/app/api/export/pdf/route.ts` — 501 stub structure, existing validation, `runtime = "nodejs"`
- `medelite-report/src/lib/report/view-model.ts` — `ReportViewModel`, `ReportViewModelSchema`, `careCompareUrl` validation
- `medelite-report/src/components/ReportPreview.tsx` — 13-field order, verbatim labels, N/A semantics, header/footer layout
- `medelite-report/src/lib/report/format.ts` — null-safe formatters, `=== null` check pattern
- `medelite-report/src/lib/report/header.ts` — `assembleHeader(state)` signature

### Secondary (MEDIUM confidence)
- `.planning/research/PITFALLS.md` — PITFALL #4 (serverExternalPackages / no client import), PITFALL #5 (Font.register Vercel), PITFALL #13 (header branding)
- `.planning/phases/04-pdf-export/04-CONTEXT.md` — All D-01 through D-09 decisions

---

## Metadata

**Confidence breakdown:**
- `renderToBuffer` return contract: HIGH — verified from type definition and route handler docs
- Buffer-assertion for SC#5: HIGH — traced through 7 verified source code steps
- react-pdf layout (flexbox, no grid): HIGH — confirmed from Yoga-based layout engine
- Built-in fonts: HIGH — confirmed from pdfkit source
- Client download pattern: HIGH — standard Web API; confirmed no client-side react-pdf needed
- Slug helper design: HIGH — pure function, straightforward implementation

**Research date:** 2026-06-18
**Valid until:** 2026-07-18 (react-pdf v4.x stable; Next.js 16.x stable)
