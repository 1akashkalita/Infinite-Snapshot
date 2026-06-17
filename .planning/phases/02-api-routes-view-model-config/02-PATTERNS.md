# Phase 2: API Routes, View Model & Config - Pattern Map

**Mapped:** 2026-06-17
**Files analyzed:** 19 (11 source + 8 test)
**Analogs found:** 19 / 19 (all have Phase-1 analogs; no no-analog files)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/cms/constants.ts` | config/utility | n/a | `scripts/capture-fixture.ts` | role-match (shares BASE URL + dataset registry) |
| `src/lib/cms/errors.ts` | utility | n/a | `src/lib/cms/parse.ts` | role-match (same module, same Zod v4 idioms) |
| `src/lib/cms/types.ts` | model | n/a | `src/lib/cms/schema.ts` | role-match (type export convention) |
| `src/lib/cms/mapper.ts` | service/transform | transform | `src/lib/cms/schema.ts` + `parse.ts` | role-match (same module, consumes `ParsedProvider`) |
| `src/lib/cms/client.ts` | service | request-response | `scripts/capture-fixture.ts` (queryCMS) | role-match (same CMS fetch + `{ count, results }` shape) |
| `src/lib/report/header.ts` | utility | n/a | `src/lib/cms/parse.ts` | partial (pure function + export pattern) |
| `src/lib/report/view-model.ts` | model/service | transform | `src/lib/cms/schema.ts` + `parse.ts` | role-match (Zod schema + typed assembler) |
| `src/lib/report/format.ts` | utility | transform | `src/lib/cms/schema.ts` (nullableNum) | role-match (null-safe transform helpers) |
| `app/api/facility/route.ts` | controller | request-response | `tests/cms.live.test.ts` (CMS fetch pattern) | partial (closest fetch+query-string pattern) |
| `app/api/export/pdf/route.ts` | controller | request-response | `app/api/facility/route.ts` (to be created) | exact (same Route Handler structure) |
| `next.config.ts` | config | n/a | existing `next.config.ts` | exact (one-line addition) |
| `tests/lib/cms/mapper.test.ts` | test | n/a | `tests/lib/cms/schema.test.ts` | exact (same test structure, same fixture import) |
| `tests/lib/cms/client.test.ts` | test | n/a | `tests/lib/cms/parse.test.ts` | exact (same describe/it/expect structure + vi.stubGlobal) |
| `tests/lib/cms/errors.test.ts` | test | n/a | `tests/lib/cms/parse.test.ts` | exact (same describe/it/expect structure) |
| `tests/lib/report/header.test.ts` | test | n/a | `tests/lib/cms/parse.test.ts` | exact |
| `tests/lib/report/view-model.test.ts` | test | n/a | `tests/lib/cms/schema.test.ts` | exact |
| `tests/lib/report/format.test.ts` | test | n/a | `tests/lib/cms/schema.test.ts` | exact |
| `tests/api/facility.test.ts` | test | n/a | `tests/cms.live.test.ts` | role-match (same CMS fetch test shape + `Request` construction) |
| `tests/api/export-pdf.test.ts` | test | n/a | `tests/lib/cms/parse.test.ts` | exact |

---

## Pattern Assignments

### `src/lib/cms/constants.ts` (config/utility)

**Analog:** `medelite-report/scripts/capture-fixture.ts`

**Imports pattern** (lines 13-14):
```typescript
// From capture-fixture.ts — the verified BASE URL and dataset IDs are already established here.
// constants.ts centralizes what the script already has inline.
const BASE = "https://data.cms.gov/provider-data/api/1/datastore/query";
// Dataset IDs (lines 28, 33, 38 of capture-fixture.ts):
// "4pq5-n9py" — Provider Information
// "ijh5-nb2v" — Medicare Claims Quality Measures
// "xcdc-v8bm" — State US Averages
```

**Core pattern** — export as named constants (no class, no object), every constant traced to a comment:
```typescript
// src/lib/cms/constants.ts
// All values traced to tests/fixtures/provider-686123.json and scripts/capture-fixture.ts (CLAUDE.md rule #3).

export const CMS_BASE_URL =
  'https://data.cms.gov/provider-data/api/1/datastore/query';

