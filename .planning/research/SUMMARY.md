# Project Research Summary

**Project:** Infinite Snapshot (Medelite nursing-home facility assessment report generator)
**Domain:** CMS public data consumer + PDF/document export — single-page SPA with server-side generation
**Researched:** 2026-06-15
**Confidence:** HIGH

---

## Executive Summary

Infinite Snapshot is a narrow-scope, single-flow web app: enter a CCN, pull CMS Care Compare data, combine with manual operational inputs, and export a polished PDF. The architecture is a Next.js 16 App Router single-page app where all CMS I/O happens through server-side Route Handlers (eliminating CORS and keeping secrets out of the client bundle), all CMS responses are validated through Zod before any render path, and a single `ReportViewModel` drives three output targets — HTML preview, PDF via `@react-pdf/renderer`, and `.docx` via the `docx` library. This one-view-model-to-many-consumers pattern is the most important architectural decision: it guarantees the preview matches the export and eliminates data divergence.

The stack is fully determined by project constraints (Next.js 16.2.x / React 19 / TypeScript strict / Tailwind v4 / Vercel). The only open library selection decisions are already resolved by research: `@react-pdf/renderer@^4.5.1` for PDF (required by CLAUDE.md, React 19 compatible), `zod@^4.4.3` for schema validation, `docx@^9.7.1` for Word export, and `recharts@^2.15.4` + `react-pdf-charts@^1.0.0` for charting. The CMS dataset IDs for all three relevant datasets have been verified against live API responses.

The primary risks are all well-known patterns with documented mitigations. The top three in order of severity: (1) CCN must be treated as a string throughout — any coercion to `Number` silently drops leading zeros and causes "not found" for valid facilities; (2) `@react-pdf/renderer` must not be imported into the browser bundle — Route Handler + `renderToBuffer` is the correct and verified server-side pattern; (3) the Zod schema must balance strictness — all star-rating and metric fields must be `.nullable().optional()` because CMS suppresses data for newly certified or small-sample facilities. None of these risks are novel; all have prevention strategies that can be encoded in the type system or schema.

---

## Key Findings

### Recommended Stack

The fixed baseline (Next.js 16.2.x / React 19.2.4 / TypeScript strict / Tailwind v4) requires zero negotiation. All production dependencies need to be installed from scratch — the current project has none beyond Next.js and React. Library choices are constrained by compatibility requirements: `recharts` must be pinned to v2 (not v3) because `react-pdf-charts@1.0.0` explicitly does not support recharts v3. Zod should use v4 (not v3), which is 14x faster for string parsing and has a smaller bundle.

**Core technologies:**

| Library | Version | Purpose | Rationale |
|---------|---------|---------|-----------|
| `@react-pdf/renderer` | `^4.5.1` | PDF generation | Required by CLAUDE.md; React 19 support since v4.1.0; peer deps verified |
| `zod` | `^4.4.3` | CMS response validation | v4 is current stable; faster and smaller than v3; `safeParse` idiom unchanged |
| `docx` | `^9.7.1` | .docx export | Actively maintained; pure JS (browser + Node); `Packer.toBuffer()` for server-side |
| `recharts` | `^2.15.4` | Web UI charts | Must be v2 — v3 incompatible with react-pdf-charts |
| `react-pdf-charts` | `^1.0.0` | Bridge recharts SVG into react-pdf | Only tested adapter; requires `isAnimationActive={false}` on all chart children |

**Install command (from `medelite-report/`):**
```bash
npm install @react-pdf/renderer@^4.5.1 zod@^4.4.3 docx@^9.7.1 recharts@^2.15.4 react-pdf-charts@^1.0.0
```

**CMS Dataset IDs (all verified via live query 2026-06-15):**

| Dataset | ID | Primary Use |
|---------|----|----|
| NH Provider Information | `4pq5-n9py` | Core facility data, star ratings, beds |
| NH Claims-Based Quality Measures | `ijh5-nb2v` | 4 hospitalization/ED measures (the "12 metrics") |
| NH State/National Averages | `xcdc-v8bm` | Benchmark comparison column |
| NH MDS Quality Measures | `djen-97ju` | 17 MDS measures — out of scope for v1 |

