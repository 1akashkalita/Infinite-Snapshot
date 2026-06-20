---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: checkpoint
stopped_at: "Phase 06-03 Task 3 — checkpoint:human-verify (Download DOCX UAT re-verification after column-collapse fix; two Word bugs fixed)"
last_updated: "2026-06-19T22:30:00Z"
last_activity: 2026-06-19
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 19
  completed_plans: 18
  percent: 95
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-15)

**Core value:** Enter a CCN → instantly get an accurate, polished, downloadable facility snapshot.
**Current focus:** Phase 06 — docx-export

## Current Position

Phase: 06 (docx-export) — CHECKPOINT (awaiting human UAT re-verification; two Word bugs fixed: EMU/px logo + column-collapse)
Phase: 07 (visualization) — NEXT (after UAT passes)
Plan: 3 of 3
Status: Paused at Task 3 checkpoint:human-verify (re-verification needed after DOCX-GRID-01 column-collapse fix)
Last activity: 2026-06-19

Progress: [██████████████████████] 95%

## Performance Metrics

**Velocity:**

- Total plans completed: 18
- Average duration: ~8 min/plan
- Total execution time: ~16 minutes

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 1 | 2/3 | ~16 min | ~8 min |
| 01 | 3 | - | - |
| 02 | 3 | - | - |
| 03 | 4 | - | - |
| 04 | 2 | - | - |
| 05 | 4 | - | - |

**Recent Trend:**

- Last 5 plans: 01-01 (install), 01-02 (fixtures)
- Trend: On track

