---
status: partial
phase: 07-visualizations-polish
source: [07-VERIFICATION.md]
started: 2026-06-21T00:30:00Z
updated: 2026-06-21T00:30:00Z
---

## Current Test

[awaiting human testing — both items are code-verified; need specific live facilities]

## Tests

### 1. Leading-zero CCN preserved end-to-end
expected: Submit a real CCN with a leading zero on https://infinite-medelite.vercel.app; the leading zero is preserved (not stripped) in the web preview, the downloaded PDF, and the downloaded .docx. (Code is sound — CCN is `z.string()` with no numeric coercion — but not yet tested with an actual leading-zero facility on the live URL.)
result: [pending]

### 2. N/A suppression renders correctly
expected: Submit a facility with at least one suppressed (null) star rating; grey "N/A" (no glyphs, not 0/5, not ☆☆☆☆☆) appears in the web preview, PDF, and .docx. (Structurally proven by PdfStarRating.test.ts + `=== null` guards (D-06), but no specific null-rating facility was tested on the deployed URL.)
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
