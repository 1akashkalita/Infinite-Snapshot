# Design Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a high-fidelity healthcare-blue design polish to the web UI and PDF export without changing any business logic, data, or branding content.

**Architecture:** A new `src/lib/ui/design-tokens.ts` file exports all brand color constants as strings. Web components consume these via Tailwind arbitrary values. `ReportPDF.tsx` imports the same constants into its `StyleSheet.create()` call, ensuring both surfaces share the same palette by construction. The `Row` component in `ReportPreview.tsx` gains an `isEven` prop to drive alternating row backgrounds; the PDF gains `rowEven`/`rowOdd` style variants for the same effect.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, `@react-pdf/renderer` v4, TypeScript strict, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-20-design-polish-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/ui/design-tokens.ts` | **Create** | Single source of truth for all brand/structural color constants |
| `src/components/SnapshotApp.tsx` | Modify | Page bg → `#eef2f7`, two panes → white cards with blue shadow, logo in gradient header |
| `src/components/CCNSearchBar.tsx` | Modify | `#f0f9ff` section panel, blue-border input, gradient button |
| `src/components/ManualInputsForm.tsx` | Modify | Remove fieldset border/bg, uppercase section label, updated input classes |
| `src/components/ExportControls.tsx` | Modify | Blue pill toggle, navy download button |
| `src/components/ErrorBanner.tsx` | Modify | Minor `rounded-lg` bump for card consistency |
| `src/components/ReportPreview.tsx` | Modify | Gradient header, alternating rows (even `#e0f2fe`/odd `#fff`), metric section divider, metric rows (`#f0f9ff`/`#fff`), Medicare footer |
| `src/components/pdf/ReportPDF.tsx` | Modify | Navy header, alternating row backgrounds + border colors, metric section header row, metric row colors, blue Medicare link |

---

## Task 1: Create design token file

**Files:**
- Create: `src/lib/ui/design-tokens.ts`

- [ ] **Step 1.1: Create the file**

```ts
// design-tokens.ts — Brand and structural color constants shared by web and PDF renderers.
// Web components use these as Tailwind arbitrary values (e.g. bg-[BRAND_NAVY]) or inline styles.
// ReportPDF.tsx uses them directly in StyleSheet.create() values.

export const BRAND_NAVY         = "#023e8a";
export const BRAND_BLUE         = "#0077b6";
export const BRAND_SKY          = "#0369a1";
export const PAGE_BG            = "#eef2f7";
export const SECTION_BG         = "#f0f9ff";
export const INPUT_DISABLED_BG  = "#f8fafc";
export const ROW_TINT           = "#e0f2fe";
export const METRIC_ROW_TINT    = "#f0f9ff";
export const BORDER_BLUE        = "#bae6fd";
export const BORDER_LIGHT       = "#e2e8f0";
export const BORDER_METRIC      = "#e0f2fe";
export const TEXT_PRIMARY       = "#1e293b";
export const TEXT_SECONDARY     = "#64748b";
```

- [ ] **Step 1.2: Verify TypeScript compiles (no errors)**

Run from `medelite-report/`:
```bash
npm run verify
```
Expected: all checks pass (no new exports to test yet).

- [ ] **Step 1.3: Commit**

```bash
git add medelite-report/src/lib/ui/design-tokens.ts
git commit -m "feat(design): add shared design token constants"
```

---

## Task 2: Polish SnapshotApp layout

**Files:**
- Modify: `src/components/SnapshotApp.tsx`

The left pane becomes a `w-80` white card. The right pane becomes a flex-1 white card. The outer wrapper uses the new page background. The logo `<img>` sits inside a gradient header block at the top of the left pane card.

- [ ] **Step 2.1: Update the outer wrapper and left/right pane divs**

In `SnapshotApp.tsx`, find the `return (` block. Replace the outer div and both pane divs:

**Before:**
```tsx
return (
  <div className="flex flex-col lg:flex-row gap-6 p-6 min-h-screen bg-zinc-50">
    {/* Left pane — search + (Wave 4) manual inputs */}
    <div className="flex-1 flex flex-col gap-4 max-w-sm">
      <h1>
        {/* eslint-disable-next-line @next/next/no-img-element -- data-URI logo, no Next/Image optimization needed */}
        <img
          src={INFINITE_LOGO_DATA_URI}
          alt="INFINITE — Managed by MEDELITE"
          width={INFINITE_LOGO_WIDTH}
          height={INFINITE_LOGO_HEIGHT}
        />
      </h1>
      <p className="text-sm text-zinc-500">
        Enter a CMS Certification Number (CCN) to generate a facility
        assessment snapshot.
      </p>
```

