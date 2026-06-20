# Phase 7: Visualizations & Polish - Pattern Map

**Mapped:** 2026-06-20
**Files analyzed:** 13 new/modified files
**Analogs found:** 13 / 13

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/StarRating.tsx` | component | transform | `src/components/ReportPreview.tsx` (`Row` + `renderMetricValue`) | role-match |
| `src/components/MiniBarChart.tsx` | component | transform | `src/components/ReportPreview.tsx` (metric rows section) | role-match (new data flow) |
| `src/components/ReportPreview.tsx` | component | request-response | itself (MODIFY) | exact |
| `src/components/pdf/PdfStarRating.tsx` | component | transform | `src/components/pdf/ReportPDF.tsx` (`PdfRow`, `styles.valueText`) | exact |
| `src/components/pdf/PdfMiniBarChart.tsx` | component | transform | `src/components/pdf/ReportPDF.tsx` (metric rows section) | role-match (new data flow) |
| `src/components/pdf/ReportPDF.tsx` | component | request-response | itself (MODIFY) | exact |
| `src/lib/docx/ReportDocx.ts` | service | transform | itself (MODIFY) | exact |
| `src/app/api/export/docx/route.ts` | route/controller | request-response | `src/app/api/export/pdf/route.tsx` | exact |
| `src/lib/charts/rasterize.ts` | utility | transform | `src/app/api/export/pdf/route.tsx` (server-only import discipline) | partial-match |
| `src/hooks/useDebounce.ts` | hook | event-driven | `src/components/SnapshotApp.tsx` (`useState`/`useCallback` pattern) | partial-match |
| `src/components/SnapshotApp.tsx` | component | event-driven | itself (MODIFY) | exact |
| `src/lib/cms/types.ts` | model | transform | itself (MODIFY) | exact |
| `src/lib/report/view-model.ts` | model | transform | itself (MODIFY) | exact |
| `src/lib/cms/claims-mapper.ts` | service | transform | itself (MODIFY) | exact |
| `next.config.ts` | config | — | itself (MODIFY) | exact |

---

## Pattern Assignments

### `src/components/StarRating.tsx` (NEW — component, transform)

**Analog:** `src/components/ReportPreview.tsx` — the `Row` component (lines 78–87) and the `renderMetricValue` function (lines 61–64).

**Context:** `StarRating` is a "use client" sub-component that replaces the plain `formatRating(f.starRatings.overall)` string in `ReportPreview`'s `<Row>` value cells. The `Row` component already accepts `value: React.ReactNode` (line 78), so no parent signature change is needed.

**Client directive** (line 1 of analog):
```tsx
"use client";
```

**Imports pattern** — copy from `ReportPreview.tsx` lines 38–46:
```tsx
import React from "react";
import { formatRating } from "@/lib/report/format";
```
For `StarRating.tsx` itself, only React is needed (no formatter — glyph logic is inline).

**Core pattern — null guard (format.ts lines 19–22, === null discipline):**
```typescript
// format.ts (the === null rule — never use falsiness; real 0 is valid)
export function formatRating(value: number | null): string {
  if (value === null) return PLACEHOLDER;  // PLACEHOLDER = "N/A"
  return String(value);
}
```
Mirror this `=== null` check exactly in `StarRating` for D-06 (null → grey "N/A", no glyphs).

**Integration point — Row value cell (ReportPreview.tsx lines 78–87, 174–184):**
```tsx
// Row accepts React.ReactNode — no type change needed:
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <th scope="row" className={`${LABEL_CELL} text-left`}>{label}</th>
      <td className={VALUE_CELL}>{value}</td>
    </tr>
  );
}

// Current usage (plain string — D-02 replaces this):
<Row label="Overall Star Rating" value={formatRating(f.starRatings.overall)} />
// Phase 7 target:
<Row label="Overall Star Rating" value={<StarRating rating={f.starRatings.overall} />} />
```

**Color band pattern** (D-05 — green/amber/red):
```tsx
// Band constants — derive from Tailwind color palette (web); hex for PDF/docx.
// These are STAR BAND colors — do NOT reuse for chart series (D-08 warning).
const STAR_BAND_WEB: Record<string, string> = {
  green: "text-green-600",   // 4-5 stars
  amber: "text-amber-500",   // 3 stars
  red:   "text-red-600",     // 1-2 stars
  grey:  "text-zinc-400",    // null / suppressed
};
// Shared hex values for PDF + docx parity:
export const STAR_BAND_HEX = {
  green: "#16a34a",
  amber: "#f59e0b",
  red:   "#dc2626",
  grey:  "#9ca3af",
} as const;

