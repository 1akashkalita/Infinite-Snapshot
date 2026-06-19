# Phase 5: Claims-Based Metrics — Research

**Researched:** 2026-06-18
**Domain:** CMS claims dataset fan-out, Zod schema extension, view-model upgrade, flat-list render
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Reference template (`.planning/reference/Facility Assessment Snapshot.docx`) is the source of truth for the 12 claims labels + order.
- **D-02:** Per-label ambiguity resolved by asking user, not guessing. (Currently moot — all 12 labels extracted.)
- **D-03:** Render the 12 data points as a FLAT label/value list — NOT a table. Continues the same `<dl>` / flexbox-row pattern as the existing 13 body fields.
- **D-04:** Row labels are VERBATIM from the reference, garbles preserved (e.g. "STR State National Avg. for Hospitalization", bare "ED Visit").
- **D-05:** Placement = after "Quality of Resident Care" (row 13), before the footer. No separate section heading.
- **D-06:** The label→value→source mapping is fully decoded (see specifics table in CONTEXT.md).
- **D-07:** 3 CMS fetches run in parallel via `Promise.allSettled`. Provider info is the ONLY hard dependency. If claims/averages fail, the core report still renders; only the metrics degrade.
- **D-08:** Extend the existing `GET /api/facility` route. No separate metrics endpoint.
- **D-09:** Whole-section fetch failure → one concise honest line: "Hospitalization & ED metrics are temporarily unavailable." Not 12 noisy placeholders.
- **D-10:** Always render all 12 fixed rows (when the fetch succeeded). A missing/suppressed facility score shows the suppressed text only in that row; the national/state average rows still render their values.
- **D-11:** Footnote-aware suppressed-value messages: 9 → "Not reported (small sample)", 7 → "Not available", 10 → "Not submitted", 1 → "Not enough data", 2 → "Not enough data", 28 → show annual avg. Safe generic fallback for unknown codes and empty-score-with-no-footnote.
- **D-12:** Reuse `formatPercent` (1 dp) for % measures (521/522 + their averages) and `formatRate` (2 dp) for per-1000-rate measures (551/552 + their averages).
- **D-13:** `hospMetrics` becomes a structured, Zod-validated field inside `ReportViewModelSchema` (replacing `z.unknown().optional()`). Must remain optional/absent-tolerant so a degraded response (D-09) still validates.
- **D-14:** Average join key is `state_or_nation`. Match the 4 average columns by human-readable description, NOT by hash-suffixed slug.
- **D-15:** Display the facility ADJUSTED (`adjusted_score`) — never observed/expected.
- **D-16:** Re-confirm both dataset IDs via the CMS metastore before writing schemas (done in this research).

### Claude's Discretion (settled by existing code / standard approaches)

All items in this block are already settled (D-12 through D-15 above).

### Deferred Ideas (OUT OF SCOPE)

- Polished benchmark visualization (table/cards/bar charts) → Phase 7 (VIZ-01/02).
- `.docx` claims section → Phase 6 (DOCX-01). Phase 5 only puts `hospMetrics` in the shared view-model.
- Re-sourcing "Current Census" / "Previous Provider Performance" from CMS → not Phase 5 scope.
- BENCH-01/02 (comparison charts, better/worse flags) → deferred to v2.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLM-01 | Report displays 12 claims-based hospitalization/ED data points — 4 measures × {facility value + national avg + state avg}. Facility values from `ijh5-nb2v` (adjusted score); averages from `xcdc-v8bm`. Dataset IDs verified via metastore. | Dataset IDs live-verified (both HTTP 200, correct schema). Fixture values match live API for 686123. Parallel `Promise.allSettled` fan-out pattern documented. |
| CLM-02 | Suppressed or "too few to report" values render cleanly (e.g. "Not reported (small sample)") rather than as blanks, nulls, or errors. | Footnote codes 1/2/7/9/10/28 confirmed from FEATURES.md Table 15. Empty-string suppression pattern (same as existing `nullableNum`) documented. Per-row, not per-measure-group, rendering confirmed (D-10). |
| CLM-03 | Metrics section matches reference labels and order exactly (including garbled text); values come from fixture/live API, not reference PDF's illustrative numbers. | All 12 verbatim labels extracted from CONTEXT.md `<specifics>`. 686123 fixture values cross-checked against live API. Both confirmed identical to fixture. |
</phase_requirements>

---

## Summary

Phase 5 adds 12 CMS claims data points by fanning out `GET /api/facility` to three datasets simultaneously, joining results into a `HospMetric[]` shape, embedding that shape in `ReportViewModelSchema`, and appending 12 flat rows to both the web `<dl>` and the react-pdf flexbox body — reusing the patterns established in Phases 2 and 4.

**Both CMS dataset IDs are confirmed live as of 2026-06-18.** `ijh5-nb2v` (Medicare Claims Quality Measures) returns the exact 4-row schema from the captured fixture. `xcdc-v8bm` (State/US Averages) returns the NATION row with the same hash-suffixed column names as the fixture. Neither ID has rotated since the fixtures were captured.

The 12 data points map to: 4 facility adjusted scores (`ijh5-nb2v`, filter `cms_certification_number_ccn`), 4 national averages and 4 state averages (`xcdc-v8bm`, keyed `state_or_nation = 'NATION'` / `state_or_nation = <state>`). Average columns must be matched by human-readable description, not hash-suffixed slug, because slugs are unstable. The four relevant column descriptions are confirmed in the fixture and live API. Suppressed values come back as empty strings, matching the existing `nullableNum` / empty-to-null pattern. The existing `formatPercent` and `formatRate` formatters cover all 12 display values without modification.

