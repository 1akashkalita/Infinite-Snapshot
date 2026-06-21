# Infinite Snapshot

## What This Is

Infinite Snapshot is a lightweight web app that turns a single facility identifier into a polished, downloadable assessment report. A user enters a nursing home's CCN (CMS Certification Number); the app instantly pulls public CMS Care Compare data (location, star ratings, metadata, and claims-based hospitalization/ED measures), combines it with manual operational inputs that don't live in CMS, lets the user preview the result live, and exports a clean, print-ready PDF (and .docx) with a clickable link back to the official Medicare Care Compare profile.

It is being built as a take-home internship project for Medelite, so the bar is not "works" — it is "fully shipped, deployed live, and clearly above expectations." The product is named **Infinite Snapshot** (app/repo/page title); the in-report header branding stays locked to the static `INFINITE — Managed by MEDELITE` / `FACILITY ASSESSMENT SNAPSHOT` block.

## Core Value

Enter a CCN → instantly get an accurate, polished, downloadable facility snapshot. If everything else fails, that one flow — lookup, combine, export — must work flawlessly.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- [x] **Foundation & CMS data layer (Phase 1, 2026-06-17)** — five production libs installed at pinned versions (`recharts` held at v2 for react-pdf-charts compat); the three CMS fixtures for CCN 686123 captured from the live API with a `_capture-manifest.json` provenance record; `CMSRowSchema` + typed parse helpers (`parseCMSRow` / `safeParseCMSRow`) validate provider rows (empty→null, real `"0"` preserved, leading-zero CCN/ZIP kept as strings, non-string/malformed input rejected). Anchors DATA-02 + DATA-06; `npm run verify` green.
- [x] **Server API surface, view-model & config (Phase 2, 2026-06-17)** — `GET /api/facility?ccn=` validates + proxies CMS data into a typed camelCase `FacilityData` (mapper uses `provider_name`/`qm_rating`, composes address without ZIP), with a 5-kind error taxonomy (`invalid_ccn`/`not_found`/`network_error`/`cms_api_error`/`validation_error`) mapped to distinct 400/404/502 responses behind an 8s abort timeout, and a leak-proof `validation_error` body (D-05). The shared `ReportViewModel` + canonical Zod schema, the static `assembleHeader(state)` (no facility-name arg — rule #2), null-safe formatters, and a `POST /api/export/pdf` stub all exist; `next.config` declares `serverExternalPackages: ['@react-pdf/renderer']`. Anchors DATA-01/03/04/05, NAME-01/02, RPT-01/02; `npm run verify:full` (incl. `next build`) green; code review findings resolved.
- [x] **Web UI, core flow & first deploy (Phase 3, 2026-06-18)** — the headline flow is **live at https://infinite-snapshot.vercel.app** (public repo, Vercel git auto-deploy on `main` + PR previews, Root Directory `medelite-report`): enter a CCN → Generate → live `ReportPreview` populated from `GET /api/facility` via `assembleViewModel`, with client-side CCN precheck (`isValidCcnFormat`), inline-vs-banner error routing (`getErrorPresentation`), and the six manual operational inputs + facility-name override flowing into the preview on every keystroke (name override stays out of the static header — rule #2). The report body matches the reference report exactly (interleaved order + verbatim labels); the address renders as a documented raw-CMS pass-through. Anchors LOOK-01/02/03, INPT-01/02/03, PREV-01, ERR-01/02, DEP-01/02; code review's 1 critical (0-census falsiness, D-10) + 4 warnings fixed with a regression test; `npm run verify` green (147 tests).
- [x] **PDF export (Phase 4, 2026-06-18)** — a "Download PDF" button in `SnapshotApp` POSTs the assembled `ReportViewModel` to `POST /api/export/pdf`, which Zod-validates the body and returns a server-rendered `@react-pdf/renderer` document (`renderToBuffer`) as a Blob for a silent anchor download (D-07 disabled/"Generating…" states, D-08 inline retry). The `ReportPDF` document mirrors `ReportPreview` 1:1 — static header (rule #2, `vm.header.*` only), 13 verbatim-labelled body rows, and a clickable `<Link>` to the Medicare Care Compare profile. Injection-safe `slugFilename` (both displayName and CCN allowlist-sanitized — CR-01 fix). Anchors PDF-01/02/03; code review's 1 blocker (header injection) + 1 warning fixed; `npm run verify:full` green (159 tests). Human PDF-viewer verification tracked in `04-HUMAN-UAT.md`.

- [x] **Claims metrics, .docx export & visual polish (Phases 5–7, 2026-06-21)** — the 12 claims-based hospitalization/ED metrics (4 measures × facility/national/state across `ijh5-nb2v` + `xcdc-v8bm`) render in all three outputs (Phase 5); a `.docx` export fills the official Word template via JSZip/OOXML with a clickable Medicare footer (Phase 6); and Phase 7 adds color-banded star glyphs (web Tailwind, PDF react-pdf `<Svg><Path>`, docx colored Unicode runs), grouped bar charts in all three renderers (web recharts v2, PDF native `<Svg><Rect>`, docx @resvg-rasterized PNGs in a 2×2 grid), and a 300ms manual-input debounce with no CMS re-fetch. The live-Vercel SC#4 smoke uncovered + fixed two production-only bugs invisible to vitest: Turbopack mangling `+`-chained OOXML literals (→ single template literals) and `@resvg` lacking Lambda fonts (→ embedded DejaVu Sans subset). Anchors VIZ-01/02 (+ Phase 5/6 bonus reqs); `npm run verify:full` green (394 tests); 2 live spot-checks (leading-zero CCN, N/A suppression) tracked in `07-HUMAN-UAT.md`.

> Phase 4 shipped the polished PDF export end-to-end (server render + Medicare hyperlink + client download); Phases 5–7 added all committed bonuses (claims metrics, .docx, charts/visual cards, live debounce, hardened errors). **Milestone v1.0 complete** — all required + bonus items validated and live.

### Active

<!-- Current scope. Building toward these. All are hypotheses until shipped. -->

**Required (must pass technical review):**

- [x] Dynamic CCN lookup — input box accepts any valid CCN, with validation and clear feedback _(Phase 3)_
- [x] Data engine — query the public CMS Provider Data Catalog API by CCN; fetch location, star ratings (Overall, Health Inspection, Staffing, Quality Care), certified beds, and metadata _(Phase 2 API + Phase 3 live flow)_
- [x] Facility name override — default to CMS legal name, with an optional text field that overrides it on the output (body only) _(Phase 3)_
- [x] Manual operational inputs — EMR, Current Census, Type of Patient, Medical Coverage, Previous Provider Performance, Previous Coverage from Medelite (Yes/No) _(Phase 3)_
- [x] Polished PDF export — single "Download PDF" button triggers a direct browser download of a clean, print-ready document, built with `@react-pdf/renderer` _(Phase 4)_
- [x] Medicare source hyperlink — the PDF includes a clickable link to `https://www.medicare.gov/care-compare/details/nursing-home/{CCN}` using the searched CCN _(Phase 4)_
- [x] Deployment — live, working URL on Vercel alongside a public code repository _(Phase 3 — https://infinite-snapshot.vercel.app)_

**Bonus (committed — these are how we exceed expectations):**

- [x] 12 CMS claims-based metrics — **4 measures × {facility value, national avg, state avg}**, spanning three datasets: facility values from Medicare Claims Quality Measures (`ijh5-nb2v`, display the adjusted score), national + state averages from State US Averages (`xcdc-v8bm`, keyed `NATION`/`FL`). Match the reference report's labels and order, not its illustrative numbers. _(Phase 5)_
- [x] Charts & visual cards — star ratings and key metrics rendered as polished visual cards/charts in the web UI, PDF, and .docx, not just plain text _(Phase 7)_
- [x] .docx export — a Word export option alongside the required PDF (fills the official Word template via JSZip/OOXML) _(Phase 6)_
- [x] Live preview — in-browser report preview that updates as the user types manual inputs (300ms debounce, no CMS re-fetch), before downloading _(Phase 3 + Phase 7 debounce)_
- [x] Hardened error handling — comprehensive boundaries for edge cases: invalid CCN, facility-not-found, network failure, and missing/partial CMS fields, all handled cleanly and tested _(Phase 2/3)_

### Out of Scope

<!-- Explicit boundaries with reasoning. -->

- User accounts / authentication — single-use internal report tool; no login needed for the take-home
- Persistence / database — reports are generated statelessly on demand; nothing saved server-side
- Multi-facility batch processing — one CCN at a time keeps the core flow sharp
- Rebranding the in-report header — the static `INFINITE — Managed by MEDELITE` / `FACILITY ASSESSMENT SNAPSHOT` block is locked (CLAUDE.md standing rule #2); "Infinite Snapshot" is the app name only
- Native mobile app — web-first, responsive is enough

## Context

- **Existing code:** `medelite-report/` subdirectory holds a barebones Next.js 16.2.9 / React 19.2.4 / TypeScript (strict) / Tailwind v4 app. Currently only default scaffolding (`layout.tsx`, `page.tsx`, `globals.css`) plus one smoke test. Tooling is already wired: `npm run verify` (typecheck → lint → format:check → test) via `scripts/verify.mjs`, Vitest (node env), Prettier, ESLint, and a `fixture:capture` script.
- **Added in Phase 1 (2026-06-17):** `@react-pdf/renderer`, `zod`, `docx`, `recharts` (v2), and `react-pdf-charts` are installed at pinned versions. `tests/fixtures/` now holds the captured `provider-686123.json`, `claims-686123.json`, and `averages-xcdc.json` (plus `_capture-manifest.json` provenance). The provider Zod schema + typed parse layer (`src/lib/cms/`) exist; the claims/averages Zod schemas are deferred to Phase 5 (fixtures captured early to anchor field names).
- **Added in Phase 2 (2026-06-17):** the server API surface — `src/lib/cms/` (`constants.ts`, `types.ts` `FacilityData`, `errors.ts` 5-kind taxonomy + `CmsError`/`assertNever`, `mapper.ts`, `client.ts` `fetchFacility`), `src/app/api/facility/route.ts` (GET), `src/app/api/export/pdf/route.ts` (POST stub, 400/501), and `src/lib/report/` (`header.ts` `assembleHeader`, `format.ts` null-safe formatters, `view-model.ts` `assembleViewModel` + canonical `ReportViewModelSchema`). `next.config.ts` declares `serverExternalPackages: ['@react-pdf/renderer']`. The Phase 3 web UI consumes `GET /api/facility` and `assembleViewModel`; the Phase 4 PDF renderer consumes the parsed `ReportViewModel`.
- **Data source:** public CMS Provider Data Catalog API — **three** datasets (verified live via the metastore): Provider Information `4pq5-n9py` (name, address components, certified beds, 4 star ratings incl. `qm_rating` = Quality), Medicare Claims Quality Measures `ijh5-nb2v` (the 4 facility hospitalization/ED measures), and State US Averages `xcdc-v8bm` (national + state averages, keyed `NATION`/`FL`). Every field used must trace to the `NH_Data_Dictionary`, a captured fixture, or a verified live response — never from memory; re-resolve dataset IDs via the metastore each build.
- **Reference test case:** CCN `686123` (Kendall Lakes Healthcare and Rehab Center, FL) → `https://www.medicare.gov/care-compare/details/nursing-home/686123`.
- **Audience:** internship reviewers grading a Medelite take-home; secondary persona is a Medelite operator generating a facility snapshot.
- **Authoritative spec:** `CLAUDE.md` (standing rules + field mapping) and `CHECKLIST.md` (per-phase acceptance criteria) already exist in the repo and govern the build.

## Constraints

- **Tech stack**: Next.js 16.2.x, React 19, TypeScript strict, Tailwind v4 — Next.js 16 has breaking changes; read the relevant guide in `medelite-report/node_modules/next/dist/docs/` before writing/changing Next.js code (per AGENTS.md).
- **PDF**: `@react-pdf/renderer` only — never `html2canvas` or `jsPDF`.
- **Validation**: every CMS response passes a Zod schema before any render or export; unvalidated data must never reach the UI or PDF.
- **Data integrity**: every CMS field traces to the data dictionary, a fixture, or a verified live response.
- **Quality gate**: `npm run verify` must be green; tests written first or alongside, never after; small, atomic commits. Never weaken tests/lint/tsconfig to pass.
- **Branding**: in-report header is static and never overwritten by the facility name; `assembleHeader()` takes no facility-name argument.
- **Timeline**: ~1 week of runway (target ~2026-06-22) — required features + all committed bonuses + real polish.
- **Deployment**: Vercel (native Next.js host), public repo.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rename product to "Infinite Snapshot" (app/repo/title only) | User directive; report header branding stays locked per CLAUDE.md rule #2 | — Pending |
| Deploy on Vercel | Native Next.js 16 host, free tier, instant live URL — fits the "live working URL" deliverable | ✓ Live (Phase 3 — infinite-snapshot.vercel.app, git auto-deploy, root dir `medelite-report`) |
| Commit to all four bonuses + hardened error handling | User wants to land clearly above expectations with a week of runway | — Pending |
| Use CCN 686123 (Kendall Lakes, FL) as the reference/test facility | Specified in CLAUDE.md; anchors the fixture and tests | — Pending |
| The "12 metrics" = 4 measures × {facility, national avg, state avg}, across 3 datasets | Per NH_Data_Dictionary + reference docs + live API (corrects the earlier 4×score reading); averages live in `xcdc-v8bm`, not the claims provider file | ✓ Good |
| Display the **adjusted** (risk-adjusted) claims score | Matches what Care Compare shows; verify against live 686123 | — Pending |
| Quality star rating = `qm_rating` column (not long/short-stay QM) | Avoids mismapping the adjacent sub-rating columns | ✓ Good |
| Location = `provider_address` + `citytown` + `state`, no ZIP | Reference output excludes ZIP; do not reuse the combined `location` field | ✓ Good |
| Match reference report labels/order, not its numbers | Reference-PDF values are illustrative; fixture/live API is the value source; preserve exact (garbled) label text | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-21 after Phase 7 (Visualizations & Polish) completion — **Milestone v1.0 complete**. All required items + all committed bonuses (claims metrics, .docx, charts/visual cards, 300ms live-preview debounce, hardened errors) are validated and live. App live at **https://infinite-medelite.vercel.app** (the old infinite-snapshot.vercel.app alias is retired after the repo rename to Infinite-MedElite). Two live spot-checks (leading-zero CCN, N/A suppression) remain as tracked human-UAT items.*
