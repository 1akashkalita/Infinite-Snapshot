# Architecture Patterns

**Domain:** Nursing-home facility report generator (CCN lookup → CMS data + manual inputs → PDF/.docx export)
**Researched:** 2026-06-15
**Confidence:** HIGH (verified against Next.js 16 bundled docs, @react-pdf/renderer official docs, React 19 APIs)

---

## Recommended Architecture

Single-page app with a three-zone layout: input panel, live preview panel, export controls. All CMS I/O happens through a Route Handler. The entire report is driven by one typed view-model assembled on the client from CMS data (fetched once) and manual inputs (updated continuously). The view-model feeds three consumers: the live HTML preview, the server-generated PDF, and the server-generated .docx.

```
Browser (Client Components)
  │
  ├─ CCNSearchBar ('use client')
  │    └─ POST /api/facility → returns FacilityData (typed, Zod-validated)
  │
  ├─ ManualInputsForm ('use client')
  │    └─ produces ManualInputs (local React state, updates live preview)
  │
  ├─ ReportPreview ('use client')
  │    └─ consumes ReportViewModel = merge(FacilityData, ManualInputs)
  │
  └─ ExportControls ('use client')
       ├─ "Download PDF" → POST /api/export/pdf   (body: ReportViewModel)
       └─ "Download DOCX" → POST /api/export/docx (body: ReportViewModel)

Server (Route Handlers — Node.js runtime, not Edge)
  ├─ /api/facility/route.ts
  │    └─ cmsClient.fetchByCCN(ccn) → Zod validate → FacilityData → JSON
  ├─ /api/export/pdf/route.ts
  │    └─ ReportViewModel → renderToBuffer(<ReportPDF />) → Response(buffer)
  └─ /api/export/docx/route.ts
       └─ ReportViewModel → docx.Packer.toBuffer(buildDocx(vm)) → Response(buffer)

Shared (no 'use client', no 'use server' — pure TypeScript modules)
  ├─ src/lib/report/view-model.ts   — ReportViewModel type + assembleViewModel()
  ├─ src/lib/report/header.ts       — assembleHeader(state: string) → HeaderData
  ├─ src/lib/cms/client.ts          — fetchByCCN() wraps raw fetch
  ├─ src/lib/cms/schema.ts          — Zod schemas for CMS responses
  ├─ src/lib/cms/mapper.ts          — raw CMS row → FacilityData (typed domain model)
  └─ src/lib/export/pdf-doc.tsx     — <ReportPDF vm={ReportViewModel} /> (react-pdf components)
       src/lib/export/docx-builder.ts — buildDocx(vm: ReportViewModel) → docx.Document
```

---

## 1. App Router Layout Decision: Route Handler for CMS Lookup

**Decision: Route Handler (`app/api/facility/route.ts`) — not Server Action, not Server Component.**

Rationale:
- The lookup is **triggered on demand by a client event** (user hits Enter or clicks Search). Server Components only run at request time for the initial page render — they cannot be re-invoked by user interaction without a navigation. Server Actions are designed for mutations (POST-only, no caching semantics) and carry awkward signatures when used as pure data-read endpoints.
- A Route Handler exposes a clean `GET /api/facility?ccn=686123` endpoint. The client calls it with `fetch()`. The response is JSON. This pattern is standard, independently testable, and the pattern Next.js itself recommends for "proxying requests to external services" (see Next.js BFF guide in `node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md`).
- GET Route Handlers are cacheable at the network layer (Vercel CDN edge), though for this app caching is not critical since CMS data changes infrequently.
- Server Actions require `'use server'` and accept `FormData`, which adds friction for a simple JSON query response pattern.

**Route design:**

```
GET  /api/facility?ccn={ccn}    → 200 FacilityData | 400 invalid CCN | 404 not found | 502 CMS error
POST /api/export/pdf            → 200 application/pdf binary
POST /api/export/docx           → 200 application/vnd.openxmlformats...
```

