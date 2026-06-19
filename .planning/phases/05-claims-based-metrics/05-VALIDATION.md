---
phase: 5
slug: claims-based-metrics
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-18
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `05-RESEARCH.md` › "## Validation Architecture". Per-task IDs are
> reconciled to the plan task IDs once `*-PLAN.md` files exist (gsd-nyquist-auditor / executor).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (node env) |
| **Config file** | `medelite-report/vitest.config.ts` (exists) |
| **Quick run command** | `npx vitest run tests/lib/cms/ tests/lib/report/` |
| **Full suite command** | `npm run verify` (typecheck → lint → format:check → test) |
| **Build gate** | `npm run verify:full` (verify + `next build` — this phase touches the PDF/route bundle) |
| **Estimated runtime** | ~3–5 seconds (unit) ; verify:full ~30–60s (build) |

> All test commands run from `medelite-report/`.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lib/cms/ tests/lib/report/`
- **After every plan wave:** Run `npm run verify`
- **Before `/gsd:verify-work`:** Full suite green **AND** `npm run verify:full` exits 0
- **Max feedback latency:** ~5 seconds (quick) / ~60 seconds (build gate)

---

## Per-Task Verification Map

> Task IDs are assigned by the planner; rows below are keyed by requirement/criterion and
> attach to whichever task delivers them. `File Exists` reflects Wave 0 state.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | schema | W0 | CLM-02 / rule #4 | T-05-V5 | `adjusted_score` `""`→null; non-numeric rejected (row dropped, no crash) | unit | `npx vitest run tests/lib/cms/claims-schema.test.ts` | ❌ W0 | ⬜ pending |
| TBD | schema | W0 | CLM-01 / rule #4 | T-05-V5 | AveragesRow `.passthrough()` preserves hash-suffixed columns for runtime key scan | unit | `npx vitest run tests/lib/cms/averages-schema.test.ts` | ❌ W0 | ⬜ pending |
| TBD | mapper | 1 | CLM-01 / SC#1 | — | Join produces exactly 12 HospMetric objects with correct 686123 values | unit | `npx vitest run tests/lib/cms/claims-mapper.test.ts` (12 metrics, values match fixture) | ❌ W0 | ⬜ pending |
| TBD | mapper | 1 | CLM-03 / SC#2 | — | All 12 verbatim labels appear in exact reference order (garbles preserved) | unit | `npx vitest run tests/lib/cms/claims-mapper.test.ts` (label/order assertion) | ❌ W0 | ⬜ pending |
| TBD | mapper | 1 | CLM-02 / SC#3 | — | Suppressed measure (footnote 9) → "Not reported (small sample)" in that facility row only; its avg rows still render | unit | `npx vitest run tests/lib/cms/claims-mapper.test.ts` (synthetic suppressed fixture) | ❌ W0 | ⬜ pending |
| TBD | mapper | 1 | CLM-02 / SC#5 | — | Fewer-than-4 measures degrades cleanly (no throw); per D-10/Open-Q1 planner decision | unit | `npx vitest run tests/lib/cms/claims-mapper.test.ts` (partial-data case) | ❌ W0 | ⬜ pending |
| TBD | format | 1 | CLM-02 | — | `formatFootnote` covers codes 1/2/7/9/10/28 + unknown + empty → fallback | unit | `npx vitest run tests/lib/report/format.test.ts` | ✅ (extend) | ⬜ pending |
| TBD | route | 1 | CLM-01 / SC#1 | T-05-V5 | GET /api/facility returns `hospMetrics` when CMS succeeds; degrades (absent/flag) when claims/averages fetch fails — provider info still renders | integration | `npx vitest run tests/api/facility.test.ts` | ✅ (extend) | ⬜ pending |
| TBD | view-model | 1 | CLM-01 / D-13 | T-05-PDF | Extended `ReportViewModelSchema` validates `hospMetrics`; stays `.optional()` so degraded model passes | unit | `npx vitest run tests/lib/report/view-model.test.ts` | ✅ (extend) | ⬜ pending |
| TBD | preview | 2 | CLM-03 / SC#1 | — | Web preview renders all 12 metric labels after "Quality of Resident Care" | unit | `npx vitest run src/components/ReportPreview.test.tsx` (if added) | ❌ W0 | ⬜ pending |
| TBD | pdf | 2 | CLM-03 / SC#4 | — | PDF buffer for 686123 contains "Short Term Hospitalization" + the 12 rows | integration | `npx vitest run tests/api/export-pdf.test.ts` (latin1 includes label) | ✅ (extend) | ⬜ pending |
| TBD | bundle | 2 | CLM-01 / rule #1 | — | react-pdf must not leak to client bundle; full build green | build | `npm run verify:full` exits 0 | n/a (gate) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `medelite-report/tests/lib/cms/claims-mapper.test.ts` — **new**: join produces 12 HospMetric objects with correct 686123 values (CLM-01); suppression path via synthetic footnote-9 fixture → "Not reported (small sample)", with avg rows still rendering (CLM-02); fewer-than-4 measures degrades without throwing (SC#5); all 12 verbatim labels in exact reference order incl. garbles (CLM-03).
- [ ] `medelite-report/tests/lib/cms/claims-schema.test.ts` — **new**: `ClaimsRowSchema` empty `adjusted_score` `""`→null; real `"0"` preserved; non-numeric rejected (row dropped); `footnote_for_score` passthrough.
- [ ] `medelite-report/tests/lib/cms/averages-schema.test.ts` — **new**: `AveragesRowSchema` `.passthrough()` preserves the hash-suffixed average columns; `state_or_nation` typed.
- [ ] `medelite-report/tests/lib/report/format.test.ts` — **extend**: `formatFootnote` for all 6 known codes (1/2/7/9/10/28) + unknown-code fallback + empty-string fallback.
- [ ] `medelite-report/tests/api/facility.test.ts` — **extend**: `hospMetrics` present in response when claims+averages succeed; degraded (absent or unavailability flag) when claims/averages fetch fails while provider info still resolves.
- [ ] `medelite-report/tests/api/export-pdf.test.ts` — **extend**: PDF buffer (CCN 686123) contains "Short Term Hospitalization" and the 12-row block when `hospMetrics` populated.

*Existing `vitest.config.ts` (node env), the `@/*` alias, `resolveJsonModule`, and the committed `claims-686123.json` / `averages-xcdc.json` fixtures cover the automatable phase requirements. The suppression path needs a **synthetic** fixture — 686123 has `footnote_for_score: ""` on all 4 measures, so its live data cannot exercise D-11.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All 12 data points render end-to-end on the deploy | CLM-01 / SC#1 | Live 3-dataset fan-out + render is a full-stack visual check no unit asserts | On the Vercel deploy, look up CCN 686123; confirm the web preview shows all 12 rows after "Quality of Resident Care" with facility + national + state values |
| Metrics labels/order match the reference exactly (garbles preserved) | CLM-03 / SC#2 | Verbatim-fidelity vs the Medelite template is a human comparison | Compare the 12 rendered rows against `.planning/reference/Facility Assessment Snapshot.docx` — incl. "STR State National Avg. for Hospitalization" and the bare "ED Visit" row |
| PDF metrics section matches the live web preview | CLM-03 / SC#4 | Visual fidelity (layout, label order, suppression text) is a human comparison | On the deploy for 686123: render the preview, download the PDF, compare the 12 rows field-by-field |
| Degraded one-line state renders when the bonus fetch fails | CLM-02 / D-09 | Transient CMS/network failure is hard to force in CI | Temporarily induce a claims/averages fetch failure (or observe a real CMS outage); confirm the report still renders fully with "Hospitalization & ED metrics are temporarily unavailable." in place of the 12 rows |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`claims-mapper`, `claims-schema`, `averages-schema` tests; extended `format`, `facility`, `export-pdf` tests)
- [ ] No watch-mode flags (all `vitest run`, not `vitest`)
- [ ] Feedback latency < 5s (quick) / < 60s (verify:full gate)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