**After:**
```tsx
return (
  <div className="flex flex-col lg:flex-row gap-6 p-6 min-h-screen bg-[#eef2f7]">
    {/* Left pane — logo header + search + manual inputs + export */}
    <div className="w-full lg:w-80 flex-shrink-0 bg-white rounded-xl overflow-hidden flex flex-col"
         style={{ boxShadow: "0 2px 8px rgba(0,60,120,0.08), 0 8px 24px rgba(0,60,120,0.04)" }}>
      {/* Gradient logo header — actual INFINITE logo image inside */}
      <div className="bg-gradient-to-br from-[#023e8a] to-[#0077b6] p-5 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- data-URI logo, no Next/Image optimization needed */}
        <img
          src={INFINITE_LOGO_DATA_URI}
          alt="INFINITE — Managed by MEDELITE"
          width={INFINITE_LOGO_WIDTH}
          height={INFINITE_LOGO_HEIGHT}
          className="mx-auto"
        />
      </div>
      {/* Content area with padding */}
      <div className="flex flex-col gap-4 p-5 flex-1">
        <p className="text-xs text-[#64748b]">
          Enter a CMS Certification Number (CCN) to generate a facility
          assessment snapshot.
        </p>
```

- [ ] **Step 2.2: Close the new `<div>` content wrapper and update the right pane**

Find the closing tags of the left pane and the right pane opening tag.

**Before:**
```tsx
        <ExportControls vm={vm} />
      </div>

      {/* Right pane — paper-like preview */}
      <div className="flex-1">
        <ReportPreview vm={vm} fetchState={fetchState} />
      </div>
    </div>
  );
```

**After:**
```tsx
        <ExportControls vm={vm} />
      </div>{/* end content area */}
    </div>{/* end left pane card */}

    {/* Right pane — paper-like preview card */}
    <div className="flex-1 bg-white rounded-xl overflow-hidden"
         style={{ boxShadow: "0 2px 8px rgba(0,60,120,0.08), 0 8px 24px rgba(0,60,120,0.04)" }}>
      <ReportPreview vm={vm} fetchState={fetchState} />
    </div>
  </div>
);
```

- [ ] **Step 2.3: Verify**

```bash
npm run verify
```
Expected: all checks pass.

- [ ] **Step 2.4: Commit**

```bash
git add medelite-report/src/components/SnapshotApp.tsx
git commit -m "feat(design): polish SnapshotApp — card layout, page bg, gradient logo header"
```

---

## Task 3: Polish CCNSearchBar

**Files:**
- Modify: `src/components/CCNSearchBar.tsx`

- [ ] **Step 3.1: Read the current return JSX**

The component returns a `<form>` with a label, input, and button. The current classes use `rounded`, `border-zinc-300`, `bg-blue-600` etc. Replace the entire return block.

- [ ] **Step 3.2: Replace the form JSX**

Find the `return (` in `CCNSearchBar.tsx` and replace the JSX:

**Before:**
```tsx
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="flex flex-col gap-2"
    >
```

**After:**
```tsx
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="flex flex-col gap-2 bg-[#f0f9ff] rounded-lg p-3 border border-[#bae6fd]"
    >
      <div className="text-[9px] font-semibold uppercase tracking-widest text-[#0369a1] mb-1">
        CCN Lookup
      </div>
```

- [ ] **Step 3.3: Update the input field classes**

Find the `<input` for CCN and update its `className`:

**Before (the className on the CCN input):**
```tsx
className="rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:bg-zinc-100"
```

**After:**
```tsx
className="rounded-md border border-[#bae6fd] bg-white px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] disabled:bg-[#f8fafc] disabled:text-[#94a3b8] w-full"
```

- [ ] **Step 3.4: Update the submit button classes**

Find the submit `<button` and update its `className`:

**Before:**
```tsx
className={[
  "rounded px-4 py-2 text-sm font-semibold text-white transition-colors",
  loading
    ? "cursor-not-allowed bg-blue-300"
    : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800",
].join(" ")}
```

**After:**
```tsx
className={[
  "w-full rounded-md py-2 text-xs font-bold tracking-wider text-white transition-opacity",
  loading
    ? "cursor-not-allowed opacity-60 bg-gradient-to-br from-[#023e8a] to-[#0077b6]"
    : "bg-gradient-to-br from-[#023e8a] to-[#0077b6] hover:opacity-90 active:opacity-80",
].join(" ")}
```

- [ ] **Step 3.5: Verify**

```bash
npm run verify
```
Expected: all checks pass.

- [ ] **Step 3.6: Commit**

```bash
git add medelite-report/src/components/CCNSearchBar.tsx
git commit -m "feat(design): polish CCNSearchBar — blue panel, bordered input, gradient button"
```

---

## Task 4: Polish ManualInputsForm

**Files:**
- Modify: `src/components/ManualInputsForm.tsx`

The `<fieldset>` keeps `disabled` for D-11 behaviour but loses its visual border/bg (the left pane card is the surface now). The legend becomes a plain section label div. All inputs get the new unified field style.

- [ ] **Step 4.1: Update the fieldset and legend**