function getStarBand(rating: number | null): keyof typeof STAR_BAND_HEX {
  if (rating === null) return "grey";
  if (rating >= 4) return "green";
  if (rating === 3) return "amber";
  return "red";
}
```
Place `STAR_BAND_HEX` in a new shared module (e.g. `src/lib/report/colors.ts`) so PDF and docx can import the same hex values.

**D-06: null → "N/A", no glyphs:**
```tsx
export function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) {
    return <span className="text-zinc-400 not-italic">N/A</span>;
  }
  const band = getStarBand(rating);
  const glyphs = Array.from({ length: 5 }, (_, i) => (i < rating ? "★" : "☆")).join("");
  return (
    <span className={`${STAR_BAND_WEB[band]} font-medium`}>
      {glyphs} {rating}/5
    </span>
  );
}
```

---

### `src/components/MiniBarChart.tsx` (NEW — component, transform)

**Analog:** `src/components/ReportPreview.tsx` — the hosp metric rows section (lines 188–208) shows the existing data shape; the chart itself is new (no recharts analog exists in the codebase yet).

**Client directive required** (recharts is browser-only):
```tsx
"use client";
```

**Data shape** — from `HospMetric` in `src/lib/cms/types.ts` (lines 34–61):
```typescript
// After D-15 extension, each HospMetric will have:
interface HospMetric {
  label: string;
  value: number | null;
  unit: "percent" | "rate";
  footnoteCode?: string;
  measureKey: "521" | "522" | "551" | "552";  // NEW (D-15)
  source: "facility" | "nation" | "state";     // NEW (D-15)
}
```

**D-09 suppression pattern** — mirror `renderMetricValue` in `ReportPreview.tsx` lines 61–64:
```typescript
// Existing null guard (reuse the === null discipline):
function renderMetricValue(m: HospMetric): string {
  if (m.value === null) return formatFootnote(m.footnoteCode);
  return m.unit === "percent" ? formatPercent(m.value) : formatRate(m.value);
}
// Chart equivalent: D-09 = omit the bar (filter out nulls), show "N/A" tick
const chartData = [
  { name: "Facility", value: facility?.value ?? null, color: CHART_SERIES.facility },
  { name: "National", value: nation?.value ?? null,   color: CHART_SERIES.nation   },
  { name: "State",    value: state?.value ?? null,    color: CHART_SERIES.state    },
].filter((d) => d.value !== null);
```

**D-08 chart series colors** (distinct from star bands — MUST carry a legend):
```typescript
// Chart series identity colors — NOT performance indicators
// Place in src/lib/report/colors.ts alongside STAR_BAND_HEX
export const CHART_SERIES = {
  facility: "#3b82f6", // blue
  nation:   "#16a34a", // green (series identity — not "good")
  state:    "#f59e0b", // amber (series identity — not "warning")
} as const;
```

**Placement in ReportPreview.tsx** — charts are added BELOW the `</table>` closing tag (line 208), inside the `<article>` wrapper:
```tsx
{/* After the table, before the footer (line 213): */}
{vm.hospMetrics && vm.hospMetrics.length > 0 && (
  <section className="mt-4 space-y-4">
    <h2 className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">
      Hospitalization &amp; ED Metrics
    </h2>
    <div className="grid grid-cols-2 gap-4">
      {groupByMeasure(vm.hospMetrics).map((group, i) => (
        <MiniBarChart key={i} group={group} />
      ))}
    </div>
  </section>
)}
```

---

### `src/components/ReportPreview.tsx` (MODIFY)

**Analog:** itself — read lines 1–227.

**Key integration points for Phase 7:**

1. **Star rating rows** (lines 174–184) — replace 4 `formatRating(...)` strings with `<StarRating rating={...} />`. The `Row` component already accepts `React.ReactNode` value (line 78).

2. **Chart section** — add after `</table>` (line 208), before `<footer>` (line 213).

3. **Import additions:**
```tsx
// Add to the existing import block (lines 37–53):
import { StarRating } from "@/components/StarRating";
import { MiniBarChart } from "@/components/MiniBarChart";
```

**Existing null-safety discipline to preserve** (D-10, lines 61–64):
```typescript
function renderMetricValue(m: HospMetric): string {
  if (m.value === null) return formatFootnote(m.footnoteCode);
  return m.unit === "percent" ? formatPercent(m.value) : formatRate(m.value);
}
```
This function remains UNCHANGED — it drives the 12 verbatim text rows (CLM-03). Only the 4 star-rating `Row` calls change (D-02).

**`vm.hospMetrics === undefined` guard** — preserve exactly (lines 189–207):
```tsx
{vm.hospMetrics === undefined ? (
  <tr><td colSpan={2} className="...">Hospitalization &amp; ED metrics are temporarily unavailable.</td></tr>
) : (
  vm.hospMetrics.map((metric) => (
    <Row key={metric.label} label={metric.label} value={renderMetricValue(metric)} />
  ))
)}
```

---

### `src/components/pdf/PdfStarRating.tsx` (NEW — component, transform)

**Analog:** `src/components/pdf/ReportPDF.tsx` — `PdfRow` (lines 174–185) and `styles` object (lines 77–171).

**NO "use client" directive** — this is server-only (mirrors `ReportPDF.tsx` which has no `"use client"` at line 1).

**Imports pattern** (copy from `ReportPDF.tsx` lines 34–42):
```tsx
import {
  View,
  Text,
  Svg,
  Path,
} from "@react-pdf/renderer";
```
Note: `Svg` and `Path` are NOT currently imported in `ReportPDF.tsx` — add them here for the star geometry.

**StyleSheet pattern** (copy from `ReportPDF.tsx` lines 77–171):
```tsx
import { StyleSheet } from "@react-pdf/renderer";
// React-pdf uses StyleSheet.create (not Tailwind); same pattern as ReportPDF.tsx line 77:
const styles = StyleSheet.create({
  starRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  ratingText: { marginLeft: 4 },
});
```

**`PdfRow` value prop constraint — CRITICAL** (lines 174–185):
```tsx
// Current PdfRow signature in ReportPDF.tsx line 174:
function PdfRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.labelCell}>
        <Text style={styles.labelText}>{label}</Text>
      </View>
      <View style={styles.valueCell}>
        <Text style={styles.valueText}>{value}</Text>  {/* value is string → wrapped in Text */}
      </View>
    </View>
  );
}
```
`value: string` means `PdfStarRating` (which returns a `<View>`) CANNOT be passed to `PdfRow.value`. Two options (per research Pitfall 4 + Open Question 3):

**Recommended approach — create `PdfRatingRow` variant:**
```tsx
// In ReportPDF.tsx — add alongside PdfRow:
function PdfRatingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.labelCell}>
        <Text style={styles.labelText}>{label}</Text>
      </View>
      <View style={styles.valueCell}>
        {children}  {/* accepts ReactNode — no Text wrapper */}
      </View>
    </View>
  );
}
```

**STAR_BAND_HEX** — import from shared `src/lib/report/colors.ts` (same values used in web `StarRating`).

**SVG star path** (pre-computed; verify visually in rendered PDF per A3):
```tsx
const STAR_PATH = "M8,1 L9.9,6.2 L15.5,6.2 L11,9.5 L12.9,14.7 L8,11.4 L3.1,14.7 L5,9.5 L0.5,6.2 L6.1,6.2 Z";

