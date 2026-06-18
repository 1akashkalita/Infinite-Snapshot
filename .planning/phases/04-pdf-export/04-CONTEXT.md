# Phase 4: PDF Export - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 turns the existing live web preview into a **downloadable, print-ready PDF**. The PDF is rendered **server-side** with `@react-pdf/renderer` from the **same shared `ReportViewModel`** that drives the web preview, carrying the static branding header, the 13-field report body, and a clickable Medicare Care Compare link — and the user gets it via a "Download PDF" button that triggers a direct browser download.

In scope (PDF-01/02/03):
- A `ReportPDF` document (react-pdf primitives) that reproduces the web preview's content + layout.
- Swapping the existing `POST /api/export/pdf` 501 stub for a real `renderToBuffer` response.
- A "Download PDF" button in the UI that POSTs the assembled view-model and triggers a direct file download (no pop-up/redirect).
- A clickable hyperlink in the PDF to `https://www.medicare.gov/care-compare/details/nursing-home/{CCN}`.
- Tests: route returns a buffer, correct `Content-Type`/`Content-Disposition`, Medicare URL present in the buffer; `npm run verify:full` green.

Out of scope (later phases — do NOT pull in):
- Claims-based hospitalization/ED metrics section in the PDF → **Phase 5** (CLM-01/02/03).
- `.docx` export → **Phase 6** (DOCX-01).
- Star-rating visual cards / charts in the PDF via react-pdf SVG primitives / react-pdf-charts, the 300ms debounce, and the full "Looks Done But Isn't" Vercel checklist → **Phase 7** (VIZ-01/02).
- A registered custom/brand font (see D-03 — built-in fonts this phase; custom font is a Phase-7 polish item).

</domain>

<decisions>
## Implementation Decisions

