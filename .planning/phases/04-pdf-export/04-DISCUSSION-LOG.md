# Phase 4: PDF Export - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 4-PDF Export
**Areas discussed:** Layout fidelity, Medicare link, Download UX (Typography delegated to Claude)

---

## Gray-area selection

| Area | Description | Selected for discussion |
|------|-------------|-------------------------|
| Typography / fonts | Built-in Helvetica (zero-risk) vs registered Google-CDN font (polished, Vercel font footgun) | (delegated to Claude) |
| Download UX | Trigger mechanism, button states, failure feedback, filename | ✓ |
| Layout fidelity | Faithful paper replica vs print-optimized restyle (react-pdf has no CSS grid) | ✓ |
| Medicare link | Placement & labeling of the clickable Care Compare link | ✓ |

**User's choice:** Discuss Layout fidelity, Download UX, Medicare link; delegate Typography.

---

## Layout fidelity

| Option | Description | Selected |
|--------|-------------|----------|
| Faithful paper replica | Mirror the preview 1:1 — centered static header, two-column label/value rows (rebuilt with flexbox), dividers, footer with CMS processing date. Strongest PDF-03 guarantee. | ✓ |
| Print-optimized restyle | Same content, re-laid-out for print (tighter margins, possibly single-column). Diverges from on-screen preview. | |

**User's choice:** Faithful paper replica → D-01.
**Notes:** react-pdf has flexbox but no CSS grid, so the preview's `<dl>` grid rows are rebuilt as flexbox `<View>` rows.

### Page format

| Option | Description | Selected |
|--------|-------------|----------|
| US Letter, portrait | 8.5×11 in — US standard for a US nursing-home report. | ✓ |
| A4, portrait | 210×297 mm — international standard. | |

**User's choice:** US Letter portrait → D-02.

---

## Medicare link

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated labeled line | Styled, clickable "View official CMS profile on Medicare.gov" near the footer. Most obviously clickable/professional. | ✓ |
| Footer URL | Full raw URL as a clickable link in the footer. Compact but less polished. | |
| Under facility name | Clickable link beneath "Name of Facility" in the body. Competes with data rows. | |

**User's choice:** Dedicated labeled line → D-04.
**Notes:** Uses the existing `vm.facility.careCompareUrl`; must verify as a real clickable annotation in a PDF viewer (PDF-02).

---

## Download UX

### Filename

| Option | Description | Selected |
|--------|-------------|----------|
| `infinite-snapshot-{CCN}.pdf` | Stable, unambiguous, no risky chars. | |
| Facility-name based | Human-friendly; needs slugifying; reflects name override. | ✓ (modified) |
| Generic `report.pdf` | Simplest; downloads collide; less professional. | |

**User's choice (free text):** "Number 2 and for the edge cases replace it with the CCN instead so it would be like {CCN}-Snapshot.pdf" → D-06.
**Notes:** Filename = `<slug(displayName)>-Snapshot.pdf`; edge-case fallback (name blank / slug empty) → `<CCN>-Snapshot.pdf`. Set server-side via `Content-Disposition` from the validated model. Reflected back to the user and confirmed.

### Failure UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline message by the button | Small error line next to the button; button stays enabled to retry; preview undisturbed. | ✓ |
| Reuse the top ErrorBanner | Route export failure through the existing D-07 banner. Distant from button; mixes export with lookup errors. | |
| Both banner + disable button | Banner AND disable until inputs change. Heavy-handed for a retryable action. | |

**User's choice:** Inline message by the button → D-08.
**Notes:** Trigger mechanism (fetch POST → blob → anchor download, D-05) and "Generating…" disabled state (D-07) were treated as architecture-forced / discretion, not separately asked.

---

## Claude's Discretion

- **Typography (decided):** built-in Helvetica family, no `Font.register` this phase — avoids the Vercel font footgun (PITFALLS #5) and guarantees deployed-PDF==preview (SC#4). Custom CDN font deferred to Phase 7. Surfaced to the user in the summary with an explicit override offer; user proceeded.
- PDF component file structure (preserving rule-#2 header/body separation).
- `StyleSheet.create` spacing/sizing/divider styling to approximate the preview.
- Download button component naming/placement; slug helper implementation/location.
- Multi-page handling (auto-pagination); optional PDF document metadata (Title).

## Deferred Ideas

- Registered custom/brand font → Phase 7.
- Claims metrics section in the PDF → Phase 5 (`hospMetrics` slot already exists).
- Star-rating visual cards / charts in the PDF → Phase 7 (VIZ-02).
- `.docx` export → Phase 6.
- Full "Looks Done But Isn't" Vercel checklist + 300ms debounce → Phase 7.
- Client-side `PDFDownloadLink`/`PDFViewer` — explicitly not used (server-side `renderToBuffer` per rule #7 / PITFALLS #4).
