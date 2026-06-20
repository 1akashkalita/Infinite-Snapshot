# Phase 6: .docx Export — Research

**Researched:** 2026-06-19
**Domain:** docx v9.7.1 library, Next.js 16 route handler, base64 PNG decoding, ExportControls UI
**Confidence:** HIGH — all key claims verified directly against the installed node_modules/docx type definitions, the installed Next.js 16 server docs, and the existing project source files.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Single Download button + a `PDF | DOCX` segmented toggle — NOT two separate buttons, NOT a dropdown. One format always visibly selected; one tap switches, one click downloads.
- **D-02:** Replace `DownloadPdfButton` with a unified `ExportControls` component. One component owns selected-format state + shared loading/error logic. `SnapshotApp` swaps `<DownloadPdfButton vm={vm} />` for `<ExportControls vm={vm} />`.
- **D-03:** PDF is the pre-selected (default) format.
- **D-04:** Download button label tracks format (`Download PDF` / `Download DOCX`); `Generating…` while in flight.
- **D-05:** Preserve Phase-4 download mechanics for both formats: client `fetch` POST → Blob → silent anchor download (`URL.createObjectURL` + `<a download>` + deferred `revokeObjectURL`). On export failure: single inline `role="alert"` below the control, button stays enabled for retry; never routed through `ErrorBanner`.
- **D-06:** Faithful replica of PDF/preview layout using native `docx` primitives (bordered 2-column table, centered logo header, footer link). Match `ReportPDF` look within Word idiom.
- **D-07:** Hand-port the 13 + 12 rows into the `docx` builder mirroring how `ReportPDF.tsx` was built — no shared cross-renderer row-descriptor abstraction this phase.
- **D-08:** Same formatters and N/A/suppression semantics as preview/PDF: `formatRating`/`formatBeds`/`formatLocation`/`formatDate`/`formatPercent`/`formatRate`/`formatFootnote`. Manual fields fall back to `"—"`. When `vm.hospMetrics === undefined`, render the single D-09 degraded line.
- **D-09:** Static logo header via `ImageRun`, decoded from `INFINITE_LOGO_DATA_URI` base64. `type: "png"`. Dimensions from `INFINITE_LOGO_WIDTH`/`HEIGHT`. Rule #2 enforced: facility name never in the header.
- **D-10:** Clickable Medicare link via `ExternalHyperlink`. Label: `"View official CMS profile on Medicare.gov"`. `link` = `vm.facility.careCompareUrl`. Blue + underlined.
- **D-11:** Set document title property to `vm.facility.displayName` (parity with PDF `<Document title={f.displayName}>`).
- **D-12:** `POST /api/export/docx` mirrors `POST /api/export/pdf` contract: `ReportViewModelSchema.safeParse`; bad shape → `400 { error: { kind: "invalid_request", message: "Invalid report data." } }` (no Zod internals). Valid → buffer → `200` with correct `Content-Type` + `Content-Disposition`. `export const runtime = "nodejs"`.
- **D-13:** Filename = `<slug(displayName)>-Snapshot.docx`; fallback `<sanitized-ccn>-Snapshot.docx`. Generalize `slugFilename` to accept an extension parameter. Update `slug.test.ts` without weakening existing PDF assertions.

### Claude's Discretion

- Exact `docx` builder file location (e.g., `src/lib/docx/ReportDocx.ts`) and whether it's a function returning a `Document` vs. a module of builders.
- `ExportControls` component naming/placement and segmented-toggle markup/styling (Tailwind), as long as accessible (keyboard-operable, selected segment programmatically indicated).
- `docx` styling specifics (table border weights/colors, font sizes, spacing, default font family) to approximate the `ReportPDF`/preview look within Word's defaults — no custom font this phase.
- Page setup (US Letter portrait) if `docx` section properties make it trivial (it does — see Standard Stack section).

### Deferred Ideas (OUT OF SCOPE)

- Shared cross-renderer row-descriptor abstraction (triplication-reduction refactor).
- Star-rating visual cards/charts in the `.docx` — Phase 7 (VIZ-01/02).
- Registered custom/brand font in the `.docx` — Phase 7.
- Full "Looks Done But Isn't" Vercel smoke checklist + 300ms debounce — Phase 7.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOCX-01 | User can download a `.docx` version of the report alongside the PDF, with matching content | docx v9 API verified (see Standard Stack); route contract modelled on existing Phase-4 PDF route; ExportControls replaces DownloadPdfButton (D-02) |
| RPT-02 | Single shared view-model drives preview + PDF + `.docx` | `ReportViewModel` + `ReportViewModelSchema` already in place; docx builder consumes `vm` directly |
</phase_requirements>

---

## Summary

Phase 6 is a high-fidelity port of the existing Phase-4 PDF export pattern to the `docx` library. The `docx` package (`^9.7.1`) is already installed, ships dual CJS/ESM without native binaries, and is bundled cleanly by Next.js 16 Turbopack without needing `serverExternalPackages` — the library is pure JavaScript (jszip/nanoid/xml-js/hash.js dependencies, all pure JS). The key research question was: does `docx` need externalization? The answer is no — unlike `@react-pdf/renderer` (which has Node-only ESM internals), `docx` ships a proper CJS entry (`dist/index.cjs`) and no native bindings. Next.js 16's official list of auto-externalized packages does not include `docx`, and it doesn't need to be there.

The `Packer.toBuffer(doc)` API is confirmed `async` and returns a Node.js `Buffer`. The same `new Uint8Array(buffer)` cast used in the PDF route is the correct conversion for the Web `Response` body in Next.js 16.

The three most critical v9 API facts are: (1) `ImageRun` accepts `data: Buffer | string | Uint8Array | ArrayBuffer` — a `Buffer` decoded from base64 works directly; (2) `ExternalHyperlink` takes `{ children: ParagraphChild[], link: string }` — the property is `link` not `href`; (3) `Document` (exported as `File_2` internally) takes `IPropertiesOptions` which has `sections: ISectionOptions[]` and `title?: string` — US Letter portrait is set via `properties.page.size` inside `ISectionOptions`.

The default page size is A4 (11906 × 16838 twips). US Letter must be set explicitly: `{ width: 12240, height: 15840 }` twips (8.5 × 11 inches × 1440 twips/inch).