export function PdfStarRating({ rating }: { rating: number | null }) {
  if (rating === null) {
    return <Text style={{ color: STAR_BAND_HEX.grey, fontFamily: "Helvetica-Oblique" }}>N/A</Text>;
  }
  const fill = STAR_BAND_HEX[getStarBand(rating)];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <Svg key={i} width={16} height={16} viewBox="0 0 16 16">
          <Path d={STAR_PATH} fill={i < rating ? fill : "none"} stroke={fill} strokeWidth={0.8} />
        </Svg>
      ))}
      <Text style={{ color: fill, marginLeft: 4, fontFamily: "Helvetica-Oblique" }}>{rating}/5</Text>
    </View>
  );
}
```

---

### `src/components/pdf/PdfMiniBarChart.tsx` (NEW — component, transform)

**Analog:** `src/components/pdf/ReportPDF.tsx` — metric rows section (lines 249–269) shows the surrounding react-pdf context.

**NO "use client" directive** — server-only (react-pdf-charts runs server-side via `renderToStaticMarkup`).

**Imports pattern:**
```tsx
import ReactPDFChart from "react-pdf-charts";
import { BarChart, Bar, XAxis, YAxis, Cell } from "recharts";
import { View } from "@react-pdf/renderer";
```
`react-pdf-charts` is already installed (`node_modules/react-pdf-charts`). `recharts` is already installed.

**CRITICAL anti-pattern from research** — `isAnimationActive={false}` is MANDATORY on every `<Bar>`:
```tsx
// Without this, charts render as blank in the PDF (Pitfall 1):
<Bar dataKey="value" isAnimationActive={false}>
  {data.map((d, i) => <Cell key={i} fill={d.color} />)}
