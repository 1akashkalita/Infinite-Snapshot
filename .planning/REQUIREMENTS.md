# Requirements: Infinite Snapshot

**Defined:** 2026-06-15
**Core Value:** Enter a CCN → instantly get an accurate, polished, downloadable facility snapshot.

All v1 requirements below are committed scope for this milestone (required take-home features **plus** the bonuses the user committed to in order to land above expectations). They are hypotheses until shipped and validated.

## v1 Requirements

### CCN Lookup

- [x] **LOOK-01**: User can enter a CCN in an input box and submit it to fetch that facility's data
- [x] **LOOK-02**: App validates CCN format (6-character, treated as a string with leading zeros preserved) and shows a clear inline error for malformed input before any fetch
- [x] **LOOK-03**: App distinguishes "invalid format" from "facility not found" (valid format but zero CMS results) with distinct, user-friendly messaging

### CMS Data Engine

- [ ] **DATA-01**: App fetches facility data from the CMS Provider Data Catalog API by CCN via a server-side route handler (no direct browser→CMS call; avoids CORS)
- [x] **DATA-02**: Every CMS response is validated by a Zod schema before reaching the UI or any export; suppressed/blank ("too few to report") fields are handled gracefully, not as errors
- [ ] **DATA-03**: Report shows the facility's location, **composed** from `provider_address` + `citytown` + `state` (e.g. `5280 SW 157th Ave, Miami, FL`) — **no ZIP**; the combined `location` field (which includes ZIP) is not reused
- [ ] **DATA-04**: Report shows the four star ratings — Overall (`overall_rating`), Health Inspection (`health_inspection_rating`), Staffing (`staffing_rating`), and **Quality of Resident Care (`qm_rating`** — NOT `longstay_qm_rating`/`shortstay_qm_rating`)
- [ ] **DATA-05**: Report shows census capacity (Number of Certified Beds) from CMS
- [x] **DATA-06**: Every CMS field used traces to the captured fixture (`provider-686123.json`) or the NH_Data_Dictionary — never a field name from memory

> **Phase 1 design decisions & scope boundary (DATA-02 / DATA-06):**
> - **Required-key + `.nullable()`-value (not `.optional()`).** The roadmap's original `.nullable().optional()` wording for star-rating fields was deliberately refined per CONTEXT D-06: `.optional()` was **dropped** on depended-on keys so a renamed/removed CMS column fails `safeParse` **loudly** instead of silently passing as `undefined`. Same "a suppressed-data facility doesn't throw" intent, stricter enforcement. This is an intended refinement, not a defect — score against the refined wording.
> - **Numeric coercion rejects non-string/non-null inputs** (review CR-01). `nullableNum` accepts only `string | number | null`; a boolean/array/object or a non-numeric string is rejected so malformed CMS data can't be coerced into a fabricated number (rule #4). Empty/whitespace → `null`; `"0"` → `0`.
> - **DATA-06 is enforced by a runtime test**, not just by the schema happening to parse: `schema.test.ts` iterates `CMSRowSchema.shape` and asserts every depended-on key exists in `provider-686123.json`.
> - **Scope boundary — what Phase 1 does NOT include:** Phase 1 delivers only the row schema (`CMSRowSchema`) + typed parse helpers (`parseCMSRow` / `safeParseCMSRow`). The raw→view-model normalizer is **RPT-02 (Phase 2)**; the "valid CCN returns zero rows → typed not-found" path is **LOOK-03 / ERR-01 (Phase 3)**. Both are intentionally out of Phase 1 — do not mark Phase 1 incomplete for their absence.

### Facility Identity

- [ ] **NAME-01**: Report defaults the facility name to the official CMS legal name
- [x] **NAME-02**: User can enter an optional custom name that overrides the CMS name on the report body only (the static branding header is never affected)

### Manual Operational Inputs

- [x] **INPT-01**: User can enter all of: EMR, Current Census, Type of Patient, **Medical Coverage** (free text, e.g. "Optometry, PCP, Podiatry" — a distinct field, not folded into "Medelite History"), and Previous Provider Performance
- [x] **INPT-02**: User can set "Previous Coverage from Medelite" via a Yes/No control
- [x] **INPT-03**: Manual inputs appear in the report body alongside the CMS data

### Report Assembly & Branding

- [ ] **RPT-01**: Report header is the static `INFINITE — Managed by MEDELITE` / `FACILITY ASSESSMENT SNAPSHOT` / dynamic state abbreviation, never overwritten by the facility name
- [ ] **RPT-02**: A single shared report view-model drives the web preview, the PDF, and the .docx, so all three stay consistent

### Live Preview