export const DATASET_PROVIDER_INFO = '4pq5-n9py';

// Verified filter field name: confirmed in capture-fixture.ts line 30 and fixture key.
export const CCN_FILTER_FIELD = 'cms_certification_number_ccn';
```

**File must export something** (tsconfig `isolatedModules` — every `.ts` needs an import or export, per CLAUDE.md / vitest.config.ts pattern). Exporting constants satisfies this.

---

### `src/lib/cms/errors.ts` (utility — discriminated union + assertNever)

**Analog:** `medelite-report/src/lib/cms/parse.ts`

**Imports pattern** (parse.ts lines 9-10):
```typescript
import { z } from "zod";
import { CMSRowSchema, type ParsedProvider } from "@/lib/cms/schema";
```
errors.ts mirrors this import style — `@/` path alias, named imports, `type` keyword for type-only imports.

**Core pattern** — Zod v4 discriminated union (verified live against Zod 4.4.3):
```typescript
// src/lib/cms/errors.ts
import { z } from 'zod';

export const CmsApiErrorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('invalid_ccn'),     message: z.string() }),
  z.object({ kind: z.literal('not_found'),        message: z.string(), ccn: z.string() }),
  z.object({ kind: z.literal('network_error'),    message: z.string() }),
  z.object({ kind: z.literal('cms_api_error'),    message: z.string() }),
  z.object({ kind: z.literal('validation_error'), message: z.string() }),
]);
export type CmsApiError = z.infer<typeof CmsApiErrorSchema>;
```

**assertNever** (D-03 exhaustiveness — from RESEARCH.md §5):
```typescript
export function assertNever(x: never): never {
  throw new Error('Unhandled CmsError kind: ' + JSON.stringify(x));
}
```

**CmsError class** (D-18 recommendation: use `class extends Error` for `instanceof` checks):
```typescript
export class CmsError extends Error {
  constructor(
    public readonly kind: CmsApiError['kind'],
    message: string,
    public readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CmsError';
  }
}
```

**Zod v4 idioms** confirmed in parse.ts (lines 22-24):
- `result.error.issues` — the ZodIssue array (`.errors` is undefined in v4)
- `z.prettifyError(result.error)` — human-readable string (verified working)

---

### `src/lib/cms/types.ts` (model)

**Analog:** `medelite-report/src/lib/cms/schema.ts`

**Pattern** — pure TypeScript type export, no Zod in this file (the Zod schema in schema.ts is the source; `FacilityData` is the camelCase domain projection):
```typescript
// src/lib/cms/types.ts
// FacilityData — curated camelCase domain model.
// CMS snake_case field names live ONLY in schema.ts + mapper.ts (D-14).

export interface FacilityData {
  ccn: string;
  providerName: string;            // ← provider_name (D-15; NOT legal_business_name)
  address: {
    street: string;                // ← provider_address
    city: string;                  // ← citytown (NOT provider_city)
    state: string;                 // ← state (NOT provider_state)
  };
  starRatings: {
    overall: number | null;        // ← overall_rating
    healthInspection: number | null; // ← health_inspection_rating
    staffing: number | null;       // ← staffing_rating
    qualityCare: number | null;    // ← qm_rating (NOT longstay_qm_rating/shortstay_qm_rating)
  };
  certifiedBeds: number | null;    // ← number_of_certified_beds
  processingDate: string;          // ← processing_date (D-12 freshness signal)
  state: string;                   // ← state (for assembleHeader(state))
}
```

`isolatedModules` requires this file to have an export — the `export interface` satisfies it.

---

### `src/lib/cms/mapper.ts` (service/transform)

**Analog:** `medelite-report/src/lib/cms/schema.ts` (field name source) + `parse.ts` (import style)

**Imports pattern** (mirrors parse.ts lines 9-10):
```typescript
import { type ParsedProvider } from '@/lib/cms/schema';
import { type FacilityData } from '@/lib/cms/types';
```

**Core pattern** — pure function, reads from `ParsedProvider` (typed output of `CMSRowSchema.safeParse`), returns `FacilityData`. All CMS field names are in this file; no consumer ever sees them:
```typescript
// src/lib/cms/mapper.ts
// All CMS field assignments traced to tests/fixtures/provider-686123.json (CLAUDE.md rule #3).
// Field names mirror CMSRowSchema keys in src/lib/cms/schema.ts.

