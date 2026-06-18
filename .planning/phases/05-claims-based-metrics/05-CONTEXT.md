# Phase 5: Claims-Based Metrics - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 adds the **12 CMS claims-based hospitalization/ED data points** to the report — the **4 measures × {facility value, national avg, state avg}** — joined from **three** datasets and rendered in **both** the web preview and the PDF, with suppressed/partial values handled cleanly, matching the reference template's labels and order exactly (CLM-01/02/03).

In scope:
- Two new CMS fetches added to the existing `GET /api/facility`: claims (`ijh5-nb2v`, filter `cms_certification_number_ccn`, the 4 facility **adjusted** scores) and averages (`xcdc-v8bm`, the `NATION` + state-`FL` rows). Provider info (`4pq5-n9py`) is already wired (P2).
- Zod schemas for both new datasets (rule #4) + a claims-mapper that joins facility row with NATION/state averages into a structured `hospMetrics` shape.
- The `hospMetrics` slot in `ReportViewModelSchema` (currently `z.unknown().optional()`) becomes a **real Zod-validated schema** — it must live inside `ReportViewModelSchema` because the PDF/DOCX routes re-validate the posted view-model.
- 12 verbatim-labeled rows appended to the report body (preview + PDF), continuing the existing 2-column label/value list after "Quality of Resident Care".
- Graceful degradation when the bonus fetch fails; footnote-aware suppressed-value handling.
- Tests: facility+averages join, a suppressed measure, fewer-than-4-measures (graceful partial), whole-section fetch failure.

Out of scope (later phases — do NOT pull in):
- Polished benchmark **table/chart/cards** for the metrics (recharts / react-pdf-charts) → **Phase 7** (VIZ-01/02). Phase 5 renders the metrics as the reference's flat label/value text rows only.
- `.docx` export of the metrics section → **Phase 6** (the DOCX builder; Phase 5 just ensures `hospMetrics` is in the shared view-model so Phase 6 can consume it).
- 300ms debounce, the full "Looks Done But Isn't" Vercel checklist → **Phase 7**.
- Re-mapping "Current Census" / "Previous Provider Performance" to CMS fields (the template hints at this — see Deferred Ideas). Those stay as the **manual** inputs locked in Phase 3 (D-12).

</domain>

<decisions>
## Implementation Decisions

### Reference artifact & labels (Area 1)
- **D-01: The reference template is the source of truth for the 12 claims labels + order.** `.planning/reference/Facility Assessment Snapshot.docx` (the Medelite snapshot template, with `{CMS API}`/`<Text>` placeholders) was supplied by the user and is now in the repo. Extracted cleanly via `textutil`. CLM-03's "match the labels and order exactly" is satisfied by transcribing from this file. The `Kendall Lakes Healthcare and Rehab Center.pdf` (CMS source profile for 686123) is a corroborating reference; its values already live in the fixtures.
- **D-02: For any future ambiguity in the reference, the planner/executor asks the user per-label rather than guessing.** (Currently moot — all 12 labels extracted legibly; see the full mapping in `<specifics>`.)

### Layout, placement & label fidelity (Area 2)
- **D-03: Render the 12 data points as a FLAT label/value list — NOT a table.** ⚠️ This **supersedes** an earlier blind pick of a "clean benchmark table" (chosen before the reference was viewed). The reference template is a single flat 2-column (label | value) list; the 12 claims metrics are simply 12 more rows continuing the **same `<dl>`** the existing 13 body fields already use. Applies identically to the web preview (Tailwind grid `<dl>`) and the PDF (react-pdf flexbox rows, per Phase-4 D-01). One row = one data point.
- **D-04: Row labels are VERBATIM from the reference, garbles preserved.** Do NOT "correct" them. Confirmed garbles: rows "STR State National Avg. for Hospitalization" / "LT State National Avg. for Hospitalization" mean the **state** average (the word "National" is spurious); the bare "ED Visit" row is the **long-stay ED facility value** (missing its "LT" prefix). Column-header concepts do not apply (flat list, no columns).
- **D-05: Placement = appended after "Quality of Resident Care" (row 13), before the processing-date/Medicare-link footer.** No separate section heading (the reference has none). The existing 13-field body order already matches the template exactly, so the 12 rows just continue it.
- **D-06: The label→value→source mapping is fully decoded** (see `<specifics>` for the table). The planner builds the mapper/labels straight from it; values come from the fixtures/live API, not the reference's placeholders.

### Fetch resilience & wiring (Area 3)
- **D-07: Degrade gracefully — provider info is the ONLY hard dependency.** If provider info loads but the claims/averages fetch fails (network/CMS/validation), the core report still renders fully and PDF/DOCX still export; only the metrics degrade. The 3 CMS fetches run **in parallel via `Promise.allSettled`** (a sequential chain of three 8s-timeout fetches would blow the Vercel ~10s function wall — D-19/P2). A provider-info failure still fails the request with the existing 5-kind taxonomy (unchanged).
- **D-08: Extend the existing `GET /api/facility` route** to fan out to all 3 datasets and return provider data + (`hospMetrics` | a metrics-unavailable flag) in **one** response. Rejected a separate metrics endpoint: it would assemble the view-model in two stages and complicate the "POST the assembled vm" PDF/DOCX flow. Keeps the locked architecture's "single shared view-model, assembled once".
- **D-09: Whole-section fetch failure → ONE concise honest line** in place of the 12 rows, after "Quality of Resident Care": e.g. *"Hospitalization & ED metrics are temporarily unavailable."* This is distinct from per-measure CMS suppression (D-11) — it signals a transient fetch problem, not suppressed data. Not hidden silently; not 12 noisy placeholder rows.

### Suppressed & partial data (Area 4)
- **D-10: Always render all 12 fixed rows (when the fetch succeeded).** Matches the reference's fixed structure. A missing measure (fewer-than-4 from `ijh5-nb2v`) or a suppressed facility score shows the suppressed text **in just that facility row**; its national/state average rows **still render their values** (averages come from `xcdc-v8bm` independently of the facility claims). Per-row, not per-measure-group, suppression.
- **D-11: Footnote-aware suppressed-value messages.** Map each known CMS footnote code to an accurate short message — 9→"Not reported (small sample)", 7→"Not available", 10→"Not submitted", 1→"Not enough data", 2→"Not enough data", 28→(annual; show annual avg) — with a **safe generic fallback** for unknown codes and for the empty-score-with-no-footnote case. Codes/messages trace to NH_Data_Dictionary Table 15 (rule #3; see FEATURES.md table). This is stricter/more honest than CLM-02's single example string "Not reported (small sample)", which it still uses for the footnote-9 case.

### Claude's Discretion (settled by existing code / standard approaches)
- **D-12: Reuse the existing formatters** `formatPercent` (1 dp → "25.6%") for the short-stay % measures (521/522 + their `_1d02`/`_d911` averages) and `formatRate` (2 dp → "2.75") for the long-stay per-1000 rate measures (551/552 + their per-1000 averages). Both already exist (built in Phase 2 anticipating this phase) and use `=== null` semantics (real 0 ≠ "N/A"). Precision is fine as-is; the template specifies no precision.
- **D-13: `hospMetrics` becomes a structured, Zod-validated field inside `ReportViewModelSchema`** (replacing `z.unknown().optional()`). It MUST be part of `ReportViewModelSchema` (not a side channel) because `POST /api/export/pdf` (and the Phase-6 DOCX route) re-validate the full posted view-model before rendering. Shape is the planner's call, but it needs per-data-point: numeric value (`number | null`), unit/format kind (percent | rate), the verbatim label, and a suppression indicator (footnote code or "unavailable"). Keep it optional/absent-tolerant so a degraded response (D-09) validates.
- **D-14: Averages join key** — query `xcdc-v8bm` for `state_or_nation = "NATION"` and `state_or_nation = facility.state` (e.g. "FL"). Match the 4 measure columns **by description, NOT by the hash-suffixed slug** (the slugs like `..._1d02`/`..._d911` are unstable — CLAUDE.md / SUMMARY.md). The 4 relevant average columns are identified in `<specifics>`.
- **D-15: Display the facility ADJUSTED (risk-adjusted) score** (`adjusted_score`) — already locked project-wide; restated so the mapper doesn't reach for observed/expected.
- **D-16: Re-confirm both dataset IDs (`ijh5-nb2v`, `xcdc-v8bm`) via the CMS metastore before writing schemas** (rule #3 — distribution IDs rotate). A research/planning task, not a discussion choice.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reference template & source data (the CLM-03 source of truth)
- `.planning/reference/Facility Assessment Snapshot.docx` — the Medelite snapshot **template**; authoritative source of the 12 claims labels + exact order (D-01/D-03/D-04). Extract with `textutil -convert txt` (already verified to extract cleanly).
- `.planning/reference/Kendall Lakes Healthcare and Rehab Center.pdf` — CMS source profile for CCN 686123; corroborates the fixture values (no text extractor installed locally — open in a viewer if needed).
- `medelite-report/tests/fixtures/claims-686123.json` — the 4 facility rows (`measure_code` 521/522/551/552, `adjusted_score`, `footnote_for_score`, `resident_type`). The field-name + value anchor for `ijh5-nb2v`.
- `medelite-report/tests/fixtures/averages-xcdc.json` — `NATION` + `FL` rows with the hash-suffixed average columns. The anchor for `xcdc-v8bm`.

### Authoritative spec & rules
- `CLAUDE.md` (repo root) — "Claims metrics, ratings & location — verified specifics" table (the 3 datasets, the 12 = 4×{facility,national,state}, adjusted score, garbled-label rule); standing rules #3 (trace every field), #4 (Zod-validate every CMS response), #1 (verify gate), #2 (static header), #7 (PDF react-pdf only).
- `CHECKLIST.md` (repo root) — bonus line: "All 12 hospitalization/ED metrics (STR→Short-Stay, LT→Long-Stay) with state/national averages."
- `medelite-report/AGENTS.md` — Next.js 16 caveat: read `medelite-report/node_modules/next/dist/docs/` before changing the route handler.

### Planning artifacts
- `.planning/ROADMAP.md` §"Phase 5: Claims-Based Metrics" — goal + 5 success criteria + the metastore/adjusted-score notes.
- `.planning/REQUIREMENTS.md` — CLM-01 (12 points, 3 datasets, adjusted score), CLM-02 (suppressed values render cleanly), CLM-03 (match reference labels/order incl. garbles; values from API).
- `.planning/research/FEATURES.md` — the 4 measure codes/descriptions/units (lines ~50-58), the confirmed 686123 values, the 4 average columns (national values), and the **CMS footnote code table** (Table 15 — basis for D-11).
- `.planning/research/SUMMARY.md` — Reconciled Q3 (the 12 = 4×{facility,national,state}); the Phase-5 delivery sketch (claims-schema/averages-schema/claims-mapper/MetricsTable + suppressed handling + tests).
- `.planning/phases/02-api-routes-view-model-config/02-CONTEXT.md` — the API seam being extended: `fetchFacility` pipeline (D-18), 8s timeout (D-19), 5-kind error taxonomy, `FacilityData` (D-14), `formatPercent`/`formatRate` (D-08), suppressed-placeholder split (D-09: "N/A" for core vs "Not reported (small sample)" for claims), constants (D-24).
- `.planning/phases/04-pdf-export/04-CONTEXT.md` — the PDF seam: `ReportPDF` mirrors `ReportPreview` 1:1 (D-01), flexbox-not-grid rows, the `hospMetrics` slot already reserved for this phase (Deferred Ideas).

### Source files (the Phase-5 integration seam)
- `medelite-report/src/lib/cms/constants.ts` — `CMS_BASE_URL`, `DATASET_PROVIDER_INFO`, `CCN_FILTER_FIELD`. Add the two new dataset IDs here (D-16), source from the same place as `scripts/capture-fixture.ts`.
- `medelite-report/src/lib/cms/client.ts` — `fetchFacility`; extend (or add sibling fetchers) for the 3-dataset parallel `allSettled` fan-out (D-07). Keep the SSRF/timeout discipline.
- `medelite-report/src/lib/cms/schema.ts` / `parse.ts` — the existing provider schema + `nullableNum` pattern to mirror for the new claims/averages schemas (empty→null, real "0" preserved).
- `medelite-report/src/lib/cms/mapper.ts` / `types.ts` — `toFacilityData` / `FacilityData`; add the claims-join mapper + the `HospMetric`/`hospMetrics` domain type.
- `medelite-report/src/app/api/facility/route.ts` — the route to extend (D-08); returns provider + metrics (or unavailable flag) in one body.
- `medelite-report/src/lib/report/view-model.ts` — `ReportViewModelSchema` + `assembleViewModel`; replace `hospMetrics: z.unknown().optional()` with the real schema (D-13); thread the joined metrics through the assembler.
- `medelite-report/src/lib/report/format.ts` — `formatPercent` (1 dp) / `formatRate` (2 dp) already exist (D-12); add footnote→message logic (D-11) here or in a small sibling helper.
- `medelite-report/src/components/ReportPreview.tsx` — append the 12 rows after "Quality of Resident Care" in the existing `<dl>` (D-03/D-05); add the degraded one-line state (D-09).
- `medelite-report/src/components/pdf/ReportPDF.tsx` — mirror the same 12 rows + degraded line in react-pdf flexbox rows.

### External
- **CMS NH Data Dictionary** — Table 12 (claims facility measures), Table 3 (state/US averages), Table 15 (footnote codes). Authoritative field traceability (rule #3).
- CMS metastore for dataset-ID re-confirmation: `https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items`; query endpoint `.../datastore/query/{datasetId}/0`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`formatPercent` / `formatRate`** (`format.ts`) — built in Phase 2 anticipating this phase; correct units + `=== null` semantics. Reuse directly (D-12).
- **`hospMetrics` slot** already reserved in `ReportViewModelSchema` (`z.unknown().optional()`) and `FacilityData` — Phase 5 fills it with a real schema (D-13). PDF (Phase 4 Deferred Ideas) and DOCX (Phase 6) consume it from the shared model.
- **`fetchFacility` pipeline** (`client.ts`) — the SSRF-safe, 8s-timeout, Zod-validate-then-map pattern to replicate for the two new datasets (D-07/D-16).
- **`nullableNum` + `safeParseCMSRow`** (`schema.ts`/`parse.ts`) — the empty-string→null / real-"0"-preserved coercion to reuse in the claims/averages schemas.
- **The existing 2-column `<dl>` body** in `ReportPreview.tsx` and the flexbox row pattern in `ReportPDF.tsx` — the 12 rows extend these verbatim (D-03).

### Established Patterns
- Next.js 16 App Router; route handler is server/Node-only; `params` is a Promise. Read `node_modules/next/dist/docs` guides (AGENTS.md).
- TS strict + `isolatedModules` (every `.ts` needs import/export); `@/*` alias; Tailwind v4 (web) vs `StyleSheet.create` (PDF); Vitest node env (`tests/**/*.test.ts`, `src/**/*.test.ts`); fixtures imported directly (`resolveJsonModule`).
- Single shared `ReportViewModel`, assembled once, drives preview + PDF + (Phase 6) DOCX (RPT-02). Formatters run at render time; the model carries raw `number | null` (D-08/D-11 from P2).
- `npm run verify` is the gate; this phase touches the PDF/route bundle, so confirm with `npm run verify:full` (adds `next build`).

### Integration Points
- `GET /api/facility` → 3-dataset parallel `allSettled` → provider `FacilityData` + joined `hospMetrics` (or unavailable flag) → `assembleViewModel` → preview/PDF/DOCX (D-07/D-08).
- `xcdc-v8bm` join: facility `state` → `state_or_nation`; match 4 average columns by description (D-14).
- Suppression: footnote code (or empty score) → footnote-aware message at render time (D-11), per-row (D-10).

</code_context>

<specifics>
## Specific Ideas

### The 12 rows — verbatim label → meaning → source → 686123 value (THE planner mapping)

Order is exactly as the template lists them (continue the body after "Quality of Resident Care"):

| # | Verbatim label (from template) | Meaning | Source | 686123 value |
|---|---|---|---|---|
| 1 | `Short Term Hospitalization` | STR rehosp — **facility** | claims 521 `adjusted_score` | 25.575578 → "25.6%" |
| 2 | `STR National Avg. for Hospitalization` | national avg | xcdc NATION `percentage_of_short_stay_residents_who_were_rehospitalized__1d02` | 23.875617 → "23.9%" |
| 3 | `STR State National Avg. for Hospitalization` | **state** avg (garble: "National" is spurious) | xcdc FL same column | 26.203324 → "26.2%" |
| 4 | `STR ED Visit` | STR outpatient ED — **facility** | claims 522 `adjusted_score` | 8.094575 → "8.1%" |
| 5 | `STR ED Visits National Avg.` | national avg | xcdc NATION `percentage_of_short_stay_residents_who_had_an_outpatient_em_d911` | 12.013574 → "12.0%" |
| 6 | `STR ED Visits State Avg.` | state avg | xcdc FL same column | 9.157686 → "9.2%" |
| 7 | `LT Hospitalization` | LT hosp/1000 — **facility** | claims 551 `adjusted_score` | 2.752503 → "2.75" |
| 8 | `LT National Avg. for Hospitalization` | national avg | xcdc NATION `number_of_hospitalizations_per_1000_longstay_resident_days` | 1.897659 → "1.90" |
| 9 | `LT State National Avg. for Hospitalization` | **state** avg (same garble) | xcdc FL same column | 2.147753 → "2.15" |
| 10 | `ED Visit` | LT ED/1000 — **facility** (garble: bare label, no "LT") | claims 552 `adjusted_score` | 0.910105 → "0.91" |
| 11 | `LT ED Visits National Avg.` | national avg | xcdc NATION `number_of_outpatient_emergency_department_visits_per_1000_l_de9d` | 1.798049 → "1.80" |
| 12 | `LT ED Visits State Avg.` | state avg | xcdc FL same column | 1.156036 → "1.16" |

(Match xcdc columns by **description**, not the hash slug — the `_1d02`/`_d911`/`_de9d` suffixes are unstable. 686123 fixture `footnote_for_score` is `""` for all 4 — no suppression on the reference facility, so the suppression path (D-11) must be tested with a synthetic/other fixture.)

- Demo/test facility **CCN 686123** (Kendall Lakes, FL) — the live preview + PDF must show all 12 points end-to-end.
- Reference values rounded by the existing formatters (`formatPercent` 1 dp, `formatRate` 2 dp) — illustrative renders above; the captured fixture / live API is the value source.

</specifics>

<deferred>
## Deferred Ideas

- **Polished benchmark visualization** of the 12 metrics (table/cards/bar charts via recharts + react-pdf-charts, color-coded vs benchmark) → **Phase 7** (VIZ-01/02). Phase 5 ships the reference's flat text rows only.
- **`.docx` claims section** → **Phase 6** (DOCX-01). Phase 5's job is to put `hospMetrics` in the shared view-model so Phase 6 consumes it.
- **OBSERVATION — template hints at re-sourcing two "manual" fields from CMS (do NOT act in Phase 5):** the template shows `Current Census` = `{Average Number of Residents per Day}` (a CMS field, present in `xcdc-v8bm` as `average_number_of_residents_per_day`) and `Previous Provider Performance from Medelite` = `<number> Patients per day`. Both are currently **manual** inputs, locked in Phase 3 (D-12). Flagged for a possible future reconciliation/milestone; not Phase 5 scope and not a regression.
- **v2 benchmarks** (BENCH-01/02: better/worse flags vs benchmark) — already deferred at init.

None of the above is scope creep into Phase 5 — they are downstream consumers/polish on top of this phase's data.

</deferred>

---

*Phase: 5-Claims-Based Metrics*
*Context gathered: 2026-06-18*