**CMS API endpoint pattern:**
```
GET https://data.cms.gov/provider-data/api/1/datastore/query/{datasetId}/0
  ?conditions[0][property]={field}
  &conditions[0][value]={value}
  &conditions[0][operator]==
  &limit=1
```

### Expected Features

Research confirms the feature set from PROJECT.md. Table stakes are low-to-medium complexity individually; the PDF export and Zod validation are the highest-complexity required features. All four committed bonuses are achievable within the one-week timeline if the core data pipeline is built first as a reusable foundation.

**Must have (table stakes — required for a passing grade):**
- CCN input with format validation and clear inline error messages
- CMS Provider Info lookup (dataset `4pq5-n9py`) through a Route Handler (never client-side — CORS)
- Zod schema validation on every CMS response before any render or export path
- Report body: facility name (with override), address, certified beds, all 4+ star ratings
- Manual inputs: all 6 fields with correct input types (especially Yes/No dropdown for Medelite coverage)
- Static header: exact "INFINITE — Managed by MEDELITE" / "FACILITY ASSESSMENT SNAPSHOT" / state abbrev
- PDF export via `@react-pdf/renderer` `renderToBuffer` in a Route Handler
- Medicare Care Compare clickable `<Link>` inside the PDF
- Error states: invalid format, not found, network failure — each distinct and tested
- Vercel deployment + public GitHub repo

**Should have (differentiators — committed bonuses):**
- 4 claims-based hospitalization/ED measures x 3 scores each = 12 data points (dataset `ijh5-nb2v`), with state/national benchmark from `xcdc-v8bm`
- Live in-browser report preview via `usePDF` hook + 300ms debounce
- Star rating visual cards with filled/outline star glyphs, color-coded by band (green >=4, amber =3, red <=2)
- .docx export (`docx` library, `Packer.toBuffer()` in Route Handler)
- Suppressed measure handling: footnote codes to human-readable text ("Not reported — small sample")
- Loading skeleton during CMS fetch (Tailwind `animate-pulse`)

**Defer to v2+:**
- All 17 MDS quality measures (adds data depth but not specified in brief)
- Historical star rating trends (requires multiple data fetches)
- Multi-facility comparison view (explicitly out of scope per PROJECT.md)

### Architecture Approach

The architecture is a single-page app with a three-zone layout (input panel, live preview panel, export controls). One `SnapshotApp` client component holds all state and assembles a `ReportViewModel` from two inputs: `FacilityData` (fetched once from CMS via Route Handler, Zod-validated) and `ManualInputs` (local React state, updated continuously). This single view-model feeds three consumers without divergence. All CMS I/O and all binary export generation happen server-side in Route Handlers; the browser never calls `data.cms.gov` directly.

**Major components:**

1. **`/api/facility` Route Handler** — GET; proxies CMS `4pq5-n9py` query by CCN; validates with Zod; returns typed `FacilityData` JSON; maps CMS errors to 400/404/502
2. **`/api/export/pdf` Route Handler** — POST; receives `ReportViewModel`; calls `renderToBuffer(<ReportPDF vm={vm} />)`; returns `application/pdf` binary
3. **`/api/export/docx` Route Handler** — POST; receives `ReportViewModel`; calls `Packer.toBuffer(buildDocx(vm))`; returns `.docx` binary
4. **`SnapshotApp` client component** — top-level orchestrator; holds `facilityData`, `fetchState`, `manualInputs` state; derives `vm = assembleViewModel(facilityData, manualInputs)`
5. **`src/lib/cms/` module set** — `schema.ts` (Zod), `mapper.ts` (CMS fields to domain model), `client.ts` (fetch), `errors.ts` (typed CmsError union)
6. **`src/lib/report/` module set** — `header.ts` (`assembleHeader(state)` returning static branding), `view-model.ts` (`ReportViewModel` type + `assembleViewModel()`)
7. **`src/lib/export/` module set** — `pdf-doc.tsx` (react-pdf Document tree), `docx-builder.ts` (docx library builder)

**Key pattern — typed error union over untyped throws:**
```typescript
type CmsError =
  | { kind: 'InvalidCcn'; message: string }
  | { kind: 'NotFound'; ccn: string }
  | { kind: 'NetworkError'; message: string }
  | { kind: 'ValidationError'; issues: z.ZodIssue[] }
  | { kind: 'CmsApiError'; status: number; body: string }
```
Each error kind maps to a distinct HTTP status and distinct UI message — no generic "something went wrong."