**Before:**
```tsx
  return (
    <fieldset
      disabled={disabled}
      className="space-y-3 border border-zinc-200 rounded-lg p-4 bg-white"
    >
      <legend className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-1">
        Operational Inputs
      </legend>
```

**After:**
```tsx
  return (
    <fieldset disabled={disabled} className="space-y-3">
      <div className="text-[9px] font-semibold uppercase tracking-widest text-[#64748b] mb-1">
        Facility Details
      </div>
```

- [ ] **Step 4.2: Update all field label classes**

There are 7 `<label>` elements (nameOverride, emr, currentCensus, typeOfPatient, previousCoverage, previousProviderPerformance, medicalCoverage). Change every one from:
```tsx
className="text-xs font-medium text-zinc-600"
```
to:
```tsx
className="text-[9px] font-semibold uppercase tracking-[.06em] text-[#64748b]"
```

- [ ] **Step 4.3: Update all text input classes**

Every `<input type="text">` in this form has:
```tsx
className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:bg-zinc-100 disabled:text-zinc-400"
```
Replace all of them with:
```tsx
className="w-full rounded-md border border-[#e2e8f0] bg-white px-3 py-1.5 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] disabled:bg-[#f8fafc] disabled:text-[#94a3b8]"
```

- [ ] **Step 4.4: Update the number input (currentCensus)**

The `<input type="number">` has the same zinc classes. Replace with the same class string as Step 4.3.

- [ ] **Step 4.5: Update the select (previousCoverage)**

The `<select>` has:
```tsx
className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:bg-zinc-100 disabled:text-zinc-400"
```
Replace with:
```tsx
className="w-full rounded-md border border-[#e2e8f0] bg-white px-3 py-1.5 text-sm text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] disabled:bg-[#f8fafc] disabled:text-[#94a3b8]"
```

- [ ] **Step 4.6: Verify**

```bash
npm run verify
```
Expected: all checks pass.

- [ ] **Step 4.7: Commit**

```bash
git add medelite-report/src/components/ManualInputsForm.tsx
git commit -m "feat(design): polish ManualInputsForm — remove fieldset border, blue field styles"
```

---

## Task 5: Polish ExportControls

**Files:**
- Modify: `src/components/ExportControls.tsx`

- [ ] **Step 5.1: Update the format toggle group**

Find the `role="group"` div:

**Before:**
```tsx
      <div
        role="group"
        aria-label="Export format"
        className="flex rounded-md border border-zinc-300 overflow-hidden"
      >
```

**After:**
```tsx
      <div
        role="group"
        aria-label="Export format"
        className="flex rounded-lg border border-[#bae6fd] overflow-hidden"
      >
```

- [ ] **Step 5.2: Update the toggle button classes**

The per-format button currently uses:
```tsx
className={[
  "flex-1 px-3 py-1 text-sm font-medium text-center transition-colors",
  format === f
    ? "bg-blue-600 text-white"
    : "bg-white text-zinc-700 hover:bg-zinc-50",
  loading ? "cursor-not-allowed opacity-50" : "",
].join(" ")}
```

Replace with:
```tsx
className={[
  "flex-1 px-4 py-2 text-xs font-bold tracking-wider text-center transition-colors",
  format === f
    ? "bg-[#0077b6] text-white"
    : "bg-white text-[#64748b] hover:bg-[#f0f9ff]",
  loading ? "cursor-not-allowed opacity-50" : "",
].join(" ")}
```

- [ ] **Step 5.3: Update the download button classes**

**Before:**
```tsx
        className={[
          "rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors",
          loading || !vm
            ? "cursor-not-allowed bg-blue-300"
            : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800",
        ].join(" ")}
```

**After:**
```tsx
        className={[
          "w-full rounded-lg py-2.5 text-xs font-bold tracking-wider text-white transition-opacity",
          loading || !vm
            ? "cursor-not-allowed opacity-50 bg-[#023e8a]"
            : "bg-[#023e8a] hover:opacity-90 active:opacity-80",
        ].join(" ")}
```

- [ ] **Step 5.4: Verify**

```bash
npm run verify
```
Expected: all checks pass.

- [ ] **Step 5.5: Commit**

```bash
git add medelite-report/src/components/ExportControls.tsx
git commit -m "feat(design): polish ExportControls — blue pill toggle, navy download button"
```

---

## Task 6: Polish ErrorBanner

**Files:**
- Modify: `src/components/ErrorBanner.tsx`

- [ ] **Step 6.1: Update the wrapper div class**

**Before:**
```tsx
    <div
      role="alert"
      className="rounded bg-red-50 border border-red-200 p-4 text-red-800 text-sm"
    >
```

**After:**
```tsx
    <div
      role="alert"
      className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-800 text-sm"
    >
```

- [ ] **Step 6.2: Verify**

```bash
npm run verify
```
Expected: all checks pass.

- [ ] **Step 6.3: Commit**

