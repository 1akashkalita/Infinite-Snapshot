# Technology Stack

**Project:** Infinite Snapshot (Medelite nursing-home facility assessment report generator)
**Researched:** 2026-06-15
**Fixed baseline:** Next.js 16.2.9 / React 19.2.4 / TypeScript strict / Tailwind v4 / Vitest / Vercel

---

## What Needs to Be Added (Libraries to Install)

The scaffolded project has zero production dependencies beyond Next.js and React. All libraries below need to be installed.

---

## 1. PDF Generation — @react-pdf/renderer

### Recommended

| Library | Version | Purpose |
|---------|---------|---------|
| `@react-pdf/renderer` | `^4.5.1` | PDF generation — REQUIRED, never html2canvas/jsPDF |

**Version rationale:** 4.5.1 is the current `latest` dist-tag (verified via `npm show`). React 19 support was added in v4.1.0 — the peer dependency declaration on 4.5.1 explicitly lists `react: "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"`. This is confirmed compatible.

### Next.js 16 Compatibility — CRITICAL

`@react-pdf/renderer` is on Next.js's built-in `serverExternalPackages` auto-opt-out list (verified in `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.md`). **No `next.config.js` configuration is required.** Next.js 16 (which is post-14.2) automatically handles the package boundary. The bug that caused "TypeError: ba.Component is not a constructor" was fixed in Next.js 14.1.1.

### Server vs Client Rendering

**Recommended pattern: server-side via Route Handler.** Generate the PDF in `app/api/pdf/[ccn]/route.ts` using `renderToBuffer`, return as a binary `application/pdf` response with `Content-Disposition: attachment`. This is clean, avoids hydration issues, and works within the existing Next.js 16 App Router model.

```typescript
// app/api/pdf/[ccn]/route.ts
import { renderToBuffer } from '@react-pdf/renderer'
import type { NextRequest } from 'next/server'

export async function POST(req: NextRequest, ctx: RouteContext<'/api/pdf/[ccn]'>) {
  const { ccn } = await ctx.params
  const body = await req.json()
  // body contains manual operational inputs validated separately

  const buffer = await renderToBuffer(<FacilityReport ccn={ccn} manualInputs={body} />)

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="snapshot-${ccn}.pdf"`,
    },
  })
}
```

The client triggers download by POSTing, receiving the blob, then using `URL.createObjectURL`.

**Do not use** `PDFViewer` or `PDFDownloadLink` from react-pdf on the server — those components require browser APIs (`URL.createObjectURL`, canvas) and must be wrapped in `dynamic(..., { ssr: false })` if used in a client component for live preview. For the primary download flow, `renderToBuffer` in a route handler is more reliable.

### Clickable Link in PDF

Use the `<Link>` component from `@react-pdf/renderer`:

```typescript
import { Link } from '@react-pdf/renderer'

<Link src={`https://www.medicare.gov/care-compare/details/nursing-home/${ccn}`}>
  View on Medicare Care Compare
</Link>
```

### What NOT to Use

- `html2canvas` — forbidden by CLAUDE.md standing rule #7
- `jsPDF` — forbidden by CLAUDE.md standing rule #7
- `Puppeteer`/`Playwright` server-side PDF — overkill and introduces Chromium binary dependencies

---

## 2. Runtime Schema Validation — Zod

### Recommended

| Library | Version | Purpose |
|---------|---------|---------|
| `zod` | `^4.4.3` | Runtime validation for every CMS API response |

**Version rationale:** Zod v4 is the current stable major (4.4.3 is the `latest` npm tag, verified). The `next` dist-tag points at v3 beta prerelease (`3.25.0-beta.*`) — ignore it, `latest` is v4. Zod v4 is 14x faster than v3 for string parsing and ships a 57% smaller core bundle. Use it.

**v4 idioms for this project:**

```typescript
import { z } from 'zod'

// Schema definition
const ProviderInfoSchema = z.object({
  cms_certification_number_ccn: z.string(),
  provider_name: z.string(),
  legal_business_name: z.string(),
  provider_address: z.string(),
  citytown: z.string(),
  state: z.string().length(2),
  zip_code: z.string(),
  number_of_certified_beds: z.string(),           // CMS returns strings for numerics
  overall_rating: z.string().nullable().optional(),
  health_inspection_rating: z.string().nullable().optional(),
  qm_rating: z.string().nullable().optional(),
  staffing_rating: z.string().nullable().optional(),
  processing_date: z.string(),
})

export type ProviderInfo = z.infer<typeof ProviderInfoSchema>

