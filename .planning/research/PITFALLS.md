# Pitfalls Research

**Domain:** CMS nursing-home report generator (Next.js 16 / React 19 / @react-pdf/renderer / Zod / Vercel)
**Researched:** 2026-06-15
**Confidence:** HIGH for @react-pdf/renderer and Next.js 16; MEDIUM for CMS API nuances (official docs render as binary in scraping tools, supplemented by community sources and ResDAC)

---

## Critical Pitfalls

### Pitfall 1: CCN Treated as a Number (Leading Zeros Silently Dropped)

**What goes wrong:**
CCN `056789` becomes `56789` the moment it passes through a JavaScript `Number()`, `parseInt()`, URL query parameter without explicit string typing, or a Zod `z.number()` schema. The query to CMS returns zero results. The error is silent — the app just shows "facility not found" even though the facility exists.

**Why it happens:**
Developers reach for numeric validation (e.g., "must be 6 digits") and accidentally coerce the value. Even a form `<input type="number">` discards leading zeros before the value reaches the handler.

**How to avoid:**
- Store CCN exclusively as `string` end-to-end (form value, Zod schema field, URL param, API call, type definition).
- Use `<input type="text" inputMode="numeric" pattern="[0-9A-Za-z]{6}">` — never `type="number"`.
- Zod schema: `z.string().regex(/^[0-9A-Za-z]{6}$/, "CCN must be exactly 6 alphanumeric characters")`.
- Note: CCN state codes have extended into alphanumeric (letters) as two-digit numeric state codes were exhausted (CMS Survey & Cert Letter 16-09). A pure `/^\d{6}$/` regex will reject valid newer CCNs.
- Test explicitly with CCN `056789` (a hypothetical leading-zero case) and with your reference CCN `686123`.

**Warning signs:**
- Anything that compiles `ccn` through a numeric type at any point.
- `typeof ccn === 'number'` anywhere in the codebase.
- `parseInt(ccn)` or `Number(ccn)` in API fetch layer.
- CMS queries returning empty results for known-valid CCNs.

**Phase to address:**
CCN input + CMS data-engine phase (Phase 1). Enforce string type in the Zod input schema and the CMS fetch function signature from day one.

---

### Pitfall 2: CMS Distribution ID Used in Fetch URL (Breaks on Every Refresh)

**What goes wrong:**
The CMS Provider Data Catalog exposes two query patterns:
- `GET /api/1/datastore/query/{distributionId}` — the distribution ID changes on every dataset refresh (weekly/monthly).
- `GET /api/1/datastore/query/{datasetId}/{index}` — the dataset ID `4pq5-n9py` (Provider Information / nursing home) is stable.

If the fetch URL is hardcoded with a distribution ID, it silently returns stale or 404 data after the next CMS refresh, which happens without notice.

**Why it happens:**
Developers copy an example URL from a CMS documentation sample or from the browser's "API endpoint" link on the dataset page, which often shows a distribution-ID URL. The dataset-ID pattern is buried in the API FAQ.

**How to avoid:**
- Always query via `https://data.cms.gov/provider-data/api/1/datastore/query/4pq5-n9py/0` (dataset ID `4pq5-n9py`, index `0`).
- Filter by CCN: append `?conditions[0][property]=cms_certification_number_ccn&conditions[0][value]={ccn}&conditions[0][operator]==`.
- Capture the reference fixture (`fixture:capture` script already present) and pin to the dataset-ID endpoint from the start.

**Warning signs:**
- Any URL in the fetch code containing a long alphanumeric string that does not match `4pq5-n9py`.
- Calls to `/datastore/query/{id}` where the ID is not the known dataset ID.
- Integration tests that stub a distribution-ID URL.

**Phase to address:**
CMS data-engine phase. Pin the endpoint URL as a named constant; document which ID is which.

---

### Pitfall 3: CMS API Called Client-Side (CORS Blocks the Fetch)