export function toFacilityData(parsed: ParsedProvider): FacilityData {
  return {
    ccn:         parsed.cms_certification_number_ccn,  // string, leading zeros preserved
    providerName: parsed.provider_name,                 // D-15: operating name, NOT legal_business_name
    address: {
      street: parsed.provider_address,
      city:   parsed.citytown,                         // NOT provider_city
      state:  parsed.state,                            // NOT provider_state
    },
    starRatings: {
      overall:         parsed.overall_rating,
      healthInspection: parsed.health_inspection_rating,
      staffing:         parsed.staffing_rating,
      qualityCare:      parsed.qm_rating,              // NOT longstay_qm_rating/shortstay_qm_rating
    },
    certifiedBeds:  parsed.number_of_certified_beds,
    processingDate: parsed.processing_date,
    state:          parsed.state,
  };
}
```

---

### `src/lib/cms/client.ts` (service, request-response)

**Analog:** `medelite-report/scripts/capture-fixture.ts` (queryCMS function, lines 99-122)

**Imports pattern:**
```typescript
import { z } from 'zod';
import { safeParseCMSRow } from '@/lib/cms/parse';
import { toFacilityData } from '@/lib/cms/mapper';
import { CmsError } from '@/lib/cms/errors';
import { CMS_BASE_URL, DATASET_PROVIDER_INFO, CCN_FILTER_FIELD } from '@/lib/cms/constants';
import { type FacilityData } from '@/lib/cms/types';
```

**URL construction pattern** (capture-fixture.ts lines 104-109 — already established and verified):
```typescript
// From capture-fixture.ts queryCMS():
const url = new URL(`${BASE}/${datasetId}/0`);
url.searchParams.set("conditions[0][property]", property);
url.searchParams.set("conditions[0][value]", value);
// Single "=" operator — "==" returns HTTP 400 (RESEARCH.md Pitfall 3)
url.searchParams.set("conditions[0][operator]", "=");
```

**Core pipeline pattern** (D-18/D-19 — full pipeline):
```typescript
export async function fetchFacility(ccn: string): Promise<FacilityData> {
  const url = new URL(`${CMS_BASE_URL}/${DATASET_PROVIDER_INFO}/0`);
  url.searchParams.set(`conditions[0][property]`, CCN_FILTER_FIELD);
  url.searchParams.set(`conditions[0][value]`, ccn);
  url.searchParams.set(`conditions[0][operator]`, '=');
  url.searchParams.set('limit', '1');

  let resp: Response;
  try {
    resp = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new CmsError('network_error', 'CMS data is unavailable — please try again.');
  }

  if (!resp.ok) {
    throw new CmsError('cms_api_error', 'CMS returned an error — please try again.');
  }

  const json = await resp.json() as { count: number; results: unknown[] };
  if (json.results.length === 0) {
    throw new CmsError('not_found', `No facility found for CCN ${ccn}.`);
  }

  const parseResult = safeParseCMSRow(json.results[0]);
  if (!parseResult.success) {
    // D-05: log server-side only; D-06: include CCN
    console.error(`[validation_error] CCN=${ccn}`, z.prettifyError(parseResult.error));
    throw new CmsError('validation_error', "We couldn't read this facility's data right now.");
  }

  return toFacilityData(parseResult.data);
}
```

**Zero-row pattern** from capture-fixture.ts (lines 115-120):
```typescript
const json = (await res.json()) as { results: unknown[]; count: number };
if (json.count === 0) {
  throw new Error(`Zero results: ...`);
}
```
client.ts uses `json.results.length === 0` (equivalent; `results.length` is the safer check since `count` could theoretically mismatch).

---

### `src/lib/report/header.ts` (utility — pure function)

**Analog:** `medelite-report/src/lib/cms/parse.ts` (pure exported function pattern)

**Imports pattern:** No imports required — pure string operations only. File must still satisfy `isolatedModules` via its exports.

**Core pattern** (RPT-01 / CLAUDE.md rule #2 — state-only arg, no facility name):
```typescript
// src/lib/report/header.ts
// assembleHeader takes ONLY a state code — NEVER a facility name (CLAUDE.md rule #2).
// TypeScript enforces this: one parameter of type string.