// Parsing pattern — use safeParse, never parse(), in API handlers
const result = ProviderInfoSchema.safeParse(rawJson)
if (!result.success) {
  // Handle validation failure — return 422 or throw structured error
  throw new Error(z.prettifyError(result.error))
}
const data = result.data
```

**Key v4 change:** Error strings use `{ error: "..." }` instead of `{ message: "..." }`. `safeParse()` and `z.infer` work identically to v3. Top-level `z.email()` / `z.url()` replace `z.string().email()` / `z.string().url()`.

**CMS field type note:** The CMS datastore API returns ALL numeric fields as strings (e.g., `"number_of_certified_beds": "57"`). Schema accordingly uses `z.string()` for those, with optional `.transform(Number)` where arithmetic is needed.

---

## 3. .docx Export — docx

### Recommended

| Library | Version | Purpose |
|---------|---------|---------|
| `docx` | `^9.7.1` | Word document (.docx) export |

**Version rationale:** 9.7.1 is the current `latest` npm tag (verified). The `next` dist-tag at `5.0.0-rc2` is an old naming artifact — ignore. v9 is production stable. Confirmed browser and Node.js compatible: "Works for Node and on the Browser" per the package description.

**How to trigger browser download** (client component, no server route needed for .docx):

```typescript
// Client component — 'use client'
import { Document, Packer, Paragraph, TextRun } from 'docx'

async function downloadDocx(data: ProviderInfo) {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun('INFINITE — Managed by MEDELITE')] }),
        // ... rest of report
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `snapshot-${data.cms_certification_number_ccn}.docx`
  a.click()
  URL.revokeObjectURL(url)
}
```

`Packer.toBlob()` is the browser API; `Packer.toBuffer()` is for Node.js route handlers if server-side generation is preferred. Since .docx is a bonus feature and `docx` works cleanly client-side, client-side generation avoids an extra route.

---

## 4. Charts / Data Visualization

Star ratings (1-5 stars) and 12 hospitalization/ED metrics must render in BOTH the web UI AND inside the react-pdf PDF.

**The constraint:** `@react-pdf/renderer` renders its own SVG primitives — it cannot render browser DOM elements, HTML `<canvas>`, or standard React charting libraries directly. Charting inside react-pdf requires converting SVG chart output into react-pdf's `<Svg>`, `<Rect>`, `<Text>` etc. primitives.

### Recommended

| Library | Version | Purpose |
|---------|---------|---------|
| `recharts` | `^2.15.4` | Charts in the web UI |
| `react-pdf-charts` | `^1.0.0` | Adapter: wraps recharts SVG output for react-pdf |

**Version constraint — CRITICAL:** `react-pdf-charts@1.0.0` explicitly does NOT support recharts v3+ (due to a breaking SVG regression in recharts v3). Pin to `recharts@^2.15.4` (latest v2). Verified: `react-pdf-charts` peer deps require `@react-pdf/renderer ^4.3.1` and `react ^18.3.1 || ^19.2.0` — both satisfied by this stack.

**Usage pattern:**

```tsx
// Web UI — standard recharts (no wrapper needed)
import { BarChart, Bar, XAxis, YAxis } from 'recharts'

const RatingChart = ({ rating }: { rating: number }) => (
  <BarChart width={200} height={100} data={[{ name: 'Overall', value: rating }]}>
    <Bar dataKey="value" fill="#3b82f6" />
    <XAxis dataKey="name" />
    <YAxis domain={[0, 5]} />
  </BarChart>
)
```

```tsx
// Inside react-pdf Document — wrap with ReactPDFChart
import ReactPDFChart from 'react-pdf-charts'
import { BarChart, Bar, XAxis, YAxis } from 'recharts'

const PDFRatingChart = ({ rating }: { rating: number }) => (
  <ReactPDFChart>
    <BarChart width={200} height={80} data={[{ name: 'Overall', value: rating }]}>
      <Bar dataKey="value" isAnimationActive={false} fill="#3b82f6" />
      <XAxis dataKey="name" />
      <YAxis domain={[0, 5]} />
    </BarChart>
  </ReactPDFChart>
)
```

**REQUIRED:** Pass `isAnimationActive={false}` to all recharts chart child components (`Bar`, `Line`, `Area`, etc.) when rendering inside `ReactPDFChart`. Animations require browser DOM and will error server-side or in PDF context.

**Star rating display:** For the 1-5 star display specifically, custom SVG primitives inside react-pdf (`<Svg><Path d="...star..." /></Svg>`) are simpler and more visually precise than wrapping recharts. Use recharts only for bar/line metric charts. Write a `StarRating` component with react-pdf SVG primitives for the star display.

### What NOT to Use in PDF

- Standard HTML `<div>` charts — not rendered by react-pdf
- `<canvas>`-based charts (Chart.js) — not rendered by react-pdf
- `victory` — `react-pdf-charts` hasn't fully tested it; recharts v2 is the verified path
- recharts v3 — explicitly incompatible with `react-pdf-charts`

---

## 5. CMS Provider Data Catalog API

### Endpoint Pattern

Base URL: `https://data.cms.gov/provider-data/api/1/datastore/query/{datasetId}/0`