**Primary recommendation:** Add two sibling fetchers to `client.ts` (matching `fetchFacility`'s SSRF/timeout discipline), run all three in `Promise.allSettled` in the route handler, join the results in a new `claims-mapper.ts`, replace `hospMetrics: z.unknown().optional()` in the view-model with a real Zod schema (keeping it `.optional()` for degraded-state tolerance), and append 12 flat rows to `ReportPreview.tsx` + `ReportPDF.tsx`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CMS claims fetch (ijh5-nb2v) | API / Backend (Route Handler) | — | CORS blocks direct browser calls; same server-side pattern as existing `fetchFacility` |
| CMS averages fetch (xcdc-v8bm) | API / Backend (Route Handler) | — | Same CORS + SSRF discipline; run in parallel with claims fetch |
| Claims + averages join / mapper | API / Backend (lib/cms/claims-mapper.ts) | — | Pure data transform; belongs in the CMS lib layer alongside `mapper.ts` |
| Zod validation of new CMS responses | API / Backend (lib/cms) | — | Rule #4 — every CMS response validated before reaching UI or PDF |
| `hospMetrics` slot in view-model | API / Backend (lib/report/view-model.ts) | Client (consumed at render time) | Single shared model drives preview + PDF + DOCX (RPT-02) |
| Footnote → suppression message lookup | API / Backend (lib/report/format.ts or sibling) | — | Pure formatter; no browser state needed |
| 12 flat rows in web preview | Browser / Client (ReportPreview.tsx) | — | Continues the existing `<dl>` pattern |
| 12 flat rows in PDF | Frontend Server / SSR (ReportPDF.tsx) | — | Continues the existing flexbox-row pattern; no "use client" |
| Degraded one-line state | Both (ReportPreview + ReportPDF) | — | Renders when `hospMetrics` absent/unavailable in view-model |

---

## Standard Stack

### Core (no new installs — all already in place)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | `^4.4.3` | Validate claims/averages CMS responses | Already installed (Phase 1); same `nullableNum` / `safeParse` pattern |
| `@react-pdf/renderer` | `^4.5.1` | PDF rows for the metrics section | Already installed (Phase 4); server-only; no new config needed |
| Next.js Route Handler | 16.2.x | Fan-out fetcher; `export const runtime = 'nodejs'` already set | Established in Phase 2; `params` is a Promise (handled) |

No new packages to install for Phase 5. The entire phase reuses installed libraries.

### Supporting (existing helpers — reuse without modification)

| Helper | Location | Reuse |
|--------|----------|-------|
| `nullableNum` | `schema.ts` | Extract or replicate inline in the new claims/averages schemas |
| `safeParseCMSRow` pattern | `parse.ts` | Template for new `safeParseClaimsRow` / `safeParseAveragesRow` |
| `formatPercent` | `format.ts` | For % measures (521/522) + their national/state averages |
| `formatRate` | `format.ts` | For per-1000-rate measures (551/552) + their national/state averages |
| `CmsError` / `assertNever` | `errors.ts` | Same error taxonomy — no new error kinds needed |
| `CMS_BASE_URL` | `constants.ts` | Base URL for all three fetchers |
| `CCN_FILTER_FIELD` | `constants.ts` | Filter property for `ijh5-nb2v` (same field name, confirmed) |

### New Constants Required

Add to `constants.ts`:
- `DATASET_CLAIMS = "ijh5-nb2v"` [VERIFIED: live CMS API 2026-06-18]
- `DATASET_AVERAGES = "xcdc-v8bm"` [VERIFIED: live CMS API 2026-06-18]
- `AVERAGES_FILTER_FIELD = "state_or_nation"` [VERIFIED: live xcdc-v8bm response 2026-06-18]

### Alternatives Considered

| Instead of | Could Use | Why not |
|------------|-----------|---------|
| Sibling fetchers in client.ts | A separate metrics endpoint | D-08: separate endpoint complicates the "POST assembled vm" PDF/DOCX flow |
| `Promise.allSettled` parallel fan-out | Sequential chain of 3 fetches | Sequential 3×8s=24s would blow Vercel ~10s function wall (D-07/D-19) |
| Extending `ReportViewModelSchema` inline | A separate metrics schema exported separately | D-13: the PDF route re-validates the full POSTed view-model — `hospMetrics` must live inside `ReportViewModelSchema` |

---

## Package Legitimacy Audit

No new packages are installed in Phase 5. All code reuses libraries already installed (Phases 1–4). This section is intentionally empty.

**Packages removed due to slopcheck [SLOP] verdict:** none (no new installs)
**Packages flagged as suspicious [SUS]:** none

---

## Live Dataset Verification (D-16 / CLAUDE.md Rule #3)

This is the most critical research task for Phase 5. Results from live CMS API calls made 2026-06-18:

### Dataset `ijh5-nb2v` — Medicare Claims Quality Measures

**HTTP status:** 200 [VERIFIED: live CMS API 2026-06-18]
**Sample response for CCN 686123 (measure_code 521):**

```json
{
  "cms_certification_number_ccn": "686123",
  "measure_code": "521",
  "measure_description": "Percentage of short-stay residents who were rehospitalized after a nursing home admission",
  "resident_type": "Short Stay",
  "adjusted_score": "25.575578",
  "observed_score": "27.372263",
  "expected_score": "25.535365",
  "footnote_for_score": "",
  "used_in_quality_measure_five_star_rating": "Y",
  "measure_period": "20241001-20250930",
  "processing_date": "2026-05-01"
}
```

**Confirmed field names:** [VERIFIED: live CMS API 2026-06-18]
- CCN filter field: `cms_certification_number_ccn` (same as `DATASET_PROVIDER_INFO` — add same constant)
- Measure identifier: `measure_code` (string "521"/"522"/"551"/"552")
- Measure text: `measure_description`
- Facility value to display: `adjusted_score` (string, must be coerced to number | null)
- Suppression signal: `footnote_for_score` (empty string `""` when not suppressed; footnote code string when suppressed)
- Resident category: `resident_type` ("Short Stay" / "Long Stay")
- Response count: `count: 4` — exactly 4 rows returned for 686123, matching fixture

**Confirmed measure codes and descriptions:** [VERIFIED: live CMS API + fixture 2026-06-18]

| measure_code | resident_type | measure_description | Unit | Formatter |
|---|---|---|---|---|
| `521` | Short Stay | Percentage of short-stay residents who were rehospitalized after a nursing home admission | % | `formatPercent` |
| `522` | Short Stay | Percentage of short-stay residents who had an outpatient emergency department visit | % | `formatPercent` |
| `551` | Long Stay | Number of hospitalizations per 1000 long-stay resident days | rate | `formatRate` |
| `552` | Long Stay | Number of outpatient emergency department visits per 1000 long-stay resident days | rate | `formatRate` |

**686123 adjusted scores (live, 2026-06-18):** 521 → 25.575578, 522 → 8.094575, 551 → 2.752503, 552 → 0.910105
These are IDENTICAL to the captured `claims-686123.json` fixture. [VERIFIED: live CMS API 2026-06-18]

---

### Dataset `xcdc-v8bm` — State/US Averages

**HTTP status:** 200 [VERIFIED: live CMS API 2026-06-18]
**Confirmed field names for NATION row:** [VERIFIED: live CMS API 2026-06-18]
- Key field: `state_or_nation` ("NATION" for national averages; 2-letter state code e.g. "FL" for state)

**The 4 relevant average columns — current live column slugs AND their descriptions:** [VERIFIED: live CMS API 2026-06-18]

| Hash-suffixed slug (UNSTABLE — do NOT key by this) | Full description (STABLE — match by this) | Measure code it corresponds to | Unit |
|---|---|---|---|
| `percentage_of_short_stay_residents_who_were_rehospitalized__1d02` | "Percentage of short-stay residents who were rehospitalized..." | 521 (STR rehosp %) | % |
| `percentage_of_short_stay_residents_who_had_an_outpatient_em_d911` | "Percentage of short-stay residents who had an outpatient emergency department visit" | 522 (STR ED %) | % |
| `number_of_hospitalizations_per_1000_longstay_resident_days` | "Number of hospitalizations per 1000 longstay resident days" | 551 (LT hosp/1000) | rate |
| `number_of_outpatient_emergency_department_visits_per_1000_l_de9d` | "Number of outpatient emergency department visits per 1000 long-stay resident days" | 552 (LT ED/1000) | rate |

**Note:** `number_of_hospitalizations_per_1000_longstay_resident_days` and `number_of_outpatient_emergency_department_visits_per_1000_l_de9d` appear as full column names in the live response — no truncation on the non-% rate columns. The two percentage columns ARE truncated with hash suffixes `_1d02` and `_d911`. The description-match approach (D-14) handles both correctly.

**686123 FL averages (live, 2026-06-18 — identical to `averages-xcdc.json` fixture):**
- `percentage_of_short_stay_residents_who_were_rehospitalized__1d02` (FL): 26.203324
- `percentage_of_short_stay_residents_who_had_an_outpatient_em_d911` (FL): 9.157686
- `number_of_hospitalizations_per_1000_longstay_resident_days` (FL): 2.147753
- `number_of_outpatient_emergency_department_visits_per_1000_l_de9d` (FL): 1.156036

**NATION averages (live, 2026-06-18 — identical to fixture):**
- `percentage_of_short_stay_residents_who_were_rehospitalized__1d02` (NATION): 23.875617
- `percentage_of_short_stay_residents_who_had_an_outpatient_em_d911` (NATION): 12.013574
- `number_of_hospitalizations_per_1000_longstay_resident_days` (NATION): 1.897659
- `number_of_outpatient_emergency_department_visits_per_1000_l_de9d` (NATION): 1.798049

---

### Footnote Codes (NH_Data_Dictionary Table 15)

Confirmed codes that appear or may appear on claims rows: [CITED: FEATURES.md Table 15, traced to NH_Data_Dictionary May 2026]

| Code | Meaning | Display string (D-11) |
|------|---------|----------------------|
| `9` | Too few residents to report | "Not reported (small sample)" |
| `7` | CMS suppressed data | "Not available" |
| `10` | Data missing or not submitted | "Not submitted" |
| `1` | Newly certified, insufficient data | "Not enough data" |
| `2` | Not enough data for star rating | "Not enough data" |
| `28` | Annual measure, no quarterly data | "Not enough data (annual measure)" |
| (unknown) | Any other code | "Not available" (safe generic fallback) |
| (empty string, empty score) | Score blank with no footnote | "Not available" (fallback) |

**Note on 686123:** All four measures have `footnote_for_score: ""` (empty) and non-empty `adjusted_score`. The suppression path (D-11) cannot be exercised with the live 686123 data. Tests for suppression MUST use synthetic/constructed fixtures or a different CCN with suppressed data.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser / SnapshotApp.tsx
    |  (1) GET /api/facility?ccn=686123
    v
Route Handler: GET /api/facility
    |-- Promise.allSettled([
    |     fetchFacility(ccn)       → 4pq5-n9py  (hard dependency)
    |     fetchClaimsMeasures(ccn) → ijh5-nb2v  (soft — degraded if fails)
    |     fetchAverages(state)     → xcdc-v8bm  (soft — degraded if fails)
    |   ])
    |-- If provider info fails → throw CmsError (existing behavior, unchanged)
    |-- If claims/averages fail → set metricsUnavailable flag
    |-- Join claims rows + NATION/state averages → HospMetric[]  [claims-mapper.ts]
    |
    v
Response: { data: FacilityData, hospMetrics: HospMetric[] | { unavailable: true } }
    |
    v
assembleViewModel(facility, manual, generatedAt, hospMetrics?)
    → ReportViewModel  (hospMetrics: HospMetricSchema[] | undefined)
    |
    +-----> ReportPreview.tsx (web <dl>)
    |         rows 14–25: 12 flat label/value rows  OR  one degraded line
    |
    +-----> POST /api/export/pdf → ReportPDF.tsx
              rows 14–25: same 12 flat flexbox rows  OR  one degraded line
```

### Recommended Project Structure Changes

```
src/lib/cms/
├── constants.ts        # ADD: DATASET_CLAIMS, DATASET_AVERAGES, AVERAGES_FILTER_FIELD
├── client.ts           # ADD: fetchClaimsMeasures(ccn), fetchAverages(state)
├── schema.ts           # unchanged (provider schema only)
├── claims-schema.ts    # NEW: ClaimsRowSchema (ijh5-nb2v row)
├── averages-schema.ts  # NEW: AveragesRowSchema (xcdc-v8bm row — NATION or state)
├── mapper.ts           # unchanged (provider mapper only)
├── claims-mapper.ts    # NEW: joinClaimsAndAverages(...) → HospMetric[]
├── types.ts            # ADD: HospMetric interface, HospMetricsResult
├── errors.ts           # unchanged (no new error kinds)
└── parse.ts            # unchanged (provider parse helpers only)

src/lib/report/
├── view-model.ts       # CHANGE: hospMetrics z.unknown().optional() → HospMetricSchema array
├── format.ts           # ADD: formatFootnote(code: string | undefined) → string
└── header.ts           # unchanged

src/app/api/facility/
└── route.ts            # EXTEND: fan-out to 3 datasets, pass hospMetrics in response

src/components/
├── ReportPreview.tsx   # EXTEND: 12 rows after row 13 + degraded one-line state
└── pdf/ReportPDF.tsx   # EXTEND: same 12 rows as flexbox rows + degraded line
```

### Pattern 1: Sibling Fetcher (mirror of fetchFacility)

The two new fetchers replicate the SSRF/timeout/Zod discipline of `fetchFacility` exactly. Key differences:
- `fetchClaimsMeasures` returns an array (4 rows) not a single row
- `fetchAverages` fetches two rows (NATION + state) without a CCN filter

```typescript
// Source: mirrors client.ts pattern (VERIFIED)
export async function fetchClaimsMeasures(ccn: string): Promise<ClaimsRow[]> {
  const url = new URL(`${CMS_BASE_URL}/${DATASET_CLAIMS}/0`);
  url.searchParams.set("conditions[0][property]", CCN_FILTER_FIELD);
  url.searchParams.set("conditions[0][value]", ccn);
  url.searchParams.set("conditions[0][operator]", "=");
  url.searchParams.set("limit", "10"); // 4 expected; 10 is safe headroom

  let resp: Response;
  try {
    resp = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new CmsError("network_error", "Claims data is unavailable.");
  }
  if (!resp.ok) throw new CmsError("cms_api_error", "Claims data is unavailable.");
  let json: { results?: unknown };
  try { json = await resp.json() as { results?: unknown }; } catch {
    throw new CmsError("cms_api_error", "Claims data is unavailable.");
  }
  if (!Array.isArray(json.results)) throw new CmsError("cms_api_error", "Claims data unavailable.");
  // Zod-validate each row; filter out invalid rows (graceful partial)
  return json.results.flatMap((r) => {
    const p = ClaimsRowSchema.safeParse(r);
    return p.success ? [p.data] : [];
  });
}
```

### Pattern 2: Promise.allSettled Fan-out

```typescript
// Source: D-07 decision (CONTEXT.md), standard Promise.allSettled pattern
const [providerResult, claimsResult, averagesResult] = await Promise.allSettled([
  fetchFacility(ccn),
  fetchClaimsMeasures(ccn),
  fetchAverages(facility.state),  // NOTE: facility.state from providerResult
]);
```

**Timing constraint:** `fetchAverages` needs the facility `state` which comes from provider info. Two options:
1. Run provider info first, then fan out claims + averages (2-step, ~8s + ~8s worst case — too slow)
2. Run all three in parallel and use the state from the ccn filter parameter passed to `fetchAverages`, OR pass the state as a parameter once provider info resolves, OR pass the state lookup separately

**Resolution (D-07 aware):** The safest pattern is to run `fetchFacility` first (it is the hard dependency), then fan out `fetchClaimsMeasures` + `fetchAverages` in parallel using the resolved state. Total worst-case: 8s (provider) + 8s (parallel claims+averages) = 16s — this exceeds the Vercel 10s wall.

**Better approach (recommended):** Run all three in parallel, passing the CCN-derived state separately to `fetchAverages`. Since `xcdc-v8bm` takes a `state_or_nation` value, the state can be obtained from the URL parameter or from a prior GET — BUT the state is only known after `fetchFacility` resolves. The practical solution: run `fetchFacility` first (as the hard dependency must complete before anything is returned), then immediately fire `fetchClaimsMeasures` and `fetchAverages` in parallel with `Promise.allSettled`. This means: ~8s max for provider + ~8s max for claims/averages parallel = up to 16s in worst case.

**Critical mitigation:** Each fetch has an 8s `AbortSignal.timeout`. In practice CMS API responds in ~300ms-1s. The wall is only hit if CMS is degraded. The graceful degradation path (D-07/D-09) means a timeout on claims/averages simply shows the one-line message — it does NOT fail the whole request. The 8s timeout fires first, not the Vercel function timeout.

**Practical recommendation for the route:** Provider info fetched first (hard dependency). If it resolves, immediately issue `Promise.allSettled([fetchClaimsMeasures(ccn), fetchAverages(facility.state)])`. Both have independent 8s timeouts. The total exposed time is ~8s (provider) then ~8s (parallel bonus fetches) — but the PDF route is a separate POST, and the GET /api/facility response is what the browser waits on. Given the CMS API typically responds in <2s, this is fine in practice. The planner should document the theoretical worst case in the implementation task.

### Pattern 3: Claims-Mapper Join

The mapper receives:
- `claimsRows: ClaimsRow[]` — up to 4 rows from `ijh5-nb2v`
- `nationRow: AveragesRow` — NATION row from `xcdc-v8bm`
- `stateRow: AveragesRow` — state (e.g. FL) row from `xcdc-v8bm`

And produces 4 `HospMetric` objects, one per measure code. Each metric:
- Finds the matching `ClaimsRow` by `measure_code`
- Extracts `adjusted_score` (string → number | null via the same empty-string coercion as `nullableNum`)
- Extracts `footnote_for_score` (string — empty means no suppression)
- Looks up the corresponding average column from NATION and state rows by matching against the description (not the hash slug)

**Average column matching — description-to-slug resolution at mapper construction time:**

```typescript
// Source: CONTEXT.md D-14 + live fixture verification (VERIFIED 2026-06-18)
// The mapper does NOT hardcode column slugs. Instead it scans the averages row's
// keys to find the one whose full description matches the target.
// The averages-schema.ts should use .passthrough() and store a parsed typed subset.

// Mapping from measure_code to partial description substring used to identify the column:
const AVERAGE_COLUMN_DESCRIPTIONS = {
  '521': 'short-stay residents who were rehospitalized',      // _1d02
  '522': 'short-stay residents who had an outpatient em',     // _d911
  '551': 'hospitalizations_per_1000_longstay',               // full column name, no hash
  '552': 'outpatient_emergency_department_visits_per_1000_l', // _de9d
} as const;
```

**Alternative (simpler):** Because the fixture has confirmed the current slugs and the two rate columns (`551`, `552`) have untruncated full names, the schema can explicitly type the two untruncated column names as required keys and use description-matching only for the two truncated `_1d02`/`_d911` columns. However, the pure description-match approach is more robust to any future re-truncation.

### Pattern 4: HospMetric Schema (D-13)

```typescript
// Source: CONTEXT.md D-13 decision (ASSUMED — exact shape is planner's call)
const HospMetricSchema = z.object({
  /** Verbatim label from reference template (D-04) */
  label: z.string(),
  /** Facility adjusted score (number | null — null when suppressed) */
  value: z.number().nullable(),
  /** Format kind — drives which formatter is called at render time (D-12) */
  unit: z.enum(["percent", "rate"]),
  /** Footnote code from CMS (D-11). Empty string or absent = not suppressed. */
  footnoteCode: z.string().optional(),
});

// The full hospMetrics field in ReportViewModelSchema:
// z.array(HospMetricSchema).length(12).optional()
// — optional so a degraded response (D-09) validates (hospMetrics absent = show one-line message)
```

**D-09 degraded state representation:** When the bonus fetch fails, `hospMetrics` is simply absent (undefined) in the view-model. The preview/PDF components render the one-line "temporarily unavailable" message when `vm.hospMetrics === undefined`. This is simpler than a `{ unavailable: true }` sentinel and keeps the schema clean.

### Pattern 5: Flat Row Rendering (D-03)

Web preview (`ReportPreview.tsx`) — append after row 13 inside the existing `<dl>`:

```tsx
{/* Source: ReportPreview.tsx existing pattern (VERIFIED) */}
{vm.hospMetrics === undefined ? (
  <>
    <dt className="font-semibold text-zinc-700 col-span-2">
      Hospitalization &amp; ED metrics are temporarily unavailable.
    </dt>
  </>
) : (
  vm.hospMetrics.map((m) => (
    <>
      <dt className="font-semibold text-zinc-700">{m.label}</dt>
      <dd className="text-zinc-900">{renderMetricValue(m)}</dd>
    </>
  ))
)}
```

PDF (`ReportPDF.tsx`) — append after row 13 as flexbox rows:

```tsx
{/* Source: ReportPDF.tsx existing row pattern (VERIFIED) */}
{vm.hospMetrics === undefined ? (
  <View style={styles.row}>
    <Text style={styles.value}>
      Hospitalization &amp; ED metrics are temporarily unavailable.
    </Text>
  </View>
) : (
  vm.hospMetrics.map((m, i) => (
    <View key={i} style={styles.row}>
      <Text style={styles.label}>{m.label}</Text>
      <Text style={styles.value}>{renderMetricValue(m)}</Text>
    </View>
  ))
)}
```

### Anti-Patterns to Avoid

- **Keying averages by hash-suffixed slug directly** (`_1d02`, `_d911`): column slugs are unstable — D-14. Match by description substring or derive slug at runtime.
- **Storing `observed_score` or `expected_score` in `hospMetrics`**: Only `adjusted_score` is displayed (D-15). The schema does NOT need these fields.
- **Adding `hospMetrics` outside `ReportViewModelSchema`**: The PDF POST route re-validates the full model. A side-channel would bypass that validation (D-13).
- **Making `hospMetrics` required in `ReportViewModelSchema`**: The degraded state (D-09) must still pass the schema. Keep it `.optional()`.
- **Running all three fetches sequentially**: Risks Vercel 10s function timeout (D-07).
- **Rendering a blank or null where a suppressed message belongs**: CLM-02 requires clean display for every suppression case. The `formatFootnote` helper covers all footnote codes.
- **Using `||` or `!` to check a metric value**: `formatPercent` and `formatRate` already use `=== null` semantics. A real `0` is valid data.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Empty-string → null coercion for CMS numeric fields | Custom string→number converter | Mirror the existing `nullableNum` helper from `schema.ts` | Already handles all edge cases: `""` → null, `"0"` → 0, non-numeric → rejected |
| Footnote code → message map | Ad-hoc if-else chain | `formatFootnote(code)` helper function with a `Map` or `Record` | All known codes catalogued (Table 15); map is testable in isolation |
| Parallel CMS fetches | Sequential chain | `Promise.allSettled([...])` | Built-in; handles partial failure without throwing |
| Averages column discovery | Hardcoded slug strings | Description-substring match at runtime | Slugs rotate; descriptions are stable |
| PDF metric row rendering | Custom react-pdf table | Extend existing `<View style={styles.row}>` pattern | Already established in Phase 4; no layout risk |

---

## Common Pitfalls

### Pitfall 1: Average Column Slug Rotation

**What goes wrong:** Hardcoding `_1d02` / `_d911` / `_de9d` as the column keys in the Zod schema or mapper. CMS re-exports truncate long column names with a new hash suffix. After a dataset re-publication, the slug changes and `averagesRow['percentage_of_short_stay_residents_who_were_rehospitalized__1d02']` becomes `undefined`.

**Why it happens:** The columns are too long for SQL (63-char limit); CMS generates a truncated slug + hash to ensure uniqueness. The hash is derived from the full description but is not stable across re-exports.

**How to avoid:** Match average column values by finding the key whose prefix matches a known description substring. Do not use the slug as a literal constant in the schema. If the schema uses `.passthrough()`, the mapper can do a runtime key scan.

**Warning signs:** All 4 average values coming back as `undefined` or `null` after a CMS data refresh.

### Pitfall 2: state Parameter Timing in the Fan-Out

**What goes wrong:** Calling `fetchAverages(facility.state)` before `fetchFacility` has resolved. The `state` field is only available from the provider info row.

**How to avoid:** Run `fetchFacility` first (it is the hard dependency; a failure returns an error immediately). Then immediately issue `Promise.allSettled([fetchClaimsMeasures(ccn), fetchAverages(resolvedState)])`.

**Warning signs:** TypeScript error — `facility` is undefined when `fetchAverages` is called.

### Pitfall 3: hospMetrics Must Be Inside ReportViewModelSchema

**What goes wrong:** Passing `hospMetrics` as a separate JSON field outside `ReportViewModelSchema`, or adding it as a type assertion without a Zod schema. The `POST /api/export/pdf` route calls `ReportViewModelSchema.safeParse(body)`. If `hospMetrics` is not in the schema, the parsed output loses the data and the PDF renders without metrics.

**How to avoid:** Add `HospMetricSchema` inside `ReportViewModelSchema`. Replace `hospMetrics: z.unknown().optional()` with the real array schema. Keep `.optional()` so the degraded state passes.

**Warning signs:** PDF exports show "temporarily unavailable" even when the GET fetch succeeded.

### Pitfall 4: Zod v4 `.length()` is Not on `z.array()`

**What goes wrong:** Using `z.array(HospMetricSchema).length(12)` — in Zod v4, `.length()` is not a method on `ZodArray`. Use `.min(12).max(12)` or `.exact(12)` if you want to enforce length. However, for this phase `.optional()` (no length constraint) is safer because the **absent** (degraded) state — `hospMetrics` undefined when a fetch is rejected (D-09) — must still pass schema validation rather than fail it.

**How to avoid:** Use `z.array(HospMetricSchema).optional()` without length enforcement. The mapper always builds the 12-row array when both fetches are fulfilled (a fewer-than-4 claims set yields per-row suppression on the absent measure, NOT a missing array — see Open Question 1 RESOLVED / D-10 / SC#5). Whole-section degrade (the absent `hospMetrics`) is the route's `Promise.allSettled`-rejection decision (D-09), not the mapper's.

**Warning signs:** TypeScript or runtime error on `ReportViewModelSchema.safeParse`.

### Pitfall 5: Suppressed Score Rendering

**What goes wrong:** `adjusted_score` comes back as `""` when suppressed. If the schema coerces `""` to `0`, the formatter renders `"0.0%"` or `"0.00"` instead of the suppression message.

**How to avoid:** Apply the same `nullableNum` transform: `""` → `null`. Then at render time, if `m.value === null`, call `formatFootnote(m.footnoteCode)` instead of `formatPercent`/`formatRate`.

**Warning signs:** Suppressed measures showing "0.0%" or "0.00" in the preview.

### Pitfall 6: React Key Warning on Mapped Metric Rows

**What goes wrong:** Using array index as the JSX `key` in a mapped list of rows inside a `<dl>` / `<View>` map. In the `<dl>` case, `<dt>` and `<dd>` are separate elements mapped over `vm.hospMetrics` — if both get the same key the list is unstable.

**How to avoid:** Use `m.label` as the key (it is unique per row per the verbatim-label mapping). Or wrap each `<dt>/<dd>` pair in a `<React.Fragment key={m.label}>`.

---

## Code Examples

### ClaimsRowSchema (ijh5-nb2v)

```typescript
// Source: live API schema field list (VERIFIED 2026-06-18) + claims-686123.json fixture
// Mirror the nullableNum pattern from schema.ts
const nullableNum = /* ... same as schema.ts ... */;

export const ClaimsRowSchema = z.object({
  cms_certification_number_ccn: z.string(),
  measure_code: z.string(),           // "521" | "522" | "551" | "552"
  measure_description: z.string(),
  resident_type: z.string(),
  adjusted_score: nullableNum,        // coerce "" → null; "25.575578" → 25.575578
  footnote_for_score: z.string(),     // "" when no suppression; footnote code when suppressed
  processing_date: z.string(),
}).passthrough(); // preserve extra fields transparently

export type ClaimsRow = z.infer<typeof ClaimsRowSchema>;
```

### AveragesRowSchema (xcdc-v8bm)

```typescript
// Source: live API NATION row (VERIFIED 2026-06-18) + averages-xcdc.json fixture
// The two percentage columns are truncated with hash suffixes; the two rate columns are full names.
// Strategy: use .passthrough() and let the mapper do description-based key lookup.

export const AveragesRowSchema = z.object({
  state_or_nation: z.string(),   // "NATION" or "FL" etc.
  processing_date: z.string(),
}).passthrough(); // ALL other columns pass through; mapper does key scan

export type AveragesRow = z.infer<typeof AveragesRowSchema>;
```

### formatFootnote Helper (D-11)

```typescript
// Source: CONTEXT.md D-11 + FEATURES.md Table 15 (NH_Data_Dictionary May 2026)
const FOOTNOTE_MESSAGES: Record<string, string> = {
  '1':  'Not enough data',
  '2':  'Not enough data',
  '7':  'Not available',
  '9':  'Not reported (small sample)',
  '10': 'Not submitted',
  '28': 'Not enough data (annual measure)',
};
const FALLBACK_MESSAGE = 'Not available';

export function formatFootnote(footnoteCode: string | undefined): string {
  if (!footnoteCode || footnoteCode === '') return FALLBACK_MESSAGE;
  return FOOTNOTE_MESSAGES[footnoteCode] ?? FALLBACK_MESSAGE;
}
```

### renderMetricValue (at render time in Preview + PDF)

```typescript
// Source: CONTEXT.md D-11/D-12 decisions
function renderMetricValue(m: HospMetric): string {
  if (m.value === null) return formatFootnote(m.footnoteCode);
  return m.unit === 'percent' ? formatPercent(m.value) : formatRate(m.value);
}
```

### The 12 HospMetric objects — hard-coded label order

The mapper produces exactly these 12 rows in this order (verbatim labels from CONTEXT.md D-04/D-06):

```typescript
// Source: CONTEXT.md <specifics> table (verbatim from reference template)
const METRIC_DEFINITIONS = [
  { label: 'Short Term Hospitalization',                       measureCode: '521', source: 'facility', unit: 'percent' },
  { label: 'STR National Avg. for Hospitalization',            measureCode: '521', source: 'nation',   unit: 'percent' },
  { label: 'STR State National Avg. for Hospitalization',      measureCode: '521', source: 'state',    unit: 'percent' },
  { label: 'STR ED Visit',                                     measureCode: '522', source: 'facility', unit: 'percent' },
  { label: 'STR ED Visits National Avg.',                      measureCode: '522', source: 'nation',   unit: 'percent' },
  { label: 'STR ED Visits State Avg.',                         measureCode: '522', source: 'state',    unit: 'percent' },
  { label: 'LT Hospitalization',                               measureCode: '551', source: 'facility', unit: 'rate'    },
  { label: 'LT National Avg. for Hospitalization',             measureCode: '551', source: 'nation',   unit: 'rate'    },
  { label: 'LT State National Avg. for Hospitalization',       measureCode: '551', source: 'state',    unit: 'rate'    },
  { label: 'ED Visit',                                         measureCode: '552', source: 'facility', unit: 'rate'    },
  { label: 'LT ED Visits National Avg.',                       measureCode: '552', source: 'nation',   unit: 'rate'    },
  { label: 'LT ED Visits State Avg.',                         measureCode: '552', source: 'state',    unit: 'rate'    },
] as const;
```

---

## State of the Art

| Old Approach | Current Approach | Impact for Phase 5 |
|--------------|-----------------|---------------------|
| Claims data assumed to be 4 × {adjusted, observed, expected} from one file | 4 measures × {facility, national, state} across 3 datasets | Requires 2 new fetchers + a join mapper |
| `hospMetrics: z.unknown().optional()` stub | Real `HospMetricSchema[]` with per-item Zod validation | PDF POST re-validates; metrics are type-safe end-to-end |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Promise.allSettled` for claims+averages is safe within Vercel's ~10s function wall because CMS responds in <2s in practice | Architecture Patterns / Fan-out | If CMS is slow, the parallel fetches could time out; the 8s `AbortSignal.timeout` fires before the Vercel wall and triggers the degraded one-line message (acceptable per D-09) |
| A2 | Description-substring matching reliably identifies the 4 average columns across re-exports | Pitfall 1 / Code Examples | If CMS renames the descriptions (extremely rare), the averages join would silently return null for all 4 averages; the degraded-row path (D-10) would show suppression messages |
| A3 | A partial claims response (fewer than 4 measures) triggers the whole-section degraded message rather than a partial 12-row list | Architecture Patterns | If the planner prefers partial rendering, the mapper needs a more complex partial-fill strategy; D-10 allows per-row suppression but only when ALL 4 measures are present |

**If this table is non-empty:** Claims A1 and A2 are low-risk because the graceful-degradation path (D-09) covers both. A3 needs a planner decision on how to handle 1-3 measures returning (recommended: treat fewer-than-4 as whole-section degradation for simplicity).

---

## Open Questions (RESOLVED)

1. **Partial claims response (1-3 of 4 measures returned) — render partial or degrade?**
   - What we know: D-10 says "always render all 12 rows" (when the fetch succeeded). D-09 says "whole-section failure → one line."
   - What's unclear: If CMS returns only 3 of 4 measures (a real data gap, not a suppressed score), is that a "fetch succeeded" (D-10 applies, render partial) or a "fetch failure" (D-09 applies, show one line)?
   - ~~Recommendation: Treat fewer-than-4 measures as whole-section degradation for simplicity.~~ **SUPERSEDED — this recommendation contradicted the locked decisions and is rejected.**
   - **RESOLVED (per CONTEXT.md D-10 + ROADMAP success-criterion #5 "graceful partial data, no throws"):** Fewer-than-4 measures is the **D-10 partial-render case, NOT a D-09 whole-section degrade.** When BOTH the claims and averages fetches *succeed* (fulfilled), the mapper renders ALL 12 fixed rows: any absent facility measure (a missing measure_code) shows the footnote-aware suppression text in just that facility row (treated like a suppressed score — generic fallback message), while its national/state average rows STILL render their values (averages come from `xcdc-v8bm` independently). D-09's single "temporarily unavailable" line is reserved for an actual **fetch failure** (claims OR averages promise rejected at the route level via `Promise.allSettled`). The mapper therefore returns the 12-row `HospMetric[]` whenever it is given usable averages rows; the whole-section degrade decision lives in the route (Plan 03), keyed on `Promise.allSettled` rejection — not on a partial claims count.

2. **averages Zod schema strictness — typed named columns or passthrough?**
   - What we know: The two rate columns have stable full names; the two percentage columns have unstable hash suffixes.
   - What's unclear: Whether to explicitly declare the two stable columns in `AveragesRowSchema` and use passthrough for the truncated ones.
   - **RESOLVED:** Use `.passthrough()` for the entire `AveragesRowSchema` (typing only `state_or_nation` + `processing_date`); the mapper does a runtime key scan by description substring (D-14). Marginally less type-safe but robust to column-name rotation. (Implemented in Plan 01 T1 + Plan 02 T1.)

3. **Where to put `formatFootnote` — `format.ts` or a new `claims-format.ts`?**
   - What we know: `format.ts` already has `formatPercent`/`formatRate` which Phase 5 reuses.
   - **RESOLVED:** Add `formatFootnote` to the existing `format.ts` — a render-time formatter with the same null-safe semantics; no new file. (Implemented in Plan 01 T2.)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| CMS `ijh5-nb2v` API | Claims facility values | ✓ (HTTP 200, 2026-06-18) | May 2026 data | Use fixture for unit tests |
| CMS `xcdc-v8bm` API | National/state averages | ✓ (HTTP 200, 2026-06-18) | May 2026 data | Use fixture for unit tests |
| `zod` | Claims/averages schema | ✓ | 4.4.3 | — |
| `@react-pdf/renderer` | PDF metrics rows | ✓ | 4.5.1 | — |
| Node.js 26 | All server-side code | ✓ | v26.2.0 | — |

**Missing dependencies with no fallback:** None.
**Live API note:** Dataset IDs `ijh5-nb2v` and `xcdc-v8bm` confirmed live as of 2026-06-18. Per CLAUDE.md rule #3, re-confirm via the metastore before writing schemas in the implementation task.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (node env) |
| Config file | `medelite-report/vitest.config.ts` |
| Quick run command | `npx vitest run tests/lib/cms/ tests/lib/report/` (from `medelite-report/`) |
| Full suite command | `npm run verify` (from `medelite-report/`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| CLM-01 | Claims + averages join produces 12 HospMetric objects with correct values for CCN 686123 | unit | `npx vitest run tests/lib/cms/claims-mapper.test.ts` | ❌ Wave 0 |
| CLM-01 | GET /api/facility returns `hospMetrics` array in response when CMS succeeds | integration | `npx vitest run tests/api/facility.test.ts` | ✓ (extend) |
| CLM-01 | GET /api/facility response validates against extended ReportViewModelSchema | unit | `npx vitest run tests/lib/report/view-model.test.ts` | ✓ (extend) |
| CLM-01 | `fetchClaimsMeasures` returns 4 validated rows for CCN 686123 fixture | unit | `npx vitest run tests/lib/cms/client.test.ts` | ✓ (extend) |
| CLM-02 | Suppressed measure (footnote code 9) renders "Not reported (small sample)" not blank | unit | `npx vitest run tests/lib/cms/claims-mapper.test.ts` | ❌ Wave 0 |
| CLM-02 | Empty adjusted_score with no footnote renders "Not available" | unit | `npx vitest run tests/lib/cms/claims-mapper.test.ts` | ❌ Wave 0 |
| CLM-02 | formatFootnote covers all 6 known codes + unknown fallback | unit | `npx vitest run tests/lib/report/format.test.ts` | ✓ (extend) |
| CLM-03 | All 12 verbatim labels appear in correct order in the view-model output | unit | `npx vitest run tests/lib/cms/claims-mapper.test.ts` | ❌ Wave 0 |
| CLM-03 | PDF buffer for CCN 686123 contains the string "Short Term Hospitalization" | integration | `npx vitest run tests/api/export-pdf.test.ts` | ✓ (extend) |
| CLM-03 | Web preview renders all 12 metric labels (snapshot or text assertion) | unit | `npx vitest run src/components/ReportPreview.test.tsx` | ❌ Wave 0 (if added) |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/lib/cms/ tests/lib/report/` — covers schema, mapper, format tests
- **Per wave merge:** `npm run verify` — full suite + typecheck + lint + format
- **Phase gate:** `npm run verify` green (all 159+ tests pass) + `npm run verify:full` (includes `next build`)

### Wave 0 Gaps

- [ ] `tests/lib/cms/claims-mapper.test.ts` — covers CLM-01 (join), CLM-02 (suppression), CLM-03 (label order)
- [ ] `tests/lib/cms/claims-schema.test.ts` — covers ClaimsRowSchema (empty score → null, footnote passthrough)
- [ ] `tests/lib/cms/averages-schema.test.ts` — covers AveragesRowSchema passthrough
- [ ] Extend `tests/lib/report/format.test.ts` — `formatFootnote` (all 6 codes + unknown + empty string)
- [ ] Extend `tests/api/facility.test.ts` — hospMetrics present in response when claims/averages succeed; absent (or unavailability flag) when claims fetch fails
- [ ] Extend `tests/api/export-pdf.test.ts` — PDF buffer contains "Short Term Hospitalization" string when hospMetrics populated

---

## Security Domain

`security_enforcement` is not explicitly set to false in `.planning/config.json` — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth in this app |
| V3 Session Management | No | Stateless requests |
| V4 Access Control | No | Public CMS data, no ACL |
| V5 Input Validation | Yes | `state_or_nation` value passed to `xcdc-v8bm` comes from the Zod-validated `facility.state` field — never raw user input. CCN is already validated by the route handler before `fetchClaimsMeasures` is called. |
| V6 Cryptography | No | No secrets used |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via `state` value injection into averages URL | Tampering | `state` comes from `facility.state` which is a Zod-validated CMS field (not raw user input). The CMS URL host+path originate from fixed `CMS_BASE_URL` constant. The `state` is only used as a `conditions[0][value]` parameter, never concatenated into the host/path. |
| CMS response with malformed `adjusted_score` (non-numeric string) | Tampering | `nullableNum` in `ClaimsRowSchema` rejects non-numeric strings — the `Number.isFinite` check fires and adds a Zod issue, causing `safeParse` to return `success: false`. The row is silently dropped (graceful partial, not a crash). |
| `hospMetrics` data injected via POST body to PDF route | Tampering | The PDF POST route re-validates the full model against `ReportViewModelSchema`. `HospMetricSchema` enforces `unit: z.enum(["percent", "rate"])` and `value: z.number().nullable()` — a crafted body cannot inject an arbitrary string into a metric value. |

---

## Sources

### Primary (HIGH confidence — live-verified 2026-06-18)

- CMS Provider Data Catalog API, dataset `ijh5-nb2v` — live query for CCN 686123; HTTP 200; field names and 4-row schema confirmed; values match `claims-686123.json` fixture exactly.
- CMS Provider Data Catalog API, dataset `xcdc-v8bm` — live query for `state_or_nation = NATION`; HTTP 200; all 4 average column slugs + values confirmed; match `averages-xcdc.json` fixture exactly.
- `medelite-report/tests/fixtures/claims-686123.json` — captured fixture; field names confirmed against live API.
- `medelite-report/tests/fixtures/averages-xcdc.json` — captured fixture; column slugs confirmed against live API.
- `medelite-report/src/lib/cms/schema.ts` — `nullableNum` pattern to replicate.
- `medelite-report/src/lib/cms/client.ts` — `fetchFacility` SSRF/timeout pattern to replicate for new fetchers.
- `medelite-report/src/lib/report/view-model.ts` — `ReportViewModelSchema` with `hospMetrics: z.unknown().optional()` stub to replace.
- `medelite-report/src/lib/report/format.ts` — `formatPercent` / `formatRate` confirmed reusable without modification.
- `medelite-report/src/components/ReportPreview.tsx` — existing `<dl>` pattern confirmed for extension.
- `medelite-report/src/components/pdf/ReportPDF.tsx` — existing flexbox row pattern confirmed for extension.

### Secondary (MEDIUM confidence — planning artifacts verified against live data)

- `.planning/phases/05-claims-based-metrics/05-CONTEXT.md` — all decisions D-01 through D-16; the 12-row label mapping confirmed against fixture values.
- `.planning/research/FEATURES.md` — Table 15 footnote codes (traced to NH_Data_Dictionary May 2026).
- `.planning/research/SUMMARY.md` — Reconciled Q3 (12 = 4×{facility, national, state}) confirmed.

### Tertiary (ASSUMED — not live-verified in this session)

- NH_Data_Dictionary May 2026, Table 15 — footnote codes 1/2/7/9/10/28 (cited via FEATURES.md; [ASSUMED] that the table values are current as of 2026-06-18).

---

## Metadata

**Confidence breakdown:**

- Live dataset IDs: HIGH — both verified live 2026-06-18, HTTP 200, correct schema
- Field names (ijh5-nb2v): HIGH — verified against fixture + live API (identical)
- Field names (xcdc-v8bm): HIGH — verified against fixture + live API (identical)
- Average column slugs: HIGH — confirmed current as of 2026-06-18; noted as unstable (description-match mitigates)
- Footnote code table: MEDIUM — cited via FEATURES.md (traced to NH_Data_Dictionary May 2026, not re-fetched in this session)
- Architecture patterns: HIGH — derived from existing code + established project decisions (D-07/D-08/D-13)
- Render patterns: HIGH — derived from live ReportPreview.tsx + ReportPDF.tsx source

**Research date:** 2026-06-18
**Valid until:** 2026-07-18 for dataset IDs (CMS typically refreshes monthly); re-confirm if a CMS data release happens before implementation.