export interface HeaderData {
  platformLine: string;   // "INFINITE — Managed by MEDELITE"
  reportTitle: string;    // "FACILITY ASSESSMENT SNAPSHOT"
  stateLine: string;      // e.g. "FL" — uppercased
}

export function assembleHeader(state: string): HeaderData {
  return {
    platformLine: 'INFINITE — Managed by MEDELITE',
    reportTitle:  'FACILITY ASSESSMENT SNAPSHOT',
    stateLine:    state.toUpperCase(),
  };
}
```

Note: `—` is the em-dash `—` used in the branding string. Use the literal character or the escape — both are correct. Consistent with CLAUDE.md static string.

---

### `src/lib/report/format.ts` (utility/transform)

**Analog:** `medelite-report/src/lib/cms/schema.ts` (`nullableNum` helper — lines 23-39)

The `nullableNum` helper is the exact analog: it's a null-safe transform that checks the value explicitly before coercing. `format.ts` mirrors this pattern at the render layer.

**nullableNum analog pattern** (schema.ts lines 23-39 — the explicit-null-check idiom):
```typescript
// From schema.ts — the prototype for all Phase-2 null-safe helpers:
const nullableNum = z
  .union([z.string(), z.number(), z.null()])
  .transform((v, ctx) => {
    if (v === null) return null;           // explicit null check, not falsiness
    // ...
  });
```

**Core pattern** (D-08 through D-11 — formatter family):
```typescript
// src/lib/report/format.ts
// D-09: single PLACEHOLDER constant shared across all formatters.
// D-10: check === null, NEVER if (!value) — a real 0 is not "N/A".

const PLACEHOLDER = 'N/A';

export function formatRating(value: number | null): string {
  if (value === null) return PLACEHOLDER;
  return String(value);
}

export function formatBeds(value: number | null): string {
  if (value === null) return PLACEHOLDER;
  return value.toLocaleString();
}

export function formatPercent(value: number | null): string {
  if (value === null) return PLACEHOLDER;
  return `${value.toFixed(1)}%`;
}

export function formatRate(value: number | null): string {
  if (value === null) return PLACEHOLDER;
  return value.toFixed(2);
}

// D-17: address formatter (no ZIP — DATA-03)
export function formatLocation(address: { street: string; city: string; state: string }): string {
  return `${address.street}, ${address.city}, ${address.state}`;
}

// D-13: date formatter with explicit UTC TZ to prevent server/client midnight disagreement
export function formatDate(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
}
```

---

### `src/lib/report/view-model.ts` (model + assembler)

**Analog:** `medelite-report/src/lib/cms/schema.ts` (Zod schema + inferred type export) + `parse.ts` (assembler function pattern)

**Imports pattern:**
```typescript
import { z } from 'zod';
import { type FacilityData } from '@/lib/cms/types';
```

**Zod schema export pattern** (mirrors schema.ts lines 41-72):
```typescript
// schema.ts pattern:
export const CMSRowSchema = z.object({ ... }).passthrough();
export type ParsedProvider = z.infer<typeof CMSRowSchema>;
```

**Core view-model pattern** (D-08 / D-12 / D-20 / D-21):
```typescript
// src/lib/report/view-model.ts

// ManualInputs — fields the user enters that don't come from CMS
export interface ManualInputs {
  nameOverride?: string;
  emr?: string;
  currentCensus?: number | null;
  typeOfPatient?: string;
  medicalCoverage?: string;
  previousCoverage?: 'Yes' | 'No' | null;
}