The DKAN datastore API is a GET endpoint. Filters use bracket-notation query params.

**VERIFIED** via live curl against the production API on 2026-06-15.

### Dataset IDs for Nursing Home Data

| Dataset | ID | Fields of Interest |
|---------|----|--------------------|
| NH Provider Information | `4pq5-n9py` | Core facility info, star ratings, beds, staffing |
| NH MDS Quality Measures | `djen-97ju` | 17 quality measures per CCN (long/short stay) |

### Query by CCN — Exact URL Pattern

The field name for the CCN in the Provider Information dataset is `cms_certification_number_ccn` (NOT `federal_provider_number` — that field does not exist in this dataset).

```
GET https://data.cms.gov/provider-data/api/1/datastore/query/4pq5-n9py/0
  ?conditions[0][property]=cms_certification_number_ccn
  &conditions[0][value]=686123
  &conditions[0][operator]==
  &limit=1
```

URL-encoded form (the `=` operator must be `%3D`):

```
https://data.cms.gov/provider-data/api/1/datastore/query/4pq5-n9py/0?conditions%5B0%5D%5Bproperty%5D=cms_certification_number_ccn&conditions%5B0%5D%5Bvalue%5D=686123&conditions%5B0%5D%5Boperator%5D=%3D&limit=1
```

Valid operators: `=`, `<>`, `<`, `<=`, `>`, `>=`, `not_empty`, `is_empty`. The string `==` is invalid and returns HTTP 400.

### Response Shape — Provider Information (4pq5-n9py)

The API returns `{ count: number, results: Array<Record> }`. For a single CCN query, `count` will be 1 and `results` has one element. Confirmed fields (from live query against CCN 686123):

```
cms_certification_number_ccn  provider_name             legal_business_name
provider_address              citytown                  state
zip_code                      number_of_certified_beds  overall_rating
health_inspection_rating      qm_rating                 staffing_rating
longstay_qm_rating            shortstay_qm_rating       average_number_of_residents_per_day
ownership_type                provider_type             location
latitude  longitude            processing_date
```

Full field list (95+ fields) includes staffing hours, deficiency scores, fines, inspection dates. All numeric values are returned as strings.

### Response Shape — MDS Quality Measures (djen-97ju)

Returns one row per measure per CCN. Fields:

```
cms_certification_number_ccn  measure_code    measure_description
resident_type                 q1_measure_score through q4_measure_score
four_quarter_average_score    used_in_quality_measure_five_star_rating
measure_period                processing_date
```

`resident_type` is either `"Long Stay"` or `"Short Stay"`. This is the dataset for the 12 hospitalization/ED bonus metrics. Filter by CCN and then client-side filter by `measure_code` for the desired metrics. The dataset has 17 measures for CCN 686123.

### Route Handler Pattern (Next.js 16)

```typescript
// app/api/provider/[ccn]/route.ts
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { ProviderApiResponseSchema } from '@/lib/schemas/cms'

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/api/provider/[ccn]'>
) {
  const { ccn } = await ctx.params

  const url = new URL(
    'https://data.cms.gov/provider-data/api/1/datastore/query/4pq5-n9py/0'
  )
  url.searchParams.set('conditions[0][property]', 'cms_certification_number_ccn')
  url.searchParams.set('conditions[0][value]', ccn)
  url.searchParams.set('conditions[0][operator]', '=')
  url.searchParams.set('limit', '1')

  const res = await fetch(url.toString(), {
    next: { revalidate: 3600 }, // cache CMS data for 1 hour
  })

  if (!res.ok) {
    return Response.json({ error: 'CMS API error' }, { status: 502 })
  }

  const raw = await res.json()
  const parsed = ProviderApiResponseSchema.safeParse(raw)

  if (!parsed.success) {
    return Response.json({ error: 'Invalid CMS data shape' }, { status: 422 })
  }

  if (parsed.data.count === 0) {
    return Response.json({ error: 'CCN not found' }, { status: 404 })
  }

  return Response.json(parsed.data.results[0])
}
```