*Updated after each plan completion*
| Phase 01 P03 | 4 minutes | 2 tasks | 4 files |
| Phase 02 P01 | 8 minutes | 2 tasks | 4 files |
| Phase 03 P01 | 12 | 3 tasks | 6 files |
| Phase 03 P02 | 30min | 3 tasks | 3 files |
| Phase 04-pdf-export P01 | 35 | 3 tasks | 5 files |
| Phase 04-pdf-export P02 | 10min | 2 tasks | 2 files |
| Phase 05-claims-based-metrics P01 | 12 | 2 tasks | 7 files |
| Phase 05-claims-based-metrics P03 | 18 | 2 tasks | 4 files |
| Phase 06-docx-export P02 | 8 | 2 tasks | 2 files |
| Phase 06-docx-export P03 | 8min | 2 tasks (3rd at checkpoint) | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Init: Fixture-first hard dependency — no CMS field names from memory (CLAUDE.md rule #3); Phase 1 must capture `provider-686123.json` before any schema is written
- Init: `serverExternalPackages: ['@react-pdf/renderer']` must be added explicitly in Phase 2 (PITFALLS.md Turbopack bug #88844)
- Init: recharts must be pinned to v2 (not v3) — react-pdf-charts incompatible with recharts v3
- Init: CCN field name in dataset `4pq5-n9py` is `cms_certification_number_ccn` (STACK.md verified; ARCHITECTURE.md sketches used `federal_provider_number` from memory — do not copy those)
- Init: Fonts in PDF must use absolute `https://` CDN URLs — `/public/` paths silently fail on Vercel
- D-01 (01-02): All three CMS datasets captured for CCN 686123 — provider (4pq5-n9py), claims (ijh5-nb2v), averages (xcdc-v8bm)
- D-02 (01-02): Claims/averages schemas deferred to Phase 5; only provider CMSRowSchema in Phase 1
- D-03 (01-02): Dataset registry with metastore ID re-resolution at capture time — dataset IDs confirmed stable
- D-11 (01-02): Committed fixtures are single source of truth for unit tests
- D-01-01 (01-01): All five production libs installed at pinned versions; recharts pinned to ^2.15.4 (not v3) — react-pdf-charts compat requirement
- D-01-01b (01-01): next.config.ts left unchanged; serverExternalPackages deferred to Phase 2/4 (react-pdf already on Next.js 16 auto-opt-out list)
- D-04 (01-03): .passthrough() on CMSRowSchema — ~90 unmodeled CMS columns preserved transparently
- D-05/D-06 (01-03): Required-key + nullable-value on depended-on fields; .optional() intentionally omitted — missing CMS key fails safeParse loudly (DATA-06 invariant)
- D-07/D-08/D-09 (01-03): Preprocess empty/whitespace→null before z.coerce.number; real "0" preserved as 0
- D-10 (01-03): CCN and ZIP as z.string() — never coerced; leading zeros preserved
- D-12 (01-03): Malformed fixtures as inline typed constants in schema.test.ts (avoids JSON type-inference edge case)
- Vitest alias fix (01-03): Added resolve.alias in vitest.config.ts for @/* → ./src; tsconfig paths not auto-forwarded to Vitest resolver
- D-14 (02-01): FacilityData is camelCase-only boundary; no snake_case CMS names re-exported from types.ts
- D-24 (02-01): CMS_BASE_URL, DATASET_PROVIDER_INFO ('4pq5-n9py'), CCN_FILTER_FIELD ('cms_certification_number_ccn') centralized in constants.ts, each traced to fixture (NOT federal_provider_number from ARCHITECTURE.md memory)
- D-01/D-03 (02-01): 5-kind discriminated union (CmsApiErrorSchema) + assertNever exhaustiveness guard in errors.ts; validation_error carries no extra field (D-05 T-02-LEAK)
- D-18 (02-01): CmsError class extends Error; Object.setPrototypeOf used for reliable instanceof across transpilation targets
- RPT-01 (02-03): assembleHeader(state) has exactly one string param — TypeScript enforces no facility-name arg at compile time
- D-10 (02-03): formatters check === null (not falsiness) — formatRating(0)='0', null='N/A'; shared PLACEHOLDER='N/A'
- D-12 (02-03): assembleViewModel is pure/deterministic — generatedAt injected by caller, never new Date() internally
- NAME-02 (02-03): displayName = manual.nameOverride?.trim() || facility.providerName — static header is unaffected
- D-25 (02-03): serverExternalPackages: ['@react-pdf/renderer'] added explicitly to next.config.ts; verified by next build in verify:full
- D-21 (02-03): ReportViewModelSchema is the canonical Zod schema — PDF route and Phase 4/6 renderers validate against it
- DEP-CLI (03-02): Vercel deploy performed via Vercel CLI instead of dashboard import — live URL https://infinite-snapshot.vercel.app HTTP/2 200, git auto-deploy on main + PR previews, Root Directory = medelite-report (DEP-01 + DEP-02 satisfied)
- DEP-PROJ (03-02): Vercel project ID prj_hctB9zrT8TVabfcXim2dYvoqHgDH; production alias https://infinite-snapshot.vercel.app; per-deploy URLs have standard Vercel deployment-protection (401) — use the public alias for smoke tests
- [Phase 03-03]: DEC-LAYOUT (03-03): Report body field order locked to reference-exact interleaved layout. CMS and manual fields interleaved, not grouped by source. Verbatim labels from reference PDF: 'Health Inspection' (not '...Rating'), 'Staffing' (not '...Rating'), 'Previous Provider Performance from Medelite' (with suffix). Two source-group separator rows removed.
- [Phase 03-03]: DEC-ADDR-PASSTHROUGH (03-03): Address displayed as raw CMS pass-through string (street + city + state, no ZIP). Intentionally NOT normalized to reference's title-case/ordinal/abbreviated form. Rationale: address is a value governed by the API; lossy normalization risks corrupting regulated source data (CLAUDE.md rule #3). Reversible if normalized presentation later preferred.
- [Phase ?]: Lossless conversion for Web Response API
- [Phase ?]: Test assertions updated: Helvetica-Bold font resource + Document Title metadata (both uncompressed)
- [Phase ?]: route.ts renamed to route.tsx in Phase 04-01
- [Phase ?]: 05-01: AveragesRowSchema passthrough + formatFootnote Table-15 map added; nullableNum replicated inline in each new schema
- [Phase 06-03]: D-02: DownloadPdfButton replaced by unified ExportControls — single component owns PDF|DOCX toggle + format state + loading/error states
- [Phase 06-03]: D-03: PDF is the default pre-selected format in ExportControls toggle
- [Phase 06-03]: T-06-08: ExportControls imports only ReportViewModel as a type — confirmed by next build passing (docx/ReportDocx never reached client bundle)
- [Phase 06-03 fix]: DOCX-EMU-01: docx ImageRun transformation takes PIXELS (not EMU); docx multiplies px×9525 internally — passing EMU produced ~17 billion EMU extent, Word-rejected
- [Phase 06-03 fix]: PREVIEW-WIDTH: report preview capped at max-w-[816px] (US-Letter 8.5in at 96 DPI) across all three render states
- [Phase 06-03 fix]: LABEL-01: footer label "CMS dataset processing date" across all three renderers
- [Phase 06-03 fix]: TITLE-01: page title "Infinite — Medelite"
- [Phase 06-03 fix 2]: DOCX-GRID-01: docx Table requires columnWidths array to emit real <w:tblGrid> entries; omitting it emits w:w="100" placeholder (0.07 in) which Word uses for layout — collapses both columns to ~1 char wide. Fixed with columnWidths + TableLayoutType.FIXED.

### Pending Todos

None yet.

### Blockers/Concerns

- **Phase 2**: Open question on `serverExternalPackages` resolved as "add explicitly"; verify with `npm run verify:full` immediately after config change.
- **Phase 5**: Claims measure code descriptions (521, 522, 551, 552) must be cross-referenced against NH_Data_Dictionary Table 11/12 before writing the claims schema — now anchored to `claims-686123.json` fixture.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260619-fw4 | Rebrand "Infinite Snapshot" → "Infinite": web header → INFINITE logo image, page title → "Infinite", docs reword, GitHub repo renamed to `Infinite-MedElite` | 2026-06-19 | f0543b6 | [260619-fw4-rebrand-infinite](./quick/260619-fw4-rebrand-infinite/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | BENCH-01: State/national average columns next to claims metrics | Deferred | Init |
| v2 | BENCH-02: Comparison charts (facility vs state/national) | Deferred | Init |

## Session Continuity

Last session: 2026-06-19T22:30:00Z
Stopped at: Phase 06-03 Task 3 — checkpoint:human-verify (Download DOCX UAT re-verification; both Word bugs fixed: EMU/px logo (commit 95cac2f) + column-collapse DOCX-GRID-01 (commit 147ee76); regression tests for both added)
Resume file: .planning/phases/06-docx-export/06-03-SUMMARY.md