**What goes wrong:**
`fetch("https://data.cms.gov/provider-data/api/...")` called from browser JavaScript is blocked by the browser's CORS policy. `data.cms.gov` does not return an `Access-Control-Allow-Origin` header that permits arbitrary browser origins. The app works on localhost (because browsers sometimes allow same-machine requests or because curl/Postman bypasses CORS), then fails on every real user's browser.

**Why it happens:**
Developers test with curl or Postman (no CORS enforcement), or the Next.js dev server's reverse proxy masks the issue. The error only surfaces when deployed to Vercel or run in a real browser pointing at a different origin.

**How to avoid:**
- All CMS fetch calls must live in a Next.js Route Handler (`app/api/facility/route.ts`) that runs server-side only. The browser calls your API route; your API route calls CMS.
- Never import `fetchCMSProvider()` into a `"use client"` component or a browser bundle.
- The route handler also keeps the CMS endpoint URL and any future API keys out of the client bundle.

**Warning signs:**
- CMS fetch function imported by a `"use client"` component.
- Network tab in browser DevTools shows a request directly to `data.cms.gov`.
- Works in `npm run dev` but 403/CORS-error in production.

**Phase to address:**
CMS data-engine phase. The fetch function must only ever be called from a server component or route handler.

---

### Pitfall 4: @react-pdf/renderer Imported Without `ssr: false` / Missing `serverExternalPackages`

**What goes wrong:**
Two distinct failure modes, both fatal:

1. **Build failure**: `Module not found: ESM packages (@react-pdf/renderer) need to be imported`. Next.js tries to bundle the package during the server compilation pass, but `@react-pdf/renderer` ships ESM and uses Node.js-only internals (Yoga layout engine, `__dirname` references). The build crashes.

2. **Runtime crash**: `TypeError: PDFDocument is not a constructor` or `TypeError: ba.Component is not a constructor`. The package gets bundled incorrectly and its internal classes become undefined at runtime. This was the dominant failure pattern reported for Next.js 13–15 App Router and remains relevant for Next.js 16.

**Why it happens:**
The App Router by default bundles server components and route handlers. `@react-pdf/renderer` cannot survive this bundling because it relies on Node.js platform APIs that are stripped. Prior to Next.js 14.1.1 there was also a reconciler-level bug.

**How to avoid:**
In `next.config.ts`, explicitly opt the package out of bundling:
```ts
const nextConfig: NextConfig = {
  serverExternalPackages: ['@react-pdf/renderer'],
};
```
For browser-side `PDFDownloadLink` or `PDFViewer`, always use `next/dynamic` with `ssr: false` inside a `"use client"` component:
```ts
"use client";
const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFDownloadLink),
  { ssr: false }
);
```
Note: `ssr: false` is only legal inside a client component in the App Router; it will throw at the module level in a server component.

Server-side PDF generation (buffer for download): use a Route Handler that imports `renderToBuffer` directly — no dynamic import needed there, since route handlers run in Node.js only.

**Warning signs:**
- Build output mentions `@react-pdf/renderer` in a module-not-found error.
- `PDFDocument is not a constructor` at runtime.
- Any static import of `@react-pdf/renderer` in a file without `"use client"` that is rendered server-side.

**Phase to address:**
PDF export phase. Verify with `npm run verify:full` (which runs build) immediately after installing the package.

---

### Pitfall 5: Font.register() Fails in Server Components and on Vercel

**What goes wrong:**
`Font.register({ family: "MyFont", src: "/fonts/myfont.ttf" })` works in local dev but silently fails on Vercel, producing PDFs that fall back to a default font with no error thrown. Two failure modes:

1. **Server component context**: `Font.register()` relies on client-side module state that is not available during SSR. Calling it in a server component produces no registered font.
2. **Vercel path resolution**: The `/public` folder path (e.g., `"/fonts/myfont.ttf"`) resolves correctly in local Node.js but does not work in Vercel's serverless function sandbox where the working directory is different. The font silently fails to load.

**Why it happens:**
`react-pdf` resolves font `src` as a URL relative to the environment, not relative to the project root. In a serverless function, the public folder is not mounted at `/`.

