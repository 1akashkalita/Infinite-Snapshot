# Requirements: Infinite Snapshot

**Defined:** 2026-06-15
**Core Value:** Enter a CCN → instantly get an accurate, polished, downloadable facility snapshot.

All v1 requirements below are committed scope for this milestone (required take-home features **plus** the bonuses the user committed to in order to land above expectations). They are hypotheses until shipped and validated.

## v1 Requirements

### CCN Lookup

- [ ] **LOOK-01**: User can enter a CCN in an input box and submit it to fetch that facility's data
- [ ] **LOOK-02**: App validates CCN format (6-character, treated as a string with leading zeros preserved) and shows a clear inline error for malformed input before any fetch
- [ ] **LOOK-03**: App distinguishes "invalid format" from "facility not found" (valid format but zero CMS results) with distinct, user-friendly messaging

### CMS Data Engine

- [ ] **DATA-01**: App fetches facility data from the CMS Provider Data Catalog API by CCN via a server-side route handler (no direct browser→CMS call; avoids CORS)
- [ ] **DATA-02**: Every CMS response is validated by a Zod schema before reaching the UI or any export; suppressed/blank ("too few to report") fields are handled gracefully, not as errors
- [ ] **DATA-03**: Report shows the facility's full address (location) from CMS
- [ ] **DATA-04**: Report shows the four star ratings — Overall, Health Inspection, Staffing, Quality Care — from CMS
- [ ] **DATA-05**: Report shows census capacity (Number of Certified Beds) from CMS
- [ ] **DATA-06**: Every CMS field used traces to the captured fixture (`provider-686123.json`) or the NH_Data_Dictionary — never a field name from memory

### Facility Identity

- [ ] **NAME-01**: Report defaults the facility name to the official CMS legal name
- [ ] **NAME-02**: User can enter an optional custom name that overrides the CMS name on the report body only (the static branding header is never affected)

### Manual Operational Inputs

- [ ] **INPT-01**: User can enter EMR, Current Census, Type of Patient, Medical Coverage, and Previous Provider Performance
- [ ] **INPT-02**: User can set "Previous Coverage from Medelite" via a Yes/No control
- [ ] **INPT-03**: Manual inputs appear in the report body alongside the CMS data

### Report Assembly & Branding

- [ ] **RPT-01**: Report header is the static `INFINITE — Managed by MEDELITE` / `FACILITY ASSESSMENT SNAPSHOT` / dynamic state abbreviation, never overwritten by the facility name
- [ ] **RPT-02**: A single shared report view-model drives the web preview, the PDF, and the .docx, so all three stay consistent

### Live Preview

- [ ] **PREV-01**: User sees an in-browser preview of the report that updates as they edit manual inputs, before downloading

### PDF Export

- [ ] **PDF-01**: User can click "Download PDF" to trigger a direct browser download of a clean, print-ready PDF built with `@react-pdf/renderer`
- [ ] **PDF-02**: The PDF includes a clickable hyperlink to `https://www.medicare.gov/care-compare/details/nursing-home/{CCN}` using the searched CCN
- [ ] **PDF-03**: The downloaded PDF content matches what the live preview showed

### DOCX Export (bonus)

- [ ] **DOCX-01**: User can download a `.docx` version of the report alongside the PDF, with matching content

### Claims-Based Metrics (bonus)

- [ ] **CLM-01**: Report displays the 12 claims-based hospitalization/ED metrics (short-stay and long-stay; 4 measures × adjusted/observed/expected) from CMS
- [ ] **CLM-02**: Suppressed or "too few to report" claims values render cleanly rather than as blanks or errors

### Visualizations (bonus)

- [ ] **VIZ-01**: Star ratings and key metrics render as polished visual cards/charts in the web UI
- [ ] **VIZ-02**: Visual elements render correctly inside the PDF using react-pdf SVG primitives / react-pdf-charts (never DOM-based charting)

### Error Handling (bonus, cross-cutting)

- [ ] **ERR-01**: Invalid CCN, facility-not-found, network/API failure, and missing/partial CMS fields each produce a distinct, clean user-facing state
- [ ] **ERR-02**: Every error path is covered by tests

### Deployment

- [ ] **DEP-01**: App is deployed to a live, working Vercel URL
- [ ] **DEP-02**: A public code repository is available alongside the live URL

## v2 Requirements

Acknowledged, deferred — stretch goals if time allows after v1 is solid.

### Benchmarks

- **BENCH-01**: Show state/national averages next to each claims metric (CMS dataset `xcdc-v8bm`) for context
- **BENCH-02**: Comparison charts (facility vs state/national) beyond single-facility cards

## Out of Scope

Explicitly excluded for this milestone, with reasoning.

| Feature | Reason |
|---------|--------|
| User accounts / authentication | Single-use internal report tool; no login needed for the take-home |
| Persistence / saved report history | Reports generated statelessly on demand; nothing stored server-side |
| Multi-facility batch / comparison | One CCN at a time keeps the core flow sharp |
| Rebranding the in-report header | Static `INFINITE — Managed by MEDELITE` / `FACILITY ASSESSMENT SNAPSHOT` block is locked (CLAUDE.md rule #2) |
| Native mobile app | Web-first; responsive layout is sufficient |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-02 | Phase 1 | Pending |
| DATA-06 | Phase 1 | Pending |
| DATA-01 | Phase 2 | Pending |
| DATA-03 | Phase 2 | Pending |
| DATA-04 | Phase 2 | Pending |
| DATA-05 | Phase 2 | Pending |
| NAME-01 | Phase 2 | Pending |
| NAME-02 | Phase 2 | Pending |
| RPT-01 | Phase 2 | Pending |
| RPT-02 | Phase 2 | Pending |
| LOOK-01 | Phase 3 | Pending |
| LOOK-02 | Phase 3 | Pending |
| LOOK-03 | Phase 3 | Pending |
| INPT-01 | Phase 3 | Pending |
| INPT-02 | Phase 3 | Pending |
| INPT-03 | Phase 3 | Pending |
| PREV-01 | Phase 3 | Pending |
| ERR-01 | Phase 3 | Pending |
| ERR-02 | Phase 3 | Pending |
| DEP-01 | Phase 3 | Pending |
| DEP-02 | Phase 3 | Pending |
| PDF-01 | Phase 4 | Pending |
| PDF-02 | Phase 4 | Pending |
| PDF-03 | Phase 4 | Pending |
| CLM-01 | Phase 5 | Pending |
| CLM-02 | Phase 5 | Pending |
| DOCX-01 | Phase 6 | Pending |
| VIZ-01 | Phase 7 | Pending |
| VIZ-02 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27/27
- Unmapped: 0

---
*Requirements defined: 2026-06-15*
*Last updated: 2026-06-15 — traceability table populated by roadmapper*