The CCN lookup is GET because it is a read with no side effects. Exports are POST because the client sends the full view-model as the request body (avoids URL length limits and keeps the payload typed).

---

## 2. Data Layer: Raw Fetch → Zod → Domain Model → UI/PDF

### Module layout under `medelite-report/src/lib/cms/`

```
src/lib/cms/
  client.ts      — fetchByccn(ccn: string): Promise<CMSRawRow>
  schema.ts      — CMSRowSchema (Zod), CMSRawRow = z.infer<typeof CMSRowSchema>
  mapper.ts      — toFacilityData(raw: CMSRawRow): FacilityData
  types.ts       — FacilityData interface (pure domain, no Zod dependency)
```

### Pipeline

```
cmsClient.fetchByccn(ccn)
  → raw fetch to data.cms.gov/provider-data/api/1/datastore/query/{DATASET_ID}/0
       ?conditions[0][property]=federal_provider_number
       &conditions[0][value]={ccn}
       &conditions[0][operator]==
  → response.json()                        (unknown)
  → CMSRowSchema.safeParse(data[0])        (Zod boundary — validates or throws CmsValidationError)
  → toFacilityData(validated)              (field mapping: CMS column → report field)
  → FacilityData                           (typed domain model)
```

**CMS API endpoint:** `https://data.cms.gov/provider-data/api/1/datastore/query/{DATASET_ID}/0`

IMPORTANT: The dataset ID and exact field names (`federal_provider_number`, `overall_rating`, `number_of_certified_beds`, etc.) MUST be sourced from the `NH_Data_Dictionary` and the `provider-686123.json` fixture that the `fixture:capture` script will populate. Do not derive them from memory — this is CLAUDE.md rule #3. The `capture-fixture.ts` script must be wired before any field mapping is written.

### Field mapping location

Field mapping (CMS column name → FacilityData property) lives exclusively in `src/lib/cms/mapper.ts`. No other file imports raw CMS field names. This gives one place to update when CMS renames columns.

```typescript
// src/lib/cms/mapper.ts  (sketch — actual field names from NH_Data_Dictionary)
export function toFacilityData(raw: CMSRawRow): FacilityData {
  return {
    providerNumber: raw.federal_provider_number,
    legalName: raw.provider_name,                  // verify against dict
    state: raw.provider_state,                     // two-letter abbrev
    address: {
      street: raw.provider_address,
      city: raw.provider_city,
      zip: raw.provider_zip_code,
    },
    certifiedBeds: Number(raw.number_of_certified_beds),
    starRatings: {
      overall: Number(raw.overall_rating),
      healthInspection: Number(raw.health_inspection_rating),
      staffing: Number(raw.staffing_rating),
      qualityCare: Number(raw.quality_measure_rating),
    },
    // Bonus: hospitalization/ED metrics mapped here when present
  };
}
```

---

## 3. PDF and .docx Generation — Server-Side via Route Handlers

### PDF: Server-side with `renderToBuffer`

**Decision: Server-side rendering in a Route Handler, not client-side.**

Rationale:
- `@react-pdf/renderer` is in Next.js 16's **built-in `serverExternalPackages` auto-opt-out list** (verified in `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.md`). This means it automatically uses native Node.js `require` without any configuration changes needed. The historical Next.js App Router compatibility issues (pre-14.1.1) do not apply here.
- Server-side generation keeps PDF internals out of the client bundle (zero KB of PDFKit added to the browser). The client downloads a binary — nothing renders in browser.
- `renderToBuffer` produces a `Buffer` directly, which wraps into a `Response` with `Content-Type: application/pdf` and `Content-Disposition: attachment` headers — clean, direct download.
- For client-side fallback: if server rendering proves problematic with Next.js 16.2.x, the `<PDFDownloadLink>` client component from `@react-pdf/renderer` is an escape hatch, but prefer server-side first.

