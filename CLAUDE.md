# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The application lives in the **`medelite-report/`** subdirectory; run all `npm` commands from there. It is a Next.js 16 / React 19 App Router app (TypeScript strict, Tailwind v4) that generates nursing-home reports from CMS Care Compare data. See `CHECKLIST.md` for per-phase acceptance criteria.

## Standing rules (non-negotiable)

1. **Verify after every change.** Run `npm run verify` (typecheck → lint → format:check → test). A task is **not done while it is red**. Never weaken tests, lint rules, or `tsconfig` to make the gate pass — fix the root cause.

2. **Header branding is static; never overwritten by the facility name.** The header block (web UI header and top page of every export) is: the exact static string `"INFINITE — Managed by MEDELITE"`, then the static header `"FACILITY ASSESSMENT SNAPSHOT"`, then the **dynamic state abbreviation** (e.g. `FL`). The platform name `"INFINITE"` is never derived from or replaced by the facility name (CMS legal name or manual override). `assembleHeader()` takes **no facility-name argument** (a state code is fine). The facility name — including the optional manual override — appears **only in the report body** under "Name of Facility".

3. **Never trust a CMS field name from memory.** Every CMS field used must trace to the `NH_Data_Dictionary`, `tests/fixtures/provider-686123.json`, or a verified live response. If you can't point to one of those, don't use the field. Data comes from the public **CMS Provider Data Catalog API**.

4. **Validate every CMS response with Zod.** Every CMS response passes through a Zod schema before any render or export. Unvalidated data must never reach the UI or PDF.

5. **Tests first or alongside, never after.** Write tests before or with the code. **Commit in small slices.**

6. **Handle and test every error path.** Invalid CCN, network failure, and missing fields are each explicitly handled and covered by tests.

7. **PDF uses `@react-pdf/renderer` only.** Never `html2canvas` or `jsPDF`. The PDF includes a clickable `<Link>` to `https://www.medicare.gov/care-compare/details/nursing-home/{CCN}`.

## Field mapping (report fields → source)

Map per the `NH_Data_Dictionary`. CMS source = Provider Data Catalog API; the rest are manual operational inputs that don't live in CMS.

| Report field | Source |
| --- | --- |
| Name of Facility | CMS legal name, **overridable** by manual text (body only) |
| Location | CMS (full address) |
| Census Capacity | CMS "Number of Certified Beds" |
| Star Ratings (Overall, Health Inspection, Staffing, Quality Care) | CMS |
| EMR, Current Census, Type of Patient, Medical Coverage, Previous Provider Performance | Manual input |
| Previous Coverage from Medelite | Manual input (Yes/No dropdown) |
| 12 Hospitalization/ED metrics (STR→Short-Stay, LT→Long-Stay) | CMS claims-based — **bonus** |

**Test case**: CCN `686123` (Kendall Lakes Healthcare and Rehab Center, FL) → `https://www.medicare.gov/care-compare/details/nursing-home/686123`.

Bonus (optional): 12 hospitalization/ED metrics, `.docx` export, charts/cards.

## Next.js 16 caveat

Per `medelite-report/AGENTS.md`, this is Next.js 16.2.x with breaking changes from older versions. **Read the relevant guide in `medelite-report/node_modules/next/dist/docs/` before writing or changing Next.js code.**

## Commands (run from `medelite-report/`)

- `npm run verify` — the quality gate (does not stop at the first failure; non-zero exit on any failure).
- `npm run verify:full` — `verify` plus `npm run build`.
- `npm run dev` / `npm run build` — dev server / production build.
- Single test: `npx vitest run tests/foo.test.ts` (by file) or `npx vitest run -t "name"` (by name); `npx vitest` for watch.
- Tests live in `tests/**/*.test.ts` and `src/**/*.test.ts` (Vitest, node env). `tsconfig` has `isolatedModules`, so every `.ts` file must have an `import`/`export`.

---

<!--
The sections below are managed by GSD (`gsd-sdk query generate-claude-md`) and refreshed
in place via the `<!-- GSD:section -->` markers. The hand-crafted Standing Rules, Field
Mapping, Next.js caveat, and Commands above are authoritative and must never be removed by
regeneration. GSD project planning artifacts live in `.planning/`.
-->

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Infinite Snapshot**

Infinite Snapshot is a lightweight web app that turns a single facility identifier into a polished, downloadable assessment report. A user enters a nursing home's CCN (CMS Certification Number); the app instantly pulls public CMS Care Compare data (location, star ratings, metadata, and claims-based hospitalization/ED measures), combines it with manual operational inputs that don't live in CMS, lets the user preview the result live, and exports a clean, print-ready PDF (and .docx) with a clickable link back to the official Medicare Care Compare profile.