**Primary recommendation:** Build `src/lib/docx/ReportDocx.ts` as a single server-only function returning a `Document` instance (mirroring `ReportPDF.tsx` exactly), wire it to a `POST /api/export/docx` route cloned from the PDF route, and replace `DownloadPdfButton` with `ExportControls` in `SnapshotApp`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| docx document assembly | API / Backend (route handler) | — | Server-only; `Packer.toBuffer` needs Node.js Buffer; client must not import the builder (T-03-09 / PITFALLS #4) |
| Format toggle state (PDF vs DOCX) | Browser / Client | — | UI state lives in `ExportControls` "use client" component |
| fetch → Blob → anchor download | Browser / Client | — | `URL.createObjectURL` is a browser API; same pattern as existing `DownloadPdfButton` |
| Input validation (ReportViewModelSchema) | API / Backend | — | Re-validate every POST body server-side (standing rule #4); client-controlled inputs never trusted |
| Filename slug sanitization | API / Backend | — | `slugFilename` runs in the route handler before `Content-Disposition` header; both inputs are client-controlled (CR-01) |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `docx` | `9.7.1` (installed) | Word document assembly + `Packer.toBuffer` | Already installed; pure JS, no native deps; stable since 2016 with 101 published versions; official repo: github.com/dolanmiu/docx |

**Version verification:** `npm view docx version` → `9.7.1`, published `2026-05-27`. [VERIFIED: npm registry + installed package type definitions]

### Reused from Existing Phases (no new installs)

| Asset | Location | Use |
|-------|----------|-----|
| `ReportViewModelSchema` | `src/lib/report/view-model.ts` | Route body validation (D-12) |
| `formatRating/Beds/Location/Date/Percent/Rate/Footnote` | `src/lib/report/format.ts` | Value formatting at render time (D-08) |
| `INFINITE_LOGO_DATA_URI`, `INFINITE_LOGO_WIDTH`, `INFINITE_LOGO_HEIGHT` | `src/lib/report/logo.ts` | Logo for `ImageRun` (D-09) |
| `slugFilename` (after generalization) | `src/lib/report/slug.ts` | Injection-safe filename for `Content-Disposition` (D-13) |
| `DownloadPdfButton` (lifted logic) | `src/components/DownloadPdfButton.tsx` | fetch→blob→anchor + D-07/D-08 logic lifted into `ExportControls` |

**Installation:** No new npm installs required. `docx@9.7.1` is already present.

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `docx` | npm | ~10 years (2016-03-27) | High (101 versions, widely used) | github.com/dolanmiu/docx | Not run (slopcheck unavailable — permission denied) | Approved — well-established, 10-year history, official GitHub, consistent with project STACK.md decision |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable at research time. `docx` is tagged `[ASSUMED]` for the slopcheck column, but its legitimacy is corroborated by: 10+ year npm history, 101 published versions, active GitHub at dolanmiu/docx, npm description "Easily generate .docx files with JS/TS", and prior project decision (STACK.md). All co-dependencies (jszip, nanoid, xml-js, hash.js, xml) are established pure-JS libraries with no native bindings.*

---

## docx v9 API Specifics

> This section directly answers the six concrete research questions. All signatures are verified against `medelite-report/node_modules/docx/dist/index.d.ts`.

### Q1: Does `docx` need `serverExternalPackages`?

**Answer: No.** [VERIFIED: installed Next.js 16 docs at `node_modules/next/dist/docs/.../serverExternalPackages.md`]

The Next.js 16 official auto-externalized package list does NOT include `docx`. However, unlike `@react-pdf/renderer`, `docx` does not need externalization:

- `docx` ships a proper CJS entry (`dist/index.cjs`) alongside the ESM entry (`dist/index.mjs`). The `package.json` `exports` map provides both `require` and `import` conditions.
- Its dependencies (`jszip`, `nanoid`, `xml-js`, `hash.js`, `xml`) are all pure JavaScript with no native bindings or Node-only internals.
- The CJS bundle does not use `require('fs')`, `require('path')`, native bindings, or any API that breaks in a bundled context. The only `process.binding` in the bundle is a polyfill shim that explicitly *throws* if called — it is defensive code, not a native binding call.

**No change to `next.config.ts` is needed.** The current config (`serverExternalPackages: ["@react-pdf/renderer"]`) stays as-is.

**Why `@react-pdf/renderer` needed it but `docx` doesn't:** `@react-pdf/renderer` ships ESM-only with Node.js internals (Yoga layout engine, `__dirname` references) that fail when bundled by Turbopack. `docx` is a pure JS zip-builder with no such constraints.

**Verification step for planner:** After adding the route, run `npm run verify:full` (which runs `next build`) to confirm no bundling regression.

### Q2: docx v9 Document/Section Constructor

```typescript
// Source: node_modules/docx/dist/index.d.ts line 667 + IPropertiesOptions line 1592
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
         ImageRun, ExternalHyperlink, AlignmentType, WidthType, BorderStyle,
         PageOrientation } from "docx";

const doc = new Document({
  // IPropertiesOptions:
  title: vm.facility.displayName,          // D-11: document title metadata
  sections: [{
    // ISectionOptions:
    properties: {
      // ISectionPropertiesOptions → ISectionPropertiesOptionsBase:
      page: {
        size: {
          // Default is A4 (11906 × 16838 twips). US Letter must be explicit.
          // 8.5in × 11in × 1440 twips/inch = 12240 × 15840
          width: 12240,   // 8.5 inches
          height: 15840,  // 11 inches
          orientation: PageOrientation.PORTRAIT,
        },
      },
    },
    children: [
      // ... Paragraph, Table, etc.
    ],
  }],
});
```

`Document` is exported as `File_2` internally but re-exported as `Document` at line 692 of the type definitions. [VERIFIED: installed docx types]

### Q3: `Packer.toBuffer` — Return Type and Route Usage

```typescript
// Source: node_modules/docx/dist/index.d.ts line 2435
// static toBuffer(file: File_2, prettify?, overrides?): Promise<Buffer>

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  // ... validate body with ReportViewModelSchema.safeParse ...
  const doc = buildReportDocx(parseResult.data);          // returns Document
  const docxBuffer = await Packer.toBuffer(doc);           // returns Node.js Buffer
  const filename = slugFilename(parseResult.data.facility.displayName,
                                parseResult.data.facility.ccn, ".docx");

  return new Response(new Uint8Array(docxBuffer), {        // Buffer extends Uint8Array
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

- `Packer.toBuffer` is `async` (returns `Promise<Buffer>`). [VERIFIED: installed docx types]
- The same `new Uint8Array(buffer)` pattern used in the PDF route is correct for the Web `Response` API. Buffer extends Uint8Array at runtime; the cast is lossless. [VERIFIED: existing `/api/export/pdf/route.tsx` line 70]
- MIME type is `application/vnd.openxmlformats-officedocument.wordprocessingml.document`. [ASSUMED — standard OOXML MIME; verified by cross-reference with PITFALLS.md #12]

### Q4: `ImageRun` — base64 PNG Decoding

```typescript
// Source: node_modules/docx/dist/index.d.ts
// RegularImageOptions (line 2621):
//   type: "jpg" | "png" | "gif" | "bmp"
//   data: Buffer | string | Uint8Array | ArrayBuffer
//
// CoreImageOptions (line 319):
//   transformation: IMediaTransformation  ← REQUIRED
//
// IMediaTransformation (line 1426):
//   width: number     ← in EMU (914400 EMU = 1 inch)
//   height: number
//   offset?: { top?, left? }
//   flip?: { vertical?, horizontal? }

import { INFINITE_LOGO_DATA_URI, INFINITE_LOGO_WIDTH, INFINITE_LOGO_HEIGHT } from "@/lib/report/logo";

// Strip the data-URI prefix and decode to Buffer
const base64Data = INFINITE_LOGO_DATA_URI.replace(/^data:image\/png;base64,/, "");
const logoBuffer = Buffer.from(base64Data, "base64");

// EMU conversion: 1 pixel at 96 DPI = 9144 EMU (1 inch = 914400 EMU, 1 inch = 96px)
// INFINITE_LOGO_WIDTH = 224px, INFINITE_LOGO_HEIGHT = 51px
// At a reasonable display size in the Word doc (e.g., 180pt wide):
//   1pt = 12700 EMU; 180pt = 2286000 EMU (~2.5 inches at 96dpi)
// Simpler: keep the dimensions proportional; planner/implementer picks exact display width.

new ImageRun({
  type: "png",
  data: logoBuffer,           // Buffer | Uint8Array | ArrayBuffer all accepted
  transformation: {
    width: 224 * 9144,        // EMU: pixel count × 9144 (at 96dpi)
    height: 51 * 9144,
  },
});
```

**Key v9 note on `type` field:** In v9, `type` is **required** for `RegularImageOptions` and must be `"jpg" | "png" | "gif" | "bmp"`. Omitting `type` causes a TypeScript compile error. This is a stricter requirement than some older versions. [VERIFIED: installed docx types, `RegularImageOptions` line 2621]

**Note on EMU sizing:** `IMediaTransformation.width` and `height` are in **EMU** (English Metric Units), not pixels or points. At 96 DPI: `1 pixel = 9144 EMU`. At 72 DPI: `1 pixel = 12700 EMU`. The implementer should pick a display width that fits within the page margins (US Letter with default ~1-inch margins = 10920 twips of text width = ~6.5 inches = ~5,943,600 EMU usable). A reasonable logo display width around 2 inches = 1,828,800 EMU is a good starting point, scaled proportionally for height.

### Q5: `ExternalHyperlink` for the Medicare Link

```typescript
// Source: node_modules/docx/dist/index.d.ts line 1194
// IExternalHyperlinkOptions = { children: readonly ParagraphChild[]; link: string }
// ExternalHyperlink is a valid ParagraphChild (line 2515)

new Paragraph({
  children: [
    new ExternalHyperlink({
      link: vm.facility.careCompareUrl,   // "link" NOT "href" — critical v9 spelling
      children: [
        new TextRun({
          text: "View official CMS profile on Medicare.gov",
          style: "Hyperlink",             // Word built-in "Hyperlink" style applies blue+underline
          // OR explicitly:
          // color: "1d4ed8",
          // underline: {},
        }),
      ],
    }),
  ],
});
```

**Critical v9 spelling:** The property is `link`, not `href`. Using `href` would silently produce no hyperlink since the option would be ignored. [VERIFIED: installed docx types line 1194-1197]

**Style vs explicit properties:** Using `style: "Hyperlink"` applies the Word built-in hyperlink style (blue + underline) automatically. This is the idiomatic Word approach and matches the PDF's `color: "#1d4ed8"` + `textDecoration: "underline"` effect. Alternatively, set `color: "1d4ed8"` and `underline: {}` explicitly on the `TextRun`.

### Q6: Table and Border API

```typescript
// Source: node_modules/docx/dist/index.d.ts
// ITableBordersOptions (line 1777): top, bottom, left, right, insideHorizontal, insideVertical
// ITableCellBorders (line 1786): top, start/left, bottom, end/right
// IBorderOptions (line 957): { style, color?, size?, space? }
// BorderStyle.SINGLE = "single"

// Full-page-width bordered 2-column table replicating ReportPDF.tsx layout:
// 42% label column / 58% value column (using DXA units for the full page width)
// US Letter text width at 1-inch margins: 12240 - 2*1440 = 9360 twips (DXA)
const LABEL_WIDTH = Math.round(9360 * 0.42);  // ~3931 DXA
const VALUE_WIDTH = 9360 - LABEL_WIDTH;        // ~5429 DXA

const BORDER_OPTS = {
  style: BorderStyle.SINGLE,
  size: 6,       // 0.75pt border (size is in eighths of a point)
  color: "000000",
};

new Table({
  width: { size: 9360, type: WidthType.DXA },
  borders: {
    top: BORDER_OPTS, bottom: BORDER_OPTS,
    left: BORDER_OPTS, right: BORDER_OPTS,
    insideHorizontal: BORDER_OPTS,
    insideVertical: BORDER_OPTS,
  },
  rows: [
    new TableRow({
      children: [
        new TableCell({
          width: { size: LABEL_WIDTH, type: WidthType.DXA },
          children: [
            new Paragraph({
              children: [new TextRun({ text: "Name of Facility", bold: true })],
            }),
          ],
        }),
        new TableCell({
          width: { size: VALUE_WIDTH, type: WidthType.DXA },
          children: [
            new Paragraph({
              children: [new TextRun({ text: f.displayName, italics: true })],
            }),
          ],
        }),
      ],
    }),
    // ... more rows
  ],
});
```

**DXA units for column widths:** `WidthType.DXA` = twips; 1440 DXA = 1 inch. Use `columnWidths` on the `Table` or per-cell `width` on `TableCell`. [VERIFIED: installed docx types `WidthType` line 3144]

**Table-level vs cell-level borders:** Setting `borders` at the `Table` level (`ITableBordersOptions`) handles outer + inner grid lines. Per-cell `borders` (`ITableCellBorders`) override individual cells. For a uniform grid, setting all six `ITableBordersOptions` keys is the simplest approach. [VERIFIED: installed docx types]

### Q7: `TextRun` Styling (bold, italic, color, size)

```typescript
// Source: node_modules/docx/dist/index.d.ts IRunStylePropertiesOptions line 1639
new TextRun({
  text: "Label text",
  bold: true,             // boolean
  italics: true,          // boolean (note: "italics" not "italic")
  color: "111827",        // hex string WITHOUT # prefix
  size: 20,               // half-points; 20 = 10pt, 24 = 12pt, 26 = 13pt
  underline: {},          // empty object = default underline style
  font: "Calibri",        // optional; omit to use document default (Calibri in Word)
});
```

**Size unit:** `size` is in **half-points**. 10pt = 20, 11pt = 22, 12pt = 24, 13pt = 26. Matching the PDF's 10pt body text requires `size: 20`. [VERIFIED: installed docx types `IRunStylePropertiesOptions` line 1656]

**Color format:** Hex string WITHOUT the `#` prefix — e.g., `"1d4ed8"` (blue), `"111827"` (near-black), `"9ca3af"` (grey). [ASSUMED — standard docx library convention; confirmed by multiple docx examples]

### Q8: `Paragraph` Alignment for the Logo Header

```typescript
// Source: node_modules/docx/dist/index.d.ts AlignmentType line 12
new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [
    new ImageRun({ ... }),
  ],
});
```

`AlignmentType.CENTER = "center"`. [VERIFIED: installed docx types line 14]

### Q9: `Document` title property

```typescript
// Source: IPropertiesOptions line 1592-1594
// title?: string
new Document({
  title: vm.facility.displayName,  // D-11 parity with PDF <Document title={f.displayName}>
  sections: [...]
});
```

[VERIFIED: installed docx types `IPropertiesOptions` line 1594]

---

## Architecture Patterns

### System Architecture Diagram

```
Client (browser)
  ExportControls "use client"
    ├── format state: "pdf" | "docx"  (D-03: default "pdf")
    ├── loading state, error state
    └── handleDownload()
         ├── fetch POST /api/export/pdf  (format === "pdf")
         └── fetch POST /api/export/docx (format === "docx")
              │
              ▼
Server — POST /api/export/docx (route.ts, runtime="nodejs")
  ├── request.json() → catch SyntaxError → 400
  ├── ReportViewModelSchema.safeParse(body) → 400 on failure
  ├── buildReportDocx(vm)  ← server-only import (never in client bundle)
  │    ├── strip base64 prefix from INFINITE_LOGO_DATA_URI
  │    ├── Buffer.from(base64, "base64") → logoBuffer
  │    ├── new Document({ title, sections: [{ properties: US-Letter, children: [...] }] })
  │    │    ├── centered logo ImageRun paragraph
  │    │    ├── bold reportTitle paragraph
  │    │    ├── bold stateLine paragraph
  │    │    ├── bordered 2-col Table (13 body rows)
  │    │    ├── bordered 2-col Table (12 metric rows OR degraded line)
  │    │    └── footer paragraph (ExternalHyperlink + date)
  │    └── returns Document instance
  ├── await Packer.toBuffer(doc) → Node.js Buffer
  ├── slugFilename(displayName, ccn, ".docx")
  └── new Response(new Uint8Array(buffer), { Content-Type, Content-Disposition })
              │
              ▼
Client — resp.blob() → URL.createObjectURL → <a download> click → revokeObjectURL
```

### Recommended Project Structure

```
src/
├── app/api/export/
│   ├── pdf/route.tsx           (existing — unchanged)
│   └── docx/route.ts           (new — clone of pdf route, imports buildReportDocx)
├── lib/
│   ├── docx/
│   │   └── ReportDocx.ts       (new — server-only docx builder function)
│   └── report/
│       ├── slug.ts             (generalize slugFilename to accept ext param)
│       └── ...
└── components/
    ├── ExportControls.tsx      (new — replaces DownloadPdfButton)
    └── SnapshotApp.tsx         (update: swap DownloadPdfButton → ExportControls)
```

### Pattern 1: Server-Only Module Discipline

**What:** The docx builder (`ReportDocx.ts`) must never be imported by any `"use client"` file. Importing it in a client component causes `next build` to fail (PITFALLS #4 — applies equally to `docx` and `@react-pdf/renderer`).

**How to enforce:** Only the route handler (`app/api/export/docx/route.ts`) imports `buildReportDocx`. `ExportControls` imports only `ReportViewModel` as a type (same discipline as `DownloadPdfButton`).

**When to use:** Every server-only module (PDF builder, docx builder) follows this pattern.

### Pattern 2: ExportControls State Machine

```typescript
"use client";
type Format = "pdf" | "docx";

export function ExportControls({ vm }: { vm: ReportViewModel | null }) {
  const [format, setFormat] = useState<Format>("pdf");   // D-03: PDF default
  const [loading, setLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleDownload() {
    if (!vm) return;
    setLoading(true);
    setExportError(null);
    try {
      const resp = await fetch(`/api/export/${format}`, { method: "POST", ... });
      if (!resp.ok) throw new Error();
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = format === "pdf" ? "report.pdf" : "report.docx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);    // WR-02
    } catch {
      setExportError(`Couldn't generate ${format.toUpperCase()} — try again.`);
    } finally {
      setLoading(false);
    }
  }
  // ... render: segmented toggle + Download button + inline error
}
```

### Pattern 3: slugFilename Generalization (D-13)

**Current:** `slugFilename(displayName, ccn)` → hardcodes `"-Snapshot.pdf"`.

**Generalized:** `slugFilename(displayName, ccn, ext: string = ".pdf")` → `"${slug}-Snapshot${ext}"`.

The `ext` parameter is allowlist-safe because it comes from the route handler code (not user input). The existing sanitization of `displayName` and `ccn` is unchanged.

```typescript
export function slugFilename(displayName: string, ccn: string, ext = ".pdf"): string {
  const slug = displayName.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug) return `${slug}-Snapshot${ext}`;
  const safeCcn = ccn.replace(/[^A-Za-z0-9]+/g, "");
  return `${safeCcn || "facility"}-Snapshot${ext}`;
}
```

`slug.test.ts` additions: `slugFilename("Name", "686123", ".docx")` → `"name-Snapshot.docx"`. All existing PDF assertions remain green (default `ext = ".pdf"`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OOXML zip packaging | Custom zip builder | `Packer.toBuffer(doc)` | OOXML is a complex multi-file ZIP with relationships XML, content types, theme files — dozens of edge cases |
| Border grid in Word tables | CSS-like border-collapse logic | `ITableBordersOptions` with all 6 keys | Word border model is not CSS; manually setting per-cell borders leads to doubled or missing lines |
| Binary PNG embedding | Manual base64-to-binary for OOXML | `ImageRun({ type: "png", data: Buffer.from(b64, "base64") })` | Image relationship XML, dimensions in EMU, media part packaging — all handled by docx |
| Clickable hyperlink | Custom XML hyperlink relationship | `ExternalHyperlink({ link, children })` | Hyperlink relationships require a `rId` in `word/_rels/document.xml.rels` — docx handles this |
| Safe filenames for Content-Disposition | New sanitizer | `slugFilename` (generalized) | Already has T-04-03/CR-01 header-injection-safe allowlist; duplicating the sanitization creates divergence |

**Key insight:** The OOXML format underlying `.docx` is a complex multi-file ZIP. Almost every component that appears simple (borders, images, hyperlinks) has hidden XML relationship requirements. The `docx` library abstracts all of this correctly.

---

## Common Pitfalls

### Pitfall 1: `ExternalHyperlink.link` vs `.href`

**What goes wrong:** Using `href` instead of `link` silently produces a paragraph with no hyperlink — no TypeScript error because the extra property is allowed by structural typing.

**Why it happens:** `<Link href="...">` is the React/HTML pattern; developers assume the same prop name.

**How to avoid:** The `IExternalHyperlinkOptions` type has `link` (not `href`). Verify against the type definition: `{ children: readonly ParagraphChild[]; link: string }`.

**Warning signs:** The downloaded `.docx` has the link text but clicking it does nothing. Word does not show the underline/blue color if there's no relationship.

### Pitfall 2: `ImageRun` `transformation` in EMU, not pixels

**What goes wrong:** Setting `transformation: { width: 224, height: 51 }` produces a 224 EMU × 51 EMU image — roughly 0.002 inches wide. The logo is invisible.

**Why it happens:** `IMediaTransformation.width/height` are in English Metric Units (914400 EMU = 1 inch), not pixels or points.

**How to avoid:** Multiply pixel dimensions by 9144 (at 96 DPI: 1 px = 9144 EMU) or scale to a target width in inches (1 inch = 914400 EMU, 2 inches = 1828800 EMU).

**Warning signs:** Logo is present in the `.docx` structure (no error) but invisible or a tiny dot.

### Pitfall 3: `docx` Imported in a `"use client"` Component

**What goes wrong:** If `ReportDocx.ts` or `docx` is imported (directly or transitively) by any `"use client"` file, `next build` fails with a module resolution error. This is PITFALLS #4 applied to `docx`.

**Why it happens:** `ExportControls` is a client component; developers might be tempted to build the docx in the browser using `Packer.toBlob` (which works in browsers too). However, CONTEXT.md D-12 mandates the server route pattern.

**How to avoid:** `ExportControls` MUST NOT import `docx` or `ReportDocx.ts`. Only the route handler imports them. The client component only imports `ReportViewModel` as a type. Same discipline as `DownloadPdfButton` / `ReportPDF`.

**Warning signs:** `next build` fails with "Server Components cannot import client-only code" or similar bundler error. Or the opposite: client bundle size grows by ~100–300 KB.

### Pitfall 4: Default Page Size is A4, Not US Letter

**What goes wrong:** Omitting `properties.page.size` in `ISectionOptions` produces an A4 document (11906 × 16838 twips — 210mm × 297mm), not US Letter. The PDF export uses `<Page size="LETTER">` explicitly; the docx builder must also be explicit.

**Why it happens:** `sectionPageSizeDefaults` in docx v9 defaults to A4 (verified in `node_modules/docx/dist/index.cjs`).

**How to avoid:** Always set `size: { width: 12240, height: 15840, orientation: PageOrientation.PORTRAIT }` in the section properties.

**Warning signs:** The downloaded document is slightly narrower and taller than the PDF; column widths feel different.

### Pitfall 5: `TextRun.color` Uses Hex WITHOUT `#`