// ReportViewModelSchema — used by POST /api/export/pdf to validate the incoming body (D-21).
// This is THE canonical schema; Phase 4 renders straight from it.
export const ReportViewModelSchema = z.object({
  header: z.object({
    platformLine: z.string(),
    reportTitle:  z.string(),
    stateLine:    z.string(),
  }),
  facility: z.object({
    ccn:          z.string(),
    providerName: z.string(),
    displayName:  z.string(),   // NAME-02: manual override or providerName
    address: z.object({
      street: z.string(),
      city:   z.string(),
      state:  z.string(),
    }),
    starRatings: z.object({
      overall:          z.number().nullable(),
      healthInspection: z.number().nullable(),
      staffing:         z.number().nullable(),
      qualityCare:      z.number().nullable(),
    }),
    certifiedBeds:   z.number().nullable(),
    processingDate:  z.string(),
    careCompareUrl:  z.string().url(),
  }),
  manual: z.object({
    emr:              z.string().optional(),
    currentCensus:    z.number().nullable().optional(),
    typeOfPatient:    z.string().optional(),
    medicalCoverage:  z.string().optional(),
    previousCoverage: z.enum(['Yes', 'No']).nullable().optional(),
  }),
  generatedAt:   z.string(),   // D-12: injected by caller as ISO string or pre-formatted
  hospMetrics:   z.unknown().optional(),  // Phase 5 fills this
});

export type ReportViewModel = z.infer<typeof ReportViewModelSchema>;

// assembleViewModel — pure, deterministic (D-12: generatedAt injected, not new Date() internally)
export function assembleViewModel(
  facility: FacilityData,
  manual: ManualInputs,
  generatedAt: Date | string,
): ReportViewModel { ... }
```

**`assembleHeader` call pattern** inside assembleViewModel:
```typescript
// Calls assembleHeader(facility.state) — state-only, no facility name (CLAUDE.md rule #2)
import { assembleHeader } from '@/lib/report/header';
const header = assembleHeader(facility.state);
```

**`displayName` pattern** (NAME-02):
```typescript
displayName: manual.nameOverride?.trim() || facility.providerName,
```

**`careCompareUrl` pattern** (D-16 — ccn stays as string):
```typescript
careCompareUrl: `https://www.medicare.gov/care-compare/details/nursing-home/${facility.ccn}`,
```

---

### `app/api/facility/route.ts` (controller, request-response)

**Analog:** `medelite-report/tests/cms.live.test.ts` (closest pattern for CMS query-string fetch) + RESEARCH.md §1 (verified NJS16 Route Handler API)

No existing route handler file exists yet — this is the first. The live test file demonstrates the `?ccn=` query-string pattern and `URL.searchParams` construction. The route handler structure comes from the NJS16 docs (verified in RESEARCH.md §1).

**Imports pattern** (NJS16 standard — from RESEARCH.md §1):
```typescript
import type { NextRequest } from 'next/server';
import { fetchFacility } from '@/lib/cms/client';
import { CmsError, assertNever } from '@/lib/cms/errors';
```

**Segment config** (D-25 — explicit Node.js runtime for routes that may touch react-pdf):
```typescript
export const runtime = 'nodejs';
```

**CCN from query string pattern** (NJS16 — NOT ctx.params; route is non-dynamic):
```typescript
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('ccn');
  // ...
}
```

**CCN normalization + validation** (D-22):
```typescript
const ccn = raw.trim().toUpperCase();
if (!/^[A-Za-z0-9]{6}$/.test(ccn)) {
  return Response.json(
    { error: { kind: 'invalid_ccn', message: 'CCN must be exactly 6 alphanumeric characters.' } },
    { status: 400 }
  );
}
```

**CmsError → HTTP mapping** (D-01 / D-03 — exhaustive switch with assertNever):
```typescript
try {
  const facility = await fetchFacility(ccn);
  return Response.json({ data: facility }, { status: 200 });
} catch (err) {
  if (!(err instanceof CmsError)) throw err;
  switch (err.kind) {
    case 'invalid_ccn':      return Response.json({ error: { kind: err.kind, message: err.message } }, { status: 400 });
    case 'not_found':        return Response.json({ error: { kind: err.kind, message: err.message, ccn } }, { status: 404 });
    case 'network_error':    return Response.json({ error: { kind: err.kind, message: err.message } }, { status: 502 });
    case 'cms_api_error':    return Response.json({ error: { kind: err.kind, message: err.message } }, { status: 502 });
    case 'validation_error': return Response.json({ error: { kind: err.kind, message: err.message } }, { status: 502 });
    default:                 return assertNever(err);
  }
}
```

**Response** uses `Response.json()` — web-standard, no import needed (verified Node 26.2.0 + NJS16).

---

### `app/api/export/pdf/route.ts` (controller, request-response — stub)

**Analog:** `app/api/facility/route.ts` (to be created in same phase; same Route Handler structure)

**Pattern** (D-20 / D-21):
```typescript
import { ReportViewModelSchema } from '@/lib/report/view-model';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parseResult = ReportViewModelSchema.safeParse(body);

  if (!parseResult.success) {
    return Response.json(
      { error: { kind: 'invalid_request', message: 'Invalid report data.' } },
      { status: 400 }
    );
  }

  // Phase 4 replaces this 501 with renderToBuffer
  return Response.json(
    { error: { kind: 'not_implemented', message: 'PDF export coming soon.' } },
    { status: 501 }
  );
}
```

**Zod safeParse pattern** mirrors parse.ts lines 33-35:
```typescript
// From parse.ts:
export function safeParseCMSRow(raw: unknown) {
  return CMSRowSchema.safeParse(raw);
}
```
The route handler uses `ReportViewModelSchema.safeParse(body)` — same pattern, inline.

---

### `next.config.ts` (config — one-line addition)

**Analog:** existing `medelite-report/next.config.ts`

**Current state** (lines 1-7 of existing file):
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
```