```typescript
// src/app/api/export/pdf/route.ts
import { renderToBuffer } from '@react-pdf/renderer';
import { ReportPDF } from '@/lib/export/pdf-doc';

export async function POST(request: Request) {
  const vm: ReportViewModel = await request.json();
  const buffer = await renderToBuffer(<ReportPDF vm={vm} />);
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="snapshot-${vm.facility.providerNumber}.pdf"`,
    },
  });
}
```

### .docx: Server-side with `docx` library

The `docx` npm library (TypeScript-native, zero external runtime dependencies, works in Node.js and serverless) generates Word files via `Packer.toBuffer(document)`. This runs in the export route handler identically to the PDF route.

```typescript
// src/app/api/export/docx/route.ts
import { Packer } from 'docx';
import { buildDocx } from '@/lib/export/docx-builder';

export async function POST(request: Request) {
  const vm: ReportViewModel = await request.json();
  const doc = buildDocx(vm);
  const buffer = await Packer.toBuffer(doc);
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="snapshot-${vm.facility.providerNumber}.docx"`,
    },
  });
}
```

---

## 4. Static Branding Header: `assembleHeader(state)`

**Location: `src/lib/report/header.ts`**

This is a pure function with no React dependency, importable by the web preview component, `ReportPDF`, and `docx-builder` identically.

```typescript
// src/lib/report/header.ts
export interface HeaderData {
  platformLine: string;          // "INFINITE — Managed by MEDELITE"
  reportTitle: string;           // "FACILITY ASSESSMENT SNAPSHOT"
  stateLine: string;             // e.g. "FL"
}

export function assembleHeader(state: string): HeaderData {
  return {
    platformLine: 'INFINITE — Managed by MEDELITE',
    reportTitle: 'FACILITY ASSESSMENT SNAPSHOT',
    stateLine: state.toUpperCase(),
  };
}
```

**Enforcement of CLAUDE.md rule #2:**
- `assembleHeader` accepts zero facility-name arguments — only `state: string`
- The function has no parameter for facility name, making the violation a TypeScript compile error
- `HeaderData.platformLine` is a literal string constant — no interpolation
- All three consumers (web preview, PDF, docx) call `assembleHeader(vm.facility.state)` and receive the same struct — single source of truth for the header

---

## 5. Component Boundaries

### Page structure

```
src/app/
  layout.tsx          — <html>, fonts, metadata: "Infinite Snapshot"
  page.tsx            — root page (Server Component shell), renders <SnapshotApp />
  globals.css

src/components/
  SnapshotApp.tsx     — 'use client' — top-level orchestrator; holds facilityData state + manualInputs state
  CCNSearchBar.tsx    — 'use client' — CCN text input, calls /api/facility, dispatches FacilityData
  ManualInputsForm.tsx— 'use client' — EMR, census, patient type, coverage fields, name override
  ReportPreview.tsx   — 'use client' — renders HeaderBlock + FacilityBlock + ManualBlock + optional MetricsBlock
  ExportControls.tsx  — 'use client' — "Download PDF" + "Download DOCX" buttons, POST to export routes
  StarRatingCard.tsx  — 'use client' OR pure — renders star icons for a rating value (used in preview + preview only; PDF has its own react-pdf equivalent)
  MetricsTable.tsx    — pure — renders 12 hospitalization metrics in a table (bonus)
  ErrorBanner.tsx     — pure — displays typed error state

src/lib/
  report/
    view-model.ts     — ReportViewModel type, assembleViewModel(facility, manual) → ReportViewModel
    header.ts         — assembleHeader(state) → HeaderData
  cms/
    client.ts         — fetchByccn(ccn) → CMSRawRow
    schema.ts         — CMSRowSchema (Zod)
    mapper.ts         — toFacilityData(raw) → FacilityData
    types.ts          — FacilityData, StarRatings, HospMetrics
    errors.ts         — CmsError union type (InvalidCcn | NotFound | NetworkError | ValidationError)
  export/
    pdf-doc.tsx       — <ReportPDF vm /> composed of react-pdf primitives (Document, Page, View, Text, Link)
    docx-builder.ts   — buildDocx(vm) → docx.Document

src/app/api/
  facility/route.ts   — GET handler: ccn → FacilityData JSON
  export/
    pdf/route.ts      — POST handler: ReportViewModel → PDF binary
    docx/route.ts     — POST handler: ReportViewModel → DOCX binary

tests/
  lib/cms/schema.test.ts        — Zod schema unit tests (valid, invalid, missing fields)
  lib/cms/mapper.test.ts        — field mapping unit tests against fixture
  lib/report/view-model.test.ts — assembleViewModel unit tests
  lib/report/header.test.ts     — assembleHeader unit tests (no facility name, state uppercase)
  api/facility.test.ts          — route handler: CCN validation, 404, 502, Zod failure paths
  api/export-pdf.test.ts        — route handler: buffer returned, headers correct
  fixtures/
    provider-686123.json        — captured via `npm run fixture:capture`
```

### Component communication

```
SnapshotApp
  ├─ state: facilityData: FacilityData | null
  ├─ state: fetchState: 'idle' | 'loading' | 'error'
  ├─ state: fetchError: CmsError | null
  ├─ state: manualInputs: ManualInputs
  │
  ├─ passes setFacilityData, setFetchState → CCNSearchBar
  ├─ passes manualInputs, setManualInputs → ManualInputsForm
  ├─ derives vm = assembleViewModel(facilityData, manualInputs)
  ├─ passes vm → ReportPreview
  └─ passes vm → ExportControls
```

No prop-drilling beyond two levels. No global state manager needed (React state in SnapshotApp is sufficient for this single-page scope).

---

## 6. ReportViewModel: Single Source of Truth

`ReportViewModel` is the canonical data shape that all three rendering targets consume. It is assembled once on the client, then:
- Passed as props to `<ReportPreview>` (HTML preview)
- POSTed as JSON to `/api/export/pdf` (server renders PDF from it)
- POSTed as JSON to `/api/export/docx` (server renders DOCX from it)

This ensures the preview exactly matches the export — no divergence possible.

```typescript
// src/lib/report/view-model.ts
export interface ReportViewModel {
  header: HeaderData;                        // from assembleHeader(facility.state)
  facility: {
    displayName: string;                     // manualInputs.nameOverride || facilityData.legalName
    providerNumber: string;
    location: string;                        // formatted address string
    certifiedBeds: number;
    starRatings: StarRatings;
    hospMetrics?: HospMetrics;               // bonus: 12 CMS claims-based metrics
  };
  manual: {
    emr: string;
    currentCensus: string;
    typeOfPatient: string;
    medicalCoverage: string;
    previousProviderPerformance: string;
    previousCoverageFromMedelite: 'Yes' | 'No' | '';
  };
  meta: {
    ccn: string;
    careCompareUrl: string;                  // `https://www.medicare.gov/care-compare/details/nursing-home/${ccn}`
    generatedAt: string;                     // ISO timestamp
  };
}