### Critical Pitfalls

1. **CCN coerced to a number (leading zeros silently dropped)** — Use `<input type="text" inputMode="numeric">` never `type="number"`; store CCN as `string` end-to-end; Zod schema field must be `z.string()`; test explicitly with a leading-zero CCN. Any `parseInt()` or `Number(ccn)` call in the data layer is a bug.

2. **`@react-pdf/renderer` bundled by the App Router (build crash or runtime TypeError)** — All react-pdf imports must live in server-only files (Route Handlers or lib files never imported by client components). Client-side `PDFDownloadLink` / `PDFViewer` require `next/dynamic` with `{ ssr: false }` inside `"use client"` components. See reconciled open question #2 below for explicit config guidance.

3. **CMS called client-side (CORS block)** — `fetch("https://data.cms.gov/...")` from the browser is blocked. All CMS calls must live in Route Handlers. Never import the CMS client into a `"use client"` file.

4. **Zod schema too strict — rejects valid CMS rows with suppressed fields** — CMS suppresses star ratings for newly certified and small-sample facilities. All rating and metric fields must be `.nullable().optional()`. Only CCN and provider name should be required. Use `safeParse()` everywhere; never `parse()`.

5. **Font registration broken on Vercel** — `Font.register({ src: '/public/fonts/...' })` resolves locally but not in Vercel serverless. Use absolute `https://` CDN URLs (e.g., Google Fonts) for any custom fonts. If no custom fonts are needed, use the built-in Helvetica fallback.

6. **Web charting libraries inside react-pdf Document tree render as blank** — recharts, Chart.js, and any DOM/canvas-based chart cannot render in react-pdf's custom reconciler. For star ratings (1-5): use react-pdf native SVG primitives (`<Svg>`, `<Path>`). For bar charts of claims metrics in the PDF: use `react-pdf-charts` adapter with recharts v2 and `isAnimationActive={false}`. Plan the PDF chart approach before writing any chart code.

---

## Reconciled Open Questions

These points were in tension across research files. Both sides are documented below; the recommended resolution is stated but must be verified during Phase 1.

### 1. CCN filter field name: `cms_certification_number_ccn` vs `federal_provider_number` / `provnum`

**STACK.md position:** `cms_certification_number_ccn` — verified via live query against CCN 686123 on the `4pq5-n9py` dataset.

**ARCHITECTURE.md position:** used `federal_provider_number` in its code sketches (e.g., `?conditions[0][property]=federal_provider_number`), apparently from memory or an older data dictionary version.

**PITFALLS.md position:** `cms_certification_number_ccn` — consistent with STACK.md.

**Consensus:** `cms_certification_number_ccn` is the verified field name for dataset `4pq5-n9py`. The ARCHITECTURE.md sketches that reference `federal_provider_number` are illustrative and must not be copied verbatim into code.

**Resolution required in Phase 1:** Run `npm run fixture:capture` to generate `tests/fixtures/provider-686123.json`. The field name that appears as the CCN key in that fixture is ground truth per CLAUDE.md rule #3. All schema and mapper code must be written after the fixture exists.

### 2. `serverExternalPackages: ['@react-pdf/renderer']` — required or not?

**STACK.md position:** Not required. Next.js 16 auto-opts `@react-pdf/renderer` out of bundling (verified in bundled docs at `node_modules/next/dist/docs/.../serverExternalPackages.md`).

**PITFALLS.md position:** Required. Explicitly recommends adding it to `next.config.ts`. Also flags Next.js GitHub issue #88844 — Turbopack standalone build omits packages listed in `serverExternalPackages` from `.next/standalone/node_modules`, causing runtime `Cannot find module` on Vercel.

**Recommendation: Add it explicitly.** The STACK.md finding that it is "on the auto-list" means the package should work without the config entry in most cases, but the PITFALLS.md argument addresses a real confirmed Turbopack bug. Explicit is safer than implicit for a production-path dependency. The downside of adding the entry when it is already on the auto-list is zero — it is a no-op redundancy. The downside of omitting it and hitting bug #88844 is a broken Vercel deploy.