**Target state** (D-25 — add `serverExternalPackages`):
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@react-pdf/renderer'],
};

export default nextConfig;
```

Key name is `serverExternalPackages` — NOT `serverComponentsExternalPackages` (the v14 name, renamed at v15.0.0; using the old name is silently ignored in NJS16).

---

## Test File Patterns

All test files follow the same structure established in Phase 1.

### Universal test file pattern

**Primary analog:** `medelite-report/tests/lib/cms/schema.test.ts` (most complete example)

**Imports block** (schema.test.ts lines 1-3):
```typescript
import { describe, expect, it } from "vitest";
import { CMSRowSchema } from "@/lib/cms/schema";
import providerFixture from "../../fixtures/provider-686123.json";
```

Key conventions:
- Named imports from `"vitest"` — always `describe`, `expect`, `it` (add `vi`, `afterEach` only when needed for mocking)
- `@/` path alias for `src/` imports (not `../../src/`)
- Relative path for fixture JSON (not `@/` — fixtures live under `tests/`)
- `"vitest"` not `"@vitest/core"` or `"vitest/dist"`

**Test structure** (schema.test.ts lines 35-168 — the established template):
```typescript
describe("CMSRowSchema", () => {
  it("description of positive case", () => {
    const result = CMSRowSchema.safeParse(providerFixture[0]);
    expect(result.success).toBe(true);
  });

  it("description of negative case", () => {
    const result = CMSRowSchema.safeParse({ error: "invalid_ccn" });
    expect(result.success).toBe(false);
    if (!result.success) {
      // Zod v4: result.error.issues (NOT .errors)
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });
});
```

**Inline malformed fixture pattern** (schema.test.ts lines 8-32 — avoids JSON import type inference issues):
```typescript
const suppressedRow: unknown = {
  cms_certification_number_ccn: "000001",
  // ...all required fields with suppressed values...
  overall_rating: "",
};
```

---

### `tests/lib/cms/mapper.test.ts`

**Analog:** `tests/lib/cms/schema.test.ts`

Key tests to cover (from CONTEXT specifics + RESEARCH §validation):
- `toFacilityData` maps `provider_name` → `providerName` (NOT `legal_business_name`)
- `qm_rating` → `qualityCare` (fixture value `"5"` → `5`)
- `longstay_qm_rating` and `shortstay_qm_rating` do NOT appear in output
- `number_of_certified_beds` → `certifiedBeds` (`"150"` → `150`)
- `citytown` → `address.city` (NOT `provider_city`)
- `state` → `address.state` (NOT `provider_state`)
- `processing_date` → `processingDate` (string preserved)
- `zip_code` is NOT in `FacilityData`

```typescript
import { describe, expect, it } from "vitest";
import { toFacilityData } from "@/lib/cms/mapper";
import { parseCMSRow } from "@/lib/cms/parse";
import providerFixture from "../../fixtures/provider-686123.json";

describe("toFacilityData", () => {
  it("maps 686123 fixture to FacilityData with correct providerName", () => {
    const parsed = parseCMSRow(providerFixture[0]);
    const facility = toFacilityData(parsed);
    expect(facility.providerName).toBe("KENDALL LAKES HEALTHCARE AND REHAB CENTER");
    // NOT "KENDALL LAKES HEALTHCARE AND REHAB CENTER, LLC"
  });
  // ...
});
```

---

### `tests/lib/cms/client.test.ts`

**Analog:** `tests/lib/cms/parse.test.ts` (same describe/it/expect structure) with `vi.stubGlobal` for fetch

**Mock fetch pattern** (RESEARCH.md §8):
```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchFacility } from "@/lib/cms/client";

