# Phase 1: Foundation & CMS Data Layer - Research

**Researched:** 2026-06-16
**Domain:** CMS Provider Data Catalog API (live query mechanics), Zod v4 schema pipeline, npm package install
**Confidence:** HIGH — all priority-1 claims verified by live API calls made during this session

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Capture all three CMS datasets for CCN 686123 now: Provider Information `4pq5-n9py` → `tests/fixtures/provider-686123.json`, Medicare Claims Quality Measures `ijh5-nb2v` → claims fixture, State US Averages `xcdc-v8bm` → averages fixture (NATION + FL rows).
- **D-02:** Phase 1 builds only the provider `CMSRowSchema` + typed pipeline. Claims/averages fixtures are captured but their Zod schemas are deferred to Phase 5.
- **D-03:** Capture script uses a dataset registry (id → output path). Re-resolve dataset IDs via the CMS metastore at capture time. Phase 5 adds registry entries, not plumbing.
- **D-04:** Lean schema — model only fields the report depends on; `.passthrough()` all other columns.
- **D-05:** Depended-on fields are **required keys** with `.nullable()` values — NOT `.optional()`. A renamed/removed CMS key causes `safeParse` to fail loudly.
- **D-06 (deliberate deviation):** Refines ROADMAP SC#4's `.nullable().optional()` to required-key + `.nullable()`-value. Do NOT treat the absent `.optional()` as a defect.
- **D-07:** Coerce inside the schema — numeric strings → `number`; downstream consumers receive clean typed values.
- **D-08:** Map `""` / whitespace-only → `null` BEFORE numeric coercion. `z.coerce.number("")` = `0`, not `null`.
- **D-09:** Only empty/whitespace → null; preserve a real `"0"` as `0`.
- **D-10:** Do NOT coerce identifier/text-numeric fields — CCN and ZIP stay strings.
- **D-11:** Committed fixtures are the single source of truth for unit tests; live CMS calls confined to `npm run fixture:capture` plus one env-gated smoke test.
- **D-12:** Commit small malformed fixtures: (a) row missing a required key, (b) suppressed row (empty-string values), (c) wrong-shape/invalid-CCN response.

### Required test assertions (derived — planner must encode):
- Suppressed empty-string value → `null` (not `0`).
- A real `"0"` → `0`.
- A row missing a required depended-on key → `safeParse` fails.
- CCN and ZIP preserve leading zeros as strings.
- The captured reference fixture row → `safeParse` succeeds with correctly typed output.

### Claude's Discretion
- Exact module layout under `src/lib/` (e.g. `cms/schema.ts`, `cms/types.ts`, `cms/parse.ts`) and file naming.
- Exact Zod construction (`z.preprocess` vs `.transform`, how the empty→null pre-step is composed).
- Whether the capture script needs deps beyond the already-installed `tsx`.

### Deferred Ideas (OUT OF SCOPE)
- Claims & state/national-average Zod schemas → Phase 5.
- API routes, `ReportViewModel`, `assembleHeader()` → Phase 2.
- UI, CCN search, live preview, error UI, Vercel deploy → Phases 2–3.
- PDF export → Phase 4.
- .docx → Phase 6.
- Charts/polish → Phase 7.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-02 | Every CMS response validated by a Zod schema before reaching the UI or any export; suppressed/blank fields handled gracefully | Zod v4 pipeline with `z.preprocess` + `.passthrough()` verified live; empty-string → null pipeline confirmed working |
| DATA-06 | Every CMS field used traces to the captured fixture or NH_Data_Dictionary — never from memory | Live API calls produced the exact field names and response shapes for all three datasets; fixtures capture anchors field names |
</phase_requirements>

---

## Summary

Phase 1 is a pure infrastructure phase: install 5 libraries, implement the fixture-capture script against the live CMS API, capture three dataset fixtures for CCN 686123, build the provider `CMSRowSchema` with a Zod v4 preprocess pipeline, and keep `npm run verify` green. Nothing is user-facing.

The highest-risk element is the live CMS API capture mechanics. This research executes live `curl` calls against all three target dataset endpoints to verify the exact request shapes, response envelopes, and field names — removing all guesswork from the planner. The query interface uses bracket-notation query parameters (`conditions[0][property]`, `conditions[0][value]`, `conditions[0][operator]`); the operator must be a single `=` (URL-encoded `%3D`), not `==` (which returns HTTP 400, verified live).

The second risk area is the Zod v4 empty-string-to-null coercion pipeline. Live tests in the installed Zod `4.4.3` confirm that `z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.coerce.number().nullable())` correctly maps `""` → `null`, `"0"` → `0`, and `"5"` → `5`. One breaking change from Zod v3 is critical: `result.error.errors` is `undefined` in v4; use `result.error.issues` instead.

