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
