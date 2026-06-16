# Infinite Snapshot

## What This Is

Infinite Snapshot is a lightweight web app that turns a single facility identifier into a polished, downloadable assessment report. A user enters a nursing home's CCN (CMS Certification Number); the app instantly pulls public CMS Care Compare data (location, star ratings, metadata, and claims-based hospitalization/ED measures), combines it with manual operational inputs that don't live in CMS, lets the user preview the result live, and exports a clean, print-ready PDF (and .docx) with a clickable link back to the official Medicare Care Compare profile.

It is being built as a take-home internship project for Medelite, so the bar is not "works" — it is "fully shipped, deployed live, and clearly above expectations." The product is named **Infinite Snapshot** (app/repo/page title); the in-report header branding stays locked to the static `INFINITE — Managed by MEDELITE` / `FACILITY ASSESSMENT SNAPSHOT` block.

## Core Value

Enter a CCN → instantly get an accurate, polished, downloadable facility snapshot. If everything else fails, that one flow — lookup, combine, export — must work flawlessly.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate. The existing app is default Next.js scaffolding only.)

### Active

<!-- Current scope. Building toward these. All are hypotheses until shipped. -->

**Required (must pass technical review):**

- [ ] Dynamic CCN lookup — input box accepts any valid CCN, with validation and clear feedback
- [ ] Data engine — query the public CMS Provider Data Catalog API by CCN; fetch location, star ratings (Overall, Health Inspection, Staffing, Quality Care), certified beds, and metadata
- [ ] Facility name override — default to CMS legal name, with an optional text field that overrides it on the output (body only)
- [ ] Manual operational inputs — EMR, Current Census, Type of Patient, Medical Coverage, Previous Provider Performance, Previous Coverage from Medelite (Yes/No)
- [ ] Polished PDF export — single "Download PDF" button triggers a direct browser download of a clean, print-ready document, built with `@react-pdf/renderer`
- [ ] Medicare source hyperlink — the PDF includes a clickable link to `https://www.medicare.gov/care-compare/details/nursing-home/{CCN}` using the searched CCN
- [ ] Deployment — live, working URL on Vercel alongside a public code repository

**Bonus (committed — these are how we exceed expectations):**

- [ ] 12 CMS claims-based metrics — short-stay (STR) and long-stay (LT) hospitalization/ED measures pulled from CMS and shown in the report
- [ ] Charts & visual cards — star ratings and key metrics rendered as polished visual cards/charts in both the web UI and the export, not just plain text
- [ ] .docx export — a Word export option alongside the required PDF
- [ ] Live preview — in-browser report preview that updates as the user types manual inputs, before downloading
- [ ] Hardened error handling — comprehensive boundaries for edge cases: invalid CCN, facility-not-found, network failure, and missing/partial CMS fields, all handled cleanly and tested

### Out of Scope

<!-- Explicit boundaries with reasoning. -->

- User accounts / authentication — single-use internal report tool; no login needed for the take-home
- Persistence / database — reports are generated statelessly on demand; nothing saved server-side
- Multi-facility batch processing — one CCN at a time keeps the core flow sharp
- Rebranding the in-report header — the static `INFINITE — Managed by MEDELITE` / `FACILITY ASSESSMENT SNAPSHOT` block is locked (CLAUDE.md standing rule #2); "Infinite Snapshot" is the app name only
- Native mobile app — web-first, responsive is enough

## Context

- **Existing code:** `medelite-report/` subdirectory holds a barebones Next.js 16.2.9 / React 19.2.4 / TypeScript (strict) / Tailwind v4 app. Currently only default scaffolding (`layout.tsx`, `page.tsx`, `globals.css`) plus one smoke test. Tooling is already wired: `npm run verify` (typecheck → lint → format:check → test) via `scripts/verify.mjs`, Vitest (node env), Prettier, ESLint, and a `fixture:capture` script.
- **Not yet present:** `@react-pdf/renderer`, `zod`, charting lib, and `.docx` generation lib all need to be added. `tests/fixtures/` is empty — the `provider-686123.json` fixture referenced by CLAUDE.md still needs to be captured.
- **Data source:** public CMS Provider Data Catalog API. Every field used must trace to the `NH_Data_Dictionary`, a captured fixture, or a verified live response — never from memory.
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
| Deploy on Vercel | Native Next.js 16 host, free tier, instant live URL — fits the "live working URL" deliverable | — Pending |
| Commit to all four bonuses + hardened error handling | User wants to land clearly above expectations with a week of runway | — Pending |
| Use CCN 686123 (Kendall Lakes, FL) as the reference/test facility | Specified in CLAUDE.md; anchors the fixture and tests | — Pending |

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
*Last updated: 2026-06-15 after initialization*