export function assembleViewModel(
  facility: FacilityData,
  manual: ManualInputs
): ReportViewModel {
  return {
    header: assembleHeader(facility.state),
    facility: {
      displayName: manual.nameOverride?.trim() || facility.legalName,
      providerNumber: facility.providerNumber,
      location: formatAddress(facility.address),
      certifiedBeds: facility.certifiedBeds,
      starRatings: facility.starRatings,
      hospMetrics: facility.hospMetrics,
    },
    manual,
    meta: {
      ccn: facility.providerNumber,
      careCompareUrl: `https://www.medicare.gov/care-compare/details/nursing-home/${facility.providerNumber}`,
      generatedAt: new Date().toISOString(),
    },
  };
}
```

The `careCompareUrl` lives in the view-model so both the HTML preview anchor and the PDF `<Link>` use the same computed value — never hardcoded in the render layer.

---

## 7. Error-Handling Architecture

Errors flow from the CMS client upward through a typed union, not untyped `Error` objects.

```typescript
// src/lib/cms/errors.ts
export type CmsError =
  | { kind: 'InvalidCcn'; message: string }
  | { kind: 'NotFound'; ccn: string }
  | { kind: 'NetworkError'; message: string }
  | { kind: 'ValidationError'; issues: z.ZodIssue[] }
  | { kind: 'CmsApiError'; status: number; body: string };
