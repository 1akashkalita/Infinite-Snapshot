# Roadmap: Infinite Snapshot

## Overview

Seven phases turn a barebones Next.js scaffold into a deployed, polished nursing-home snapshot generator. The fixture must exist before any CMS field name is written (CLAUDE.md rule #3), so Phase 1 anchors the entire build: capture the reference fixture, install all libraries, and build the validated CMS data layer. Phase 2 builds the server API surface and shared view-model. Phase 3 delivers the first end-to-end vertical slice — CCN search to live preview, with deployment to Vercel. Phases 4–7 layer PDF export, claims metrics, .docx export, and visual polish on top of a continuously shippable base.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & CMS Data Layer** - Capture fixture, install packages, build Zod schema + typed CMS pipeline (completed 2026-06-17)
- [ ] **Phase 2: API Routes, View Model & Config** - Server route handlers, shared view-model, static header, next.config
- [x] **Phase 3: Web UI, Core Flow & Deployment** - CCN search, manual inputs, live preview, error states, first Vercel deploy (completed 2026-06-18)
- [x] **Phase 4: PDF Export** - react-pdf document, server-side PDF route, Download PDF button, Medicare link (completed 2026-06-18)
- [x] **Phase 5: Claims-Based Metrics** - 12 hospitalization/ED data points from CMS, suppressed-value handling, metrics in UI + PDF (completed 2026-06-19)
- [x] **Phase 6: .docx Export** - Word document builder, export route, Download DOCX button (completed 2026-06-20)
- [ ] **Phase 7: Visualizations & Polish** - Star rating cards, recharts/react-pdf-charts, live preview debounce, Vercel smoke test

## Phase Details

### Phase 1: Foundation & CMS Data Layer

**Goal**: A verified, type-safe CMS data pipeline exists, with field names anchored to the captured fixture, all packages installed, and `npm run verify` green.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: DATA-02, DATA-06
**Success Criteria** (what must be TRUE):

  1. `tests/fixtures/provider-686123.json` exists and contains valid CMS JSON for CCN 686123 captured via `npm run fixture:capture`
  2. `npm install` of all five production libraries (`@react-pdf/renderer`, `zod`, `docx`, `recharts`, `react-pdf-charts`) completes without peer-dep errors and `tsc --noEmit` is clean
  3. Every CMS field used in the schema traces to the fixture or NH_Data_Dictionary — no field name from memory
  4. `CMSRowSchema.safeParse()` accepts the reference fixture row and rejects a malformed row; all star-rating fields are `.nullable().optional()` so a suppressed-data facility does not throw (refined by CONTEXT D-06 to required-key + `.nullable()`-value — `.optional()` intentionally dropped so a renamed/removed key fails loudly; same intent, stricter enforcement)
  5. `npm run verify` is green (typecheck, lint, format, tests all pass)

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Install the five production libraries (pinned; recharts v2) behind a package-legitimacy checkpoint
- [x] 01-02-PLAN.md — Implement npm run fixture:capture (dataset registry) and capture provider/claims/averages fixtures for CCN 686123

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-03-PLAN.md — Build provider CMSRowSchema + parse module + the DATA-02/DATA-06 test suite (empty→null, real 0, missing-key fail, leading-zero strings)

### Phase 2: API Routes, View Model & Config

**Goal**: The server API surface is complete — a GET `/api/facility` route validates and proxies CMS data, a POST `/api/export/pdf` stub is in place, the shared `ReportViewModel` type and `assembleHeader()` function exist, and `npm run verify:full` is green including the production build.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-03, DATA-04, DATA-05, NAME-01, NAME-02, RPT-01, RPT-02
**Notes**:

  - Location is **composed** from `provider_address` + `citytown` + `state` (e.g. `5280 SW 157th Ave, Miami, FL`), **no ZIP** — do not reuse the combined `location` field.
  - Quality star rating maps to the **`qm_rating`** column (not `longstay_qm_rating`/`shortstay_qm_rating`); Overall/Health Inspection/Staffing → `overall_rating`/`health_inspection_rating`/`staffing_rating`.
  - **Deliberate, fixture-verified deviation (D-15):** `providerName ← provider_name` (the operating name, no `LLC`), NOT `legal_business_name` — the reference-output match rule wins over NAME-01's "legal name" prose. Do not "correct" this.

**Success Criteria** (what must be TRUE):

  1. `GET /api/facility?ccn=686123` returns 200 with a fully typed `FacilityData` JSON body containing name, composed address (no ZIP), certified beds, and all four star ratings (with Quality from `qm_rating`)
  2. `GET /api/facility?ccn=000000` returns 404 with a distinct error payload, and `GET /api/facility?ccn=12` returns 400 (invalid format) — each error kind is distinct
  3. `assembleHeader("FL")` returns the exact static branding strings and does not accept a facility-name argument (TypeScript enforces this at compile time)
  4. `assembleViewModel(facilityData, manualInputs)` produces a `ReportViewModel` where `displayName` respects the manual override, and `careCompareUrl` contains the correct CCN
  5. `npm run verify:full` (typecheck + lint + format + tests + `next build`) is green

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Contract foundation: centralized CMS constants (`4pq5-n9py`), the camelCase `FacilityData` type, and the 5-kind error union + `CmsError`/`assertNever`

**Wave 2** *(parallel; depend on 02-01, zero file overlap)*

- [x] 02-02-PLAN.md — Slice: CCN → validated `FacilityData` JSON over HTTP — mapper + `fetchFacility` pipeline (8s timeout) + `GET /api/facility` with the 5-kind taxonomy and the D-05 leak invariant
- [x] 02-03-PLAN.md — Slice: `FacilityData` → shared `ReportViewModel` — static `assembleHeader` + null-safe formatter family + `assembleViewModel` + `POST /api/export/pdf` stub + `next.config` serverExternalPackages (phase gate `verify:full`)

### Phase 3: Web UI, Core Flow & Deployment

**Goal**: A user can visit the live Vercel URL, enter CCN 686123, see a populated report preview with all CMS fields and manual inputs, and interact with every error state — all with `npm run verify` green and the repo public.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: LOOK-01, LOOK-02, LOOK-03, INPT-01, INPT-02, INPT-03, PREV-01, ERR-01, ERR-02, DEP-01, DEP-02
**Success Criteria** (what must be TRUE):

  1. User can enter CCN 686123, submit the form, and see the report preview update with facility name, address, certified beds, and star ratings pulled live from CMS — no manual refresh needed
  2. User sees a distinct inline error for malformed CCN (e.g., "12"), a different message for a valid-format CCN with no CMS match, and a third message for network failure — error types never bleed into each other
  3. User can fill all six manual input fields (EMR, Current Census, Type of Patient, Medical Coverage, Previous Provider Performance, Previous Coverage from Medelite Yes/No) and see them reflected in the report preview instantly
  4. User can override the facility name in a text field and see only the report body update — the static header block is unaffected
  5. The app is live at a public Vercel URL and the code is in a public GitHub repository; every error path has a corresponding test

**Plans**: 4 plans
Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Foundation: extend `ManualInputs`/`ReportViewModelSchema` with `previousProviderPerformance` (INPT-01) + the pure `src/lib/ui/` CCN pre-check and exhaustive error-kind mapping modules + their tests (LOOK-02/03, ERR-01/02)

**Wave 2** *(skeleton-first early deploy; depends on 03-01)*

- [x] 03-02-PLAN.md — Minimal deployable page + first Vercel deploy: thin `page.tsx` server shell + `SnapshotApp` two-pane skeleton + layout metadata, then push + Vercel connect (Root Dir = `medelite-report`) and verify live 200 / public repo (DEP-01/02) — LIVE: https://infinite-snapshot.vercel.app

**Wave 3** *(core flow; depends on 03-02 — shared SnapshotApp/ReportPreview files)*

- [x] 03-03-PLAN.md — Core slice: `CCNSearchBar` + `ErrorBanner` + `ReportPreview` + the SnapshotApp fetch seam → CCN 686123 populates the preview; distinct inline/banner error states; body-layout reference confirm (LOOK-01/02/03, ERR-01/02)

**Wave 4** *(manual inputs; depends on 03-03 — shared SnapshotApp/ReportPreview files)*

- [x] 03-04-PLAN.md — Final slice: `ManualInputsForm` (six fields + name override, D-12 types) wired to the live preview; body renders bound manual values + override-aware displayName (INPT-01/02/03, PREV-01, NAME-02)

### Phase 4: PDF Export

**Goal**: A user can click "Download PDF" and receive a clean, print-ready PDF generated server-side with `@react-pdf/renderer`, containing the static branding header, all report data, and a clickable Medicare link — verified in an actual PDF viewer, not just the web preview.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: PDF-01, PDF-02, PDF-03
**Success Criteria** (what must be TRUE):

  1. Clicking "Download PDF" triggers a direct browser download of a `.pdf` file — no pop-up, no redirect, no error
  2. The downloaded PDF contains the exact static header (`INFINITE — Managed by MEDELITE` / `FACILITY ASSESSMENT SNAPSHOT` / state abbreviation) and the facility name appears only in the report body under "Name of Facility"
  3. The PDF includes a clickable hyperlink to `https://www.medicare.gov/care-compare/details/nursing-home/686123` (using the searched CCN) that opens in a browser when clicked in the PDF viewer
  4. PDF content matches the live web preview for the same inputs (same name, same data, same manual fields)
  5. `npm run verify:full` is green; the PDF route handler test asserts: buffer returned, correct `Content-Type`, correct `Content-Disposition`, and the Medicare URL appears in the buffer

**Plans**: 2 plans
Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Server render core: pure `slugFilename` helper (+ Wave 0 slug.test.ts), `ReportPDF` react-pdf document mirroring ReportPreview 1:1 with the clickable Medicare link, and the route swap from the 501 stub to real `renderToBuffer` (+ extended export-pdf.test.ts) — delivers PDF-02/PDF-03 and the server half of PDF-01

**Wave 2** *(depends on 04-01 — consumes the live PDF route)*

- [x] 04-02-PLAN.md — Client download UX slice: `DownloadPdfButton` (fetch POST → Blob → silent anchor download, D-07 disabled/"Generating…" states, D-08 inline retry error) wired into the SnapshotApp left pane — closes PDF-01 end-to-end

### Phase 5: Claims-Based Metrics

**Goal**: The report displays all 12 CMS claims-based hospitalization/ED data points — the 4 measures, each with **facility value + national avg + state avg** — drawn from **three** datasets (Provider Info `4pq5-n9py` already wired in P2; facility values from Medicare Claims Quality Measures `ijh5-nb2v`; national/state averages from State US Averages `xcdc-v8bm`), with suppressed values rendering cleanly, matching the reference report's labels/order, in both the web preview and the PDF.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: CLM-01, CLM-02, CLM-03
**Notes**:

  - Resolve/confirm `ijh5-nb2v` and `xcdc-v8bm` via the CMS metastore before writing schemas (don't assume from memory — rule #3). The claims provider file has **no average columns**; averages live only in `xcdc-v8bm` (keyed `state_or_nation` = `NATION`/`FL`; measure columns are hash-suffixed — match by description).
  - Display the **adjusted (risk-adjusted)** facility score; verify against the live 686123 profile.
  - The 12 = 4 measures × {facility, national, state} — NOT 4 × adjusted/observed/expected.

**Success Criteria** (what must be TRUE):

  1. The web preview shows the 4 hospitalization/ED measures (short-stay rehospitalization %, short-stay outpatient ED %, long-stay hospitalizations per 1,000 resident-days, long-stay ED visits per 1,000 resident-days), each with facility value + national avg + state avg — 12 data points total for CCN 686123
  2. The metrics section reproduces the reference report's **labels and order exactly** — including its slightly garbled text ("STR State National Avg. for Hospitalization", the bare "ED Visit" line); the displayed values come from the fixture/live API, not the reference PDF's illustrative numbers
  3. A facility with suppressed claims data (`footnote_for_score` set or empty-string score) renders "Not reported (small sample)" — not a blank cell or an unhandled null
  4. The PDF export includes the claims metrics section with values and layout matching the web preview
  5. Tests cover: facility values (`ijh5-nb2v`) joined with `NATION`/state-`FL` averages (`xcdc-v8bm`), a suppressed measure, and fewer-than-4-measures (graceful partial data, no throws)

**Plans**: 4 plans
Plans:
**Wave 1**

- [x] 05-01-PLAN.md — Data primitives: ClaimsRowSchema + AveragesRowSchema + 3 dataset constants + formatFootnote (with tests); blocking metastore ID re-confirm

**Wave 2** *(depends on 05-01)*

- [x] 05-02-PLAN.md — Join + fetch: HospMetric type + joinClaimsAndAverages mapper (12 verbatim rows, per-row suppression) + fetchClaimsMeasures/fetchAverages

**Wave 3** *(depends on 05-02)*

- [x] 05-03-PLAN.md — Server plumbing: real HospMetricSchema in ReportViewModelSchema + assembleViewModel param + GET /api/facility 3-dataset Promise.allSettled fan-out

**Wave 4** *(depends on 05-03)*

- [x] 05-04-PLAN.md — Render slice: SnapshotApp wiring + 12 rows in ReportPreview + ReportPDF (degraded line) + PDF test + verify:full gate

**UI hint**: yes

### Phase 6: .docx Export

**Goal**: A user can click "Download DOCX" and receive a Word document with content matching the live preview, generated server-side via the `docx` library, well under the 4.5 MB Vercel response limit.
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: DOCX-01
**Success Criteria** (what must be TRUE):

  1. Clicking "Download DOCX" triggers a direct browser download of a `.docx` file that opens cleanly in Microsoft Word or Google Docs
  2. The .docx content matches the web preview: static header block, facility data, all manual inputs, and the claims metrics section
  3. The route handler test asserts `Buffer.byteLength(docxBuffer) < 4_500_000` and correct `Content-Type` / `Content-Disposition` headers

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 06-01-PLAN.md — Server foundations: generalize `slugFilename` with an `ext` param (D-13) + build `ReportDocx.ts`, the server-only docx twin of `ReportPDF` (static logo header, 13+12 rows, Medicare link)

**Wave 2** *(depends on 06-01 — consumes buildReportDocx + the generalized slug)*

- [x] 06-02-PLAN.md — Route slice: Wave 0 `export-docx.test.ts` + `POST /api/export/docx` cloning the PDF contract (validate → `Packer.toBuffer` → OOXML headers; clean 400 envelope; PK-ZIP + 4.5 MB assertions)

**Wave 3** *(depends on 06-02 — consumes the live /api/export/docx route)*

- [x] 06-03-PLAN.md — Client slice: `ExportControls` (PDF|DOCX toggle, D-01..D-05) replaces `DownloadPdfButton` in `SnapshotApp`; closes DOCX-01 end-to-end; `verify:full` phase gate + human UAT (Tasks 1–2 complete; EMU/px fix applied + regression test; Task 3 awaiting human re-verification)

### Phase 7: Visualizations & Polish

**Goal**: Star ratings render as polished visual cards with color-coded star glyphs in the web UI, claims metrics render as charts in the web UI and inside the PDF (using react-pdf SVG primitives / react-pdf-charts), the live preview debounce is 300ms, and the deployed Vercel URL passes the full "Looks Done But Isn't" checklist from research.
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: VIZ-01, VIZ-02
**Success Criteria** (what must be TRUE):

  1. Star rating cards in the web UI display filled/outline star glyphs color-coded by band (green for 4-5 stars, amber for 3, red for 1-2) — not plain numbers
  2. The downloaded PDF shows the same star rating visuals using react-pdf SVG primitives (not recharts), and charts for claims metrics render as filled shapes — not blank rectangles
  3. Manual input changes update the web preview within 300ms (debounced) with no full re-fetch of CMS data
  4. The live Vercel URL passes all checklist items: leading-zero CCN preserved, static header correct in PDF, suppressed fields render as "N/A", font renders correctly, charts visible in opened PDF, all error states trigger clean messages, .docx under 4 MB

**Plans**: 3 plans
Plans:
**Wave 1**

- [ ] 07-01-PLAN.md — Star-ratings slice (web + PDF + docx) + D-15 grouping foundation: shared colors/star-band/chart-utils modules, HospMetric measureKey/source schema+type+mapper, StarRating + PdfStarRating + colored docx star runs (VIZ-01/VIZ-02 star half, D-01..D-06, D-15)

**Wave 2** *(depends on 07-01 — consumes measureKey/source + groupByMeasure + CHART_SERIES; shared ReportPreview/ReportPDF/ReportDocx files)*

- [ ] 07-02-PLAN.md — Claims-charts slice (web recharts + PDF react-pdf-charts + docx PNGs): `@resvg/resvg-js` install behind a legitimacy checkpoint + serverExternalPackages, MiniBarChart + PdfMiniBarChart + chart-svg/rasterize lib, 4 charts added below the 12 verbatim rows (VIZ-01/VIZ-02 chart half, D-07..D-09, D-11, DOCX-01 size guard with images)

**Wave 3** *(depends on 07-01 + 07-02 — smoke-tests the stars + charts; shared SnapshotApp file)*

- [ ] 07-03-PLAN.md — Debounce + live-Vercel polish slice: `useDebounce` 300ms hook + SnapshotApp wiring (no CMS re-fetch), then the full "Looks Done But Isn't" SC#4 checklist on the live URL + `verify:full` phase gate (D-14, SC#3, SC#4)

**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & CMS Data Layer | 3/3 | Complete   | 2026-06-17 |
| 2. API Routes, View Model & Config | 3/3 | Complete   | 2026-06-17 |
| 3. Web UI, Core Flow & Deployment | 4/4 | Complete   | 2026-06-18 |
| 4. PDF Export | 2/2 | Complete   | 2026-06-18 |
| 5. Claims-Based Metrics | 4/4 | Complete   | 2026-06-19 |
| 6. .docx Export | 3/3 | Complete   | 2026-06-20 |
| 7. Visualizations & Polish | 0/3 | Not started | - |
