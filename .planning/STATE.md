# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-15)

**Core value:** Enter a CCN → instantly get an accurate, polished, downloadable facility snapshot.
**Current focus:** Phase 1 — Foundation & CMS Data Layer

## Current Position

Phase: 1 of 7 (Foundation & CMS Data Layer)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-06-15 — Roadmap created; ready to begin Phase 1 planning

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: none yet
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Init: Fixture-first hard dependency — no CMS field names from memory (CLAUDE.md rule #3); Phase 1 must capture `provider-686123.json` before any schema is written
- Init: `serverExternalPackages: ['@react-pdf/renderer']` must be added explicitly in Phase 2 (PITFALLS.md Turbopack bug #88844)
- Init: recharts must be pinned to v2 (not v3) — react-pdf-charts incompatible with recharts v3
- Init: CCN field name in dataset `4pq5-n9py` is `cms_certification_number_ccn` (STACK.md verified; ARCHITECTURE.md sketches used `federal_provider_number` from memory — do not copy those)
- Init: Fonts in PDF must use absolute `https://` CDN URLs — `/public/` paths silently fail on Vercel

### Pending Todos

None yet.

### Blockers/Concerns

- **Phase 1**: `tests/fixtures/` is currently empty — `npm run fixture:capture` must succeed before any schema code is written. Verify the script actually runs and produces valid JSON as the very first action.
- **Phase 2**: Open question on `serverExternalPackages` resolved as "add explicitly"; verify with `npm run verify:full` immediately after config change.
- **Phase 5**: Claims measure code descriptions (521, 522, 551, 552) must be cross-referenced against NH_Data_Dictionary Table 11/12 before writing the claims schema.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | BENCH-01: State/national average columns next to claims metrics | Deferred | Init |
| v2 | BENCH-02: Comparison charts (facility vs state/national) | Deferred | Init |

## Session Continuity

Last session: 2026-06-15
Stopped at: Roadmap created; STATE.md and REQUIREMENTS.md traceability initialized
Resume file: None