```

**Flow:**

```
cmsClient.fetchByccn(ccn)
  → CCN format validation (regex: 6-digit string) — throws InvalidCcn before any network call
  → fetch() network failure → catches, wraps as NetworkError
  → response.status === 404 → NotFound
  → response.status !== 200 → CmsApiError
  → CMSRowSchema.safeParse() fails → ValidationError (preserves ZodIssue[] for logging)
  → success → FacilityData

Route Handler /api/facility
  → catches CmsError, maps to HTTP status:
      InvalidCcn       → 400 { error: 'invalid_ccn' }
      NotFound         → 404 { error: 'not_found' }
      NetworkError     → 502 { error: 'network_error' }
      ValidationError  → 502 { error: 'validation_error' }   (CMS data malformed)
      CmsApiError      → 502 { error: 'cms_api_error' }

CCNSearchBar (client)
  → fetch /api/facility response
  → non-200 → parses error JSON → maps to { kind, message } for UI
  → SnapshotApp fetchError state → ErrorBanner renders appropriate user message
```

**UI error states:**
- `idle` — empty search input
- `loading` — spinner, input disabled
- `error: InvalidCcn` — "CCN must be a 6-digit number"
- `error: NotFound` — "No facility found for CCN 686123"
- `error: NetworkError / CmsApiError / ValidationError` — "Unable to reach CMS. Try again."

All error paths must have corresponding test cases (CLAUDE.md rule #6).

---

## 8. Build Order (Phase Dependency Graph)

The dependency graph between pieces determines the correct build order. Each phase builds on the previous, and no phase needs to mock a dependency that hasn't been built yet.

```
Phase 1: Foundation
  1a. Capture provider-686123.json fixture (fixture:capture script)
  1b. Write NH_Data_Dictionary field mapping reference
  → Unlocks: all subsequent work that depends on field names

Phase 2: CMS Data Layer
  2a. src/lib/cms/errors.ts         (no deps)
  2b. src/lib/cms/schema.ts         (deps: Zod, fixture)
  2c. src/lib/cms/mapper.ts         (deps: schema, types)
  2d. src/lib/cms/client.ts         (deps: schema, errors, mapper)
  2e. Tests for schema + mapper      (deps: fixture)
  → Unlocks: API route, view-model

Phase 3: API Route + View Model
  3a. src/app/api/facility/route.ts  (deps: cms/client)
  3b. src/lib/report/header.ts       (no deps)
  3c. src/lib/report/view-model.ts   (deps: header, cms/types)
  3d. Tests for route + view-model
  → Unlocks: all UI components, both export routes

Phase 4: Web UI
  4a. src/components/CCNSearchBar.tsx      (deps: api route)
  4b. src/components/ManualInputsForm.tsx  (no backend deps — local state)
  4c. src/components/ReportPreview.tsx     (deps: view-model, header)
  4d. src/components/SnapshotApp.tsx       (assembles 4a+4b+4c)
  4e. Update app/page.tsx + layout.tsx     (title, metadata)
  → Unlocks: PDF/DOCX export (needs ReportViewModel shape finalized)

Phase 5: PDF Export
  5a. src/lib/export/pdf-doc.tsx           (deps: view-model, header, @react-pdf/renderer)
  5b. src/app/api/export/pdf/route.ts      (deps: pdf-doc)
  5c. src/components/ExportControls.tsx    (deps: export routes, view-model)
  5d. Tests for PDF route (buffer response, headers, Link URL)
  → Unlocks: .docx export (parallel structure established)

