---
phase: 4
slug: pdf-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-18
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `04-RESEARCH.md` › "## Validation Architecture". Per-task IDs are
> reconciled to the plan task IDs once `*-PLAN.md` files exist (gsd-nyquist-auditor / executor).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 (node env) |
| **Config file** | `medelite-report/vitest.config.ts` (exists) |
| **Quick run command** | `npx vitest run tests/api/export-pdf.test.ts tests/lib/slug.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Build gate** | `npm run verify:full` (typecheck → lint → format:check → test → next build) |
| **Estimated runtime** | ~3–5 seconds (unit + route) ; verify:full ~30–60s (build) |

> All test commands run from `medelite-report/`.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/api/export-pdf.test.ts tests/lib/slug.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite green **AND** `npm run verify:full` exits 0
- **Max feedback latency:** ~5 seconds (quick) / ~60 seconds (build gate)

---

## Per-Task Verification Map

> Task IDs are assigned by the planner; rows below are keyed by requirement/criterion and
> attach to whichever task delivers them. `File Exists` reflects Wave 0 state.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | slug | W0 | D-06 | — | Filename derives only from validated model; no path/script injection in filename | unit | `npx vitest run tests/lib/slug.test.ts` | ❌ W0 | ⬜ pending |
| TBD | render | 1 | PDF-01 / SC#5 | — | N/A | route | `npx vitest run tests/api/export-pdf.test.ts` (200 + binary body) | ✅ (extend) | ⬜ pending |
| TBD | render | 1 | PDF-01 / SC#5 | — | N/A | route | `npx vitest run tests/api/export-pdf.test.ts` (`content-type` contains `application/pdf`) | ✅ (extend) | ⬜ pending |
| TBD | render | 1 | PDF-01 / SC#5 | — | N/A | route | `npx vitest run tests/api/export-pdf.test.ts` (`content-disposition` contains `attachment` + slug/ccn filename) | ✅ (extend) | ⬜ pending |
| TBD | render | 1 | PDF-02 / SC#5 | — | careCompareUrl consumed as-is (origin-pinned by schema) | route | `npx vitest run tests/api/export-pdf.test.ts` (`buffer.toString('latin1').includes(careCompareUrl)`) | ✅ (extend) | ⬜ pending |
| TBD | render | 1 | PDF-03 / SC#2 | — | Static header strings present in buffer | route | `npx vitest run tests/api/export-pdf.test.ts` (latin1 includes `INFINITE — Managed by MEDELITE`, `FACILITY ASSESSMENT SNAPSHOT`, state) | ✅ (extend) | ⬜ pending |
| TBD | render | 1 | rule #2 | — | Facility name never in header block | route | `npx vitest run tests/api/export-pdf.test.ts` (assert displayName not adjacent to header strings) | ✅ (extend) | ⬜ pending |
| TBD | render | 1 | PDF-01 / SC#5 | — | react-pdf must not leak to client bundle | build | `npm run verify:full` exits 0 | n/a (gate) | ⬜ pending |
| TBD | download | 2 | PDF-01 / SC#1 | — | Client never imports `@react-pdf/renderer` | build/manual | `npm run verify:full` + manual download check | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `medelite-report/tests/lib/slug.test.ts` — **new** unit tests for the D-06 filename slug helper: blank/whitespace `displayName` → `<CCN>-Snapshot.pdf` fallback; all-special-chars name → CCN fallback; normal name → `kendall-lakes-...-Snapshot.pdf`; CCN leading zeros preserved.
- [ ] `medelite-report/tests/api/export-pdf.test.ts` — **extend** existing file with a Phase-4 `describe` block: 200 + binary PDF body, `Content-Type: application/pdf`, `Content-Disposition: attachment; filename=...`, Medicare URL present in buffer (`latin1`), static header strings present, facility name NOT in header section. (Existing stub tests remain.)

*No new test infrastructure needed — existing `vitest.config.ts` (node env), the `@/*` alias, and the committed `provider-686123.json` fixture cover all automatable phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PDF link is a real clickable annotation | PDF-02 / SC#3 | Annotation click behavior cannot be asserted from a byte buffer — requires a real PDF viewer | Open the **deployed** PDF (CCN 686123) in Chrome/Firefox/Acrobat; click the "View official CMS profile on Medicare.gov" line; confirm it navigates to `https://www.medicare.gov/care-compare/details/nursing-home/686123` |
| PDF content matches the live web preview | PDF-03 / SC#4 | Visual fidelity (layout, label order, N/A semantics, header centering) is a human comparison | On the Vercel deploy for CCN 686123: render the web preview, download the PDF, compare field-by-field (same name, same data, same manual fields, same verbatim label order) |
| Download triggers with no pop-up/redirect | PDF-01 / SC#1 | End-to-end browser download UX (blob anchor) | On the deploy, click "Download PDF"; confirm a `.pdf` file downloads directly with no new tab, redirect, or error; filename is `<slug(displayName)>-Snapshot.pdf` |
| Built-in font renders correctly on Vercel | D-03 / SC#4 | Font.register Vercel footgun (PITFALLS #5) — built-in Helvetica must look identical local==deploy | Open the deployed PDF; confirm typography is Helvetica and matches local render (no fallback/tofu) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`tests/lib/slug.test.ts`, extended `export-pdf.test.ts`)
- [ ] No watch-mode flags (all `vitest run`, not `vitest`)
- [ ] Feedback latency < 5s (quick) / < 60s (verify:full gate)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
