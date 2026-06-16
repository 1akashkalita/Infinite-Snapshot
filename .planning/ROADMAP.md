# Roadmap: Infinite Snapshot

## Overview

Seven phases turn a barebones Next.js scaffold into a deployed, polished nursing-home snapshot generator. The fixture must exist before any CMS field name is written (CLAUDE.md rule #3), so Phase 1 anchors the entire build: capture the reference fixture, install all libraries, and build the validated CMS data layer. Phase 2 builds the server API surface and shared view-model. Phase 3 delivers the first end-to-end vertical slice — CCN search to live preview, with deployment to Vercel. Phases 4–7 layer PDF export, claims metrics, .docx export, and visual polish on top of a continuously shippable base.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & CMS Data Layer** - Capture fixture, install packages, build Zod schema + typed CMS pipeline
- [ ] **Phase 2: API Routes, View Model & Config** - Server route handlers, shared view-model, static header, next.config
- [ ] **Phase 3: Web UI, Core Flow & Deployment** - CCN search, manual inputs, live preview, error states, first Vercel deploy
- [ ] **Phase 4: PDF Export** - react-pdf document, server-side PDF route, Download PDF button, Medicare link
- [ ] **Phase 5: Claims-Based Metrics** - 12 hospitalization/ED data points from CMS, suppressed-value handling, metrics in UI + PDF
- [ ] **Phase 6: .docx Export** - Word document builder, export route, Download DOCX button
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
  4. `CMSRowSchema.safeParse()` accepts the reference fixture row and rejects a malformed row; all star-rating fields are `.nullable().optional()` so a suppressed-data facility does not throw
  5. `npm run verify` is green (typecheck, lint, format, tests all pass)
**Plans**: TBD

### Phase 2: API Routes, View Model & Config
**Goal**: The server API surface is complete — a GET `/api/facility` route validates and proxies CMS data, a POST `/api/export/pdf` stub is in place, the shared `ReportViewModel` type and `assembleHeader()` function exist, and `npm run verify:full` is green including the production build.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-03, DATA-04, DATA-05, NAME-01, NAME-02, RPT-01, RPT-02
**Success Criteria** (what must be TRUE):
  1. `GET /api/facility?ccn=686123` returns 200 with a fully typed `FacilityData` JSON body containing name, address, certified beds, and all four star ratings
  2. `GET /api/facility?ccn=000000` returns 404 with a distinct error payload, and `GET /api/facility?ccn=12` returns 400 (invalid format) — each error kind is distinct
  3. `assembleHeader("FL")` returns the exact static branding strings and does not accept a facility-name argument (TypeScript enforces this at compile time)
  4. `assembleViewModel(facilityData, manualInputs)` produces a `ReportViewModel` where `displayName` respects the manual override, and `careCompareUrl` contains the correct CCN
  5. `npm run verify:full` (typecheck + lint + format + tests + `next build`) is green
**Plans**: TBD
**UI hint**: no

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
**Plans**: TBD
**UI hint**: yes

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
**Plans**: TBD
**UI hint**: yes

### Phase 5: Claims-Based Metrics
**Goal**: The report displays all 12 CMS claims-based hospitalization/ED data points (4 measures x 3 scores) from dataset `ijh5-nb2v`, with suppressed or "too few to report" values rendering cleanly rather than as blanks or errors, in both the web preview and the PDF.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: CLM-01, CLM-02
**Success Criteria** (what must be TRUE):
  1. The web preview shows a metrics table with 4 hospitalization/ED measures (Short-Stay Hospitalization, Short-Stay ED Visit, Long-Stay Hospitalization, Long-Stay ED Visit), each with adjusted, observed, and expected scores — 12 data points total for CCN 686123
  2. A facility with suppressed claims data (footnote code "9" or empty measure score) renders "Not reported (small sample)" in the metrics table — not a blank cell or an unhandled null
  3. The PDF export includes the claims metrics section with matching values to the web preview
  4. The claims schema tests cover: valid 4-measure response, suppressed single measure, and fewer-than-4-measures response (no throws — graceful partial data)
**Plans**: TBD
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
**Plans**: TBD
**UI hint**: yes

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
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & CMS Data Layer | 0/TBD | Not started | - |
| 2. API Routes, View Model & Config | 0/TBD | Not started | - |
| 3. Web UI, Core Flow & Deployment | 0/TBD | Not started | - |
| 4. PDF Export | 0/TBD | Not started | - |
| 5. Claims-Based Metrics | 0/TBD | Not started | - |
| 6. .docx Export | 0/TBD | Not started | - |
| 7. Visualizations & Polish | 0/TBD | Not started | - |
