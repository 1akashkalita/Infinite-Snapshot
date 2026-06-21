# Design Spec: High-Fidelity Design Polish

**Date:** 2026-06-20  
**Scope:** Web UI + PDF export (both surfaces)  
**Direction:** Clinical / Healthcare — healthcare blue palette, branded but professional  
**Approach:** Shared design token file drives consistent styling across web and PDF renderers

---

## Goals

Apply a high-fidelity visual polish to both the web UI and the PDF export without changing any business logic, data layer, routing, or branding content. The result should feel like a designed product, not a default Tailwind scaffold.

### Hard constraints

- The **INFINITE logo image** (`INFINITE_LOGO_DATA_URI` from `src/lib/report/logo.ts`) is the single source of the INFINITE brand mark. It must appear unchanged in both the web preview and PDF header. No text substitution, no placeholder.
- The static header block — logo, `"FACILITY ASSESSMENT SNAPSHOT"`, state abbreviation — is unchanged in content. Only its visual container is styled.
- `assembleHeader()` is not touched.
- All Zod schemas, view-model, API routes, and business logic are out of scope.
- `src/lib/report/colors.ts` (star band + chart series colors) is out of scope — those are data-visualization color systems, not brand tokens.

---

## Design Language

### Color palette

| Token name | Hex | Role |
|---|---|---|
| `BRAND_NAVY` | `#023e8a` | Primary brand — header bg (PDF), section headers, label text, download button |
| `BRAND_BLUE` | `#0077b6` | Accent — CCN button, active toggle, focus rings, Medicare link |
| `BRAND_SKY` | `#0369a1` | Secondary label text for metric rows |
| `PAGE_BG` | `#eef2f7` | App page background |
| `CARD_BG` | `#ffffff` | Left pane + right pane card surface |
| `SECTION_BG` | `#f0f9ff` | CCN lookup panel, metric row alternate, input bg |
| `INPUT_DISABLED_BG` | `#f8fafc` | Disabled form fields |
| `ROW_TINT` | `#e0f2fe` | Even-indexed table rows (both web preview and PDF) |
| `ROW_WHITE` | `#ffffff` | Odd-indexed table rows |
| `BORDER_BLUE` | `#bae6fd` | Table borders inside tinted areas, CCN input border |
| `BORDER_LIGHT` | `#e2e8f0` | Table borders inside white rows, form input borders |
| `TEXT_PRIMARY` | `#1e293b` | Body values in table rows |
| `TEXT_SECONDARY` | `#64748b` | Subtitles, section labels, placeholder text |
| `TEXT_LABEL` | `#023e8a` | Bold label cells in table (same as BRAND_NAVY) |

### Typography (web)

- Page font: inherits Geist Sans (`--font-geist-sans`) already set in `globals.css`
- Section labels: `text-[9px] font-semibold uppercase tracking-widest text-[#64748b]`
- Form field labels: `text-[9px] font-semibold uppercase tracking-[.06em] text-[#64748b]`
- Table label cells: `font-bold text-[#023e8a]`
- Table value cells: `italic text-[#1e293b]`

### Typography (PDF)