**How to avoid:**
- Register fonts using absolute `https://` URLs (e.g., from Google Fonts CDN) rather than local paths — this works identically in local dev and on Vercel.
- If using local font files is non-negotiable: use `path.join(process.cwd(), 'public', 'fonts', 'myfont.ttf')` only inside a route handler (Node.js only) — never in a shared module.
- Only supported font formats are TTF and WOFF (not WOFF2, not OTF).
- Call `Font.register()` at module scope inside a file that is only ever imported server-side (or inside the route handler that calls `renderToBuffer`).

**Warning signs:**
- PDF renders in dev with correct fonts but on Vercel the font looks wrong (Helvetica fallback).
- `Font.register()` call is in a file that is also imported client-side.
- Font `src` is a relative path starting with `/`.

**Phase to address:**
PDF export phase. Test the Vercel deployment immediately after adding fonts; do not assume local dev behavior transfers.

---

### Pitfall 6: Web Charting Libraries (Recharts, Chart.js, Victory) Do Not Render in @react-pdf/renderer

**What goes wrong:**
Chart components from recharts, Chart.js, ApexCharts, or any library that renders to the DOM/canvas produce nothing (blank space) or throw errors inside a `<Document>` / `<Page>` from `@react-pdf/renderer`. This is a hard architectural incompatibility, not a configuration issue.

**Why it happens:**
`@react-pdf/renderer` does not render to the browser DOM — it uses its own PDF-specific reconciler. Web charting libraries depend on DOM APIs (`document`, `window`, `ResizeObserver`, canvas) that simply do not exist in the react-pdf rendering environment.

**How to avoid:**
Three viable approaches (in order of simplicity for this project):

1. **react-pdf native SVG primitives** (`<Svg>`, `<Circle>`, `<Rect>`, `<Path>`, `<Line>`, `<Text>`): For star-rating cards (1–5 filled circles/stars), this is the right approach. Build reusable `<StarRating rating={n} />` components using react-pdf SVG primitives. Zero dependencies. Fully server-renderable.

2. **react-pdf-charts wrapper** (only if complex charts are needed): Wraps recharts v2 (NOT v3 — recharts v3 is explicitly unsupported) with a conversion layer. Requires `isAnimationActive={false}` on all chart components or charts will not render. Adds significant complexity and a pinned recharts dependency.

3. **Server-side SVG-to-PNG conversion** (canvas/canvg + Image): Render SVG server-side, rasterize to PNG with canvg + node-canvas, pass base64 PNG to `<Image>`. Complex build requirements (native canvas bindings often fail on Vercel).

For this project (star ratings 1–5 and metric cards): use react-pdf native SVG primitives only. Do not install recharts for the PDF path.

**Warning signs:**
- Any recharts, chart.js, or apexcharts import inside a react-pdf `<Document>` tree.
- Charts render in web preview (web UI uses normal React DOM) but PDF shows blank space.
- Build errors mentioning `document is not defined` during PDF generation.

**Phase to address:**
Bonus charts phase. Plan the PDF chart approach (SVG primitives) before writing any PDF chart code.

---

### Pitfall 7: Zod Schema Too Strict — Rejects Valid Partial CMS Rows

**What goes wrong:**
A strict Zod schema with all fields required causes `parse()` to throw whenever CMS omits or suppresses a field. CMS suppresses fields for facilities that: (a) are newly certified with fewer than 12–15 months of data, (b) did not submit required data, or (c) have data that did not meet measure thresholds. The star-rating fields (`overall_rating`, `staffing_rating`, `quality_measure_rating`, `health_ins_rating`) can be `null` or missing entirely for these facilities.

**Why it happens:**
Developers write a Zod schema that mirrors the "happy path" response for CCN `686123` (which is a large established facility with all data present), then assume every facility will have the same fields populated.

**How to avoid:**
Mark all non-identity fields as `.nullable().optional()`. Only `cms_certification_number_ccn` and perhaps `provider_name` and `provider_address` should be required. Star ratings must be `z.number().nullable().optional()`.