**What goes wrong:** `color: "#1d4ed8"` does not produce blue — the `#` prefix causes the color to be ignored or produce black, depending on the Word version.

**Why it happens:** CSS uses `#rrggbb`; the OOXML `<w:color w:val="...">` element takes the hex value without a `#`.

**How to avoid:** Always pass hex colors as 6-character strings without `#`: `color: "1d4ed8"`, `color: "111827"`, `color: "9ca3af"`.

**Warning signs:** Text color appears as black regardless of the color set.

### Pitfall 6: `size` in `TextRun` is Half-Points

**What goes wrong:** `size: 10` produces 5pt text (nearly invisible). `size: 12` produces 6pt text.

**Why it happens:** The OOXML `<w:sz>` element is in half-points. `docx` v9 passes this value through directly.

**How to avoid:** To match the PDF's 10pt body text, use `size: 20`. Title text at 13pt = `size: 26`. State line at 11pt = `size: 22`.

**Warning signs:** Body text in the Word document is much smaller or larger than the PDF.

### Pitfall 7: Vercel 4.5 MB Response Limit (PITFALLS #12)

**What goes wrong:** If the docx embeds large images without size-checking, the route response can exceed Vercel's 4.5 MB body limit, returning 413.

**Expected size:** A small text report with one embedded logo PNG (~10 KB base64 decoded, ~7 KB binary) packaged as an OOXML ZIP will be in the range of **30–100 KB** — far under the 4.5 MB limit. No risk for this report.