**Primary recommendation:** Run `npm run fixture:capture` as the absolute first action — field names in the schema must come from the captured fixture, not memory (CLAUDE.md rule #3). The live API data captured during this research session provides exact field names and values to anchor that fixture.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CMS API fetch (fixture capture) | Node.js script (`tsx`) | — | Runs at dev time only; no server route needed in Phase 1 |
| Zod schema + parse pipeline | Shared TypeScript module (`src/lib/cms/`) | — | No React/Next dependency; pure TS; consumed by Phase 2 route handler |
| Fixture files | `tests/fixtures/` | — | Static JSON; imported directly by tests via `resolveJsonModule: true` |
| npm install | `medelite-report/` | — | All 5 libs are production deps; `tsx` (already installed) runs the capture script |
| Test gate (`npm run verify`) | Vitest (node env) | tsc + eslint + prettier | Must stay green after every task in this phase |

---

## PRIORITY 1: Live CMS API Mechanics — Verified Evidence

> All data in this section is `[VERIFIED]` from live API calls made during this research session on 2026-06-16.

### Endpoint Pattern

**Stable dataset-ID endpoint (use this — not distribution IDs):**

```
GET https://data.cms.gov/provider-data/api/1/datastore/query/{datasetId}/0
```

The `{datasetId}` is stable; distribution IDs (the UUID-like strings visible in the metastore) rotate on every dataset refresh (weekly/monthly). [VERIFIED: live curl 2026-06-16]

**Metastore (for confirming dataset IDs are valid at capture time):**

```
GET https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items
```

Returns an array of 234 dataset objects (as of 2026-06-16). Each object has an `identifier` field. All three dataset IDs confirmed present: [VERIFIED: live curl 2026-06-16]

| Dataset ID | `title` in metastore | `modified` |
|------------|---------------------|------------|
| `4pq5-n9py` | Provider Information | 2026-05-01 |
| `ijh5-nb2v` | Medicare Claims Quality Measures | 2026-05-01 |
| `xcdc-v8bm` | State US Averages | 2026-05-01 |

### Filter (conditions) Syntax

```
?conditions[0][property]={fieldName}
&conditions[0][value]={value}
&conditions[0][operator]==
```

- The operator is a single `=` sign, URL-encoded as `%3D`.
- Using `==` (double equals) returns **HTTP 400**. [VERIFIED: live curl 2026-06-16]
- Valid operators (from STACK.md prior research): `=`, `<>`, `<`, `<=`, `>`, `>=`, `not_empty`, `is_empty`.
- Multiple conditions use `conditions[1][...]`, `conditions[2][...]`, etc.

**Working URL for CCN 686123 provider lookup:**

```
https://data.cms.gov/provider-data/api/1/datastore/query/4pq5-n9py/0?conditions%5B0%5D%5Bproperty%5D=cms_certification_number_ccn&conditions%5B0%5D%5Bvalue%5D=686123&conditions%5B0%5D%5Boperator%5D=%3D&limit=1
```

### Response Envelope (all three datasets)

```json
{
  "results": [ ... ],
  "count": <number>,
  "schema": { "<distribution-uuid>": { "fields": [...] } },
  "query": { "limit": 1500, "offset": 0, "resources": [...], ... }
}
```

[VERIFIED: live curl 2026-06-16]

- `results` — array of row objects.
- `count` — total matching rows (not just the page returned).
- `schema` — keyed by a distribution UUID (rotates); use it to enumerate columns but do not use the UUID as an endpoint.
- `query` — echoes the resolved query, including default `limit: 1500` when none specified.
- Default limit is **1500**; no pagination needed for single-CCN queries that return 1–4 rows.

### No Authentication Required

No API key or auth header needed. Response headers confirm no rate-limit headers are present. `content-type: application/json`. [VERIFIED: live curl 2026-06-16]

CORS blocks browser calls (as documented in PITFALLS.md), but server-side `fetch` and the `tsx` capture script run without restriction. [VERIFIED: confirmed by STACK.md prior research; no CORS issue in Node.js context]

### Dataset 1: Provider Information (`4pq5-n9py`)

**CCN filter field:** `cms_certification_number_ccn` [VERIFIED: live curl 2026-06-16]

**Verified fields for CCN 686123 (fields the report needs):**

| Field name | Live value | Type in API |
|------------|-----------|-------------|
| `cms_certification_number_ccn` | `"686123"` | string |
| `provider_name` | `"KENDALL LAKES HEALTHCARE AND REHAB CENTER"` | string |
| `legal_business_name` | `"KENDALL LAKES HEALTHCARE AND REHAB CENTER, LLC"` | string |
| `provider_address` | `"5280 SW 157 AVENUE"` | string |
| `citytown` | `"MIAMI"` | string |
| `state` | `"FL"` | string (2-char) |
| `zip_code` | `"33185"` | string |
| `number_of_certified_beds` | `"150"` | string (numeric encoded as string) |
| `overall_rating` | `"5"` | string |
| `health_inspection_rating` | `"5"` | string |
| `qm_rating` | `"5"` | string |
| `staffing_rating` | `"2"` | string |
| `longstay_qm_rating` | `"5"` | string |
| `shortstay_qm_rating` | `"3"` | string |
| `processing_date` | `"2026-05-01"` | string |
| `location` | `"5280 SW 157 AVENUE,MIAMI,FL,33185"` | string (combined — do NOT use for address composition per CLAUDE.md) |

**Fields confirmed by live query but NOT in the report (do not model in CMSRowSchema):** ~95 additional fields including staffing hours, deficiency scores, turnover, inspection dates, chain info. With `.passthrough()` these are ignored safely.

**Fields with suppression (empty string `""` possible):**
- `total_nursing_staff_turnover` — `""` in live 686123 response (footnote_field is `"26"`)
- `registered_nurse_turnover` — `""` in live 686123 response
- `number_of_citations_from_infection_control_inspections` — `""`
- `average_number_of_residents_per_day_footnote` — `""`
- All `*_rating_footnote` fields — `""`

This confirms that CMS returns suppressed values as empty strings with the key present, validating D-05/D-06/D-08. [VERIFIED: live curl 2026-06-16]

### Dataset 2: Medicare Claims Quality Measures (`ijh5-nb2v`)

**CCN filter field:** `cms_certification_number_ccn` [VERIFIED: live curl 2026-06-16]

**Response: 4 rows for CCN 686123** (one per measure code). No pagination needed.

**All row fields (from live query):**

```
cms_certification_number_ccn, provider_name, provider_address, citytown, state,
zip_code, measure_code, measure_description, resident_type, adjusted_score,
observed_score, expected_score, footnote_for_score, used_in_quality_measure_five_star_rating,
measure_period, location, processing_date
```

[VERIFIED: live curl 2026-06-16]

**Live data for all 4 rows (CCN 686123, period 20241001–20250930):**

| `measure_code` | `measure_description` | `resident_type` | `adjusted_score` | `observed_score` | `expected_score` |
|-------------|----------------------|----------------|-----------------|-----------------|-----------------|
| `521` | Percentage of short-stay residents who were rehospitalized after a nursing home admission | Short Stay | `25.575578` | `27.372263` | `25.535365` |
| `522` | Percentage of short-stay residents who had an outpatient emergency department visit | Short Stay | `8.094575` | `7.664234` | `10.579347` |
| `551` | Number of hospitalizations per 1000 long-stay resident days | Long Stay | `2.752503` | `2.062629` | `1.426903` |
| `552` | Number of outpatient emergency department visits per 1000 long-stay resident days | Long Stay | `0.910105` | `0.656291` | `1.201392` |

[VERIFIED: live curl 2026-06-16]

**Display score:** `adjusted_score` (risk-adjusted, matches what CMS Care Compare shows per CLAUDE.md).

**Note about STACK.md dataset ID discrepancy:** STACK.md prior research listed `djen-97ju` as the MDS Quality Measures dataset ID (17 measures). The correct dataset for the 4 hospitalization/ED claims measures is `ijh5-nb2v` (4 rows for CCN 686123, confirmed live). CONTEXT.md D-01 correctly specifies `ijh5-nb2v`. Do not use `djen-97ju` for the claims metrics — it is a different dataset.

### Dataset 3: State US Averages (`xcdc-v8bm`)

**Key field:** `state_or_nation` — filter value is `FL` (state code) or `NATION`.

**CCN filter:** Not applicable — this dataset has no CCN column. It is keyed by `state_or_nation`. The capture script fetches two rows: `state_or_nation = NATION` and `state_or_nation = FL`. [VERIFIED: live curl 2026-06-16]

**Total dataset size:** 54 rows (one per state + DC + nation). [VERIFIED: live curl 2026-06-16]

**The 4 hospitalization/ED column names are hash-suffixed** (CMS truncates long column names). The exact column names, verified from live response: [VERIFIED: live curl 2026-06-16]

| Column in `xcdc-v8bm` | Maps to measure code | NATION value | FL value |
|----------------------|---------------------|-------------|---------|
| `percentage_of_short_stay_residents_who_were_rehospitalized__1d02` | 521 | `23.875617` | `26.203324` |
| `percentage_of_short_stay_residents_who_had_an_outpatient_em_d911` | 522 | `12.013574` | `9.157686` |
| `number_of_hospitalizations_per_1000_longstay_resident_days` | 551 | `1.897659` | `2.147753` |
| `number_of_outpatient_emergency_department_visits_per_1000_l_de9d` | 552 | `1.798049` | `1.156036` |

These hash-suffixed names are stable (they are part of the column definition, not the distribution ID). The fixture captures the full row — Phase 5 matches by column name, not description, since descriptions are unambiguous identifiers via the hash suffix.

---

## PRIORITY 2: Capture Script Structure

### Dataset Registry Pattern (D-03)

The registry is a typed constant in the capture script mapping each dataset to its output path. Example pattern (Claude has discretion over exact syntax):

```typescript
// scripts/capture-fixture.ts
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const FIXTURES_DIR = join(process.cwd(), 'tests', 'fixtures')

interface DatasetCapture {
  datasetId: string
  outputFile: string
  filter?: { property: string; value: string }
  /** For xcdc-v8bm: fetch multiple rows by state_or_nation */
  multiFilter?: Array<{ property: string; value: string }>
}

const REGISTRY: DatasetCapture[] = [
  {
    datasetId: '4pq5-n9py',
    outputFile: 'provider-686123.json',
    filter: { property: 'cms_certification_number_ccn', value: '686123' },
  },
  {
    datasetId: 'ijh5-nb2v',
    outputFile: 'claims-686123.json',
    filter: { property: 'cms_certification_number_ccn', value: '686123' },
  },
  {
    datasetId: 'xcdc-v8bm',
    outputFile: 'averages-xcdc.json',
    // Fetch both NATION and FL rows; store as { NATION: {...}, FL: {...} }
    multiFilter: [
      { property: 'state_or_nation', value: 'NATION' },
      { property: 'state_or_nation', value: 'FL' },
    ],
  },
]
```

**Phase 5 adds entries by appending to `REGISTRY`** — no plumbing changes needed.

### Fetch Helper (no extra deps — Node 18+ built-in `fetch` + `tsx`)

```typescript
const BASE = 'https://data.cms.gov/provider-data/api/1/datastore/query'

async function fetchDataset(datasetId: string, property: string, value: string) {
  const url = new URL(`${BASE}/${datasetId}/0`)
  url.searchParams.set('conditions[0][property]', property)
  url.searchParams.set('conditions[0][value]', value)
  url.searchParams.set('conditions[0][operator]', '=')
  // No explicit limit needed — default is 1500, more than enough for 1–4 rows
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`CMS API ${res.status} for ${datasetId}`)
  const data = await res.json() as { results: unknown[]; count: number }
  if (data.count === 0) throw new Error(`No results for ${datasetId} / ${property}=${value}`)
  return data.results
}
```

`tsx` is already installed (`devDependencies: tsx@^4.22.4`). Node 18+ `fetch` is available (Node 26.2.0 confirmed on this machine). No additional dependencies needed for the capture script. [VERIFIED: package.json]

### Output Fixture Shapes

**`tests/fixtures/provider-686123.json`** — The full API response results array (single-element array, or just the row object). ROADMAP SC#1 requires this exact path and name.

**`tests/fixtures/claims-686123.json`** — Array of 4 row objects (one per measure code 521/522/551/552).

**`tests/fixtures/averages-xcdc.json`** — Recommend an object keyed by `state_or_nation`: `{ "NATION": {...full NATION row...}, "FL": {...full FL row...} }`.

### Malformed Fixtures (D-12)

Commit to `tests/fixtures/malformed/` (or inline in test files as objects):

**(a) Missing required key:**
```json
{
  "provider_name": "Test Facility",
  "overall_rating": "4"
}
```
(Missing `cms_certification_number_ccn` — must cause `safeParse` to fail.)

**(b) Suppressed row (empty-string values):**
```json
{
  "cms_certification_number_ccn": "000001",
  "provider_name": "New Facility",
  "provider_address": "123 Main St",
  "citytown": "Anytown",
  "state": "TX",
  "zip_code": "75001",
  "number_of_certified_beds": "30",
  "overall_rating": "",
  "health_inspection_rating": "",
  "qm_rating": "",
  "staffing_rating": ""
}
```
(All rating fields empty string → must become `null` after parse, not `0`.)

**(c) Wrong shape / invalid structure:**
```json
{ "error": "invalid_ccn", "message": "No matching records" }
```
(Entirely wrong shape — `results` key missing — must fail `safeParse`.)

---

## PRIORITY 3: Library Install & Verify-Gate

### Peer Dependency Status — React 19 Compatibility

[VERIFIED: npm registry 2026-06-16]

| Library | Version to Install | React 19 Peer Dep | Status |
|---------|-------------------|-------------------|--------|
| `@react-pdf/renderer` | `^4.5.1` | `^16.8.0 \|\| ^17 \|\| ^18 \|\| ^19` | CLEAN |
| `zod` | `^4.4.3` | none declared | CLEAN |
| `docx` | `^9.7.1` | none declared | CLEAN |
| `recharts` | `^2.15.4` (PINNED — not `latest` which is v3) | `^16.0.0 \|\| ^17 \|\| ^18 \|\| ^19` | CLEAN |
| `react-pdf-charts` | `^1.0.0` | `react: ^18.3.1 \|\| ^19.2.0`, `@react-pdf/renderer: ^4.3.1` | CLEAN |

No postinstall scripts on any of the 5 packages. [VERIFIED: npm view scripts.postinstall]

**Recharts v2 pin rationale:** npm `latest` tag for recharts is **3.8.1** (not 2.x). Must pin explicitly: `recharts@^2.15.4`. `react-pdf-charts` peer deps declare no recharts version (it wraps recharts internally) but the README warns recharts v3 is explicitly unsupported due to a breaking SVG regression. Using `latest` would silently install v3 and break PDF chart rendering in Phase 7. [VERIFIED: npm view recharts dist-tags.latest = 3.8.1]

**Install command (run from `medelite-report/`):**

```bash
npm install @react-pdf/renderer@^4.5.1 zod@^4.4.3 docx@^9.7.1 recharts@^2.15.4 react-pdf-charts@^1.0.0
```

**`@react-pdf/renderer` and `serverExternalPackages`:** The package is already on Next.js 16's built-in auto-opt-out list in `node_modules/next/dist/lib/server-external-packages.jsonc`. No explicit `next.config.ts` change is needed for Phase 1 (PDF rendering is Phase 4). [VERIFIED: grep on next/dist/lib/server-external-packages.jsonc]

Note: PITFALLS.md recommends adding it explicitly as a defense against Turbopack bug #88844. This is a Phase 4 concern, not Phase 1. The planner should add a `next.config.ts` update task to Phase 4 or Phase 2 (whichever introduces the first route handler that imports react-pdf).

---

## Package Legitimacy Audit

> slopcheck could not be installed (permission denied). All packages verified via npm registry age, download history, and source repo cross-reference.

| Package | Registry | Age | Source Repo | Postinstall | Disposition |
|---------|----------|-----|-------------|-------------|-------------|
| `@react-pdf/renderer@4.5.1` | npm | Since 2018-08-04 | github.com/diegomura/react-pdf | none | Approved |
| `zod@4.4.3` | npm | Since 2020-03-07 | github.com/colinhacks/zod | none | Approved |
| `docx@9.7.1` | npm | Since 2016-03-27 | github.com/dolanmiu/docx | none | Approved |
| `recharts@2.15.4` | npm | Since 2015-08-07 | github.com/recharts/recharts | none | Approved |
| `react-pdf-charts@1.0.0` | npm | Since 2023-06-26 | github.com/EvHaus/react-pdf-charts | none | Approved |

**slopcheck unavailable at research time** — all packages tagged `[ASSUMED]` for purposes of the legitimacy gate. However, all five have multi-year histories (oldest: recharts 2015, docx 2016), established source repos, and no postinstall scripts. Risk is LOW.

---

## Zod v4 API Nuances (D-07/D-08 pipeline)

> All claims in this section verified by live Node.js execution with installed `zod@4.4.3` on 2026-06-16.

### The Correct Empty-String → Null Pipeline

```typescript
// Verified working pattern for D-07/D-08/D-09
const nullableNumericField = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z.coerce.number().nullable()
)

// Behavior confirmed:
// ''        → null  (suppressed CMS field, D-08)
// '   '     → null  (whitespace-only, also treated as suppressed)
// '0'       → 0     (real zero preserved, D-09)
// '5'       → 5     (normal value)
// null      → null  (pass-through)
```

`z.preprocess` exists in Zod v4 and works identically to v3 for this use case. [VERIFIED: live Node.js test]

### BREAKING CHANGE from Zod v3: error.issues not error.errors

```typescript
// Zod v3 pattern — BROKEN in v4:
if (!result.success) {
  result.error.errors  // undefined in v4
}

// Zod v4 correct pattern:
if (!result.success) {
  result.error.issues  // array of ZodIssue objects
}
```

`result.error.errors` is `undefined` in Zod v4. Any code using the v3 pattern will silently fail (accessing a property on undefined). [VERIFIED: live Node.js test with zod@4.4.3]

`z.prettifyError(result.error)` works in v4 and returns a human-readable string. [VERIFIED: live Node.js test]

### D-05: Required Key + Nullable Value Pattern

```typescript
// Correct (D-05):
z.object({
  cms_certification_number_ccn: z.string(),               // required key, fails if missing
  overall_rating: z.preprocess(                           // required key...
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.coerce.number().nullable()                          // ...nullable value
  ),
}).passthrough()

// Confirmed behaviors:
// { cms_certification_number_ccn: '686123', overall_rating: '' }  → success, overall_rating: null
// { overall_rating: '' }  → failure (missing required ccn key) — loud failure per D-05
// Extra fields → kept (passthrough per D-04)
```

[VERIFIED: live Node.js test with zod@4.4.3]

### D-10: CCN and ZIP Stay Strings

```typescript
z.string()  // cms_certification_number_ccn: z.string() preserves '056789' → '056789'
```

[VERIFIED: live Node.js test — `z.string().parse('056789')` returns `'056789'`]

### z.prettifyError API

```typescript
z.prettifyError(result.error)  // → "✖ Invalid input: expected string, received undefined\n  → at cms_certification_number_ccn"
```

[VERIFIED: live Node.js test]

---

## Architecture Patterns

### Recommended Project Structure (Phase 1 scope only)

```
medelite-report/
├── scripts/
│   └── capture-fixture.ts          # implement from no-op; wired to npm run fixture:capture
├── src/
│   └── lib/
│       └── cms/
│           ├── schema.ts            # CMSRowSchema (Zod) + ParsedProvider type
│           └── parse.ts             # parseCMSRow(raw: unknown): ParsedProvider (or error)
└── tests/
    ├── fixtures/
    │   ├── provider-686123.json     # captured (ROADMAP SC#1 required path)
    │   ├── claims-686123.json       # captured (for Phase 5)
    │   ├── averages-xcdc.json       # captured (for Phase 5)
    │   └── malformed/               # D-12 malformed fixtures
    │       ├── missing-required-key.json
    │       ├── suppressed-row.json
    │       └── wrong-shape.json
    ├── smoke.test.ts                # existing — keep green
    └── lib/
        └── cms/
            └── schema.test.ts       # new — tests for CMSRowSchema
```

File naming and exact module structure are Claude's discretion (per CONTEXT.md).

### System Architecture Diagram (Phase 1 data flow)

```
npm run fixture:capture
  │
  ├─ scripts/capture-fixture.ts (tsx, Node.js)
  │    │
  │    ├─ REGISTRY entry 1: 4pq5-n9py + CCN=686123
  │    │    └─ GET data.cms.gov → { results: [row], count: 1 }
  │    │         └─ write → tests/fixtures/provider-686123.json
  │    │
  │    ├─ REGISTRY entry 2: ijh5-nb2v + CCN=686123
  │    │    └─ GET data.cms.gov → { results: [4 rows], count: 4 }
  │    │         └─ write → tests/fixtures/claims-686123.json
  │    │
  │    └─ REGISTRY entry 3: xcdc-v8bm, state_or_nation=NATION + FL
  │         └─ GET (×2) data.cms.gov → { results: [1 row], count: 1 } each
  │              └─ write → tests/fixtures/averages-xcdc.json
  │
npm run test
  │
  └─ tests/lib/cms/schema.test.ts
       │
       ├─ import provider-686123.json (resolveJsonModule: true)
       │    └─ CMSRowSchema.safeParse(fixture[0])  → success, typed ParsedProvider
       │
       ├─ import malformed/missing-required-key.json
       │    └─ CMSRowSchema.safeParse(...)         → failure (D-05)
       │
       ├─ import malformed/suppressed-row.json
       │    └─ CMSRowSchema.safeParse(...)         → success, ratings: null (D-08)
       │
       └─ import malformed/wrong-shape.json
            └─ CMSRowSchema.safeParse(...)         → failure
```

---

## Standard Stack

### Core (Phase 1)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | `^4.4.3` | Runtime CMS response validation | Required by CLAUDE.md rule #4; v4 is 14× faster than v3 |
| `tsx` | `^4.22.4` (already installed) | Runs the capture script | Already in devDependencies; no additional install needed |

### Production Installs (Phase 1)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@react-pdf/renderer` | `^4.5.1` | PDF generation (used Phase 4+) | Install now per CONTEXT.md scope |
| `docx` | `^9.7.1` | .docx export (used Phase 6+) | Install now per CONTEXT.md scope |
| `recharts` | `^2.15.4` | UI charts (used Phase 7+) | MUST pin `^2` — `latest` is v3 |
| `react-pdf-charts` | `^1.0.0` | recharts → react-pdf adapter (Phase 7+) | Install now per CONTEXT.md scope |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `zod@^4.4.3` | `zod@^3.x` | v3 is slower; `error.errors` API differs from v4's `error.issues`; no reason to downgrade |
| `recharts@^2.15.4` | `recharts@latest` (v3) | v3 breaks `react-pdf-charts`; must pin v2 |
| Node.js built-in `fetch` | `node-fetch` or `axios` | Built-in `fetch` available in Node 18+ (Node 26.2.0 on this machine); no extra dep needed |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CMS response validation | Custom type guards | `zod` `CMSRowSchema.safeParse` | Edge cases: empty string `""` for suppressed values, all-numeric fields returned as strings, ~100 columns with `.passthrough()` |
| Empty-string → null coercion | `if (v === '') v = null` ad hoc | `z.preprocess` + `z.coerce.number().nullable()` | The preprocess pattern is the single coercion pipeline — hand-rolling per-field if-statements diverges across schema fields |
| Fixture file writes | Manual copy-paste | `node:fs.writeFileSync` in capture script | Capture script ensures fixtures are always from live API, not stale manual copies |

---

## Common Pitfalls

### Pitfall 1: Using `result.error.errors` Instead of `result.error.issues` (Zod v4 Breaking Change)

**What goes wrong:** Code uses the Zod v3 pattern `result.error.errors[0].message`. In Zod v4, `error.errors` is `undefined`. The access throws `TypeError: Cannot read properties of undefined`. Particularly dangerous because it only surfaces in error paths (which are tested with malformed fixtures).

**Why it happens:** All Zod documentation and Stack Overflow examples before 2024 show `error.errors`. Zod v4 renamed this to `error.issues`.

**How to avoid:** Use `result.error.issues` throughout. Use `z.prettifyError(result.error)` for human-readable error strings.

**Warning signs:** Any reference to `result.error.errors` or `zodError.errors` in the codebase.

[VERIFIED: live Node.js test with zod@4.4.3]

### Pitfall 2: `z.coerce.number("")` Returns `0`, Not `null` (the D-08 trap)

**What goes wrong:** A suppressed star rating (`""`) coerces to `0`, rendering as "0 stars" instead of "N/A". This is the landmine called out explicitly in CONTEXT.md.

**Why it happens:** `z.coerce.number()` calls `Number("")` internally, which is `0` in JavaScript.

**How to avoid:** Always preprocess before coercing:
```typescript
z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z.coerce.number().nullable()
)
```

**Warning signs:** A test checking `parse({ overall_rating: '' }).overall_rating === null` fails (returns `0` instead).

[VERIFIED: live Node.js test]

### Pitfall 3: Using `==` (Double Equals) as the CMS Conditions Operator

**What goes wrong:** The CMS datastore API returns HTTP 400 for `operator==`. No results, just a 400.

**Why it happens:** Some DKAN documentation examples show `==`. The correct operator is a single `=`.

**How to avoid:** Always use `operator==` when URL-encoded becomes `operator=%3D` (single equals). In `URLSearchParams.set('conditions[0][operator]', '=')` the encoding happens automatically.

**Warning signs:** HTTP 400 response from the CMS API in the capture script.

[VERIFIED: live curl returning 400 for `operator==`]

### Pitfall 4: `recharts@latest` Installs v3, Breaking Phase 7 Charts

**What goes wrong:** `npm install recharts` installs v3.8.1. `react-pdf-charts` is incompatible with recharts v3 (SVG regression). PDF charts render as blank rectangles in Phase 7.

**How to avoid:** Always specify the version range: `npm install recharts@^2.15.4`.

**Warning signs:** `npm list recharts` shows `3.x.x`.

[VERIFIED: npm view recharts dist-tags.latest = 3.8.1]

### Pitfall 5: Fixtures Directory Does Not Exist

**What goes wrong:** `tests/fixtures/` does not exist. The capture script's `writeFileSync` throws `ENOENT`. The script fails immediately.

**How to avoid:** `mkdirSync(FIXTURES_DIR, { recursive: true })` before any write call.

**Warning signs:** ENOENT error on first `npm run fixture:capture` run. Confirmed: `tests/fixtures/` does not currently exist in the repo. [VERIFIED: ls tests/]

### Pitfall 6: Importing Malformed Fixture as JSON Directly (Type Safety)

**What goes wrong:** TypeScript's `resolveJsonModule: true` infers strict types from JSON. A malformed fixture may not typecheck as `unknown` if imported directly with a typed annotation.

**How to avoid:** Import malformed fixtures as `unknown`:
```typescript
import rawMalformed from '../fixtures/malformed/missing-required-key.json'
const malformed: unknown = rawMalformed
const result = CMSRowSchema.safeParse(malformed)
```

Or define malformed fixtures as `const` objects in the test file itself — no file import needed for small fixtures.

---

## Code Examples

### Complete `CMSRowSchema` (sketch — implement against captured fixture)

```typescript
// src/lib/cms/schema.ts
// Source: field names from tests/fixtures/provider-686123.json (CLAUDE.md rule #3)
import { z } from 'zod'

// Helper: empty/whitespace string → null, then coerce to number
// Verified working in zod@4.4.3 (2026-06-16 live test)
const nullableNum = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z.coerce.number().nullable()
)

export const CMSRowSchema = z
  .object({
    // Identity fields — stay as strings (D-10)
    cms_certification_number_ccn: z.string(),
    zip_code: z.string(),

    // Required text fields
    provider_name: z.string(),
    legal_business_name: z.string(),
    provider_address: z.string(),
    citytown: z.string(),
    state: z.string(),

    // Numeric (string-encoded in CMS, coerced to number)
    number_of_certified_beds: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
      z.coerce.number().nullable()
    ),

    // Star ratings — required keys, nullable values (D-05/D-06)
    // CMS returns "" for suppressed; must become null, not 0 (D-08)
    overall_rating: nullableNum,
    health_inspection_rating: nullableNum,
    qm_rating: nullableNum,          // Quality of Resident Care (NOT longstay_qm_rating)
    staffing_rating: nullableNum,

    processing_date: z.string(),
  })
  .passthrough()  // D-04: ~90 other CMS columns pass through untouched

export type ParsedProvider = z.infer<typeof CMSRowSchema>
```

### Complete Fixture Capture Fetch Helper

```typescript
// scripts/capture-fixture.ts (verified query pattern)
// Source: live CMS API tested 2026-06-16

const BASE = 'https://data.cms.gov/provider-data/api/1/datastore/query'

async function queryCMS(datasetId: string, property: string, value: string) {
  const url = new URL(`${BASE}/${datasetId}/0`)
  url.searchParams.set('conditions[0][property]', property)
  url.searchParams.set('conditions[0][value]', value)
  url.searchParams.set('conditions[0][operator]', '=')   // single = not ==
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`CMS ${res.status} for dataset=${datasetId}`)
  const json = await res.json() as { results: unknown[]; count: number }
  if (json.count === 0) throw new Error(`Zero results: ${datasetId} / ${property}=${value}`)
  return json.results
}
```

### Safe Parse with v4 Error Access

```typescript
// Correct Zod v4 pattern (error.issues, not error.errors)
const result = CMSRowSchema.safeParse(raw)
if (!result.success) {
  // v4: use result.error.issues (not result.error.errors — undefined in v4)
  throw new Error(z.prettifyError(result.error))
}
const provider = result.data   // type: ParsedProvider
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `zod@^3.x` (`error.errors`) | `zod@^4.x` (`error.issues`) | Zod v4, ~early 2024 | Any v3 error-handling code breaks silently |
| CMS distribution-ID endpoint (rotates weekly) | CMS dataset-ID endpoint (stable) | Always the case — distribution IDs always rotated | Distribution IDs silently break after each CMS refresh |
| `recharts@latest` (v2 for years) | `recharts@latest` = v3 as of 2024+ | recharts v3 released | Must pin `^2` — `latest` now means v3 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `tests/fixtures/malformed/` is an acceptable subdirectory for error fixtures (vs inline in test files) | Capture Script Structure | Low — either location works; planner chooses |
| A2 | Node 18+ built-in `fetch` is available in the `tsx` script environment | Capture Script | Low — Node 26.2.0 confirmed on this machine; if older Node is used, add `node-fetch` |
| A3 | `averages-xcdc.json` should store both NATION and FL rows keyed by `state_or_nation` | Fixture Structure | Medium — if stored as array, Phase 5 must filter; keyed object is simpler |
| A4 | All 5 packages are legitimate (slopcheck unavailable; verified by age + source repo) | Package Legitimacy Audit | Low — all packages are 3–10 years old with active source repos |

---

## Open Questions (RESOLVED)

1. **Should malformed fixtures be files or inline constants in test files?**
   - What we know: Both work; `resolveJsonModule: true` enables JSON import.
   - What's unclear: File fixtures are more reusable; inline constants avoid a TypeScript import-type issue.
   - Recommendation: Define small malformed fixtures as `const` objects in `schema.test.ts` to avoid the JSON type inference edge case. Only commit the happy-path fixtures as files.

2. **`averages-xcdc.json` format: array vs keyed object?**
   - What we know: xcdc-v8bm has 54 rows (all states + NATION); we need exactly NATION and FL.
   - What's unclear: Array of 2 rows is simpler to capture; keyed object `{ NATION, FL }` is simpler to consume in Phase 5.
   - Recommendation: Keyed object — Phase 5 access is `averages['NATION']` and `averages['FL']` without filtering.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Capture script (`tsx`) | ✓ | 26.2.0 | — |
| `tsx` | `npm run fixture:capture` | ✓ | 4.22.4 (devDep) | — |
| Native `fetch` | Capture script | ✓ | Node 18+ built-in | `node-fetch` |
| npm | Package install | ✓ | (available) | — |
| CMS API (`data.cms.gov`) | Fixture capture | ✓ | Verified live 2026-06-16 | Cannot defer — capture is Phase 1 blocker |
| `tests/fixtures/` directory | Fixture output | ✗ (missing) | — | `mkdirSync` creates it |

**Missing with no fallback:** `tests/fixtures/` must be created by the capture script (`mkdirSync`). CMS API must be reachable at capture time (it is a public API with no auth).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | `medelite-report/vitest.config.ts` |
| Quick run command | `npx vitest run tests/lib/cms/schema.test.ts` |
| Full suite command | `npm run test` (= `vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-02 | Zod parse succeeds on 686123 fixture | unit | `npx vitest run tests/lib/cms/schema.test.ts` | ❌ Wave 0 |
| DATA-02 | Suppressed `""` → `null`, not `0` | unit | `npx vitest run tests/lib/cms/schema.test.ts` | ❌ Wave 0 |
| DATA-02 | Real `"0"` → `0` (preserved) | unit | `npx vitest run tests/lib/cms/schema.test.ts` | ❌ Wave 0 |
| DATA-02 | Missing required key → `safeParse` fails | unit | `npx vitest run tests/lib/cms/schema.test.ts` | ❌ Wave 0 |
| DATA-02 | CCN preserves leading zeros as string | unit | `npx vitest run tests/lib/cms/schema.test.ts` | ❌ Wave 0 |
| DATA-06 | Every field name in schema matches a key in provider-686123.json | unit (schema-as-test) | `npx vitest run tests/lib/cms/schema.test.ts` | ❌ Wave 0 |

### Sampling Rate

- Per task commit: `npx vitest run tests/lib/cms/schema.test.ts`
- Per wave merge: `npm run verify` (full gate)
- Phase gate: `npm run verify` green before declaring Phase 1 complete

### Wave 0 Gaps

- [ ] `tests/fixtures/` directory — created by `npm run fixture:capture` (first action in phase)
- [ ] `tests/fixtures/provider-686123.json` — created by capture script
- [ ] `tests/fixtures/claims-686123.json` — created by capture script
- [ ] `tests/fixtures/averages-xcdc.json` — created by capture script
- [ ] `tests/lib/cms/schema.test.ts` — new; covers all DATA-02 assertions
- [ ] `src/lib/cms/schema.ts` — new; implements CMSRowSchema

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Zod `CMSRowSchema.safeParse` on all CMS responses |
| V6 Cryptography | no | No crypto in Phase 1 |
| V2 Authentication | no | CMS API is public; no auth in Phase 1 |
| V3 Session Management | no | No sessions in Phase 1 |
| V4 Access Control | no | No access control in Phase 1 |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed CMS response reaching typed code | Tampering | Zod `safeParse` — validation fails loudly, error bubbles up |
| CCN passed as number (leading zeros lost) | Tampering | `z.string()` on CCN field; `<input type="text">` (Phase 3) |

---

## Sources

### Primary (HIGH confidence — verified by live tool calls)

- Live CMS API curl 2026-06-16: `GET /datastore/query/4pq5-n9py/0?...` for CCN 686123 — field names, response envelope, count=1
- Live CMS API curl 2026-06-16: `GET /datastore/query/ijh5-nb2v/0?...` for CCN 686123 — 4 rows, measure codes 521/522/551/552, adjusted_score values
- Live CMS API curl 2026-06-16: `GET /datastore/query/xcdc-v8bm/0?...` for NATION and FL — hash-suffixed column names, 4 hospitalization/ED values
- Live CMS metastore curl 2026-06-16: `GET /metastore/schemas/dataset/items` — 234 items, all 3 dataset IDs confirmed present with titles
- Live CMS operator test 2026-06-16: `operator==` → HTTP 400 confirmed
- Node.js live execution with `zod@4.4.3` (already installed): preprocess pipeline, error.issues vs error.errors, passthrough, prettifyError
- `npm view` (npm registry, 2026-06-16): versions, peer deps, postinstall scripts for all 5 packages
- `node_modules/next/dist/lib/server-external-packages.jsonc` — `@react-pdf/renderer` confirmed in auto-opt-out list

### Secondary (MEDIUM confidence — from prior research artifacts)

- `.planning/research/STACK.md` — library version rationale, CMS API query pattern (prior research 2026-06-15)
- `.planning/research/PITFALLS.md` — suppressed value handling, recharts v2 pin, CORS, serverExternalPackages (prior research 2026-06-15)
- `medelite-report/node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.md` — auto opt-out list confirmation

### Tertiary (LOW confidence — not verified this session)

- None. All Phase 1-relevant claims are HIGH or MEDIUM.

---

## Metadata

**Confidence breakdown:**

- CMS API mechanics: HIGH — all three datasets queried live; response envelopes, field names, and operator behavior verified
- Zod v4 pipeline: HIGH — live Node.js execution with installed zod@4.4.3
- Package peer deps + legitimacy: HIGH — npm registry queries (slopcheck unavailable, legitimacy assessed by age + source repos)
- Fixture structure recommendations: MEDIUM — design choices (keyed object vs array) are Claude's discretion; functional correctness is HIGH

**Research date:** 2026-06-16
**Valid until:** 2026-07-16 for CMS API mechanics (CMS updates monthly; dataset IDs are stable); re-run `npm run fixture:capture` at any time to refresh values