- PDF uses Helvetica built-ins (no Font.register — PITFALLS #5)
- Label cells: `fontFamily: "Helvetica-Bold"`, `color: "#023e8a"`
- Value cells: `fontFamily: "Helvetica-Oblique"`, `color: "#1e293b"`
- Metric labels: `color: "#0369a1"`

### Shadows (web only)

Both panes use the same shadow: `box-shadow: 0 2px 8px rgba(0,60,120,0.08), 0 8px 24px rgba(0,60,120,0.04)` applied via Tailwind arbitrary value or inline style.

### Gradient (web only)

`background: linear-gradient(135deg, #023e8a, #0077b6)` — used for:
- Left pane logo container
- CCN Generate button
- Web preview report header block  

**PDF note:** `@react-pdf/renderer` does not support `linear-gradient`. The PDF header uses solid `backgroundColor: "#023e8a"` (BRAND_NAVY). Same color family, renderer-appropriate treatment.

---

## Implementation: New File

### `src/lib/ui/design-tokens.ts` (new)

A flat export of all color and structural constants above as typed `const` strings. Both web components (Tailwind arbitrary values / inline styles) and the PDF renderer (`StyleSheet.create`) import from this file.

```ts
export const BRAND_NAVY    = "#023e8a";
export const BRAND_BLUE    = "#0077b6";
export const BRAND_SKY     = "#0369a1";
export const PAGE_BG       = "#eef2f7";
export const CARD_BG       = "#ffffff";
export const SECTION_BG    = "#f0f9ff";
export const INPUT_DISABLED_BG = "#f8fafc";
export const ROW_TINT      = "#e0f2fe";
export const ROW_WHITE     = "#ffffff";
export const BORDER_BLUE   = "#bae6fd";
export const BORDER_LIGHT  = "#e2e8f0";
export const TEXT_PRIMARY  = "#1e293b";
export const TEXT_SECONDARY = "#64748b";
// TEXT_LABEL = BRAND_NAVY (alias, not re-exported to avoid drift)
```

This file must have an `export` so TypeScript's `isolatedModules` is satisfied.

---

## Implementation: Files Modified

### 1. `src/components/SnapshotApp.tsx`

- Outer wrapper: `bg-[#eef2f7]` (PAGE_BG), `min-h-screen`, `p-6`
- Left pane: white card, `rounded-xl`, shadow class, `overflow-hidden`, `flex flex-col`
- Right pane: white card, `rounded-xl`, shadow class, `overflow-hidden`
- Logo area inside left pane: gradient container (`bg-gradient-to-br from-[#023e8a] to-[#0077b6]`, `rounded-lg`, `p-4`) wrapping the `<img>` logo — logo stays centered inside the gradient block
- Subtitle text: `text-xs text-[#64748b]`

### 2. `src/components/CCNSearchBar.tsx`

- Input container: `bg-[#f0f9ff] rounded-lg p-3 border border-[#bae6fd]`
- Section label above: `text-[9px] font-semibold uppercase tracking-widest text-[#0369a1]`
- Input field: `border border-[#bae6fd] rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6]`
- Submit button: `bg-gradient-to-br from-[#023e8a] to-[#0077b6] text-white rounded-md py-2 font-semibold text-xs tracking-wider w-full`
- Inline error: unchanged styling (functional, not brand)

### 3. `src/components/ManualInputsForm.tsx`

- Remove `border border-zinc-200 rounded-lg p-4 bg-white` fieldset; replace with unstyled container (the left pane card provides the surface)
- Legend → section label div: `text-[9px] font-semibold uppercase tracking-widest text-[#64748b] mb-2 px-1`
- Field labels: `text-[9px] font-semibold uppercase tracking-[.06em] text-[#64748b] mb-1`
- Inputs: `border border-[#e2e8f0] rounded-md px-3 py-1.5 text-sm text-[#1e293b] bg-white placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] disabled:bg-[#f8fafc] disabled:text-[#94a3b8]`
- Select (previousCoverage): same border/focus/disabled pattern as inputs
- No layout change — field order and `disabled` prop unchanged

### 4. `src/components/ExportControls.tsx`

- Format toggle pill group: `border border-[#bae6fd] rounded-lg overflow-hidden flex`
  - Active tab: `bg-[#0077b6] text-white font-semibold text-xs tracking-wider px-4 py-2`
  - Inactive tab: `bg-white text-[#64748b] text-xs tracking-wider px-4 py-2`
- Download button: `bg-[#023e8a] text-white rounded-lg py-2.5 text-xs font-bold tracking-wider w-full disabled:opacity-50`
- Inline export error: unchanged (functional)

### 5. `src/components/ErrorBanner.tsx`

No structural change. Styling update: `rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-800 text-sm` (minor border-radius bump for card consistency).

### 6. `src/components/ReportPreview.tsx`

**Header block** (replaces the `<img>` + plain title rendering):  
- Gradient container: `bg-gradient-to-br from-[#023e8a] to-[#0077b6] rounded-t-none p-5 text-center` (sits flush at top of right pane card)
- Logo `<img>` centered inside, white opacity filter not needed — logo already renders on dark bg correctly
- `vm.header.reportTitle` ("FACILITY ASSESSMENT SNAPSHOT"): `text-white font-bold tracking-widest text-xs mt-2`
- `vm.header.stateLine`: `text-white/60 text-xs tracking-wider`

**Table rows:**
- Even rows (index % 2 === 0): `bg-[#e0f2fe]`, border `border-[#bae6fd]`
- Odd rows: `bg-white`, border `border-[#e2e8f0]`
- `LABEL_CELL`: `border px-3 py-2 font-bold text-[#023e8a] w-2/5` + appropriate border color class per row parity
- `VALUE_CELL`: `border px-3 py-2 italic text-[#1e293b]` + appropriate border color class per row parity

**Metric section divider row:**
- `<tr>` with single `<td colspan={2}>`: `bg-[#023e8a] text-white text-[9px] font-bold tracking-widest uppercase px-3 py-1.5`

**Metric rows:**
- Even: `bg-[#f0f9ff]`, border `border-[#e0f2fe]`
- Odd: `bg-white`, border `border-[#e0f2fe]`
- Label: `font-bold text-[#0369a1] text-xs`

**Medicare link footer:**
- `bg-[#f0f9ff] border-l-4 border-[#0077b6] rounded-r-md px-3 py-2 text-xs text-[#0077b6] font-semibold mt-3`

**Skeleton** (idle/loading state): keep existing `animate-pulse` structure, update placeholder colors to `bg-[#e0f2fe]` for consistency.

### 7. `src/components/pdf/ReportPDF.tsx`

Update `StyleSheet.create({})` entries:

**Header:**
- `headerBlock`: `{ backgroundColor: "#023e8a", padding: 20, alignItems: "center" }` — solid navy (no gradient in react-pdf)
- `headerTitle`: `{ color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 9, letterSpacing: 1.2 }`
- `headerState`: `{ color: "rgba(255,255,255,0.65)", fontSize: 8, marginTop: 3 }`

**Table rows (alternating):**
- `rowEven`: `{ backgroundColor: "#e0f2fe", flexDirection: "row" }`
- `rowOdd`: `{ backgroundColor: "#ffffff", flexDirection: "row" }`
- Label cells: `{ color: "#023e8a", fontFamily: "Helvetica-Bold" }` + bottom/right border `#bae6fd` (even) or `#e2e8f0` (odd)
- Value cells: `{ color: "#1e293b", fontFamily: "Helvetica-Oblique" }` + matching borders

**Metric section header row:**
- `metricSectionHeader`: `{ backgroundColor: "#023e8a", padding: [5, 8] }`
- `metricSectionHeaderText`: `{ color: "#ffffff", fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 0.8 }`

**Metric rows:**
- `metricRowEven`: `{ backgroundColor: "#f0f9ff" }`
- `metricRowOdd`: `{ backgroundColor: "#ffffff" }`
- Metric label: `{ color: "#0369a1", fontFamily: "Helvetica-Bold" }`

**Medicare link:**
- `{ color: "#0077b6" }` on the `<Link>` text

The per-cell border pattern (top+left on table View, bottom+right on each cell) is preserved — only border color updates from `#000000` to `#bae6fd` / `#e2e8f0` based on row parity.

---

## What Does NOT Change

| Item | Reason |
|---|---|
| `src/lib/report/logo.ts` | Logo data URI is already correct |
| `src/lib/report/colors.ts` | Star band + chart series are data-viz, not brand |
| `assembleHeader()`, `assembleViewModel()` | Business logic, out of scope |
| All Zod schemas and API routes | Data layer, out of scope |
| `src/components/pdf/PdfStarRating.tsx` | Star band colors (green/amber/red) stay as-is from `STAR_BAND_HEX` |
| `src/components/pdf/PdfMiniBarChart.tsx` | Chart series colors stay as-is from `CHART_SERIES` |
| `src/components/MiniBarChart.tsx` | Web chart series colors stay as-is |
| All tests | Only style classes change, no logic or rendered text changes that break existing test assertions |

---

## Quality Gate

- `npm run verify` must stay green after every component change
- The INFINITE logo image must appear in both the web preview and the PDF — confirmed visually
- `npm run verify:full` (includes `next build`) must pass — ensure no Tailwind arbitrary values break the build
- No field labels, field values, or header text content may change — only visual styling

---

## File Checklist

| File | Action |
|---|---|
| `src/lib/ui/design-tokens.ts` | Create |
| `src/components/SnapshotApp.tsx` | Update classes |
| `src/components/CCNSearchBar.tsx` | Update classes |
| `src/components/ManualInputsForm.tsx` | Update classes |
| `src/components/ExportControls.tsx` | Update classes |
| `src/components/ErrorBanner.tsx` | Minor update |
| `src/components/ReportPreview.tsx` | Update header, rows, metric section |
| `src/components/pdf/ReportPDF.tsx` | Update StyleSheet |