afterEach(() => vi.unstubAllGlobals());

it("throws network_error when fetch is aborted", async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(
    new DOMException('The operation was aborted.', 'AbortError')
  ));
  await expect(fetchFacility('686123')).rejects.toMatchObject({ kind: 'network_error' });
});
```

---

### `tests/lib/cms/errors.test.ts`

**Analog:** `tests/lib/cms/parse.test.ts`

Key tests:
- `CmsError` construction (kind, message, instanceof check)
- `assertNever` throws at runtime for an unexpected kind
- Discriminated union schema correctly accepts/rejects each kind variant

---

### `tests/lib/report/header.test.ts`

**Analog:** `tests/lib/cms/parse.test.ts`

**Critical test from PITFALLS.md / CONTEXT specifics** (facility name must never appear):
```typescript
it("platformLine does not contain the facility name", () => {
  const h = assembleHeader('FL');
  expect(h.platformLine).not.toContain('Kendall');
  expect(h.platformLine).toBe('INFINITE — Managed by MEDELITE');
});
```

---

### `tests/lib/report/format.test.ts`

**Analog:** `tests/lib/cms/schema.test.ts` (null-coercion test pattern)

**D-10 critical test** (must NOT use falsiness check):
```typescript
it("formatRating(0) returns '0', not 'N/A'", () => {
  expect(formatRating(0)).toBe('0');  // a real zero is not suppressed
});
it("formatRating(null) returns 'N/A'", () => {
  expect(formatRating(null)).toBe('N/A');
});
```

---

### `tests/lib/report/view-model.test.ts`

**Analog:** `tests/lib/cms/schema.test.ts`

**D-12 determinism test** (generatedAt must be a parameter):
```typescript
// Pass a fixed date so the test is deterministic (D-12 / RESEARCH.md pitfall #6):
const vm = assembleViewModel(facilityFixture, {}, new Date('2026-06-17T12:00:00Z'));
expect(vm.generatedAt).toBe('2026-06-17T12:00:00.000Z');
```

**NAME-02 test** (manual override in body only; header unaffected):
```typescript
const vm = assembleViewModel(facilityFixture, { nameOverride: 'Custom Name' }, generatedAt);
expect(vm.facility.displayName).toBe('Custom Name');
expect(vm.header.platformLine).not.toContain('Custom Name');
```

---

### `tests/api/facility.test.ts`

**Analog:** `tests/cms.live.test.ts` (CMS fetch + Request pattern)

**Route handler test pattern** (RESEARCH.md §8 — no running server, import and call directly):
```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/facility/route";

afterEach(() => vi.unstubAllGlobals());

it("returns 400 for invalid CCN format", async () => {
  const req = new NextRequest('http://localhost/api/facility?ccn=12');
  const resp = await GET(req);
  expect(resp.status).toBe(400);
  const body = await resp.json();
  expect(body.error.kind).toBe('invalid_ccn');
});
```

**D-05 leak-prevention invariant test** (CONTEXT specifics — mandatory):
```typescript
it("validation_error response contains no Zod internals (D-05)", async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ count: 1, results: [{ broken: true }] }), { status: 200 })
  ));
  const req = new NextRequest('http://localhost/api/facility?ccn=686123');
  const resp = await GET(req);
  expect(resp.status).toBe(502);
  const body = await resp.json();
  const bodyStr = JSON.stringify(body);
  expect(bodyStr).not.toMatch(/issues|expected|received|path|code/);
  expect(body.error.kind).toBe('validation_error');
});
```

---

### `tests/api/export-pdf.test.ts`

**Analog:** `tests/lib/cms/parse.test.ts` (safeParse fail/pass pattern)

```typescript
import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/export/pdf/route";