Use `safeParse()` over `parse()` — return a typed error to the UI instead of throwing:
```ts
const result = CmsProviderSchema.safeParse(raw);
if (!result.success) {
  return { error: "Unexpected CMS response shape", details: result.error };
}
```

Render `null` rating values as "N/A" in the report, not as `0` stars.

**Warning signs:**
- Schema uses `z.number()` without `.nullable()` for any rating field.
- Tests only use CCN `686123` — add a test fixture for a newly-certified facility with suppressed ratings.
- `ZodError` surfaces for any CMS response in production but not in tests.

**Phase to address:**
CMS data-engine phase. Write the Zod schema alongside the fixture tests, with an explicit suppressed-data test case.

---

### Pitfall 8: Zod Schema Too Loose — Invalid Data Reaches the PDF

**What goes wrong:**
The inverse: a schema that uses `z.any()` or `z.unknown()` everywhere validates nothing. Malformed CMS responses (wrong field types, extra nesting on a refresh, or a schema change from CMS) silently reach the PDF and produce garbled output or crash the PDF renderer with an unhelpful error.

**Why it happens:**
Developers hit the "too strict" problem (Pitfall 7), overcorrect to `z.any()`, and remove all protection.

**How to avoid:**
Type every field explicitly. Use `.nullable().optional()` for CMS fields that can be absent — not `.any()`. For string fields that CMS occasionally returns as `"Not Available"` (a literal string), add a transform:
```ts
z.string().nullable().optional().transform(v => (v === "Not Available" ? null : v))
```
Run `safeParse()` and if it fails, log the raw response shape — do not silently swallow errors.

**Warning signs:**
- `z.any()` or `z.unknown()` appears in the CMS schema.
- No test exercises an invalid/malformed CMS response.
- PDF render crashes with a type error deep in react-pdf internals (the actual cause is undefined reaching a field that expected a string).

**Phase to address:**
CMS data-engine phase, same as Pitfall 7. Address both sides of the strictness tradeoff simultaneously.

---

### Pitfall 9: Next.js 16 Async Request API — Synchronous `params` / `searchParams` Access Removed

**What goes wrong:**
In Next.js 15, synchronous access to `params`, `searchParams`, `cookies()`, and `headers()` was deprecated but still functioned with a warning. In Next.js 16, synchronous access is **fully removed** — it throws at runtime. Code that does `const { ccn } = props.params` in a page or layout crashes.

**Why it happens:**
Most Next.js tutorials and Stack Overflow answers were written for Next.js 13/14 where sync access was standard. Training-data-based code suggestions reproduce the old pattern.

**How to avoid:**
Always `await` request-time APIs:
```ts
// next.config.ts route file
export default async function Page(props: PageProps<'/search/[ccn]'>) {
  const { ccn } = await props.params;
  // ...
}
```
Run `npx next typegen` after creating page files to get typed `PageProps` helpers.

**Warning signs:**
- `props.params.ccn` (synchronous) anywhere in App Router pages or layouts.
- TypeScript error from `@types/react` saying params is `Promise<...>`.
- Works in dev but crashes on Vercel (dev sometimes defers the error).

**Phase to address:**
Any phase that introduces dynamic route segments. Address in Phase 1 when the CCN lookup route is created.

---

### Pitfall 10: Next.js 16 Turbopack Build — Webpack Custom Config Silently Ignored

**What goes wrong:**
Next.js 16 ships with Turbopack as the default builder for both `next dev` and `next build`. Any `webpack(config) {}` function in `next.config.ts` is silently ignored by Turbopack. If a dependency (e.g., canvas bindings for chart rasterization) required a webpack loader, the build succeeds but the runtime import fails.