```bash
git add medelite-report/src/components/ErrorBanner.tsx
git commit -m "feat(design): polish ErrorBanner — rounded-lg for card consistency"
```

---

## Task 7: Polish ReportPreview

**Files:**
- Modify: `src/components/ReportPreview.tsx`

This is the most involved web change. The header becomes a full-bleed gradient block. All table rows become alternating. A navy section divider appears before the metric rows.

- [ ] **Step 7.1: Add `isEven` prop to `Row` and update cell classes**

Replace the two cell constants and the `Row` function:

**Before:**
```tsx
/** Shared cell classes — single black grid border, matching the template table. */
const LABEL_CELL =
  "border border-black px-3 py-2 align-middle font-bold text-zinc-900 w-2/5";
const VALUE_CELL =
  "border border-black px-3 py-2 align-middle italic text-zinc-900";

/** One template table row: bold label (left) + italic value (right). */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <th scope="row" className={`${LABEL_CELL} text-left`}>
        {label}
      </th>
      <td className={VALUE_CELL}>{value}</td>
    </tr>
  );
}
```

**After:**
```tsx
/** One template table row: bold label (left) + italic value (right). */
function Row({
  label,
  value,
  isEven,
}: {
  label: string;
  value: React.ReactNode;
  isEven: boolean;
}) {
  const bg = isEven ? "bg-[#e0f2fe]" : "bg-white";
  const border = isEven ? "border-[#bae6fd]" : "border-[#e2e8f0]";
  return (
    <tr className={bg}>
      <th
        scope="row"
        className={`border ${border} px-3 py-2 align-middle font-bold text-[#023e8a] w-2/5 text-left`}
      >
        {label}
      </th>
      <td className={`border ${border} px-3 py-2 align-middle italic text-[#1e293b]`}>
        {value}
      </td>
    </tr>
  );
}
```

- [ ] **Step 7.2: Add `MetricRow` component below `Row`**

Add this new component directly after the `Row` function:

```tsx
/** One metric row with lighter alternating background (SECTION_BG / white). */
function MetricRow({
  label,
  value,
  isEven,
}: {
  label: string;
  value: React.ReactNode;
  isEven: boolean;
}) {
  const bg = isEven ? "bg-[#f0f9ff]" : "bg-white";
  return (
    <tr className={bg}>
      <th
        scope="row"
        className="border border-[#e0f2fe] px-3 py-2 align-middle font-bold text-[#0369a1] text-xs w-2/5 text-left"
      >
        {label}
      </th>
      <td className="border border-[#e0f2fe] px-3 py-2 align-middle italic text-[#1e293b] text-xs">
        {value}
      </td>
    </tr>
  );
}
```

- [ ] **Step 7.3: Update the skeleton state**

Find the skeleton `return` (the `animate-pulse` block) and update placeholder colors:

**Before:**
```tsx
      <div className="mx-auto w-full max-w-[816px] bg-white rounded shadow p-8 animate-pulse space-y-4">
        <div className="h-12 bg-gray-200 rounded w-1/2 mx-auto" />
        <div className="h-5 bg-gray-200 rounded w-2/3 mx-auto" />
        <div className="h-px bg-gray-100 my-4" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 bg-gray-100 rounded w-full" />
        ))}
      </div>
```

**After:**
```tsx
      <div className="w-full animate-pulse">
        <div className="h-24 bg-[#023e8a] opacity-70" />
        <div className="p-8 space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className={`h-8 rounded ${i % 2 === 0 ? "bg-[#e0f2fe]" : "bg-[#f1f5f9]"}`}
            />
          ))}
        </div>
      </div>
```

- [ ] **Step 7.4: Update the empty (error) state**

**Before:**
```tsx
      <div className="mx-auto w-full max-w-[816px] bg-white rounded shadow p-8 text-sm text-zinc-400 min-h-[200px] flex items-center justify-center">
        Enter a CCN above to generate the report preview.
      </div>
```

**After:**
```tsx
      <div className="w-full text-sm text-[#64748b] min-h-[200px] flex items-center justify-center p-8">
        Enter a CCN above to generate the report preview.
      </div>