It is being built as a take-home internship project for Medelite, so the bar is not "works" — it is "fully shipped, deployed live, and clearly above expectations." The product is named **Infinite Snapshot** (app/repo/page title); the in-report header branding stays locked to the static `INFINITE — Managed by MEDELITE` / `FACILITY ASSESSMENT SNAPSHOT` block.

**Core Value:** Enter a CCN → instantly get an accurate, polished, downloadable facility snapshot. If everything else fails, that one flow — lookup, combine, export — must work flawlessly.

### Constraints

- **Tech stack**: Next.js 16.2.x, React 19, TypeScript strict, Tailwind v4 — Next.js 16 has breaking changes; read the relevant guide in `medelite-report/node_modules/next/dist/docs/` before writing/changing Next.js code (per AGENTS.md).
- **PDF**: `@react-pdf/renderer` only — never `html2canvas` or `jsPDF`.
- **Validation**: every CMS response passes a Zod schema before any render or export; unvalidated data must never reach the UI or PDF.
- **Data integrity**: every CMS field traces to the data dictionary, a fixture, or a verified live response.
- **Quality gate**: `npm run verify` must be green; tests written first or alongside, never after; small, atomic commits. Never weaken tests/lint/tsconfig to pass.
- **Branding**: in-report header is static and never overwritten by the facility name; `assembleHeader()` takes no facility-name argument.
- **Timeline**: ~1 week of runway (target ~2026-06-22) — required features + all committed bonuses + real polish.
- **Deployment**: Vercel (native Next.js host), public repo.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

Verified library versions and CMS API details (full detail in `.planning/research/STACK.md`).

### Libraries to add (install from `medelite-report/`)

| Library | Version | Purpose |
|---------|---------|---------|
| `@react-pdf/renderer` | `^4.5.1` | PDF generation — REQUIRED, never html2canvas/jsPDF (React 19 compatible) |
| `zod` | `^4.4.3` | Runtime validation for every CMS API response (CMS returns numbers as strings) |
| `docx` | `^9.7.1` | Word document (.docx) export |
| `recharts` | `^2.15.4` | Charts in the web UI — **pin to v2** (v3 is incompatible with react-pdf-charts) |
| `react-pdf-charts` | `^1.0.0` | Adapter: wraps recharts SVG output for react-pdf |

### Charts inside the PDF — what NOT to use

- HTML `<div>` charts, `<canvas>`/Chart.js, `victory` — **none render in react-pdf**.
- Use react-pdf native SVG primitives (`<Svg><Path/>`) for star ratings, and `react-pdf-charts` (recharts v2, `isAnimationActive={false}`) for metric bar charts.

### CMS Provider Data Catalog API

- Query the **stable dataset-ID endpoint** (distribution IDs change weekly): `https://data.cms.gov/provider-data/api/1/datastore/query/{datasetId}/0`.
- Fetch **server-side only** (Route Handler) — CORS blocks direct browser calls.

| Dataset | ID | Holds |
|---------|----|-------|
| NH Provider Information | `4pq5-n9py` | Core facility info, the 4 star ratings, certified beds, address |
| NH Claims-Based Measures | `ijh5-nb2v` | The 12 hospitalization/ED data points (4 measures: 521/522/551/552 × adjusted/observed/expected) |
| State/National Benchmarks | `xcdc-v8bm` | State + national averages for claims measures (v2 stretch) |

- **CCN is always a string** (preserve leading zeros; alphanumeric state codes exist — do NOT use `^\d{6}$` as the only gate). The exact CCN filter field name is resolved by the captured fixture, per standing rule #3.
- Suppressed/"too few to report" CMS values come back as **empty strings**, not null — Zod schemas must handle `""` and use `.nullable().optional()` on rating fields.

### Next.js 16 / Vercel notes

- Add `serverExternalPackages: ['@react-pdf/renderer']` to `next.config.ts` and verify with `npm run verify:full` (Turbopack bug #88844 can omit it from standalone builds).
- Route handler `params` is a Promise in Next.js 16 — `await ctx.params`.
- Register PDF fonts via `https://` CDN URLs, not `/public` paths (silently fails on Vercel).
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Single-flow SPA: CCN in → server Route Handler (`/api/facility`) fetches + Zod-validates CMS data → a single shared `ReportViewModel` (assembled once) drives the live HTML preview, the PDF (`renderToBuffer`), and the .docx so all three stay consistent. `assembleHeader(state)` (no facility-name arg) is the single source of header truth. Full detail in `.planning/research/ARCHITECTURE.md`.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