**`next: { revalidate: 3600 }`** — CMS data updates monthly; caching for an hour on Vercel is safe and avoids rate-limit risk.

**`RouteContext<'/api/provider/[ccn]'>`** — This is a Next.js 16 App Router feature; types are auto-generated by `next dev`/`next build`. Params are now a Promise (requires `await ctx.params`).

---

## Complete Install Command

```bash
# From medelite-report/
npm install @react-pdf/renderer@^4.5.1 zod@^4.4.3 docx@^9.7.1 recharts@^2.15.4 react-pdf-charts@^1.0.0
npm install -D @types/recharts@^1.8.29
```

Note: `recharts` v2 ships its own types (`@types/recharts` is for the old v1 API — may not be needed for v2; verify post-install with `tsc --noEmit`).

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| PDF | `@react-pdf/renderer` | `html2canvas` + `jsPDF` | Forbidden by CLAUDE.md rule #7 |
| PDF | `@react-pdf/renderer` | `Puppeteer`/`Playwright` | Adds Chromium binary, overkill for structured report |
| Validation | `zod@^4.4.3` | `zod@^3.x` | v4 is faster, smaller, stable — no reason to use v3 |
| .docx | `docx` | `officegen` | `officegen` is unmaintained; `docx` actively maintained, browser + Node |
| Charts | `recharts@^2.15.4` + `react-pdf-charts` | `victory` | `react-pdf-charts` docs say "only recharts has been tested" |
| Charts | `recharts@^2.15.4` | `recharts@^3.x` | recharts v3 is explicitly incompatible with `react-pdf-charts` |
| Charts | manual react-pdf SVG | `react-pdf-charts` for star ratings | For 1-5 star display, manual `<Svg><Path />` in react-pdf is simpler; use `react-pdf-charts` for bar charts of metrics |

---

## Confidence Levels

| Area | Confidence | Source |
|------|------------|--------|
| `@react-pdf/renderer` version + React 19 compat | HIGH | npm peer dep declaration on 4.5.1 |
| Next.js 16 auto-opt-out (no config needed) | HIGH | Verified in Next.js 16 docs `serverExternalPackages.md` |
| `renderToBuffer` in route handler | HIGH | GitHub issue #2350 resolution + Next.js 14.2 release notes |
| Zod v4.4.3 as current latest | HIGH | npm dist-tags verified |
| Zod v4 idioms (`safeParse`, `z.infer`) | HIGH | zod.dev/v4 docs |
| `docx@9.7.1` browser Packer.toBlob | HIGH | npm description + browser demo links verified |
| `recharts@^2.15.4` as latest v2 | HIGH | npm versions list verified |
| `react-pdf-charts@1.0.0` peer deps | HIGH | npm peerDependencies verified |
| recharts v3 incompatibility with react-pdf-charts | HIGH | Documented in react-pdf-charts README warning |
| CMS API field name `cms_certification_number_ccn` | HIGH | Live API query against CCN 686123 confirmed |
| CMS dataset ID `4pq5-n9py` for Provider Info | HIGH | Live API query confirmed, 95 fields mapped |
| CMS dataset ID `djen-97ju` for MDS Quality Measures | HIGH | Live API query confirmed, 17 measures for CCN 686123 |
| Hospitalization/ED metrics in `djen-97ju` | MEDIUM | 17 measures confirmed but need to verify which `measure_code` values map to the 12 hospitalization/ED metrics specified in CLAUDE.md — requires cross-referencing NH_Data_Dictionary |

---

## Sources

- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.md` — Next.js 16 built-in external packages list (includes @react-pdf/renderer)
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — Route Handler API, params-as-Promise pattern
- https://react-pdf.org/compatibility — React 19 support since v4.1.0
- https://github.com/diegomura/react-pdf/issues/2350 — App Router fix history (resolved in Next.js 14.1.1)
- https://github.com/EvHaus/react-pdf-charts — react-pdf-charts README, peer deps, recharts v3 warning
- https://zod.dev/v4 — Zod v4 API changes, performance numbers
- https://data.cms.gov/provider-data/api/1/datastore/query/4pq5-n9py/0 — Live CMS API (queried 2026-06-15)
- npm registry: `@react-pdf/renderer@4.5.1`, `zod@4.4.3`, `docx@9.7.1`, `recharts@2.15.4`, `react-pdf-charts@1.0.0`