- [x] **PREV-01**: User sees an in-browser preview of the report that updates as they edit manual inputs, before downloading

### PDF Export

- [ ] **PDF-01**: User can click "Download PDF" to trigger a direct browser download of a clean, print-ready PDF built with `@react-pdf/renderer`
- [ ] **PDF-02**: The PDF includes a clickable hyperlink to `https://www.medicare.gov/care-compare/details/nursing-home/{CCN}` using the searched CCN
- [ ] **PDF-03**: The downloaded PDF content matches what the live preview showed

### DOCX Export (bonus)

- [ ] **DOCX-01**: User can download a `.docx` version of the report alongside the PDF, with matching content

### Claims-Based Metrics (bonus)

- [ ] **CLM-01**: Report displays the 12 claims-based hospitalization/ED data points — the **4 measures** (short-stay rehospitalization %, short-stay outpatient ED %, long-stay hospitalizations per 1,000 resident-days, long-stay ED visits per 1,000 resident-days) each shown with **facility value + national avg + state avg**. Facility values come from Medicare Claims Quality Measures (`ijh5-nb2v`, display the **adjusted/risk-adjusted** score); national + state averages come from State US Averages (`xcdc-v8bm`, keyed `NATION`/`FL`). Dataset IDs resolved/verified via the CMS metastore.
- [ ] **CLM-02**: Suppressed or "too few to report" claims values (e.g. `footnote_for_score` set, or empty-string score) render cleanly (e.g. "Not reported (small sample)") rather than as blanks, nulls, or errors
- [ ] **CLM-03**: The metrics section matches the reference report's **labels and order** (including its exact, slightly garbled label text such as "STR State National Avg. for Hospitalization" and the bare "ED Visit" line); displayed **values come from the fixture/live API**, not the reference PDF's illustrative numbers

### Visualizations (bonus)

- [ ] **VIZ-01**: Star ratings and key metrics render as polished visual cards/charts in the web UI
- [ ] **VIZ-02**: Visual elements render correctly inside the PDF using react-pdf SVG primitives / react-pdf-charts (never DOM-based charting)

### Error Handling (bonus, cross-cutting)

- [x] **ERR-01**: Invalid CCN, facility-not-found, network/API failure, and missing/partial CMS fields each produce a distinct, clean user-facing state
- [x] **ERR-02**: Every error path is covered by tests

### Deployment

- [x] **DEP-01**: App is deployed to a live, working Vercel URL
- [x] **DEP-02**: A public code repository is available alongside the live URL

## v2 Requirements

Acknowledged, deferred — stretch goals if time allows after v1 is solid.

> Note: state/national averages were **promoted into v1** — they are 8 of the 12 metrics in CLM-01 (`xcdc-v8bm`), not a stretch.

### Benchmarks

- **BENCH-01**: Comparison charts (facility vs state vs national) beyond the per-metric value columns
- **BENCH-02**: Visual flag when a facility value is better/worse than its state and national benchmark

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
| DATA-02 | Phase 1 | Complete |
| DATA-06 | Phase 1 | Complete |
| DATA-01 | Phase 2 | Pending |
| DATA-03 | Phase 2 | Pending |
| DATA-04 | Phase 2 | Pending |
| DATA-05 | Phase 2 | Pending |
| NAME-01 | Phase 2 | Pending |
| NAME-02 | Phase 2 | Complete |
| RPT-01 | Phase 2 | Pending |
| RPT-02 | Phase 2 | Pending |
| LOOK-01 | Phase 3 | Complete |
| LOOK-02 | Phase 3 | Complete |
| LOOK-03 | Phase 3 | Complete |
| INPT-01 | Phase 3 | Complete |
| INPT-02 | Phase 3 | Complete |
| INPT-03 | Phase 3 | Complete |
| PREV-01 | Phase 3 | Complete |
| ERR-01 | Phase 3 | Complete |
| ERR-02 | Phase 3 | Complete |
| DEP-01 | Phase 3 | Complete |
| DEP-02 | Phase 3 | Complete |
| PDF-01 | Phase 4 | Pending |
| PDF-02 | Phase 4 | Pending |
| PDF-03 | Phase 4 | Pending |
| CLM-01 | Phase 5 | Pending |
| CLM-02 | Phase 5 | Pending |
| CLM-03 | Phase 5 | Pending |
| DOCX-01 | Phase 6 | Pending |
| VIZ-01 | Phase 7 | Pending |
| VIZ-02 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28/28
- Unmapped: 0

---
*Requirements defined: 2026-06-15*
*Last updated: 2026-06-17 — DATA-02/DATA-06 marked complete; Phase 1 design-decision + scope-boundary note added after phase execution*