it("returns 400 for invalid body shape", async () => {
  const req = new Request('http://localhost/api/export/pdf', {
    method: 'POST',
    body: JSON.stringify({ bad: 'shape' }),
    headers: { 'Content-Type': 'application/json' },
  });
  const resp = await POST(req);
  expect(resp.status).toBe(400);
  const body = await resp.json();
  expect(body.error.kind).toBe('invalid_request');
});

it("returns 501 for a valid ReportViewModel body", async () => {
  // Build a minimal valid vm...
  const resp = await POST(req);
  expect(resp.status).toBe(501);
  expect(body.error.kind).toBe('not_implemented');
});
```

---

## Shared Patterns

### Import style
**Source:** `medelite-report/src/lib/cms/parse.ts` lines 9-10 and `tests/lib/cms/schema.test.ts` lines 1-3
**Apply to:** All source files and test files
```typescript
// Source files: use @/ alias for src/ imports
import { z } from "zod";
import { CMSRowSchema, type ParsedProvider } from "@/lib/cms/schema";

// Test files: use @/ for src/, relative path for fixtures
import { CMSRowSchema } from "@/lib/cms/schema";
import providerFixture from "../../fixtures/provider-686123.json";
```

### Zod v4 error access
**Source:** `medelite-report/src/lib/cms/parse.ts` line 24 and `tests/lib/cms/schema.test.ts` lines 94-97
**Apply to:** All files that handle Zod parse failures
```typescript
// CORRECT (Zod v4):
result.error.issues          // ZodIssue[]
z.prettifyError(result.error) // human-readable string

// WRONG (Zod v3 — undefined in v4):
result.error.errors           // DO NOT USE
```

### Null-check idiom (D-10)
**Source:** `medelite-report/src/lib/cms/schema.ts` `nullableNum` lines 26-27
**Apply to:** All formatter functions in `format.ts`, any conditional in the mapper
```typescript
// CORRECT:
if (value === null) return PLACEHOLDER;

// WRONG — turns real 0 into "N/A":
if (!value) return PLACEHOLDER;
```

### `isolatedModules` compliance
**Source:** `medelite-report/tsconfig.json` line 13
**Apply to:** Every new `.ts` file
Every new `.ts` file must have at least one `import` or `export` statement. Pure-constant files (like `constants.ts`) satisfy this via their `export const` declarations.

### File header comment convention
**Source:** `medelite-report/src/lib/cms/schema.ts` lines 1-12 and `parse.ts` lines 1-8
**Apply to:** All source files
Each file begins with a comment block naming:
1. What the file does (one-line)
2. Any CLAUDE.md rule or phase decision that shaped it
3. Zod v4 notes where applicable
```typescript
// mapper.ts — toFacilityData(parsed): FacilityData
//
// All CMS field names verified against tests/fixtures/provider-686123.json (CLAUDE.md rule #3).
// CMS snake_case field names are confined to this file + schema.ts; no consumer sees them (D-14).
```

### Route handler segment config
**Source:** RESEARCH.md §1 (NJS16 docs verified)
**Apply to:** `app/api/facility/route.ts`, `app/api/export/pdf/route.ts`
```typescript
export const runtime = 'nodejs';
// NJS16 default — explicit declaration documents intent and future-proofs against Edge runtime.
```

---

## No Analog Found

All files have viable analogs in the codebase. No files require falling back to RESEARCH.md patterns exclusively.

---

## Metadata

**Analog search scope:** `medelite-report/src/`, `medelite-report/tests/`, `medelite-report/scripts/`, `medelite-report/next.config.ts`, `medelite-report/vitest.config.ts`, `medelite-report/tsconfig.json`
**Files scanned:** 10 (schema.ts, parse.ts, parse.test.ts, schema.test.ts, smoke.test.ts, cms.live.test.ts, capture-fixture.ts, vitest.config.ts, next.config.ts, tsconfig.json)
**Pattern extraction date:** 2026-06-17