Additionally, a confirmed bug (Next.js issue #88844) in 16.1.x causes packages listed in `serverExternalPackages` to be omitted from `.next/standalone/node_modules` when building with Turbopack, causing "Cannot find module" crashes at runtime.

**Why it happens:**
Turbopack is a different bundler written in Rust — it does not execute webpack loaders and has its own config namespace (`turbopack` in `next.config.ts`, not `webpack`).

**How to avoid:**
- For this project, avoid any webpack-loader-dependent dependency (e.g., native canvas for chart rasterization) — use URL-based fonts and SVG primitives instead, which require no loaders.
- If `serverExternalPackages` is used (it will be, for `@react-pdf/renderer`): test with `npm run verify:full` (which runs `next build`) and confirm the standalone output includes the package. If not, add `--webpack` flag as a workaround while tracking the upstream fix.
- Do not add a `webpack()` function to `next.config.ts` — it has no effect under Turbopack and creates false confidence.

**Warning signs:**
- `next.config.ts` contains a `webpack(config)` function.
- Build reports success but runtime throws `Cannot find module`.
- Package appears in `serverExternalPackages` but is missing from `.next/standalone`.

**Phase to address:**
Initial configuration phase. Verify build immediately with `npm run verify:full` after any change to `next.config.ts`.

---

### Pitfall 11: `middleware.ts` Renamed to `proxy.ts` in Next.js 16

**What goes wrong:**
Next.js 16 deprecates the `middleware.ts` filename in favor of `proxy.ts`. The `middleware` named export function is also deprecated (rename to `proxy`). Config flags like `skipMiddlewareUrlNormalize` become `skipProxyUrlNormalize`. If middleware is used for any request-level logic (e.g., CCN format validation at the edge), the old file name silently stops executing after upgrade.

**Why it happens:**
Purely a naming change. The old file does not throw — it just does nothing.

**How to avoid:**
- For this project: avoid middleware/proxy entirely. All request handling belongs in route handlers.
- If middleware becomes necessary: use `proxy.ts` with export function `proxy()` from day one.

**Warning signs:**
- File named `middleware.ts` exists at the project root.
- Deprecation warning in `next dev` output mentioning `middleware`.

**Phase to address:**
Initial configuration phase.

---

### Pitfall 12: .docx Export — Response Body Exceeds 4.5 MB Vercel Limit

**What goes wrong:**
Vercel Route Handler responses have a hard 4.5 MB body limit. A `.docx` with embedded images (facility logos, chart screenshots) can exceed this, returning a `413 FUNCTION_PAYLOAD_TOO_LARGE` error. The user clicks "Download Word" and gets an error page.

**Why it happens:**
Developers test `.docx` generation locally (no payload limit) and do not discover the constraint until deployed.

**How to avoid:**
- Keep `.docx` content text-only or with minimal embedded assets. The 4.5 MB limit is generous for a text report — as long as you do not embed rasterized charts or full-resolution images.
- Use `docx` (npm: `docx`) for generation — it runs universally in Node.js with no native dependencies, returns a `Buffer` from `Packer.toBuffer()`, and works within Vercel's serverless constraints.
- Return the buffer with correct headers: `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document` and `Content-Disposition: attachment; filename="report.docx"`.
- Test `.docx` file size in CI with a realistic fixture before deploying.

**Warning signs:**
- `.docx` download works locally but returns 413 or times out on Vercel.
- Embedded images in the Word document without size-checking.
- Using `officegen` (older library with sparse maintenance) or any library requiring native modules — prefer `docx` which is pure JS.

**Phase to address:**
.docx export bonus phase. Size-check the output in the route handler test.

---

### Pitfall 13: Header Branding Derived from or Replaced by Facility Name

**What goes wrong:**
Code that passes the facility name (or the manual override) into `assembleHeader()`, or that places the facility name in the report header block, violates the core CLAUDE.md standing rule. The in-report header must always read: `"INFINITE — Managed by MEDELITE"` / `"FACILITY ASSESSMENT SNAPSHOT"` / `{state abbreviation}`. The facility name — even the manual override — appears exclusively under "Name of Facility" in the body.

**Why it happens:**
Naive report generation code conflates the "title block" with the "facility name block." When reviewing the spec quickly, "make the header show the facility" seems natural.

**How to avoid:**
- `assembleHeader(stateCode: string)` takes one argument and returns three static strings plus the state abbreviation. No facility name argument, ever.
- Add a test: `expect(assembleHeader("FL")).not.toContain("Kendall")` — facility name must not appear in the header output.
- Separate the `<Header>` component from the `<FacilityNameSection>` component in the PDF layout, with no prop sharing between them.

**Warning signs:**
- `assembleHeader` accepting a facility name parameter.
- The word "Kendall" (or any facility name) appearing in the PDF header section in any test output.
- `facilityName` prop passed to the header component.

**Phase to address:**
PDF export phase, Phase 1 of PDF layout.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `z.any()` for entire CMS response | Unblocks development quickly | Bad data reaches PDF renderer; runtime crashes are hard to diagnose | Never — use `.nullable().optional()` on individual fields instead |
| `<input type="number">` for CCN | Native numeric keyboard on mobile | Silently drops leading zeros | Never |
| Hardcoding a CMS distribution ID | Simple URL string | Breaks silently on every CMS refresh (weekly) | Never |
| Fetching CMS client-side | Eliminates route handler boilerplate | CORS block in all real browsers | Never |
| Importing recharts inside react-pdf Document tree | Familiar charting API | PDF renders blank charts — not detected until PDF is opened | Never |
| `Font.register()` with a `/public/` relative path | Works locally | Silently fails on Vercel | Never in production code |
| Using webpack config for @react-pdf/renderer externalization | Works in Next.js 13/14 | Silently ignored under Turbopack (Next.js 16 default) | Never — use `serverExternalPackages` |
| `middleware.ts` for request validation | Familiar filename | Deprecated in Next.js 16; silently does nothing | Never — use route handler validation |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| CMS Provider Data Catalog | Using distribution-ID endpoint (changes every refresh) | Use dataset-ID endpoint: `/api/1/datastore/query/4pq5-n9py/0` |
| CMS Provider Data Catalog | Calling from browser (CORS blocked) | Call from Next.js Route Handler only |
| CMS Provider Data Catalog | Assuming all fields populated | All star-rating fields must be `.nullable().optional()` in Zod |
| CMS Provider Data Catalog | Numeric CCN input (drops leading zeros) | String CCN throughout; `<input type="text">` |
| @react-pdf/renderer | Static import in a server component without `serverExternalPackages` | Add to `serverExternalPackages` in `next.config.ts` |
| @react-pdf/renderer | `PDFDownloadLink` without `ssr: false` | `next/dynamic` with `{ ssr: false }` inside `"use client"` component |
| @react-pdf/renderer | Font from `/public/` path on Vercel | Use absolute `https://` CDN URL for fonts |
| docx library | Expecting `officegen`-style API | Use `docx` npm package; `Packer.toBuffer()` returns Buffer |
| Vercel Route Handler | PDF/docx response > 4.5 MB | Keep exports text-focused; test response size pre-deploy |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Calling CMS API without timeout | Lookup hangs indefinitely if CMS is slow | Set `AbortController` timeout (5–8 seconds); show error on timeout | Every slow CMS response |
| Generating PDF synchronously on first request (cold start) | First PDF download takes 5–10 seconds | Accept cold start; @react-pdf/renderer is CPU-intensive. On Vercel Hobby: 300s limit (ample). Do not add artificial retries. | N/A for this scale |
| Uncompressed fonts embedded in PDF | PDF file size blooms (5–10 MB+) | Use subset-compatible fonts; prefer standard PDF fonts (Helvetica) where report quality allows | Every PDF export |
| Recharts animations not disabled in react-pdf-charts | Charts render as empty rectangles | Set `isAnimationActive={false}` on every chart component | Every PDF with charts if using react-pdf-charts |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| CMS API URL or any future key exposed in client bundle | Key rotation risk; API abuse | All CMS calls in server-only route handler; use `NEXT_PUBLIC_` prefix only for genuinely public values |
| Unsanitized CCN passed to CMS URL without validation | Path traversal / injection if CMS URL is constructed dynamically | Validate CCN with Zod regex before using in URL; never interpolate raw user input into fetch URLs |
| `serverRuntimeConfig` / `publicRuntimeConfig` in next.config | Removed in Next.js 16; silently undefined | Use `process.env` for server-only vars; `NEXT_PUBLIC_*` for client-accessible vars |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No loading state while CMS fetch + PDF generation runs | User clicks "Generate" and sees nothing for 2–5 seconds, assumes broken | Show a spinner or progress indicator immediately on form submit |
| PDF download fails silently (CORS / module error) | User gets no feedback, retries fruitlessly | Catch all errors in route handler and return JSON error with status 500; show user-friendly message |
| "Not Available" string from CMS rendered as literal text in PDF | Confusing to readers expecting a number | Transform `"Not Available"` to `null` in Zod; render null as `"N/A"` with a styled placeholder |
| Invalid CCN accepted until CMS returns 0 results | User gets "facility not found" with no indication of why | Validate CCN format (6 alphanumeric chars) client-side before submitting, with inline error message |
| Manual facility name override not cleared when CCN changes | Stale override from previous facility persists in new report | Reset override field when CCN search succeeds and returns a new facility |

---

## "Looks Done But Isn't" Checklist

- [ ] **CCN input:** Verify leading zeros survive from `<input>` → Zod schema → CMS API URL → rendered report. Test with a CCN starting with `0`.
- [ ] **PDF branding:** Verify `assembleHeader("FL")` output does not contain any facility name. Verify in PDF download, not just web preview.
- [ ] **Suppressed CMS fields:** Verify app renders "N/A" gracefully for a facility with null star ratings (add fixture or mock for newly certified facility).
- [ ] **Font on Vercel:** Verify deployed Vercel URL PDF uses correct font — not just localhost. Fonts from `/public` path often silently fail only on Vercel.
- [ ] **CMS endpoint URL:** Verify the URL uses dataset ID `4pq5-n9py` (not a distribution ID). Search codebase for any 30+ character alphanumeric string used as a URL segment.
- [ ] **react-pdf charts:** Open the downloaded PDF (not the web preview) and confirm charts render. Web preview uses DOM; PDF generation uses react-pdf reconciler — they can diverge.
- [ ] **Error handling:** Deliberately submit an invalid CCN (`000000`), a CCN that doesn't match any facility, and disconnect network mid-request. Confirm the user sees a clear error each time, not an uncaught exception page.
- [ ] **Next.js 16 async params:** Verify no page/layout accesses `props.params` or `props.searchParams` synchronously. TypeScript strict mode will catch this if `@types/react` is current.
- [ ] **.docx file size:** Download the generated .docx and confirm it is under 4 MB (with margin from the 4.5 MB Vercel limit).
- [ ] **build passes:** `npm run verify:full` must be green before declaring any phase complete.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Leading-zero CCN breakage found in production | LOW | Fix `<input type="text">`, fix Zod schema to `z.string()`, fix any `Number(ccn)` calls. No data migration needed. |
| Distribution ID hardcoded, CMS refresh broke it | LOW | Replace URL string with dataset-ID endpoint. One-line fix, re-deploy. |
| react-pdf bundling crashes build | MEDIUM | Add `serverExternalPackages: ['@react-pdf/renderer']` to `next.config.ts`, re-run build. If Turbopack standalone issue also hits, add `--webpack` flag as temporary workaround. |
| Font broken on Vercel only | LOW | Switch `Font.register` src to absolute `https://` CDN URL. Re-deploy. |
| Charts blank in PDF (recharts in react-pdf) | HIGH | Rewrite chart components using react-pdf SVG primitives (`<Svg>`, `<Rect>`, `<Circle>`) from scratch. No shortcut — recharts fundamentally cannot render in react-pdf's reconciler. Budget 1–2 days. |
| Zod schema too strict, new facility fails | LOW | Add `.nullable().optional()` to all optional fields. Extend test fixtures with suppressed-data case. |
| Vercel 4.5 MB docx response error | LOW–MEDIUM | Remove embedded images from docx; test output size in route handler test. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| CCN as number / leading zeros | Phase 1: CCN input + CMS data engine | Unit test: `parseCcn("056789")` returns string `"056789"` |
| Distribution ID in URL | Phase 1: CMS data engine | Code review: grep for any non-`4pq5-n9py` ID in fetch URLs |
| CMS called client-side (CORS) | Phase 1: CMS data engine | Network tab in deployed Vercel URL shows no `data.cms.gov` requests from browser |
| @react-pdf/renderer SSR / bundling | Phase 2: PDF export scaffold | `npm run verify:full` green after install; route handler returns PDF buffer |
| Font registration on Vercel | Phase 2: PDF export scaffold | Font renders correctly in PDF downloaded from Vercel URL (not just localhost) |
| Charts in react-pdf (DOM incompatibility) | Phase 3: Bonus charts | PDF opened in Adobe Reader / browser shows filled chart shapes, not blank rectangles |
| Zod too strict / suppressed fields | Phase 1: CMS data engine | Test fixture with null ratings parses without error; renders "N/A" |
| Zod too loose / invalid data in PDF | Phase 1: CMS data engine | Test with malformed response; `safeParse` returns error; UI shows error message |
| Next.js 16 async params | Phase 1 or any route phase | TypeScript strict mode + `next typegen` catches sync access; no runtime errors on Vercel |
| Turbopack / webpack config ignored | Configuration phase | `npm run verify:full` after every `next.config.ts` change |
| middleware.ts deprecated | Configuration phase | No `middleware.ts` in project; any proxy logic uses `proxy.ts` or route handlers |
| .docx payload > 4.5 MB | Phase 4: .docx export | `Buffer.byteLength(docxBuffer) < 4_500_000` assertion in route handler test |
| Header branding replaced by facility name | Phase 2: PDF export | `assembleHeader("FL")` unit test asserts output does not contain any facility name string |

---

## Sources

- Next.js 16 upgrade guide (official, retrieved 2026-06-15): https://nextjs.org/docs/app/guides/upgrading/version-16
- react-pdf compatibility page (official): https://react-pdf.org/compatibility
- react-pdf GitHub issue #2350 — App Router route handler incompatibility: https://github.com/diegomura/react-pdf/issues/2350
- react-pdf GitHub issue #2460 — renderToBuffer/renderToStream in Next.js 13+: https://github.com/diegomura/react-pdf/issues/2460
- react-pdf GitHub issue #3074 — renderToBuffer Next.js 15 (`PDFDocument is not a constructor`): https://github.com/diegomura/react-pdf/issues/3074
- react-pdf GitHub issue #2816 — Font.register in Next.js 14 server component: https://github.com/diegomura/react-pdf/issues/2816
- react-pdf-charts README — recharts v3 incompatibility, animation requirement: https://github.com/EvHaus/react-pdf-charts/blob/dev/README.md
- react-pdf GitHub issue #1050 — charting libraries in react-pdf: https://github.com/diegomura/react-pdf/issues/1050
- CMS Provider Data Catalog — About page: https://data.cms.gov/provider-data/about
- CMS Provider Information dataset: https://data.cms.gov/provider-data/dataset/4pq5-n9py
- CMS API documentation: https://data.cms.gov/provider-data/docs
- ResDAC — Provider Number (CCN format): https://resdac.org/cms-data/variables/provider-number
- CMS Survey & Cert Letter 16-09 — CCN state codes (alphanumeric extension): https://www.cms.gov/medicare/provider-enrollment-and-certification/surveycertificationgeninfo/downloads/survey-and-cert-letter-16-09.pdf
- Next.js GitHub issue #88844 — Turbopack standalone build omits serverExternalPackages: https://github.com/vercel/next.js/issues/88844
- Vercel Functions Limits (official, updated 2026-06-02): https://vercel.com/docs/functions/limitations
- docx library: https://docx.js.org/
- Next.js serverExternalPackages docs: https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages

---
*Pitfalls research for: CMS nursing-home report generator (Infinite Snapshot / Medelite)*
*Researched: 2026-06-15*
