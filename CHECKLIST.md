# Build Checklist

Acceptance criteria per build phase. A phase is complete only when every box is
checked **and** `npm run verify` is green. Scopes follow the Medelite Facility
Assessment Report Generator case study (test CCN `686123`).

## Invariants (apply to every phase)

These must hold at the end of **every** phase, not just the phase that
introduces them:

- [ ] **Banner**: header block is static `"INFINITE — Managed by MEDELITE"` + `"FACILITY ASSESSMENT SNAPSHOT"` + dynamic state abbrev; `assembleHeader()` takes no facility-name argument; the facility name (legal or manual override) appears only in the report body.
- [ ] **Fixture-traceable fields**: every CMS field name traces to `tests/fixtures/provider-686123.json` or a verified live response — none from memory.
- [ ] **Zod**: every CMS response passes a Zod schema before any render or export.
- [ ] **Error handling**: invalid CCN, network failure, and missing fields are each explicitly handled and tested.
- [ ] `npm run verify` is green; no test/lint/tsconfig weakened to pass.

---

## Phase 0 — Project scaffold & quality harness

- [ ] Next.js 16 / React 19 app builds and runs (`npm run dev`, `npm run build`).
- [ ] `npm run verify` runs typecheck, lint, format:check, and test without short-circuiting and exits non-zero on any failure.
- [ ] Prettier, Vitest, CI workflow, and pre-commit hook are in place.

## Phase 1 — CCN lookup & CMS Data Engine

- [ ] Input box accepts any valid CCN and dynamically fetches that facility from the **CMS Provider Data Catalog API**.
- [ ] Fetches location, star ratings (Overall, Health Inspection, Staffing, Quality Care), certified beds, and metadata.
- [ ] Invalid CCN (malformed / not found) and network failure are handled and tested.
- [ ] No field name is referenced that isn't traceable to `NH_Data_Dictionary` / fixture.

## Phase 2 — Zod schemas & data-dictionary mapping

- [ ] A Zod schema models the CMS response; every response is parsed through it before any render/export.
- [ ] Field names trace 1:1 to `NH_Data_Dictionary` / `tests/fixtures/provider-686123.json` (e.g. Census Capacity → "Number of Certified Beds").
- [ ] Missing/invalid fields produce a typed, tested failure — never a silent pass.
- [ ] Tests assert the `686123` fixture parses and malformed input is rejected.

## Phase 3 — Manual operational inputs & name override

- [ ] Inputs for EMR, Current Census (numeric), Type of Patient, Medical Coverage, Previous Provider Performance, and Previous Coverage from Medelite (Yes/No dropdown).
- [ ] Optional facility-name field overrides the CMS legal name **in the body only**; CCN-driven data is unaffected.
- [ ] Input validation and edge cases are tested.

## Phase 4 — Header block & report body

- [ ] `assembleHeader()` returns `"INFINITE — Managed by MEDELITE"` + `"FACILITY ASSESSMENT SNAPSHOT"` + dynamic state abbrev; takes no facility-name argument.
- [ ] Test asserts branding is byte-for-byte exact and independent of facility name (legal or override).
- [ ] Validated data + manual inputs render into the report body, with facility name under "Name of Facility" only.

## Phase 5 — Error-path hardening

- [ ] Invalid CCN, network failure, and missing-field paths each surface a clear, tested user-facing outcome.
- [ ] No error path is swallowed silently; each has a dedicated test.

## Phase 6 — PDF export

- [ ] One "Download PDF" button triggers a direct browser download of a print-ready document.
- [ ] PDF is generated with `@react-pdf/renderer` only (no `html2canvas`, no `jsPDF`).
- [ ] PDF includes a clickable `<Link>` to `https://www.medicare.gov/care-compare/details/nursing-home/{CCN}`.
- [ ] PDF uses the same Zod-validated data; banner and body rules hold in the PDF.
- [ ] PDF generation has tests covering the happy path and at least one error path.

## Phase 7 — Deployment & end-to-end verification

- [ ] Full flow (CCN input → fetch → validate → manual inputs → render → PDF) works end-to-end on CCN `686123`.
- [ ] Live hosted URL is reachable alongside the public repo; any engineering assumptions documented in the README.
- [ ] All invariants re-verified; `npm run verify:full` (verify + build) is green.

## Bonus (optional, after MVP)

- [ ] All 12 hospitalization/ED metrics (STR→Short-Stay, LT→Long-Stay) with state/national averages.
- [ ] `.docx` export button; responsive data cards / charts.