### Layout & rendering fidelity
- **D-01: Faithful paper replica of the web preview.** The PDF mirrors `ReportPreview.tsx` 1:1 — centered **static header block** (`platformLine` / `reportTitle` / `stateLine`), the **same 13 body fields in the same verbatim label order** locked in Phase 3 (D-03), divider lines between sections, and a footer showing the **CMS processing date**. This is the strongest guarantee for PDF-03 ("content matches preview") and RPT-02 (single shared model). ⚠️ **react-pdf has flexbox but NO CSS grid** — the preview's two-column `<dl>` label/value rows must be **rebuilt as flexbox `<View>` rows** (label left, value right), not ported as grid. Number/null fields render through the same N/A semantics as the formatters (real `0` ≠ missing; never `||`/`!` fallback).
- **D-02: Page format = US Letter, portrait** (8.5×11 in) — the US standard for a US nursing-home / Medelite report.
- **D-03: Typography = react-pdf built-in standard fonts (Helvetica family); NO `Font.register` this phase.** (This area was delegated to Claude's discretion — decision recorded here.) Rationale: PITFALLS.md #5 documents `Font.register` silently falling back to the wrong font **only on Vercel**, and ROADMAP SC#4 requires the **deployed** PDF to match the preview. Built-in fonts guarantee local==Vercel parity with zero render-time network dependency. A registered Google-CDN font (https TTF/WOFF) is real polish but the riskiest thing to introduce on the live deploy → **deferred to Phase 7**.

### Medicare link (PDF-02)
- **D-04: Dedicated, styled, clickable link line near the footer.** Render `vm.facility.careCompareUrl` via react-pdf `<Link src={...}>` as a styled line (blue + underlined) labeled **"View official CMS profile on Medicare.gov"**. The URL is already computed in the model — do NOT recompute or reconstruct it. Must be a real clickable PDF link annotation, verified **in an actual PDF viewer** (not just present as text).

### Download UX (PDF-01)
- **D-05: Trigger = client `fetch` POST → blob → silent anchor download.** The button POSTs the assembled `ReportViewModel` to the existing `POST /api/export/pdf`, receives the PDF as a `Blob`, then `URL.createObjectURL` + a programmatic `<a download>` click + revoke. No navigation, no new tab, no pop-up (SC#1). Generation stays **server-side** (rule #7); the client never imports `@react-pdf/renderer`.
- **D-06: Filename = `<slug(displayName)>-Snapshot.pdf`, fallback `<CCN>-Snapshot.pdf`.** Slug the **override-aware `displayName`** (spaces → `-`, strip commas/slashes/unsafe chars, collapse repeats). **Edge-case fallback** — when `displayName` is blank/whitespace OR the slug empties out — use the CCN: `686123-Snapshot.pdf`. Set server-side via `Content-Disposition: attachment; filename=...` derived from the **validated model** (the route already has `displayName` + `ccn`).
- **D-07: Button states.** Disabled + "Generating…" label while the request is in flight; re-enabled after. Also disabled until a successful facility fetch exists (no view-model = nothing to export).
- **D-08: Failure UX = inline message by the button; keep button enabled to retry.** On any export failure (400 invalid body, 5xx render error, network drop), show a small inline error beside/below the Download button (e.g. "Couldn't generate PDF — try again"). Do **NOT** route through the top `ErrorBanner` (that's for CMS lookup errors, Phase-3 D-07) — export errors stay local to the action the user took.

### Route implementation (mostly locked — noted so the planner doesn't re-decide)
- **D-09: Real `renderToBuffer` in `POST /api/export/pdf`.** Replace the current 501 stub with `renderToBuffer(<ReportPDF vm={parseResult.data} />)`, returning the buffer with `Content-Type: application/pdf` + the D-06 `Content-Disposition`. **Keep** the existing `ReportViewModelSchema.safeParse` body validation and the clean-envelope discipline (no Zod internals in the response — D-05). Import `renderToBuffer` **directly** in the route (Node runtime; route is already `runtime = "nodejs"`). Never import `@react-pdf/renderer` into a `"use client"` component (T-03-09 / PITFALLS.md #4). `serverExternalPackages: ["@react-pdf/renderer"]` is **already configured** in `next.config.ts` — do not re-add.

### Claude's Discretion
- **PDF component structure** — e.g. `src/components/pdf/ReportPDF.tsx` (+ sub-components for header / body-row / footer / link) or under `src/lib/pdf/`. **Must preserve the rule-#2 separation:** a Header component that receives only header strings / state — never `displayName`; the facility name lives only in the body.
- **`StyleSheet.create` details** — margins, spacing, font sizes, divider color — to approximate the preview's Tailwind look within built-in fonts (D-03).
- **Download button component + placement** — likely a `DownloadPdfButton` in the `SnapshotApp` left pane that reads the already-assembled `vm` from state; exact naming/placement is open.
- **Slug helper** — a small pure, unit-tested function (location open) implementing D-06.
- **Multi-page handling** — with 13 fields the report is one page; rely on react-pdf auto-pagination if content ever grows. No manual page breaks needed this phase.
- **PDF document metadata** (`<Document title=...>`) — optional nicety; fine to set Title to the displayName/snapshot if trivial.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative spec & rules
- `CLAUDE.md` (repo root) — standing rules: **#7 PDF uses `@react-pdf/renderer` only** (never html2canvas/jsPDF) + the clickable Care Compare `<Link>` requirement; **#2 static header** (facility name body-only); #1 verify gate; #4 Zod validation. Field-mapping table = body field list.
- `medelite-report/AGENTS.md` — **Next.js 16 caveat**: read the relevant guide in `medelite-report/node_modules/next/dist/docs/` before writing/changing Next.js code (route handlers / `Response` / streaming for the PDF route).

### Planning artifacts
- `.planning/ROADMAP.md` §"Phase 4: PDF Export" — goal + 5 success criteria (esp. SC#4 deployed-PDF==preview, SC#5 route-handler test assertions).
- `.planning/REQUIREMENTS.md` — PDF-01 (Download PDF / react-pdf), PDF-02 (clickable Medicare link), PDF-03 (PDF matches preview); RPT-02 (single shared view-model).
- `.planning/phases/03-web-ui-core-flow-deployment/03-CONTEXT.md` — D-02 (paper-like preview set the PDF==preview expectation), D-03 (verbatim body field order/labels the PDF must match), D-07 (existing ErrorBanner pattern — which export errors must NOT reuse, per D-08 here).
- `.planning/phases/02-api-routes-view-model-config/02-CONTEXT.md` — the `POST /api/export/pdf` stub contract (D-20/D-21 body validation, D-25 nodejs runtime + `serverExternalPackages`), `ReportViewModel`/`assembleViewModel`, `careCompareUrl` (D-16), `assembleHeader` (rule #2).

### Research (read before writing PDF code)
- `.planning/research/PITFALLS.md` — **#4** (`serverExternalPackages` / never import react-pdf client-side / `renderToBuffer` in route handler), **#5** (font registration silently fails on Vercel — basis for D-03), **#13** (header branding must never carry the facility name), Performance Traps (cold start acceptable; subset fonts), "Looks Done But Isn't" checklist (open the PDF in a viewer, verify font + link on Vercel — not just localhost).
- `.planning/research/ARCHITECTURE.md` — single shared `ReportViewModel` → preview/PDF/docx; PDF via `renderToBuffer`. ⚠️ do NOT copy CMS field names from it (memory-sketched, wrong).
- `.planning/research/STACK.md` — `@react-pdf/renderer ^4.5.1` (React 19 compatible).

### Source files (the Phase-4 integration seam)
- `medelite-report/src/app/api/export/pdf/route.ts` — the stub to convert (validates `ReportViewModelSchema`, returns 501 → replace with `renderToBuffer`); already `runtime = "nodejs"`.
- `medelite-report/src/lib/report/view-model.ts` — `ReportViewModel` / `ReportViewModelSchema` (the PDF's input contract) + `careCompareUrl` (PDF-02 target, hardened to https://www.medicare.gov).
- `medelite-report/src/components/ReportPreview.tsx` — **the layout the PDF replicates** (D-01): static header block + the 13-field body order with verbatim labels + processing-date footer + N/A semantics.
- `medelite-report/src/lib/report/format.ts` — null-safe formatters (`formatRating/Beds/Location/Date`); the PDF reuses the same rendering semantics (real `0` ≠ N/A).
- `medelite-report/src/lib/report/header.ts` — `assembleHeader(state)`; the static header in the PDF (rule #2 — no facility-name arg).
- `medelite-report/src/components/SnapshotApp.tsx` — owns the assembled `vm` in state; where the Download button + its inline error live (left pane).
- `medelite-report/next.config.ts` — confirms `serverExternalPackages: ["@react-pdf/renderer"]` already present (do not re-add).

### External
- CMS Care Compare profile URL pattern (already in `careCompareUrl`): `https://www.medicare.gov/care-compare/details/nursing-home/{CCN}`. Test facility CCN **686123** (Kendall Lakes, FL).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`POST /api/export/pdf` stub** — already validates the body against `ReportViewModelSchema` and emits clean error envelopes; Phase 4 only swaps the 501 for `renderToBuffer` + headers (D-09).
- **`ReportViewModel` + `assembleViewModel`** — the PDF renders straight from the already-assembled, already-validated model; no new data shape. `careCompareUrl` for PDF-02 is already in it.
- **`ReportPreview.tsx`** — the exact content + label order + N/A semantics to reproduce (D-01). It IS the reference (no external reference report ever landed in the repo).
- **Formatters (`format.ts`)** — same null-safe rendering rules (real `0` preserved) so PDF values match the preview.
- **`SnapshotApp` state** — `vm` is already computed in component state; the Download button reads it directly (no re-fetch, no re-assemble).

### Established Patterns
- Next.js 16 App Router; route handlers are server/Node-only — `renderToBuffer` imported directly there. Read `node_modules/next/dist/docs` guides first (AGENTS.md).
- TypeScript strict + `isolatedModules` (every `.ts` needs import/export); `@/*` alias; Tailwind v4 (web only — PDF uses `StyleSheet.create`); Vitest node env (`tests/**/*.test.ts`, `src/**/*.test.ts`).
- `npm run verify` gate (typecheck → lint → format:check → test); **Phase 4 closes on `verify:full`** (adds `next build`) per ROADMAP SC#5 — build catches react-pdf bundling regressions (PITFALLS #4).
- Server-only module discipline (T-03-09): `@react-pdf/renderer` must never reach a `"use client"` bundle — `next build` errors if it does.

### Integration Points
- `SnapshotApp` (left pane) → `DownloadPdfButton` reads `vm` → `fetch` POST `/api/export/pdf` → blob → anchor download (D-05); inline error on failure (D-08).
- `POST /api/export/pdf` → `renderToBuffer(<ReportPDF vm={validated} />)` → `application/pdf` + `Content-Disposition` filename (D-06/D-09).
- `ReportPDF` consumes `ReportViewModel`; its `<Header>` gets header strings only (rule #2); body rows + `<Link>` mirror `ReportPreview`.
- Vercel: Root Dir `medelite-report`; built-in fonts (D-03) avoid the Vercel font footgun on deploy.

</code_context>

<specifics>
## Specific Ideas

- Demo/test facility **CCN 686123** (Kendall Lakes, FL) — the live "Download PDF" must work end-to-end on it; opened PDF must show the clickable Medicare link to `.../nursing-home/686123` (SC#3) and content matching the preview (SC#4).
- Exact Medicare link label: **"View official CMS profile on Medicare.gov"**, blue + underlined, near the footer (D-04).
- Exact filename: `<slug(displayName)>-Snapshot.pdf`; fallback `686123-Snapshot.pdf` when the name is blank/slug-empty (D-06).
- Built-in **Helvetica** for the PDF (D-03) — no `Font.register` this phase.
- US Letter portrait (D-02).

</specifics>

<deferred>
## Deferred Ideas

- **Registered custom/brand font** (Google-CDN https TTF/WOFF) for extra polish → **Phase 7** (Visualizations & Polish), where the live-deploy font verification belongs. Built-in fonts ship in Phase 4 (D-03).
- **Claims-based metrics section in the PDF** (the 12 hospitalization/ED data points, garbled reference labels) → **Phase 5**. The `ReportViewModel.hospMetrics` slot already exists for it.
- **Star-rating visual cards / charts in the PDF** via react-pdf SVG primitives / react-pdf-charts → **Phase 7** (VIZ-02). Phase 4 renders ratings as formatted text, matching the current preview.
- **`.docx` export** (Download DOCX button) → **Phase 6** (DOCX-01).
- **Full "Looks Done But Isn't" Vercel smoke checklist + 300ms debounce** → **Phase 7**. Phase 4 still verifies its own PDF (font + clickable link) in a real viewer on the deploy.
- **Client-side `PDFDownloadLink`/`PDFViewer`** — explicitly NOT used; we generate server-side via `renderToBuffer` (rule #7 + PITFALLS #4). Recorded so no one reaches for the client-side path.

None of the above is scope creep into Phase 4 — they are downstream consumers/polish on top of this phase's PDF.

</deferred>

---

*Phase: 4-PDF Export*
*Context gathered: 2026-06-18*