**How to avoid:** The test assertion `Buffer.byteLength(docxBuffer) < 4_500_000` (DOCX-01 SC#3) catches this automatically. The logo is 224×51px PNG inlined as a data URI — tiny.

---

## Code Examples

### Complete `buildReportDocx` skeleton

```typescript
// Source: verified against node_modules/docx/dist/index.d.ts
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, ExternalHyperlink, AlignmentType, WidthType, BorderStyle,
  PageOrientation,
} from "docx";
import type { ReportViewModel } from "@/lib/report/view-model";
import {
  formatRating, formatBeds, formatLocation, formatDate,
  formatPercent, formatRate, formatFootnote,
} from "@/lib/report/format";
import {
  INFINITE_LOGO_DATA_URI, INFINITE_LOGO_WIDTH, INFINITE_LOGO_HEIGHT,
} from "@/lib/report/logo";
import type { HospMetric } from "@/lib/cms/types";

// US Letter in twips (1440 twips = 1 inch)
const PAGE_WIDTH_DXA = 12240;    // 8.5 inches
const PAGE_HEIGHT_DXA = 15840;   // 11 inches
// Text width with default 1-inch margins: 12240 - 2*1440 = 9360
const TEXT_WIDTH_DXA = 9360;
const LABEL_WIDTH_DXA = Math.round(TEXT_WIDTH_DXA * 0.42);
const VALUE_WIDTH_DXA = TEXT_WIDTH_DXA - LABEL_WIDTH_DXA;

const BORDER = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
const ALL_BORDERS = {
  top: BORDER, bottom: BORDER, left: BORDER, right: BORDER,
  insideHorizontal: BORDER, insideVertical: BORDER,
};

// Decode logo: strip data-URI prefix, decode base64 to Buffer
const b64 = INFINITE_LOGO_DATA_URI.replace(/^data:image\/png;base64,/, "");
const LOGO_BUFFER = Buffer.from(b64, "base64");
// Scale to ~2-inch display width in the Word doc; maintain aspect ratio
const LOGO_DISPLAY_W_EMU = 1828800;  // 2 inches × 914400 EMU/inch
const LOGO_DISPLAY_H_EMU = Math.round(
  LOGO_DISPLAY_W_EMU * (INFINITE_LOGO_HEIGHT / INFINITE_LOGO_WIDTH)
);

function docRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: LABEL_WIDTH_DXA, type: WidthType.DXA },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20 })] })],
      }),
      new TableCell({
        width: { size: VALUE_WIDTH_DXA, type: WidthType.DXA },
        children: [new Paragraph({ children: [new TextRun({ text: value, italics: true, size: 20 })] })],
      }),
    ],
  });
}

function renderMetricValue(m: HospMetric): string {
  if (m.value === null) return formatFootnote(m.footnoteCode);
  return m.unit === "percent" ? formatPercent(m.value) : formatRate(m.value);
}

export function buildReportDocx(vm: ReportViewModel): Document {
  const f = vm.facility;
  const m = vm.manual;

  const metricRows: TableRow[] = vm.hospMetrics === undefined
    ? [new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            children: [new Paragraph({
              children: [new TextRun({
                text: "Hospitalization & ED metrics are temporarily unavailable.",
                italics: true, size: 20, color: "6b7280",
              })],
            })],
          }),
        ],
      })]
    : vm.hospMetrics.map((metric) => docRow(metric.label, renderMetricValue(metric)));

  return new Document({
    title: f.displayName,                          // D-11
    sections: [{
      properties: {
        page: {
          size: {
            width: PAGE_WIDTH_DXA,
            height: PAGE_HEIGHT_DXA,
            orientation: PageOrientation.PORTRAIT,
          },
        },
      },
      children: [
        // Header: centered logo (rule #2 static branding)
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new ImageRun({
            type: "png", data: LOGO_BUFFER,
            transformation: { width: LOGO_DISPLAY_W_EMU, height: LOGO_DISPLAY_H_EMU },
          })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: vm.header.reportTitle, bold: true, size: 26 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: vm.header.stateLine, bold: true, size: 22 })],
        }),

        // Body: bordered 2-column table (13 fields + metrics)
        new Table({
          width: { size: TEXT_WIDTH_DXA, type: WidthType.DXA },
          borders: ALL_BORDERS,
          rows: [
            docRow("Name of Facility", f.displayName),
            docRow("Location", formatLocation(f.address)),
            docRow("EMR", m.emr ?? "—"),
            docRow("Census Capacity", formatBeds(f.certifiedBeds)),
            docRow("Current Census", m.currentCensus != null ? String(m.currentCensus) : "—"),
            docRow("Type of Patient", m.typeOfPatient ?? "—"),
            docRow("Previous Coverage from Medelite", m.previousCoverage ?? "—"),
            docRow("Previous Provider Performance from Medelite", m.previousProviderPerformance ?? "—"),
            docRow("Medical Coverage", m.medicalCoverage ?? "—"),
            docRow("Overall Star Rating", formatRating(f.starRatings.overall)),
            docRow("Health Inspection", formatRating(f.starRatings.healthInspection)),
            docRow("Staffing", formatRating(f.starRatings.staffing)),
            docRow("Quality of Resident Care", formatRating(f.starRatings.qualityCare)),
            ...metricRows,
          ],
        }),

        // Footer: Medicare link (D-10) + CMS processing date
        new Paragraph({
          children: [
            new ExternalHyperlink({
              link: f.careCompareUrl,                // "link" NOT "href"
              children: [
                new TextRun({
                  text: "View official CMS profile on Medicare.gov",
                  style: "Hyperlink",                // or: color: "1d4ed8", underline: {}
                }),
              ],
            }),
            new TextRun({ text: `    CMS processing date: ${formatDate(f.processingDate)}`, color: "9ca3af", size: 18 }),
          ],
        }),
      ],
    }],
  });
}
```

### Route Handler (POST /api/export/docx)

```typescript
// src/app/api/export/docx/route.ts
import { Packer } from "docx";
import { buildReportDocx } from "@/lib/docx/ReportDocx";
import { slugFilename } from "@/lib/report/slug";
import { ReportViewModelSchema } from "@/lib/report/view-model";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { kind: "invalid_request", message: "Invalid report data." } }, { status: 400 });
  }
  const parseResult = ReportViewModelSchema.safeParse(body);
  if (!parseResult.success) {
    return Response.json({ error: { kind: "invalid_request", message: "Invalid report data." } }, { status: 400 });
  }
  const docxBuffer = await Packer.toBuffer(buildReportDocx(parseResult.data));
  const filename = slugFilename(
    parseResult.data.facility.displayName,
    parseResult.data.facility.ccn,
    ".docx",   // D-13
  );
  return new Response(new Uint8Array(docxBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `officegen` (older Word generation) | `docx` (actively maintained) | ~2018 | `officegen` is unmaintained; `docx` v9 has a clean TypeScript API |
| `Packer.toBlob` (client-side only) | `Packer.toBuffer` (server route) | docx v7+ | Both APIs exist; project uses server route (D-12) to match PDF route pattern |
| `serverComponentsExternalPackages` key | `serverExternalPackages` key | Next.js 15.0.0 | Old key silently ignored in Next.js 16; already correct in next.config.ts |

**Not deprecated:** `Packer.toBuffer`, `Document`, `Table`, `TableRow`, `TableCell`, `Paragraph`, `TextRun`, `ImageRun`, `ExternalHyperlink` — all present and unchanged in v9.7.1.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | MIME type `application/vnd.openxmlformats-officedocument.wordprocessingml.document` is the correct Content-Type for `.docx` files | Q3: Route Usage | Browser may not trigger download or Word may not open; easily fixed by checking OOXML spec |
| A2 | `style: "Hyperlink"` applies Word's built-in blue+underline hyperlink style in all Word versions and Google Docs | Q5: ExternalHyperlink | Link text may appear unstyled; fallback: use explicit `color: "1d4ed8"` + `underline: {}` on the TextRun |
| A3 | `color: "1d4ed8"` (hex without `#`) is the docx v9 color format convention | Pitfall 5 | Text color wrong; easy fix if behavior observed during UAT |
| A4 | `docx` CJS bundle does not trigger Next.js bundling failures (no ESM-only internals) | Q1: serverExternalPackages | Build fails with module error; fix: add `"docx"` to `serverExternalPackages` |
| A5 | Logo display at 2 inches × proportional height is visually appropriate in the Word document | Q4: ImageRun sizing | Logo too large/small; implementer adjusts EMU values during UAT |

**Note on A4:** The package structure analysis (CJS entry, pure-JS deps, no native bindings, no `require('fs')`) provides HIGH confidence. `[VERIFIED: installed package analysis]`. If `next build` fails after adding the route, adding `"docx"` to `serverExternalPackages` is the single-line fix.

---

## Open Questions (RESOLVED)

> All three questions below are engineering-judgment calls with concrete recommendations that are implemented in the Phase-6 plan actions (06-01 Task 2). The logo/hyperlink/table-width rendering choices are confirmed visually in the human UAT (06-03 Task 3).

1. **Logo EMU sizing — exact display dimensions**
   - What we know: `IMediaTransformation.width/height` are in EMU; 1 inch = 914400 EMU; logo is 224×51 px at 96 DPI (9144 EMU/px = 2,048,256 × 466,344 EMU, roughly 2.24 × 0.51 inches)
   - What's unclear: The exact display size that looks correct in Word next to the header text
   - Recommendation: Start with ~2 inches wide (1,828,800 EMU); verify during human UAT (open in Word/Google Docs)

2. **Hyperlink style in Google Docs**
   - What we know: `style: "Hyperlink"` uses the Word built-in style; Google Docs may or may not apply it
   - What's unclear: Whether Google Docs renders the `ExternalHyperlink` with blue+underline using the style name, or only when explicit color/underline properties are set
   - Recommendation: Set both `style: "Hyperlink"` AND explicit `color: "1d4ed8"` + `underline: {}` on the TextRun for maximum compatibility

3. **Table width and column calculation**
   - What we know: US Letter text width = 9360 DXA (with 1-inch margins); label = 42%; value = 58%
   - What's unclear: Whether docx default margins are exactly 1 inch or differ from Word defaults
   - Recommendation: Use `width: { size: 100, type: WidthType.PERCENTAGE }` on the Table for automatic full-width fit, then set per-cell widths in DXA

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `docx` package | DOCX builder + `Packer.toBuffer` | ✓ (installed) | 9.7.1 | — |
| Node.js `Buffer` | base64 decoding (`Buffer.from(b64, "base64")`) + `new Uint8Array(buffer)` | ✓ | runtime="nodejs" route | — |
| `ReportViewModelSchema` | Route body validation | ✓ (Phase 2) | — | — |
| `formatters` in `format.ts` | Value formatting (D-08) | ✓ (Phase 3/5) | — | — |
| `INFINITE_LOGO_DATA_URI` | `ImageRun` data | ✓ (Phase 4) | — | — |
| `slugFilename` | Filename sanitization (D-13) | ✓ (needs generalization) | — | — |

**Missing dependencies with no fallback:** None — all required assets are in place.

**Missing dependencies with fallback:** None.

---

## Validation Architecture

> `workflow.nyquist_validation` is not explicitly set to false in `.planning/config.json` (key is absent from that file; defaults to enabled). Validation Architecture section is included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (node env) |
| Config file | `medelite-report/vitest.config.ts` (existing) |
| Quick run command | `npx vitest run tests/api/export-docx.test.ts` |
| Full suite command | `npm run verify` (from `medelite-report/`) |

### DOCX-01 Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOCX-01 | `POST /api/export/docx` with invalid body → 400 | unit | `npx vitest run tests/api/export-docx.test.ts -t "invalid body"` | ❌ Wave 0 |
| DOCX-01 | `400` response has `{ error: { kind: "invalid_request" } }` envelope, no Zod internals | unit | `npx vitest run tests/api/export-docx.test.ts -t "error envelope"` | ❌ Wave 0 |
| DOCX-01 | `POST` with valid `ReportViewModel` → 200 | unit | `npx vitest run tests/api/export-docx.test.ts -t "200 success"` | ❌ Wave 0 |
| DOCX-01 | Response body is a valid OOXML ZIP (PK magic bytes `50 4B 03 04`) | unit | `npx vitest run tests/api/export-docx.test.ts -t "PK magic bytes"` | ❌ Wave 0 |
| DOCX-01 | `Buffer.byteLength(buffer) < 4_500_000` (SC#3 size guard) | unit | `npx vitest run tests/api/export-docx.test.ts -t "size limit"` | ❌ Wave 0 |
| DOCX-01 | `Content-Type` header is the exact OOXML MIME type | unit | `npx vitest run tests/api/export-docx.test.ts -t "Content-Type"` | ❌ Wave 0 |
| DOCX-01 | `Content-Disposition` contains `filename=` with `.docx` extension | unit | `npx vitest run tests/api/export-docx.test.ts -t "Content-Disposition"` | ❌ Wave 0 |
| DOCX-01 | Non-JSON body → 400 (not raw 500) | unit | `npx vitest run tests/api/export-docx.test.ts -t "non-JSON body"` | ❌ Wave 0 |
| DOCX-01 | `slugFilename(name, ccn, ".docx")` returns `.docx` extension | unit | `npx vitest run tests/lib/slug.test.ts` | ❌ (add to existing) |
| DOCX-01 (UAT) | `.docx` opens cleanly in Word/Google Docs, logo visible, all 13+12 rows present, link clickable (SC#1/SC#2) | manual | human UAT with CCN 686123 | manual only |

### ZIP Validity Assertion (PK magic bytes)

A `.docx` file is an OOXML ZIP. The first four bytes of every valid ZIP are `50 4B 03 04` (PK header). This is a lightweight structural sanity check that does not require opening Word:

```typescript
it("response body is a valid OOXML ZIP (PK magic bytes)", async () => {
  const resp = await POST(makeRequest(validVm));
  expect(resp.status).toBe(200);
  const arrayBuffer = await resp.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  // PK magic bytes: 0x50, 0x4B, 0x03, 0x04
  expect(bytes[0]).toBe(0x50);
  expect(bytes[1]).toBe(0x4B);
  expect(bytes[2]).toBe(0x03);
  expect(bytes[3]).toBe(0x04);
});
```

This pattern does not require any additional npm packages. [VERIFIED: ZIP format specification; confirmed OOXML is a ZIP by definition]

### Sampling Rate

- **Per task commit:** `npx vitest run tests/api/export-docx.test.ts`
- **Per wave merge:** `npm run verify` (full suite, typecheck + lint + format + test)
- **Phase gate:** `npm run verify:full` (adds `next build`) must be green before `/gsd:verify-work` — this phase touches a new route and the slug helper, so the build check is mandatory (CONTEXT.md "close on verify:full")

### Wave 0 Gaps

- [ ] `tests/api/export-docx.test.ts` — covers all DOCX-01 automated assertions above
- [ ] `tests/lib/slug.test.ts` — add `.docx` extension assertions (no new file, add to existing)
- [ ] `src/lib/docx/ReportDocx.ts` — server-only builder function (new file)
- [ ] `src/app/api/export/docx/route.ts` — route handler (new file)
- [ ] `src/components/ExportControls.tsx` — unified export control (new file)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | `ReportViewModelSchema.safeParse` on every POST body; `careCompareUrl` validated to `https://www.medicare.gov` hostname |
| V6 Cryptography | no | — |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Header injection via `displayName`/`ccn` in `Content-Disposition` | Tampering | `slugFilename` allowlist-sanitizes both inputs to `[a-z0-9]`/`[A-Za-z0-9]`; CRLF, quotes, slashes cannot survive (T-04-03/CR-01) |
| Malicious `careCompareUrl` injection into Word hyperlink | Tampering | `ReportViewModelSchema` constrains `careCompareUrl` to `https://www.medicare.gov` hostname via `.refine()`; non-medicare URLs → 400 |
| Zod internals leaked in 400 response body | Information Disclosure | D-05 clean-envelope discipline: 400 body always `{ error: { kind, message } }`, never Zod `.issues` |
| `docx` builder reaching client bundle | Elevation of Privilege | Server-only import discipline; `ExportControls` never imports `docx` or `ReportDocx.ts`; `next build` fails fast if violated |

---

## Sources

### Primary (HIGH confidence)

- `medelite-report/node_modules/docx/dist/index.d.ts` — All v9 type signatures verified: `Packer.toBuffer` (line 2435), `ImageRun`/`IImageOptions`/`RegularImageOptions`/`CoreImageOptions` (lines 319–340, 1262, 1322–1326, 2621–2628), `ExternalHyperlink`/`IExternalHyperlinkOptions` (lines 638–640, 1194–1197), `Table`/`TableRow`/`TableCell` (lines 1803–1897, 1921–1923, 2875–2877, 2890–2893, 2920–2923), `Document`/`IPropertiesOptions`/`ISectionOptions`/`ISectionPropertiesOptionsBase` (lines 648–692, 1592–1619, 1682–1719), `TextRun`/`IRunStylePropertiesOptions` (lines 1639–1675, 2991–2993), `AlignmentType` (lines 12–26), `WidthType` (lines 3144–3149), `BorderStyle`/`IBorderOptions` (lines 131–141, 957–962), `PageOrientation`/`IPageSizeAttributes` (lines 1530–1535, 2490–2493), `sectionPageSizeDefaults` (lines 2715–2719 — A4 default confirmed)
- `medelite-report/node_modules/docx/dist/index.cjs` — Confirmed `sectionPageSizeDefaults.WIDTH = 11906` (A4), `HEIGHT = 16838` (A4); pure-JS deps confirmed; no native bindings
- `medelite-report/node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.md` — Official Next.js 16 auto-opt-out list; `docx` is NOT on it; `@react-pdf/renderer` IS on it
- `medelite-report/src/app/api/export/pdf/route.tsx` — Existing route contract to clone: `new Uint8Array(buffer)` cast pattern, clean error envelope, `runtime = "nodejs"`
- `medelite-report/src/components/DownloadPdfButton.tsx` — ExportControls download mechanics to lift
- `medelite-report/src/lib/report/slug.ts` — `slugFilename` current implementation to generalize
- `medelite-report/src/components/pdf/ReportPDF.tsx` — Exact content/labels/order/semantics to replicate
- `medelite-report/src/lib/report/view-model.ts` — `ReportViewModel`/`ReportViewModelSchema` route input contract

### Secondary (MEDIUM confidence)

- `.planning/research/PITFALLS.md` — PITFALLS #4 (serverExternalPackages discipline applies to docx too), #5 (font footgun — not applicable this phase, using Word defaults), #12 (Vercel 4.5 MB limit), #13 (header branding rule)
- `.planning/research/STACK.md` — `docx@9.7.1` decision recorded
- `npm view docx` registry data — version 9.7.1, published 2026-05-27, homepage https://docx.js.org, repository git+https://github.com/dolanmiu/docx.git

### Tertiary (LOW confidence / ASSUMED)

- OOXML MIME type `application/vnd.openxmlformats-officedocument.wordprocessingml.document` — widely known standard; tagged [ASSUMED] per protocol since not verified against official IANA/ECMA spec in this session
- `color` hex format without `#` prefix — docx library convention; not explicitly stated in installed types but consistent with OOXML spec [ASSUMED]
- `style: "Hyperlink"` word built-in style applicability in Google Docs [ASSUMED]

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — docx v9.7.1 installed and types fully inspected
- Architecture: HIGH — mirrors existing Phase-4 PDF route, only library changes
- docx v9 API specifics: HIGH — all signatures verified directly from installed type definitions
- serverExternalPackages decision: HIGH — verified against installed Next.js 16 official docs
- Pitfalls: HIGH — grounded in installed source analysis, not training data
- EMU dimensions: MEDIUM — formula is correct; exact display size needs UAT confirmation

**Research date:** 2026-06-19
**Valid until:** 2026-07-19 (docx v9 is stable; Next.js 16 serverExternalPackages list could change on any Next.js point release)