**Action (Phase 2):** Add `serverExternalPackages: ['@react-pdf/renderer']` to `next.config.ts` immediately after installing the package. Verify with `npm run verify:full` (which runs `next build`). If the standalone build omits the package, apply the `--webpack` flag as a temporary workaround while tracking the upstream issue.

### 3. "12 hospitalization/ED metrics" interpretation

**FEATURES.md position (authoritative):** 4 distinct CMS claims measures (codes 521, 522, 551, 552) x 3 numeric scores per measure (`adjusted_score`, `observed_score`, `expected_score`) = 12 numeric data points. Dataset is `ijh5-nb2v` (NH Claims-Based Quality Measures). Confirmed with live API data for CCN 686123.

**STACK.md position:** `djen-97ju` (MDS Quality Measures) was the initial candidate but has 17 MDS measures, not the 4 claims measures. `ijh5-nb2v` is the correct dataset.

**Working interpretation:** "12 hospitalization/ED metrics" = `ijh5-nb2v` dataset, 4 measure codes, 3 scores each. This is HIGH confidence from live API verification.

**Confirm during Phase 5:** Cross-reference measure codes 521, 522, 551, 552 against the `NH_Data_Dictionary` (Table 11 or 12) to verify descriptions match the CLAUDE.md "Short-Stay Hospitalization", "Short-Stay ED Visit", "Long-Stay Hospitalization", "Long-Stay ED Visit" labels.

### 4. CCN validation regex: `/^\d{6}$/` vs alphanumeric

**FEATURES.md position:** CCNs are `/^\d{6}$/` for all currently issued nursing home CCNs. The 6-character structure (2-digit SSA state code + 4-digit sequence) has historically been all-numeric.

**PITFALLS.md position:** CMS Survey & Cert Letter 16-09 notes that SSA state codes have extended into alphanumeric characters as 2-digit numeric codes were exhausted. A pure `/^\d{6}$/` regex will reject valid newer CCNs with letter characters.

**Recommendation:** Treat CCN as a string always. For client-side pre-validation, use `/^[0-9A-Za-z]{6}$/` (accept alphanumeric, exactly 6 characters) rather than `/^\d{6}$/`. This is more permissive but avoids rejecting valid CCNs. The API is the ground truth for "found vs not found" — a syntactically valid CCN that returns 0 results from `4pq5-n9py` should show "No facility found for CCN {ccn}" (not "invalid CCN format"). The error type distinction matters for user messaging.

Never use `<input type="number">` for CCN. Use `<input type="text" inputMode="numeric">` which keeps the numeric keyboard on mobile while preserving leading zeros and accepting string values.

---

## Implications for Roadmap

The build order is tightly constrained by data dependencies. Nothing can be built correctly until the fixture exists and field names are verified. The CMS data layer is the foundation for everything else.

### Phase 1: Foundation + CMS Data Layer

**Rationale:** CLAUDE.md rule #3 prohibits using any CMS field name from memory. Every subsequent phase depends on verified field names from the fixture and data dictionary. The fixture must exist before any schema, mapper, or route handler is written. Additionally, the package installs must happen in this phase so type errors surface immediately.

**Delivers:**
- `tests/fixtures/provider-686123.json` (captured via `npm run fixture:capture`)
- All production dependencies installed and type-checked
- `src/lib/cms/errors.ts` — typed `CmsError` union
- `src/lib/cms/schema.ts` — Zod schemas (field names from fixture, all ratings `.nullable().optional()`)
- `src/lib/cms/mapper.ts` — CMS raw row to `FacilityData` domain model
- `src/lib/cms/client.ts` — `fetchByCCN(ccn: string)` (string type enforced)
- Unit tests: schema (valid, suppressed-fields, invalid), mapper (field mapping against fixture)
- `npm run verify` green

**Must address:**
- Pitfall 1 (CCN as number) — enforce `string` in schema and function signatures from day one
- Pitfall 2 (distribution ID) — hardcode dataset ID `4pq5-n9py` as a named constant
- Pitfall 7 (Zod too strict) — all rating and metric fields `.nullable().optional()`
- Open question #1 (CCN field name) — resolved from fixture before writing schema
- Next.js 16 async params — `await ctx.params` pattern used from the start

