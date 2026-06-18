---
status: partial
phase: 04-pdf-export
source: [04-VERIFICATION.md]
started: 2026-06-18T01:34:00Z
updated: 2026-06-18T01:40:00Z
---

## Current Test

[awaiting human testing]

## Setup (applies to tests 1–5)

Load CCN **686123**, then enter all six manual fields before exporting (so no manual field renders blank). Reference values:

- EMR: **PCC**
- Current Census: **112**
- Type of Patient: **Long-term & Short-term**
- Previous Coverage from Medelite: **Yes**
- Previous Provider Performance from Medelite: **About 30 patients/day**
- Medical Coverage: **Optometry, PCP, Podiatry**

## Tests

### 1. PDF body — exact label text and reference order (not just "populated")
expected: All 13 rows render in the exact reference order with the exact reference label text — a reorder or reworded label is a failure even when values are present. Order and labels, verbatim:
  1. Name of Facility
  2. Location
  3. EMR
  4. Census Capacity
  5. Current Census
  6. Type of Patient
  7. Previous Coverage from Medelite
  8. Previous Provider Performance from Medelite
  9. Medical Coverage
  10. Overall Star Rating
  11. Health Inspection
  12. Staffing
  13. Quality of Resident Care
  Quirks that must hold: "Health Inspection" and "Staffing" carry NO "Rating" suffix; the quality row reads "Quality of Resident Care" (NOT "Quality Care") even though the domain field is `qualityCare`; the manual fields are interleaved early (rows 3, 5–9), not grouped at the end; row 8 keeps the "from Medelite" suffix. Any suppressed CMS value (e.g. a null star rating or null Census Capacity) shows the exact string "N/A" — never a blank cell. Footer renders a single line: "CMS processing date: <date>".
result: [pending]

### 2. Clickable Medicare link in PDF viewer
expected: The footer link "View official CMS profile on Medicare.gov" is clickable and opens https://www.medicare.gov/care-compare/details/nursing-home/686123 in a browser.
result: [pending]

### 3. PDF text is selectable, not rasterized
expected: In the PDF viewer, select and search the body text and the link. The body field text and the Medicare link highlight/copy as real text (not a flattened image). This proves the @react-pdf vector-text render path (the no-html2canvas/jsPDF rule); a rasterized page would also make test 2's clickable link impossible.
result: [pending]

### 4. PDF content matches web preview — character-for-character
expected: Side-by-side, every field value is identical between the web preview and the downloaded PDF — same manual inputs, same star ratings, same Location, same Census Capacity. Suppressed CMS values show the exact string "N/A" in BOTH surfaces, character-for-character (the em dash "—" is the placeholder for blank *manual* fields only and must not appear for suppressed CMS values; with all manual fields filled per Setup, "N/A" is the only placeholder that should appear). The footer "CMS processing date: <date>" is identical in both.
result: [pending]

### 5. Static branding survives a name override (the actual no-overwrite failure path)
expected: Set a name override (e.g. "ZZZ Test Facility") and generate. The header still reads exactly "INFINITE — Managed by MEDELITE" / "FACILITY ASSESSMENT SNAPSHOT" / "FL". The override string "ZZZ Test Facility" appears ONLY in the body under "Name of Facility" — never in the header block. (Testing with the default CMS name is the easy case; the override path is where a leak into the header would actually occur.)
result: [pending]

### 6. Download button states (D-07) — re-enables on success AND failure
expected: On click the button immediately disables and the label changes to "Generating…" for the duration of the request. It re-enables with the "Download PDF" label afterward in BOTH outcomes — a successful download and a failed generate — so a failure never leaves the button stuck disabled.
result: [pending]

### 7. Inline error on failure (D-08) — action-local, distinct from lookup errors
expected: On an export failure, a small red message "Couldn't generate PDF — try again." appears below the button; the button stays enabled for retry; no top ErrorBanner appears. Confirm this is the deliberate distinction (not an inconsistency with the Phase-3 banner): a PDF-generation failure is feedback on the action the user just clicked, so it sits action-local at the button, whereas CMS lookup/input/system-status errors render in the top ErrorBanner.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