</Bar>
```

**`ReactPDFChart` API** (from `node_modules/react-pdf-charts/dist/index.d.ts`):
```typescript
// Props: children, chartStyle, debug, style
// Mechanism: renderToStaticMarkup(children) → SVG string → react-pdf <Svg> primitives
```

**Pattern from surrounding react-pdf context** (ReportPDF.tsx lines 252–268):
```tsx
// react-pdf has NO JSX key on Fragment — use key on View (line 261):
vm.hospMetrics.map((metric, i) => (
  <PdfRow key={i} label={metric.label} value={renderMetricValue(metric)} />
))
// PdfMiniBarChart must return a <View> wrapping ReactPDFChart:
export function PdfMiniBarChart({ data, unit }: Props) {
  const filtered = data.filter((d) => d.value !== null);
  if (filtered.length === 0) return null;
  return (
    <View>
      <ReactPDFChart>
        <BarChart width={300} height={100} data={filtered}>
          <XAxis dataKey="name" tick={{ fontSize: 7 }} />
          <YAxis tick={{ fontSize: 7 }} width={28} />
          <Bar dataKey="value" isAnimationActive={false}>
            {filtered.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ReactPDFChart>
    </View>
  );
}
```

---

### `src/components/pdf/ReportPDF.tsx` (MODIFY)

**Analog:** itself — read lines 1–286.

**Key integration points for Phase 7:**

1. **Add `PdfRatingRow` variant alongside `PdfRow`** (after line 185) — see `PdfStarRating` section above.

2. **Replace 4 star-rating `PdfRow` calls** (lines 232–247) with `PdfRatingRow` containing `<PdfStarRating>`.

3. **Add chart section after the metrics `</View>` block** (after line 268, before `</View>` at line 269):
```tsx
// After the hospMetrics map block, within the table View:
{/* Charts section — added below the 12 verbatim metric rows (D-03) */}
{vm.hospMetrics && vm.hospMetrics.length > 0 && (
  <View style={{ marginTop: 8 }}>
    {groupByMeasure(vm.hospMetrics).map((group, i) => (
      <PdfMiniBarChart key={i} group={group} />
    ))}
  </View>
)}
```

4. **New imports to add** (after line 42):
```tsx
import { Svg, Path } from "@react-pdf/renderer";
import { PdfStarRating } from "@/components/pdf/PdfStarRating";
import { PdfMiniBarChart } from "@/components/pdf/PdfMiniBarChart";
```

**Existing `styles` to reuse for new components** (lines 77–171):
- `styles.valueCell` (lines 123–131) — `PdfRatingRow` uses the same cell style.
- `styles.labelCell` (lines 114–122), `styles.labelText` (lines 141–145) — unchanged in `PdfRatingRow`.
- `styles.valueText` (lines 146–150) — NOT used in `PdfRatingRow` value slot (replaced by `<PdfStarRating>`).

---

### `src/lib/docx/ReportDocx.ts` (MODIFY)

**Analog:** itself — read lines 1–225.

**Key integration patterns:**

**1. `xmlEsc` helper** (lines 45–52) — star glyph `★`/`☆` are plain Unicode in XML text nodes; `xmlEsc` does NOT escape them (only `&`, `<`, `>`, `"`, `'`). Star glyphs are SAFE to pass through `xmlEsc`. Inject as literal Unicode in the OOXML `<w:r>` fragment (Pitfall 7 discipline):
```typescript
// xmlEsc is already defined (lines 45-52) — no change needed:
function xmlEsc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
```

**2. Row-replace pattern (CR-01 callback discipline)** (lines 151–173) — the existing callback-form `.replace()` guard must be preserved when injecting star OOXML. Any raw OOXML fragment with `$` metacharacters in the replacement path must use the `() => fragment` form:
```typescript
// The existing pattern (lines 166-173) — copy exactly for star injection:
const newValTag = originalValTag.replace(
  /(<w:t\b[^>]*>)[\s\S]*?(<\/w:t>)/,
  (_m, open, close) => `${open}${xmlEsc(value)}${close}`,
);
return row.replace(originalValTag, () => newValTag);
```

**3. `buildValueMap` (lines 77–107)** — for star rating rows, the value is currently a plain string from `formatRating`. For Phase 7, replace the string values for the 4 rating keys with a colored OOXML `<w:r>` run. The existing label-match loop (lines 151–173) picks up the right cell by label; the challenge is that `buildValueMap` returns `Record<string, string>` — the OOXML `<w:r>` fragment is a string that will pass through the existing `xmlEsc(value)` in `newValTag`. **However**, this is wrong for the star case because the star fragment is already OOXML markup (not plain text). The correct approach is to use a separate injection path for star rows that replaces the entire value-cell content (not just the inner `<w:t>` text):

```typescript
// In buildReportDocxBuffer, after the main MAP fill loop (after line 174):
// Inject star OOXML for the 4 rating rows by replacing the full value-cell XML:
const STAR_ROW_LABELS = [
  "Overall Star Rating",
  "Health Inspection",
  "Staffing",
  "Quality of Resident Care",
];
// buildStarRunXml returns a ready <w:r> fragment — see RESEARCH.md Pattern 6:
function buildStarRunXml(rating: number | null): string {
  if (rating === null) {
    return `<w:r><w:rPr><w:color w:val="9ca3af"/></w:rPr><w:t>N/A</w:t></w:r>`;
  }
  const fill = rating >= 4 ? "16a34a" : rating === 3 ? "f59e0b" : "dc2626";
  const glyphs = "★".repeat(rating) + "☆".repeat(5 - rating);
  return `<w:r><w:rPr><w:color w:val="${fill}"/></w:rPr><w:t xml:space="preserve">${glyphs} ${rating}/5</w:t></w:r>`;
}
```

**4. `ImageRun` chart PNGs** — extend `buildReportDocxBuffer` after the existing XML fill (line 174) to inject 4 chart PNGs. The `<w:sectPr>` injection pattern (lines 188–195) shows how to append content using callback-form `.replace()`. Chart PNGs are embedded in the zip as `word/media/chart-N.png` entries and referenced via `ImageRun` or direct OOXML `<w:drawing>` markup.

**5. Byte-size assertion** — the existing route test asserts `Buffer.byteLength(docxBuffer) < 4_500_000`. Keep chart PNG dimensions to 300×100 to stay within budget (Pitfall 3).

**Existing footer OOXML injection pattern** (lines 188–195) to copy for chart paragraph injection:
```typescript
// Callback form — mandatory so any `$` in the injected XML is not re-expanded (CR-01):
xml = xml.replace("<w:sectPr>", () => footerP + "<w:sectPr>");
```

---

### `src/app/api/export/docx/route.ts` (MODIFY)

**Analog:** itself (lines 1–85) + `src/app/api/export/pdf/route.tsx` (the mirror pattern).

**Unchanged patterns to preserve:**

**Runtime declaration** (line 23):
```typescript
export const runtime = "nodejs";
```

**Request validation pattern** (lines 35–64) — copy exactly; do NOT inline Zod errors:
```typescript
const parseResult = ReportViewModelSchema.safeParse(body);
if (!parseResult.success) {
  return Response.json({ error: { kind: "invalid_request", message: "Invalid report data." } }, { status: 400 });
}
```

**Buffer-to-Response pattern** (lines 71–84):
```typescript
const docxBuffer = Buffer.from(await buildReportDocxBuffer(parseResult.data));
// ...
return new Response(docxBuffer, {
  status: 200,
  headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "Content-Disposition": `attachment; filename="${filename}"`,
  },
});
```

**Size assertion in tests** — the existing `tests/api/export-docx.test.ts` line 138 asserts `Buffer.byteLength(docxBuffer) < 4_500_000`. This MUST remain passing after chart PNGs are added.

**Phase 7 addition** — chart rasterization happens inside `buildReportDocxBuffer` (called at line 71), NOT in the route handler. The route handler stays thin.

---

### `src/lib/charts/rasterize.ts` (NEW — utility, transform)

**Analog:** `src/app/api/export/pdf/route.tsx` (server-only import discipline) + `src/lib/docx/ReportDocx.ts` (server-only module pattern).

**NO "use client" directive** — server-only module. Must never reach a client bundle (PITFALLS #4).

**Server-only pattern from `ReportDocx.ts` (lines 22–24):**
```typescript
// NO "use client" — this file is server-only. Import only from route handlers.
// The JSZip and Buffer APIs are Node-only; never include in client bundles.
```

**Module structure:**
```typescript
// src/lib/charts/rasterize.ts — server-only (NO "use client")
// @resvg/resvg-js must be in next.config.ts serverExternalPackages (see config section)
import { Resvg } from "@resvg/resvg-js";

export function svgToPngBuffer(svgString: string, width = 300, height = 100): Buffer {
  const resvg = new Resvg(svgString, {
    fitTo: { mode: "width", value: width },
  });
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}
```

**SVG-from-recharts pattern** (used in `buildReportDocxBuffer` to generate SVG before rasterization):
```typescript
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { BarChart, Bar, XAxis, YAxis, Cell } from "recharts";

// isAnimationActive={false} is mandatory (same rule as PDF charts):
function renderChartSvgString(data: ChartData[], width = 300, height = 100): string {
  return renderToStaticMarkup(
    createElement(BarChart, { width, height, data },
      createElement(XAxis, { dataKey: "name" }),
      createElement(YAxis),
      createElement(Bar, { dataKey: "value", isAnimationActive: false },
        ...data.map((d, i) => createElement(Cell, { key: i, fill: d.color }))
      )
    )
  );
}
```

---

### `src/hooks/useDebounce.ts` (NEW — hook, event-driven)

**Analog:** `src/components/SnapshotApp.tsx` — `useState`/`useCallback`/`useEffect` import pattern (lines 29–45).

**Client context** — this hook is consumed by `SnapshotApp.tsx` which is `"use client"`. The hook itself does not need the directive but must only be imported from client components.

**Import pattern** (from `SnapshotApp.tsx` line 29):
```typescript
import { useState, useCallback } from "react";
// Phase 7 addition: useEffect for the timer
import { useState, useEffect } from "react";
```

**Pattern:**
```typescript
// src/hooks/useDebounce.ts
import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debouncedValue;
}
```

**Why not `useDeferredValue`** (from RESEARCH.md): `useDeferredValue` in React 19 has no guaranteed minimum delay — it defers to the next render pass which may be sub-millisecond. A fixed 300ms timer is required for D-14.

---

### `src/components/SnapshotApp.tsx` (MODIFY)

**Analog:** itself — read lines 1–207.

**Debounce integration point** (lines 135–140 — view-model assembly):
```typescript
// CURRENT (lines 138-140):
const vm = facilityData
  ? assembleViewModel(facilityData, manualInputs, new Date(), hospMetrics)
  : null;

// PHASE 7 target (D-14 — debounce manualInputs → vm path only):
const debouncedManualInputs = useDebounce(manualInputs, 300);
const vm = facilityData
  ? assembleViewModel(facilityData, debouncedManualInputs, new Date(), hospMetrics)
  : null;
```

**handleSearch stays unchanged** (lines 68–133) — CMS re-fetch is triggered ONLY by `handleSearch`; `manualInputs` changes NEVER trigger a fetch. The debounce applies only to the `vm` assembly path.

**ManualInputsForm stays unchanged** (lines 187–191):
```tsx
<ManualInputsForm
  inputs={manualInputs}       // still raw (un-debounced) for immediate UI feedback
  onChange={setManualInputs}  // fires on every keystroke — unchanged
  disabled={!facilityData}
/>
```
`manualInputs` updates immediately; `debouncedManualInputs` trails by 300ms. Both `ReportPreview` and `ExportControls` receive the same debounced `vm`.

**Import addition:**
```typescript
import { useDebounce } from "@/hooks/useDebounce";
```

---

### `src/lib/cms/types.ts` (MODIFY — D-15)

**Analog:** itself — read lines 1–99.

**Extension point** — `HospMetric` interface (lines 34–61). Add `measureKey` and `source`:
```typescript
// CURRENT (lines 34-61):
export interface HospMetric {
  label: string;
  value: number | null;
  unit: "percent" | "rate";
  footnoteCode?: string;
}

// PHASE 7 (D-15 — add grouping keys):
export interface HospMetric {
  label: string;
  value: number | null;
  unit: "percent" | "rate";
  footnoteCode?: string;
  /** D-15: measure group key — matches METRIC_DEFINITIONS measureCode */
  measureKey: "521" | "522" | "551" | "552";
  /** D-15: data source within the measure group */
  source: "facility" | "nation" | "state";
}
```

**Important:** Because `joinClaimsAndAverages` currently returns objects WITHOUT `measureKey`/`source` (lines 205–258 of `claims-mapper.ts`), adding these as required fields will cause TypeScript errors in the mapper until the mapper is updated. Treat as a paired change.

---

### `src/lib/report/view-model.ts` (MODIFY — D-15 + Pitfall 6)

**Analog:** itself — read lines 1–220.

**Extension point** — `HospMetricSchema` (lines 50–62). Must be extended BEFORE `HospMetric` in `types.ts` is extended (Pitfall 6: schema must mirror interface or fields are stripped during POST validation):
```typescript
// CURRENT HospMetricSchema (lines 50-62):
const HospMetricSchema = z.object({
  label: z.string(),
  value: z.number().nullable(),
  unit: z.enum(["percent", "rate"]),
  footnoteCode: z.string().optional(),
});

// PHASE 7 (D-15 — add to schema BEFORE extending HospMetric):
const HospMetricSchema = z.object({
  label: z.string(),
  value: z.number().nullable(),
  unit: z.enum(["percent", "rate"]),
  footnoteCode: z.string().optional(),
  measureKey: z.enum(["521", "522", "551", "552"]),  // D-15
  source: z.enum(["facility", "nation", "state"]),    // D-15
});
```

**`ReportViewModelSchema` comment block** (line 1–15) — update the D-08 comment to note Phase 7 chart keys: `D-08: ReportViewModel carries raw number | null — formatters run at render time. Charts (Phase 7) also read raw values and use measureKey/source for grouping.`

**`assembleViewModel` signature** (lines 177–182) — no change needed; `hospMetrics` is already typed as `HospMetric[] | undefined` and passed through directly (line 218).

---

### `src/lib/cms/claims-mapper.ts` (MODIFY — D-15)

**Analog:** itself — read lines 1–259.

**Extension point** — `METRIC_DEFINITIONS` (lines 26–103) already has `measureCode` and `source` on each entry. The `joinClaimsAndAverages` return objects (lines 205–258) must include `measureKey` and `source`:

```typescript
// Current return object for facility rows (lines 215-222):
return {
  label: def.label,
  value: null,
  unit,
  footnoteCode: "",
};
// PHASE 7 — add measureKey and source:
return {
  label: def.label,
  value: null,
  unit,
  footnoteCode: "",
  measureKey: def.measureCode as "521" | "522" | "551" | "552",
  source: def.source as "facility" | "nation" | "state",
};
```
Apply the same extension to ALL return paths within the `METRIC_DEFINITIONS.map((def) => ...)` call (lines 205–258), including: facility-absent path (line 215), CMS-suppressed path (line 229), valid-facility path (line 240), and nation/state average path (line 256).

---

### `next.config.ts` (MODIFY)

**Analog:** itself — read lines 1–15.

**Current `serverExternalPackages`** (line 12):
```typescript
serverExternalPackages: ["@react-pdf/renderer"],
```

**Phase 7 addition** — `@resvg/resvg-js` must be added (Pitfall 2; it uses a NAPI `.node` binary and is NOT in Next.js's auto-external list):
```typescript
serverExternalPackages: ["@react-pdf/renderer", "@resvg/resvg-js"],
```

The existing comment block (lines 4–10) explaining the rationale for explicit listing should be updated to mention `@resvg/resvg-js` and the same NAPI-binary reason.

---

## Shared Patterns

### Server-Only Module Discipline
**Source:** `src/lib/docx/ReportDocx.ts` (lines 22–24), `src/components/pdf/ReportPDF.tsx` (no `"use client"` — line 1 comment)
**Apply to:** `PdfStarRating.tsx`, `PdfMiniBarChart.tsx`, `src/lib/charts/rasterize.ts`
```typescript
// NO "use client" — this file is server-only. Import only from route handlers.
// Server-only modules must NEVER be imported by client components.
// `next build` fails if @react-pdf/renderer or @resvg/resvg-js reaches the client bundle.
```

### Null-Safety: `=== null` Not Falsiness
**Source:** `src/lib/report/format.ts` (lines 6–10, 19–22), `src/components/ReportPreview.tsx` (lines 61–64)
**Apply to:** `StarRating.tsx`, `PdfStarRating.tsx`, `MiniBarChart.tsx`, `PdfMiniBarChart.tsx`, star OOXML in `ReportDocx.ts`
```typescript
// D-10 discipline — real 0 is valid data, not N/A:
if (value === null) return PLACEHOLDER;  // NEVER: if (!value) or if (value == null)
```

### Export Route Pattern (Thin Handler, Validate-Then-Delegate)
**Source:** `src/app/api/export/docx/route.ts` (lines 32–84), `src/app/api/export/pdf/route.tsx` (lines 29–77)
**Apply to:** `src/app/api/export/docx/route.ts` (MODIFY — remains thin after chart work moves into `buildReportDocxBuffer`)
```typescript
export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try { body = await request.json(); } catch { return 400; }
  const parseResult = ReportViewModelSchema.safeParse(body);
  if (!parseResult.success) return 400; // NO Zod internals
  // delegate to server-only builder
}
```

### CR-01: Callback-Form `.replace()` for User-Controlled Strings
**Source:** `src/lib/docx/ReportDocx.ts` (lines 160–173, 194–195)
**Apply to:** All new OOXML injection points in `ReportDocx.ts` (star runs, chart paragraph)
```typescript
// ALWAYS use callback form so `$` in replacement is not interpreted as metacharacter:
return row.replace(originalValTag, () => newValTag);
xml = xml.replace("<w:sectPr>", () => chartParagraph + "<w:sectPr>");
// NEVER: xml.replace(pattern, userControlledString) — $& etc. corrupt OOXML
```

### D-15 Metric Grouping Utility
**Source:** `src/lib/cms/claims-mapper.ts` — `METRIC_DEFINITIONS` (lines 26–103) proves the 4 measure groups and fixed order
**Apply to:** `ReportPreview.tsx` and `ReportPDF.tsx` (chart rendering)
```typescript
// Group 12 flat HospMetrics into 4 measure buckets for chart rendering:
type MeasureKey = "521" | "522" | "551" | "552";
type MeasureGroup = { facility?: HospMetric; nation?: HospMetric; state?: HospMetric; label: string; unit: "percent" | "rate" };

export function groupByMeasure(metrics: HospMetric[]): MeasureGroup[] {
  const groups: Record<MeasureKey, MeasureGroup> = {
    "521": { label: "Short-Stay Rehospitalization", unit: "percent" },
    "522": { label: "Short-Stay ED Visits", unit: "percent" },
    "551": { label: "Long-Stay Hospitalizations", unit: "rate" },
    "552": { label: "Long-Stay ED Visits", unit: "rate" },
  };
  for (const m of metrics) {
    groups[m.measureKey][m.source] = m;
  }
  return (["521", "522", "551", "552"] as MeasureKey[]).map((k) => groups[k]);
}
// Place in src/lib/report/chart-utils.ts or co-locate with color constants
```

### `isAnimationActive={false}` — Mandatory in All react-pdf-charts Usage
**Source:** RESEARCH.md Pitfall 1, react-pdf-charts mechanism (Pattern 4)
**Apply to:** `PdfMiniBarChart.tsx`, `src/lib/charts/rasterize.ts` (recharts SVG for docx PNGs)
```tsx
// Required on every animated recharts child inside ReactPDFChart:
<Bar dataKey="value" isAnimationActive={false}>
```

### `"use client"` — Required for All Web-Side Visual Components
**Source:** `src/components/ReportPreview.tsx` (line 1), `src/components/SnapshotApp.tsx` (line 1)
**Apply to:** `StarRating.tsx`, `MiniBarChart.tsx`
```tsx
"use client";
// recharts and Unicode star rendering are browser/DOM-only
```

---

## No Analog Found

No files are without an analog. All 15 new/modified files have at least a partial analog in the existing codebase.

---

## Metadata

**Analog search scope:** `medelite-report/src/` (all directories)
**Files scanned:** 26 TypeScript source files + `next.config.ts`
**Pattern extraction date:** 2026-06-20
**Source file line ranges read:**
- `ReportPreview.tsx`: full (227 lines)
- `ReportPDF.tsx`: full (286 lines)
- `ReportDocx.ts`: full (225 lines)
- `SnapshotApp.tsx`: full (207 lines)
- `ManualInputsForm.tsx`: full (206 lines)
- `ExportControls.tsx`: full (143 lines)
- `claims-mapper.ts`: full (259 lines)
- `types.ts`: full (99 lines)
- `view-model.ts`: full (220 lines)
- `format.ts`: full (100 lines)
- `route.ts` (docx): full (85 lines)
- `route.tsx` (pdf): full (77 lines)
- `next.config.ts`: full (15 lines)