**Research flag:** None needed — standard patterns.

### Phase 2: API Routes + View Model

**Rationale:** The CMS data layer (Phase 1) is a prerequisite. Once the data layer exists and tests pass, the Route Handlers and view-model can be wired. This phase produces the complete server-side API surface — after it is done, the UI can be built against real endpoints.

**Delivers:**
- `src/app/api/facility/route.ts` — GET handler; CCN to FacilityData JSON; handles all CmsError kinds
- `src/lib/report/header.ts` — `assembleHeader(state: string): HeaderData` (no facility name parameter)
- `src/lib/report/view-model.ts` — `ReportViewModel` type + `assembleViewModel()`
- `next.config.ts` update: `serverExternalPackages: ['@react-pdf/renderer']`
- Unit tests: route handler (valid CCN, 400, 404, 502, Zod failure), `assembleHeader` (state uppercase, no facility name in output), `assembleViewModel`
- `npm run verify:full` green (includes `next build`)

**Must address:**
- Pitfall 3 (CMS called client-side) — Route Handler pattern established here
- Open question #2 (`serverExternalPackages`) — add explicitly, verify build passes
- Pitfall 13 (header branding) — `assembleHeader` signature enforces no facility-name arg at compile time

**Research flag:** None needed — standard Next.js 16 patterns.

### Phase 3: Web UI

**Rationale:** With the API surface established, the web UI can be built with real data flowing through real endpoints. This phase produces the interactive single-page experience.

**Delivers:**
- `SnapshotApp.tsx` — top-level orchestrator (state management, view-model assembly)
- `CCNSearchBar.tsx` — CCN input with client-side format validation + API call
- `ManualInputsForm.tsx` — all 6 manual fields with correct input types
- `ReportPreview.tsx` — HTML report preview (header block, facility block, manual block)
- `ErrorBanner.tsx` — typed error display (each `CmsError` kind to distinct user message)
- `StarRatingCard.tsx` — star glyphs with color-coded bands
- Loading skeleton (Tailwind `animate-pulse`) during CMS fetch
- Component tests for CCN validation edge cases, error states, name override behavior
- `npm run verify` green

**Must address:**
- CCN leading-zero auto-pad or clear error (5-digit input)
- Manual name override reset when new CCN succeeds
- All error states: `InvalidCcn`, `NotFound`, `NetworkError`, `CmsApiError`, `ValidationError`

**Research flag:** None needed — standard React patterns.

### Phase 4: PDF Export

**Rationale:** The web UI (Phase 3) finalizes the `ReportViewModel` shape. PDF generation consumes the view-model via a Route Handler POST. This is the highest-risk individual phase due to react-pdf compatibility concerns — it must be isolated and verified with a full build after every significant addition.

**Delivers:**
- `src/lib/export/pdf-doc.tsx` — `<ReportPDF vm={vm} />` using react-pdf primitives
- `src/app/api/export/pdf/route.ts` — POST handler; `renderToBuffer` to `application/pdf` response
- `ExportControls.tsx` (partial) — "Download PDF" button, POST to `/api/export/pdf`, blob download
- Star rating display in PDF using react-pdf SVG primitives (`<Svg><Path /></Svg>`) — not recharts
- Clickable `<Link>` to `https://www.medicare.gov/care-compare/details/nursing-home/{CCN}` in PDF
- Route handler tests: buffer returned, correct headers, `Content-Disposition`, `<Link>` URL
- `npm run verify:full` green after every change in this phase

**Must address:**
- Pitfall 4 (react-pdf bundling) — `serverExternalPackages` in place from Phase 2; verify `renderToBuffer` works
- Pitfall 5 (font on Vercel) — use CDN URLs for any custom fonts; test on deployed Vercel URL
- Pitfall 6 (charts in react-pdf) — star ratings use SVG primitives, not recharts
- Pitfall 13 (header branding) — `assembleHeader("FL")` unit test asserts no facility name in output

**Research flag:** Run `npm run verify:full` after installing react-pdf and after each major PDF component addition. Verify the actual PDF file (not just web preview) at every checkpoint.

### Phase 5: Claims Metrics Bonus

**Rationale:** The core data pipeline and PDF export are complete. Claims metrics are a second CMS API call that uses the same patterns already established. This phase adds the "12 data points" differentiator.