```

- [ ] **Step 7.5: Update the success article and header block**

**Before:**
```tsx
  return (
    <article className="mx-auto w-full max-w-[816px] bg-white rounded shadow p-8 text-sm text-zinc-800">
      {/* ... */}
      <header className="text-center space-y-1 mb-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- data-URI logo, no Next/Image optimization needed */}
        <img
          src={INFINITE_LOGO_DATA_URI}
          alt={vm.header.platformLine}
          width={INFINITE_LOGO_WIDTH}
          height={INFINITE_LOGO_HEIGHT}
          className="mx-auto"
        />
        <p className="text-base font-bold tracking-wide text-zinc-900 pt-1">
          {vm.header.reportTitle}
        </p>
        <p className="text-sm font-bold text-zinc-700">{vm.header.stateLine}</p>
      </header>
```

**After:**
```tsx
  return (
    <article className="w-full text-sm">
      {/* Gradient header — full-bleed at top of right pane card */}
      <header className="bg-gradient-to-br from-[#023e8a] to-[#0077b6] py-6 px-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- data-URI logo, no Next/Image optimization needed */}
        <img
          src={INFINITE_LOGO_DATA_URI}
          alt={vm.header.platformLine}
          width={INFINITE_LOGO_WIDTH}
          height={INFINITE_LOGO_HEIGHT}
          className="mx-auto"
        />
        <p className="text-white font-bold tracking-widest text-xs mt-2">
          {vm.header.reportTitle}
        </p>
        <p className="text-white/60 text-xs tracking-wider mt-1">
          {vm.header.stateLine}
        </p>
      </header>
      <div className="px-8 pt-4 pb-8">
```

- [ ] **Step 7.6: Update the table and add `isEven` to all 13 static rows**

**Before:**
```tsx
      <table className="w-full border-collapse border border-black">
        <tbody>
          <Row label="Name of Facility" value={f.displayName} />
          <Row label="Location" value={formatLocation(f.address)} />
          <Row label="EMR" value={m.emr ?? "—"} />
          <Row label="Census Capacity" value={formatBeds(f.certifiedBeds)} />
          <Row
            label="Current Census"
            value={m.currentCensus != null ? String(m.currentCensus) : "—"}
          />
          <Row label="Type of Patient" value={m.typeOfPatient ?? "—"} />
          <Row
            label="Previous Coverage from Medelite"
            value={m.previousCoverage ?? "—"}
          />
          <Row
            label="Previous Provider Performance from Medelite"
            value={m.previousProviderPerformance ?? "—"}
          />
          <Row label="Medical Coverage" value={m.medicalCoverage ?? "—"} />
          <Row
            label="Overall Star Rating"
            value={<StarRating rating={f.starRatings.overall} />}
          />
          <Row
            label="Health Inspection"
            value={<StarRating rating={f.starRatings.healthInspection} />}
          />
          <Row
            label="Staffing"
            value={<StarRating rating={f.starRatings.staffing} />}
          />
          <Row
            label="Quality of Resident Care"
            value={<StarRating rating={f.starRatings.qualityCare} />}
          />
```

**After:**
```tsx
      <table className="w-full border-collapse">
        <tbody>
          <Row isEven={true}  label="Name of Facility" value={f.displayName} />
          <Row isEven={false} label="Location" value={formatLocation(f.address)} />
          <Row isEven={true}  label="EMR" value={m.emr ?? "—"} />
          <Row isEven={false} label="Census Capacity" value={formatBeds(f.certifiedBeds)} />
          <Row
            isEven={true}
            label="Current Census"
            value={m.currentCensus != null ? String(m.currentCensus) : "—"}
          />
          <Row isEven={false} label="Type of Patient" value={m.typeOfPatient ?? "—"} />
          <Row
            isEven={true}
            label="Previous Coverage from Medelite"
            value={m.previousCoverage ?? "—"}
          />
          <Row
            isEven={false}
            label="Previous Provider Performance from Medelite"
            value={m.previousProviderPerformance ?? "—"}
          />
          <Row isEven={true}  label="Medical Coverage" value={m.medicalCoverage ?? "—"} />
          <Row
            isEven={false}
            label="Overall Star Rating"
            value={<StarRating rating={f.starRatings.overall} />}
          />
          <Row
            isEven={true}
            label="Health Inspection"
            value={<StarRating rating={f.starRatings.healthInspection} />}
          />
          <Row
            isEven={false}
            label="Staffing"
            value={<StarRating rating={f.starRatings.staffing} />}
          />
          <Row
            isEven={true}
            label="Quality of Resident Care"
            value={<StarRating rating={f.starRatings.qualityCare} />}
          />
```

- [ ] **Step 7.7: Add metric section divider and switch hospMetrics to MetricRow**

**Before:**
```tsx
          {vm.hospMetrics === undefined ? (
            <tr>
              <td
                colSpan={2}
                className="border border-black px-3 py-2 text-zinc-500 italic"
              >
                Hospitalization &amp; ED metrics are temporarily unavailable.
              </td>
            </tr>
          ) : (
            vm.hospMetrics.map((metric) => (
              <Row
                key={metric.label}
                label={metric.label}
                value={renderMetricValue(metric)}
              />
            ))
          )}
```

**After:**
```tsx
          {/* Metric section divider */}
          <tr>
            <td
              colSpan={2}
              className="bg-[#023e8a] text-white text-[9px] font-bold tracking-widest uppercase px-3 py-2"
            >
              Hospitalization / ED Metrics
            </td>
          </tr>

          {vm.hospMetrics === undefined ? (
            <tr>
              <td
                colSpan={2}
                className="border border-[#e0f2fe] px-3 py-2 text-[#64748b] italic text-xs"
              >
                Hospitalization &amp; ED metrics are temporarily unavailable.
              </td>
            </tr>
          ) : (
            vm.hospMetrics.map((metric, i) => (
              <MetricRow
                key={metric.label}
                isEven={i % 2 === 0}
                label={metric.label}
                value={renderMetricValue(metric)}
              />
            ))
          )}
```

- [ ] **Step 7.8: Update the Medicare footer**

**Before:**
```tsx
      <footer className="pt-3 mt-3 text-xs text-zinc-500 flex justify-between">
        <a
          href={f.careCompareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-700 underline"
        >
          View official CMS profile on Medicare.gov
        </a>
        <span>CMS dataset processing date: {formatDate(f.processingDate)}</span>
      </footer>
```

**After:**
```tsx
      <footer className="pt-3 mt-4 text-xs text-[#64748b] flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
        <a
          href={f.careCompareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-[#f0f9ff] border-l-4 border-[#0077b6] rounded-r-md px-3 py-2 text-[#0077b6] font-semibold no-underline hover:opacity-80"
        >
          View official CMS profile on Medicare.gov ↗
        </a>
        <span>CMS dataset processing date: {formatDate(f.processingDate)}</span>
      </footer>
```

- [ ] **Step 7.9: Close the new `<div className="px-8 pt-4 pb-8">` wrapper**

After the footer and before the closing `</article>`, add the missing closing div:

```tsx
      </div>{/* end px-8 body area */}
    </article>
```

- [ ] **Step 7.10: Verify**

```bash
npm run verify
```
Expected: all checks pass.

- [ ] **Step 7.11: Commit**

```bash
git add medelite-report/src/components/ReportPreview.tsx
git commit -m "feat(design): polish ReportPreview — gradient header, alternating rows, metric section"
```

---

## Task 8: Polish ReportPDF

**Files:**
- Modify: `src/components/pdf/ReportPDF.tsx`

`@react-pdf/renderer` has no CSS gradient or `border-collapse`. The border pattern keeps the existing approach (top+left on table View, bottom+right on each cell) but border colors change per row. The header uses solid `#023e8a`.

- [ ] **Step 8.1: Import design tokens**

At the top of `ReportPDF.tsx`, add the import after the existing imports:

```tsx
import {
  BRAND_NAVY,
  BRAND_BLUE,
  BRAND_SKY,
  ROW_TINT,
  METRIC_ROW_TINT,
  BORDER_BLUE,
  BORDER_LIGHT,
  BORDER_METRIC,
  TEXT_PRIMARY,
} from "@/lib/ui/design-tokens";
```

- [ ] **Step 8.2: Remove the `BORDER` constant and update `StyleSheet.create`**

Find and delete:
```tsx
const BORDER = "#000000";
```

Then replace the entire `StyleSheet.create({})` block:

**Replace from `const styles = StyleSheet.create({` to the closing `});`:**

```tsx
const styles = StyleSheet.create({
  page: {
    paddingVertical: 32,
    paddingHorizontal: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
  },
  // ---- Header ----
  header: {
    backgroundColor: BRAND_NAVY,
    alignItems: "center",
    marginBottom: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  logo: {
    width: INFINITE_LOGO_WIDTH,
    height: INFINITE_LOGO_HEIGHT,
    marginBottom: 6,
  },
  reportTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    letterSpacing: 1.2,
    color: "#ffffff",
  },
  stateLine: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    marginTop: 3,
    color: "rgba(255,255,255,0.65)",
  },
  // ---- Table ----
  // Table carries top+left borders; each cell carries bottom+right borders → single-line grid.
  table: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: BORDER_BLUE,
  },
  // Base row — flexDirection shared by even/odd variants
  row: {
    flexDirection: "row",
  },
  rowEven: {
    flexDirection: "row",
    backgroundColor: ROW_TINT,
  },
  rowOdd: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
  },
  // Base label cell — width/padding shared
  labelCell: {
    width: "42%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER_BLUE,
    paddingVertical: 4,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  labelCellOdd: {
    width: "42%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER_LIGHT,
    paddingVertical: 4,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  valueCell: {
    flex: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER_BLUE,
    paddingVertical: 4,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  valueCellOdd: {
    flex: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER_LIGHT,
    paddingVertical: 4,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  // Full-width cell for the D-09 degraded message row.
  fullCell: {
    width: "100%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER_METRIC,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  // Metric section header row (navy divider)
  metricSectionHeader: {
    flexDirection: "row",
    backgroundColor: BRAND_NAVY,
  },
  metricSectionHeaderCell: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  metricSectionHeaderText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: "#ffffff",
    letterSpacing: 0.8,
  },
  // Metric rows (lighter tint alternation)
  metricRowEven: {
    flexDirection: "row",
    backgroundColor: METRIC_ROW_TINT,
  },
  metricRowOdd: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
  },
  metricLabelCell: {
    width: "42%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER_METRIC,
    paddingVertical: 4,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  metricValueCell: {
    flex: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER_METRIC,
    paddingVertical: 4,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  labelText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: BRAND_NAVY,
  },
  valueText: {
    fontFamily: "Helvetica-Oblique",
    fontSize: 10,
    color: TEXT_PRIMARY,
  },
  metricLabelText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: BRAND_SKY,
  },
  metricValueText: {
    fontFamily: "Helvetica-Oblique",
    fontSize: 9,
    color: TEXT_PRIMARY,
  },
  degradedText: {
    fontFamily: "Helvetica-Oblique",
    fontSize: 10,
    color: "#6b7280",
  },
  // ---- Footer ----
  footer: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  linkText: {
    fontSize: 9,
    color: BRAND_BLUE,
    textDecoration: "underline",
  },
  footerText: {
    fontSize: 9,
    color: "#6b7280",
  },
});
```

- [ ] **Step 8.3: Add `isEven` prop to `PdfRow` and `PdfRatingRow`**

Find the `PdfRow` function. Replace it:

**Before:**
```tsx
function PdfRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.labelCell}>
        <Text style={styles.labelText}>{label}</Text>
      </View>
      <View style={styles.valueCell}>
        <Text style={styles.valueText}>{value}</Text>
      </View>
    </View>
  );
}
```

**After:**
```tsx
function PdfRow({
  label,
  value,
  isEven,
}: {
  label: string;
  value: string;
  isEven: boolean;
}) {
  return (
    <View style={isEven ? styles.rowEven : styles.rowOdd}>
      <View style={isEven ? styles.labelCell : styles.labelCellOdd}>
        <Text style={styles.labelText}>{label}</Text>
      </View>
      <View style={isEven ? styles.valueCell : styles.valueCellOdd}>
        <Text style={styles.valueText}>{value}</Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 8.4: Add `isEven` prop to `PdfRatingRow`**

Find `PdfRatingRow`. Replace it:

**Before:**
```tsx
function PdfRatingRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.labelCell}>
        <Text style={styles.labelText}>{label}</Text>
      </View>
      <View style={styles.valueCell}>{children}</View>
    </View>
  );
}
```

**After:**
```tsx
function PdfRatingRow({
  label,
  children,
  isEven,
}: {
  label: string;
  children: React.ReactNode;
  isEven: boolean;
}) {
  return (
    <View style={isEven ? styles.rowEven : styles.rowOdd}>
      <View style={isEven ? styles.labelCell : styles.labelCellOdd}>
        <Text style={styles.labelText}>{label}</Text>
      </View>
      <View style={isEven ? styles.valueCell : styles.valueCellOdd}>{children}</View>
    </View>
  );
}
```

- [ ] **Step 8.5: Update the header View**

Find `<View style={styles.header}>` and its children. The header View now uses `styles.header` (which has `backgroundColor: BRAND_NAVY`). Remove any existing `backgroundColor` inline style if present.

The header block should look like:
```tsx
        <View style={styles.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf <Image> is not an HTML <img>; it has no alt prop */}
          <Image style={styles.logo} src={INFINITE_LOGO_DATA_URI} />
          <Text style={styles.reportTitle}>{vm.header.reportTitle}</Text>
          <Text style={styles.stateLine}>{vm.header.stateLine}</Text>
        </View>
```

(No change needed to the JSX here — the `styles.header` StyleSheet update from Step 8.2 applies the navy background automatically.)

- [ ] **Step 8.6: Add `isEven` to all 13 static `PdfRow` / `PdfRatingRow` calls**

In the render section, update each row call. The row parity sequence (0-indexed) is:

| Index | isEven |
|---|---|
| 0 Name of Facility | `true` |
| 1 Location | `false` |
| 2 EMR | `true` |
| 3 Census Capacity | `false` |
| 4 Current Census | `true` |
| 5 Type of Patient | `false` |
| 6 Previous Coverage | `true` |
| 7 Previous Provider Performance | `false` |
| 8 Medical Coverage | `true` |
| 9 Overall Star Rating | `false` |
| 10 Health Inspection | `true` |
| 11 Staffing | `false` |
| 12 Quality of Resident Care | `true` |

**Replace the 13 static row calls:**
```tsx
          <PdfRow isEven={true}  label="Name of Facility" value={f.displayName} />
          <PdfRow isEven={false} label="Location" value={formatLocation(f.address)} />
          <PdfRow isEven={true}  label="EMR" value={m.emr ?? "—"} />
          <PdfRow isEven={false} label="Census Capacity" value={formatBeds(f.certifiedBeds)} />
          <PdfRow
            isEven={true}
            label="Current Census"
            value={m.currentCensus != null ? String(m.currentCensus) : "—"}
          />
          <PdfRow isEven={false} label="Type of Patient" value={m.typeOfPatient ?? "—"} />
          <PdfRow
            isEven={true}
            label="Previous Coverage from Medelite"
            value={m.previousCoverage ?? "—"}
          />
          <PdfRow
            isEven={false}
            label="Previous Provider Performance from Medelite"
            value={m.previousProviderPerformance ?? "—"}
          />
          <PdfRow isEven={true}  label="Medical Coverage" value={m.medicalCoverage ?? "—"} />
          <PdfRatingRow isEven={false} label="Overall Star Rating">
            <PdfStarRating rating={f.starRatings.overall} />
          </PdfRatingRow>
          <PdfRatingRow isEven={true} label="Health Inspection">
            <PdfStarRating rating={f.starRatings.healthInspection} />
          </PdfRatingRow>
          <PdfRatingRow isEven={false} label="Staffing">
            <PdfStarRating rating={f.starRatings.staffing} />
          </PdfRatingRow>
          <PdfRatingRow isEven={true} label="Quality of Resident Care">
            <PdfStarRating rating={f.starRatings.qualityCare} />
          </PdfRatingRow>
```

- [ ] **Step 8.7: Add metric section header row and update metric rows**

Find the hospMetrics block. Replace it:

**Before:**
```tsx
          {vm.hospMetrics === undefined ? (
            <View style={styles.row}>
              <View style={styles.fullCell}>
                <Text style={styles.degradedText}>
                  Hospitalization &amp; ED metrics are temporarily unavailable.
                </Text>
              </View>
            </View>
          ) : (
            vm.hospMetrics.map((metric, i) => (
              <PdfRow
                key={i}
                label={metric.label}
                value={renderMetricValue(metric)}
              />
            ))
          )}
```

**After:**
```tsx
          {/* Metric section divider row */}
          <View style={styles.metricSectionHeader}>
            <View style={styles.metricSectionHeaderCell}>
              <Text style={styles.metricSectionHeaderText}>
                HOSPITALIZATION / ED METRICS
              </Text>
            </View>
          </View>

          {vm.hospMetrics === undefined ? (
            <View style={styles.row}>
              <View style={styles.fullCell}>
                <Text style={styles.degradedText}>
                  Hospitalization &amp; ED metrics are temporarily unavailable.
                </Text>
              </View>
            </View>
          ) : (
            vm.hospMetrics.map((metric, i) => (
              <View key={i} style={i % 2 === 0 ? styles.metricRowEven : styles.metricRowOdd}>
                <View style={styles.metricLabelCell}>
                  <Text style={styles.metricLabelText}>{metric.label}</Text>
                </View>
                <View style={styles.metricValueCell}>
                  <Text style={styles.metricValueText}>
                    {renderMetricValue(metric)}
                  </Text>
                </View>
              </View>
            ))
          )}
```

- [ ] **Step 8.8: Update Medicare link text color**

Find the `<Link src={f.careCompareUrl}>` block. The `styles.linkText` already has `color: BRAND_BLUE` from the StyleSheet update in Step 8.2 — no JSX change needed here.

- [ ] **Step 8.9: Verify**

```bash
npm run verify
```
Expected: all checks pass. TypeScript will catch any missing `isEven` props.

- [ ] **Step 8.10: Commit**

```bash
git add medelite-report/src/components/pdf/ReportPDF.tsx
git commit -m "feat(design): polish ReportPDF — navy header, alternating rows, metric section divider"
```

---

## Task 9: Final verification

- [ ] **Step 9.1: Full build verify**

```bash
npm run verify:full
```
Expected: typecheck + lint + format + test + build — all pass.

- [ ] **Step 9.2: Visual check — web UI**

```bash
npm run dev
```

Open http://localhost:3000. Verify:
- Page background is soft blue (`#eef2f7`)
- Left pane is a white card with shadow; logo sits inside a navy-to-blue gradient block at top
- CCN panel (`#f0f9ff`) has blue-border input and gradient button
- Facility Details fields have blue focus rings
- PDF/DOCX toggle is a blue pill; Download button is navy
- Right pane is a white card; report header is gradient navy-to-blue with white text
- Table rows alternate `#e0f2fe` / white with matching border colors
- "HOSPITALIZATION / ED METRICS" divider row is solid navy with white text
- Metric rows alternate `#f0f9ff` / white
- Medicare footer is a blue left-border block

- [ ] **Step 9.3: Visual check — PDF export**

Enter CCN `686123`, fill in a manual field, click Download PDF. Open the PDF and verify:
- Header is solid navy (`#023e8a`) with the INFINITE logo centered and white title text
- Table rows alternate `#e0f2fe` / white
- Label text is `#023e8a`, value text is dark with italic style
- "HOSPITALIZATION / ED METRICS" section divider is navy with white text
- Metric rows alternate `#f0f9ff` / white with `#0369a1` label text
- Medicare link is blue and clickable

- [ ] **Step 9.4: Commit any final fixes, then tag the milestone**

```bash
git add -A
git commit -m "feat(design): high-fidelity healthcare blue polish — web UI + PDF"
```
