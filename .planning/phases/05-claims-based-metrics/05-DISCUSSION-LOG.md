# Phase 5: Claims-Based Metrics - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 5-Claims-Based Metrics
**Areas discussed:** Reference labels source, Section layout & placement, Fetch resilience, Suppressed & partial data

---

## Reference labels source

### Q1 — Reference report availability

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — I'll add it | User has the reference; transcribe exact labels/order from it | ✓ |
| No — reconstruct labels | Reconstruct from CLAUDE.md fragments + measure descriptions | |
| Partial — I'll describe it | User describes wording in chat | |

**User's choice:** Yes — added two files (asked which repo location). Guided to `.planning/reference/`; files were in `~/Downloads/` and copied into the repo: `Facility Assessment Snapshot.docx` (template — authoritative labels/order) + `Kendall Lakes Healthcare and Rehab Center.pdf` (CMS source profile). DOCX extracted cleanly via `textutil`.
**Notes:** This made the rest of the discussion concrete — the template turned out to dictate layout, not just labels.

### Q2 — Handling ambiguous labels

| Option | Description | Selected |
|--------|-------------|----------|
| Reference is gospel | Transcribe legible text, fall back + flag for unreadable | |
| Reference + clean up obvious typos | Correct broken labels silently | |
| Ask me per ambiguous label | Pause and check the user on each unreadable label | ✓ |

**User's choice:** Ask me per ambiguous label.
**Notes:** Moot in practice — all 12 labels extracted legibly.

---

## Section layout & placement

### Q1 — Visual structure (initial, before viewing reference)

| Option | Description | Selected |
|--------|-------------|----------|
| Clean benchmark table | 4-col Measure/Facility/National/State | ✓ (blind) |
| Reference-faithful flat lines | Mirror garbled label/value lines | |
| Hybrid: clean grid + verbatim row labels | Grid with verbatim labels | |

**User's choice (initial):** Clean benchmark table — then immediately asked to "view the reference snapshot" before locking placement.

### Q1b — Row label wording

| Option | Description | Selected |
|--------|-------------|----------|
| Verbatim reference labels | Garbles preserved | ✓ |
| Cleaned readable labels | Readable wording, diverges from CLM-03 | |
| Decide once reference is in | Defer | |

**User's choice:** Verbatim reference labels.

### Q1c — RECONCILE after viewing the reference (.docx revealed a flat list, not a table)

| Option | Description | Selected |
|--------|-------------|----------|
| Match reference flat list | 12 verbatim rows continue the existing `<dl>`; chart → Phase 7 | ✓ |
| Clean table (override reference) | Use the 4-col table; soften CLM-03 | |
| Flat list + light grouping | Verbatim labels + per-measure sub-headings | |

**User's choice:** Match reference flat list — **supersedes** the earlier blind "clean benchmark table" pick.
**Notes:** The template is a single flat 2-column list; the 12 claims rows simply follow "Quality of Resident Care". Existing 13-field body order already matches the template exactly. Garbles confirmed (rows 16/22 "State National Avg." = state; row 23 bare "ED Visit" = LT ED facility). Polished benchmark chart deferred to Phase 7.

---

## Fetch resilience

### Q1 — Behavior when provider OK but claims/averages fail

| Option | Description | Selected |
|--------|-------------|----------|
| Degrade gracefully | Core + exports still render; metrics show unavailable; parallel allSettled | ✓ |
| All-or-nothing | Any fetch failure fails the whole request | |
| Core fails only on provider | Same as degrade, stated as explicit rule | |

**User's choice:** Degrade gracefully.

### Q2 — Where the claims+averages fetches live

| Option | Description | Selected |
|--------|-------------|----------|
| Extend GET /api/facility | One route fans out to 3 datasets; view-model assembled once | ✓ |
| Separate metrics endpoint | Client lazy-loads metrics; two-stage view-model | |

**User's choice:** Extend GET /api/facility.

### Q3 — Whole-section-failure presentation

| Option | Description | Selected |
|--------|-------------|----------|
| One concise line | Single "temporarily unavailable" line | ✓ |
| Hide the section | No claims rows at all | |
| 12 placeholder rows | All 12 labels with "Unavailable" values | |

**User's choice:** One concise line.

---

## Suppressed & partial data

### Q1 — Partial / suppressed behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Always 12 rows, fixed | Missing/suppressed facility row shows suppressed text; averages still render | ✓ |
| Only present measures | Drop all 3 rows for a missing measure | |

**User's choice:** Always 12 rows, fixed.

### Q2 — Suppressed-value copy precision

| Option | Description | Selected |
|--------|-------------|----------|
| Footnote-aware messages | Map each footnote code to an accurate message + generic fallback | ✓ |
| Single locked string | "Not reported (small sample)" for every suppression | |
| Two-tier | Small-sample for footnote 9; generic "Not reported" otherwise | |

**User's choice:** Footnote-aware messages (traced to NH_Data_Dictionary Table 15).

---

## Claude's Discretion

- Numeric formatting/units: reuse existing `formatPercent` (1 dp) / `formatRate` (2 dp).
- `hospMetrics` view-model schema shape (must live inside `ReportViewModelSchema`; round-trips through the PDF/DOCX POST).
- Averages join mechanics (state→`state_or_nation`; match columns by description).
- Re-confirm dataset IDs (`ijh5-nb2v`, `xcdc-v8bm`) via the CMS metastore before writing schemas (rule #3).

## Deferred Ideas

- Polished benchmark table/chart/cards for the 12 metrics → Phase 7 (VIZ-01/02).
- `.docx` claims section → Phase 6 (DOCX-01).
- OBSERVATION (out of Phase 5 scope): template hints "Current Census" = CMS `average_number_of_residents_per_day` and "Previous Provider Performance" = "<number> Patients per day"; both currently manual (locked Phase 3 D-12). Future reconciliation only.
- v2 benchmarks (BENCH-01/02).