**Delivers:**
- `src/lib/cms/claims-schema.ts` — Zod schema for `ijh5-nb2v` dataset
- `src/lib/cms/claims-mapper.ts` — 4 measures x 3 scores to `HospMetrics`
- `/api/facility` route updated to fetch claims measures in parallel with provider info
- `MetricsTable.tsx` — web UI table: 4 measures, 3 scores + national average as 4th column
- Suppressed measure display: `footnote_for_score: "9"` to "Not reported (small sample)"
- Claims measures section in `<ReportPDF />` (react-pdf native table layout)
- Tests: claims schema (valid, suppressed, fewer than 4 measures returned)

**Must address:**
- Open question #3 (12 metrics interpretation) — confirm measure codes 521/522/551/552 against NH_Data_Dictionary before writing schema
- Dataset `ijh5-nb2v` (not `djen-97ju`) for claims measures
- National average from `xcdc-v8bm` — note truncated column name pattern (hash suffix on long column names)

**Research flag:** Minor — verify measure code descriptions against NH_Data_Dictionary Table 11 or 12 before writing the mapper.

### Phase 6: .docx Export Bonus

**Rationale:** Parallel to PDF export in structure. The `docx` library's Node.js API mirrors the route handler pattern already established. Lower risk than PDF.

**Delivers:**
- `src/lib/export/docx-builder.ts` — `buildDocx(vm: ReportViewModel) -> docx.Document`
- `src/app/api/export/docx/route.ts` — POST handler; `Packer.toBuffer()` to `.docx` binary
- "Download DOCX" button in `ExportControls.tsx`
- Route handler test: buffer under 4 MB, correct `Content-Type`, correct `Content-Disposition`

**Must address:**
- Pitfall 12 (4.5 MB Vercel limit) — keep docx text-only or minimal assets; assert `Buffer.byteLength(buf) < 4_500_000` in route handler test

**Research flag:** None needed — standard patterns.

### Phase 7: Visual Polish + Live Preview Bonus

**Rationale:** All data flows and exports are complete. This phase adds the live preview and visual polish that creates the "wow" moment for reviewers.

**Delivers:**
- Live preview: `usePDF` hook from `@react-pdf/renderer` + 300ms debounce + "Generating..." state
- Charts for claims metrics in web UI (recharts v2 `BarChart`)
- Claims metric charts in PDF (`react-pdf-charts` adapter with `isAnimationActive={false}`)
- Final Vercel deployment verification (font rendering, PDF download, DOCX download, CORS check in browser DevTools)

**Must address:**
- Pitfall 6 (charts in react-pdf) — `react-pdf-charts` wrapper, `isAnimationActive={false}` on all chart components; open downloaded PDF to verify (not just web preview)
- Live preview must use `dynamic(() => import(...), { ssr: false })` for any react-pdf components rendered in the browser
- Deployed Vercel URL smoke test against the "Looks Done But Isn't" checklist from PITFALLS.md

**Research flag:** `react-pdf-charts` integration — verify chart rendering in the actual PDF (not web preview) before declaring done.

### Phase Ordering Rationale

- **Fixture first** — violating CLAUDE.md rule #3 (using field names from memory) is the easiest way to write code that is confidently wrong. The fixture is the anchor for all field name decisions.
- **CMS layer before UI** — the UI components consume a typed domain model. Building the type system first means every consumer is type-safe from the start.
- **Route handlers before client components** — client components can be built against the real API surface rather than mocks, reducing integration bugs.
- **PDF before bonus features** — PDF export is the primary deliverable. Getting it green before adding claims metrics and .docx means the core deliverable is always working.
- **Bonus phases ordered by dependency** — Claims metrics (Phase 5) adds data that the PDF (Phase 4) can display. .docx (Phase 6) parallels the established PDF route handler pattern. Live preview (Phase 7) requires the PDF Document component already built in Phase 4.

### Research Flags Summary