Phase 6: DOCX Export (bonus)
  6a. src/lib/export/docx-builder.ts       (deps: view-model, docx library)
  6b. src/app/api/export/docx/route.ts     (deps: docx-builder)
  6c. Update ExportControls for DOCX button
  → Unlocks: visual polish (all data flows complete)

Phase 7: Visual Polish + Hardened Errors (bonus)
  7a. StarRatingCard, MetricsTable components
  7b. Charts/cards in preview
  7c. Visual parity in PDF (equivalent react-pdf layouts)
  7d. Comprehensive error boundary tests
  7e. Deploy to Vercel, verify live URL
```

**Critical path:** Phase 1 (fixture) → Phase 2 (CMS layer) → Phase 3 (route + view-model) → Phase 4 (UI) → Phase 5 (PDF). Phases 6 and 7 are parallel after Phase 5.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Letting unvalidated CMS data reach render
**What goes wrong:** CMS API occasionally returns `null` for star rating fields. Without Zod, a `null` renders as "null" in the PDF.
**Instead:** `CMSRowSchema` must use `.nullable().default(null)` for optional fields and the view-model must handle `null` explicitly (e.g., render "N/A").

### Anti-Pattern 2: Embedding field names in the route handler
**What goes wrong:** `raw['Overall_Rating']` in the route handler creates a hidden dependency. When CMS renames the column, the error is in a route handler, not in the mapper.
**Instead:** All CMS field names live only in `schema.ts` and `mapper.ts`. The route handler never references raw field names.

### Anti-Pattern 3: Passing facilityName into assembleHeader
**What goes wrong:** Violates CLAUDE.md rule #2 silently — the header shows facility name instead of static branding.
**Instead:** `assembleHeader(state: string)` signature makes this a TypeScript error. The function body contains only literal strings.

### Anti-Pattern 4: Generating PDF on the client to "avoid route handler complexity"
**What goes wrong:** Adds ~500KB+ PDFKit to the client bundle; PDF generation blocks the main thread; no way to test without a browser.
**Instead:** Use the server Route Handler with `renderToBuffer`. `@react-pdf/renderer` is auto-listed in Next.js 16's `serverExternalPackages`, so no additional config is needed.

### Anti-Pattern 5: Separate data shapes for preview vs PDF
**What goes wrong:** Preview shows "Yes" for Previous Coverage; PDF shows "true". Divergence grows over time.
**Instead:** One `ReportViewModel` assembled once, passed to all three consumers. The render layer never re-fetches or re-derives — it only formats.

### Anti-Pattern 6: Fetching CMS data from a Server Component
**What goes wrong:** Server Components fetch at render time and cannot be re-invoked when the user changes the CCN. The entire page would need to reload (navigation) to re-fetch.
**Instead:** Route Handler + client-side fetch. The page is a single interactive app; the CCN input triggers a fetch, not a navigation.

---

## Sources

- Next.js 16.2.9 bundled docs: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` (Route Handlers)
- Next.js 16.2.9 bundled docs: `node_modules/next/dist/docs/01-app/02-guides/forms.md` (Server Actions pattern)
- Next.js 16.2.9 bundled docs: `node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md` (BFF pattern)
- Next.js 16.2.9 bundled docs: `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.md` — confirms `@react-pdf/renderer` is in auto-opt-out list
- react-pdf.org/node — `renderToBuffer` and `renderToStream` Node API confirmed (HIGH confidence)
- CMS Provider Data Catalog API format: `https://data.cms.gov/provider-data/api/1/datastore/query/{id}/0?conditions[0][property]=...` (MEDIUM confidence — field names must be verified from fixture)
- makerkit.dev/blog/tutorials/server-actions-vs-route-handlers — Route Handler preference for external API proxy (MEDIUM confidence, consistent with Next.js official docs)
