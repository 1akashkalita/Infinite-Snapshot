---
phase: 7
slug: visualizations-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-20
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> ⚠ Visual-render caveat (from RESEARCH.md): charts can render in the DOM but blank in react-pdf, and the web preview is an independent pipeline from the PDF/docx. Automated tests prove structure/values; **the rendered-artifact checks (open the real PDF + .docx) are Manual-Only and gate phase sign-off.**

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (node env) |
| **Config file** | `medelite-report/` (vitest config; tests in `tests/**/*.test.ts` + `src/**/*.test.ts`) |
| **Quick run command** | `npx vitest run <file>` (from `medelite-report/`) |
| **Full suite command** | `npm run verify` (typecheck → lint → format:check → test); **phase close on `npm run verify:full`** (adds `next build`) |
| **Estimated runtime** | ~TBD seconds (planner/nyquist auditor to confirm) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched file>` (quick)
- **After every plan wave:** Run `npm run verify`
- **Before `/gsd:verify-work`:** `npm run verify:full` must be green (this phase touches the client bundle + export routes)
- **Max feedback latency:** TBD seconds

---

## Per-Task Verification Map

> Populated by the planner during PLAN.md authoring (one row per task with `<acceptance_criteria>`), then reconciled by the Nyquist auditor. Threat Ref ties to each plan's `<threat_model>` block (security gate active, ASVS L1).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 7-XX-XX | XX | X | VIZ-01 / VIZ-02 | T-7-XX / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for VIZ-01 (web star glyphs + grouped-bar chart grouping of the 12 metrics into 4 measures × {facility, national, state})
- [ ] Test stubs for VIZ-02 (PDF star SVG geometry + react-pdf-charts presence; docx star runs + embedded chart PNGs)
- [ ] Regression guards: CLM-02 (suppressed → "Not reported (small sample)"), CLM-03 (verbatim labels/order + API values), DOCX-01 (`Buffer.byteLength(docxBuffer) < 4_500_000` with images included), RPT-02 (single shared view-model)

*Existing Vitest infrastructure covers the harness — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Charts render as filled shapes in the **opened** PDF (not blank rectangles) | VIZ-02 | react-pdf SVG output cannot be asserted by unit tests; DOM render ≠ PDF render | Download the PDF for CCN 686123 from the live Vercel URL; open it (poppler/render) and confirm 4 grouped-bar charts + star glyphs are visible |
| Star glyphs + chart PNGs render in the **opened** `.docx` | VIZ-01/VIZ-02 | docx ImageRun/colored-run rendering must be visually confirmed | Download `.docx`; open with LibreOffice; confirm colored star runs and 4 embedded chart images appear; confirm file < 4.5 MB |
| Color bands correct (green 4–5 / amber 3 / red 1–2; chart hues blue/green/amber with legend) | VIZ-01 | Visual/perceptual judgement | Inspect web preview + opened PDF/docx for CCN 686123 |
| 300ms debounce, no CMS re-fetch on manual edits | SC#3 (VIZ-01 polish) | Timing/network behavior | Edit a manual input; confirm preview updates ~300ms later and the network tab shows no CMS fetch |
| Full "Looks Done But Isn't" smoke checklist on live Vercel URL | SC#4 | End-to-end deployed behavior | Run the verbatim PITFALLS checklist against `infinite-snapshot.vercel.app` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < TBDs
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