| Phase | Research Flag | Reason |
|-------|--------------|--------|
| Phase 1 | None needed | Fixture capture and Zod schemas follow standard patterns |
| Phase 2 | None needed | Route handler + view-model follow established Next.js 16 patterns |
| Phase 3 | None needed | Standard React state management and form patterns |
| Phase 4 | Build-verify loop | react-pdf compatibility with Next.js 16.2.x — verify each addition with `npm run verify:full` |
| Phase 5 | Minor (claims dataset) | Confirm measure codes 521/522/551/552 against NH_Data_Dictionary before writing schema |
| Phase 6 | None needed | `docx` library patterns are straightforward |
| Phase 7 | Chart verification | Verify `react-pdf-charts` integration by opening the actual PDF, not just the web preview |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All library versions verified via npm; React 19 peer deps confirmed; recharts v3 incompatibility documented in react-pdf-charts README |
| Features | HIGH | CMS field names and dataset IDs verified via live API queries against CCN 686123 on 2026-06-15; NH_Data_Dictionary consulted for footnote codes |
| Architecture | HIGH | Patterns verified against Next.js 16 bundled docs; Route Handler + BFF pattern confirmed as recommended approach for external API proxy |
| Pitfalls | HIGH | react-pdf pitfalls traced to specific GitHub issues with resolution status; Next.js 16 async params change confirmed in upgrade guide; Turbopack bug #88844 is a confirmed open issue |

**Overall confidence:** HIGH

### Gaps to Address

The following items are unresolved and must be handled during Phase 1 before writing any feature code:

1. **Exact CCN field name in `4pq5-n9py`** — STACK.md says `cms_certification_number_ccn` (verified via live query); ARCHITECTURE.md code sketches say `federal_provider_number`. The fixture from `npm run fixture:capture` is the tiebreaker per CLAUDE.md rule #3. Write all schema and mapper code after the fixture exists.

2. **`serverExternalPackages` explicit vs implicit** — STACK.md says the package is on the auto-list (no config needed); PITFALLS.md says add it explicitly due to Turbopack bug #88844. Decision: add it explicitly, verify with `npm run verify:full`. Gap closes during Phase 2.

3. **Claims measure code descriptions vs NH_Data_Dictionary** — FEATURES.md confirmed 4 codes (521, 522, 551, 552) from live data but cross-reference against Table 11/12 of the data dictionary to verify descriptions match the CLAUDE.md "STR/Short-Stay, LT/Long-Stay" labels. Gap closes during Phase 5.

4. **Live Vercel font rendering** — Font behavior in Vercel serverless functions cannot be verified until there is a deployed URL. Design the PDF using built-in PDF fonts (Helvetica) to avoid the risk entirely. If custom fonts are desired, use CDN URLs only. Gap closes at the end of Phase 4 when the first Vercel deploy is tested.

5. **`fixture:capture` script wiring** — The fixture script is noted as "already present" in PROJECT.md but `tests/fixtures/` is empty. Verify the script actually runs and produces valid JSON as the first action of Phase 1.

---

## Sources

### Primary (HIGH confidence — verified via live query or official docs)

- CMS Provider Data Catalog API, dataset `4pq5-n9py` — live query against CCN 686123 on 2026-06-15; field names and response shape confirmed
- CMS Provider Data Catalog API, dataset `ijh5-nb2v` — live query on 2026-06-15; 4 measure codes confirmed
- CMS Provider Data Catalog API, dataset `xcdc-v8bm` — national averages confirmed
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.md` — Next.js 16 auto-opt-out list
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — Route Handler API, async params pattern
- `node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md` — BFF pattern recommendation
- npm registry: `@react-pdf/renderer@4.5.1`, `zod@4.4.3`, `docx@9.7.1`, `recharts@2.15.4`, `react-pdf-charts@1.0.0` — peer deps and dist-tags verified
- react-pdf-charts README — recharts v3 incompatibility, `isAnimationActive` requirement

### Secondary (MEDIUM confidence — community sources, multiple consistent)

- react-pdf.org/compatibility — React 19 support since v4.1.0
- react-pdf GitHub issues #2350, #2460, #3074, #2816 — App Router compatibility history; `renderToBuffer` in route handler pattern
- ResDAC — CCN format documentation
- CMS Survey & Cert Letter 16-09 — alphanumeric CCN extension

### Tertiary (noted, not relied upon for decisions)

- makerkit.dev — Route Handler vs Server Action preference (consistent with official docs, used for confirmation only)

---
*Research completed: 2026-06-15*
*Ready for roadmap: yes*
