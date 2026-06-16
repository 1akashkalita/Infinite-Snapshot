# Feature Research

**Domain:** Nursing-home CMS facility-assessment report generator (internship take-home)
**Researched:** 2026-06-15
**Confidence:** HIGH — all CMS field names verified against live API responses and the NH_Data_Dictionary (May 2026 edition); all dataset IDs verified via live query

---

## CMS Data: Verified Field Names and Dataset IDs

### Primary Dataset: Provider Information
**API dataset ID:** `4pq5-n9py`
**Query pattern:** `GET /api/1/datastore/query/4pq5-n9py/0?conditions[0][property]=cms_certification_number_ccn&conditions[0][value]={CCN}&conditions[0][operator]==`

Verified fields (from live response for CCN 686123, processed 2026-05-01):

| API Column Name | Report Field | Notes |
|-----------------|-------------|-------|
| `cms_certification_number_ccn` | CCN | 6-digit string, zero-padded |
| `provider_name` | Name of Facility (default) | CMS legal name |
| `legal_business_name` | Legal entity name | Differs from `provider_name` for some facilities |
| `provider_address` | Street address | e.g. "5280 SW 157 AVENUE" |
| `citytown` | City | e.g. "MIAMI" |
| `state` | State abbreviation | e.g. "FL" — used for dynamic header |
| `zip_code` | ZIP code | |
| `number_of_certified_beds` | Census Capacity | Maps to "Number of Certified Beds" in data dict |
| `average_number_of_residents_per_day` | Current Census (CMS) | MDS-based daily average |
| `overall_rating` | Overall Star Rating | Integer 1–5 (or blank with footnote) |
| `health_inspection_rating` | Health Inspection Rating | Integer 1–5 |
| `qm_rating` | Quality Measure Rating | Integer 1–5 (composite) |
| `longstay_qm_rating` | Long-Stay QM Rating | Integer 1–5 |
| `shortstay_qm_rating` | Short-Stay QM Rating | Integer 1–5 |
| `staffing_rating` | Staffing Rating | Integer 1–5 |
| `ownership_type` | Ownership | e.g. "For profit - Corporation" |
| `provider_type` | Provider Type | e.g. "Medicare and Medicaid" |
| `overall_rating_footnote` | — | Footnote code (see below) |
| `health_inspection_rating_footnote` | — | Footnote code |
| `staffing_rating_footnote` | — | Footnote code |
| `qm_rating_footnote` | — | Footnote code |
| `processing_date` | Data as-of date | "2026-05-01" format |

**Confirmed values for CCN 686123 (Kendall Lakes Healthcare and Rehab Center, Miami FL):**
- `overall_rating`: "5", `health_inspection_rating`: "5", `qm_rating`: "5", `staffing_rating`: "2"
- `number_of_certified_beds`: "150", `state`: "FL"

### Claims-Based Quality Measures Dataset
**API dataset ID:** `ijh5-nb2v`
**Filename pattern:** `NH_QualityMsr_Claims_MonYYYY.csv`
**Query pattern:** same conditions filter as above

Exactly **4 measure codes** exist in this dataset (all with `used_in_quality_measure_five_star_rating: "Y"`):

| Measure Code | Resident Type | Description | Unit |
|-------------|--------------|-------------|------|
| `521` | Short Stay | Percentage of short-stay residents who were rehospitalized after a nursing home admission | % |
| `522` | Short Stay | Percentage of short-stay residents who had an outpatient emergency department visit | % |
| `551` | Long Stay | Number of hospitalizations per 1000 long-stay resident days | rate |
| `552` | Long Stay | Number of outpatient emergency department visits per 1000 long-stay resident days | rate |

Each measure record contains three numeric scores: `adjusted_score`, `observed_score`, `expected_score` (4 measures × 3 scores = **12 numeric data points** — this is the "12 hospitalization/ED metrics" referenced in CLAUDE.md).

Footnotes apply: a `footnote_for_score` of `"9"` means "number of residents too small to report" — scores will be empty strings when suppressed.

**Confirmed values for CCN 686123:**
- 521: adjusted 25.58%, observed 27.37%, expected 25.54%
- 522: adjusted 8.09%, observed 7.66%, expected 10.58%
- 551: adjusted 2.75, observed 2.06, expected 1.43 per 1000 days
- 552: adjusted 0.91, observed 0.66, expected 1.20 per 1000 days

### MDS Quality Measures Dataset
**API dataset ID:** `djen-97ju`
**Filename pattern:** `NH_QualityMsr_MDS_MonYYYY.csv`

17 measures per facility (long-stay and short-stay MDS-based). These are NOT the hospitalization/ED measures. Available for 686123 with 4-quarter averages. Out of scope for the initial report but available for v2 expansion.

### State/National Averages Dataset
**API dataset ID:** `xcdc-v8bm`
**Filename pattern:** `NH_StateUSAverages_MonYYYY.csv`

One row per state + one NATION row. Useful for claims benchmarking:
- `percentage_of_short_stay_residents_who_were_rehospitalized__1d02`: national 23.88%
- `percentage_of_short_stay_residents_who_had_an_outpatient_em_d911`: national 12.01%
- `number_of_hospitalizations_per_1000_longstay_resident_days`: national 1.90
- `number_of_outpatient_emergency_department_visits_per_1000_l_de9d`: national 1.80

**Note:** the truncated column names (ending in `_628c` etc.) are the API's hash-suffix system for long column names; query by full readable description, not the truncated form.

### CMS Footnote Codes (from NH_Data_Dictionary May 2026, Table 15)

| Code | Meaning | Display behavior |
|------|---------|-----------------|
| 1 | Newly certified, insufficient data | "Not enough data" |
| 2 | Not enough data for star rating | Empty star or N/A |
| 7 | CMS suppressed data | "Not available" |
| 9 | Too few residents to report | "Not reported (small sample)" |
| 10 | Data missing or not submitted | "Not submitted" |
| 28 | Annual measure, no quarterly data | Show annual average only |

---

## CCN Format and Validation Rules

**Format:** Exactly 6 characters, all numeric digits, zero-padded.
- Structure: `[2-digit SSA state code][4-digit facility type + sequence]`
- SSA state codes differ from FIPS: Florida uses `68` and `69` (not `10` for all) as CCN prefixes
- Alabama uses `01` as CCN prefix; confirmed CCNs 015009–015015 all nursing homes
- Nursing home facility codes (positions 3–6) typically start with `5` (e.g., 5009) or can be in other ranges

**Practical validation rules for the app:**
1. Must be exactly 6 characters
2. Must be all digits (`/^\d{6}$/`)
3. Cannot be all zeros (`000000`)
4. **Ground truth is the API response**: a syntactically valid CCN that returns 0 results = "facility not found" (not "invalid CCN" — the distinction matters for error messaging)

**Example CCNs:** `686123` (FL, 5-star), `015009` (AL, 2-star)
**Leading zeros:** Must be preserved. Input `15009` is wrong; `015009` is correct. The app should pad-or-warn.

---

## Feature Landscape

### Table Stakes (Must Nail for a Passing Grade)

| Feature | Why Expected | Complexity | Notes |
|---------|-------------|------------|-------|
| CCN input with format validation | Every form validates before submitting | LOW | /^\d{6}$/ + clear inline error |
| "Facility not found" error state | Any CCN lookup can return 0 results | LOW | Distinct from network error; "No facility found for CCN 123456" |
| Network/timeout error state | APIs fail | LOW | Retry button + clear message; never silent |
| CMS data fields in report body | Reviewers will check these against Care Compare | LOW | provider_name, address, number_of_certified_beds, all 4 (or 5 counting sub-ratings) star ratings |
| Static header branding | Specified in brief and CLAUDE.md rule #2 | LOW | Exact string "INFINITE — Managed by MEDELITE" + "FACILITY ASSESSMENT SNAPSHOT" + state abbrev |
| Facility name override | Manual override in body only; CCN data unaffected | LOW | Text field pre-populated with `provider_name`; editing it changes body display only |
| Manual inputs section | All 6 fields specified in brief | MEDIUM | See field types below |
| "Download PDF" button | Core deliverable | MEDIUM | Uses `@react-pdf/renderer` `PDFDownloadLink` with `ssr: false` in Next.js |
| Clickable Medicare source link in PDF | Specified in brief | LOW | `<Link>` to `https://www.medicare.gov/care-compare/details/nursing-home/{CCN}` inside PDF |
| Zod schema validation of CMS response | Specified in CLAUDE.md | MEDIUM | Every field parsed before render; schema must handle empty strings for suppressed measures |
| Vercel deployment + public repo | Deliverable requirement | LOW | — |

### Manual Input Field Types (Table Stakes Detail)

The brief specifies 6 manual fields. These are UX decisions that signal quality:

| Field | Recommended Input Type | Notes |
|-------|----------------------|-------|
| EMR (Electronic Medical Record system) | Text input or select with common options (PointClickCare, MatrixCare, etc.) | Free text acceptable; a dropdown of common EMRs adds polish |
| Current Census | Number input (integer, min 0, max = `number_of_certified_beds`) | Validate against certified beds; warn if census > capacity |
| Type of Patient | Select: Short-Stay / Long-Stay / Mixed | Maps to the STR/LT distinction in CMS measures |
| Medical Coverage | Multi-select or checkboxes: Medicare / Medicaid / Private Pay / Other | A facility can have multiple; don't force single-select |
| Previous Provider Performance | Text area or structured rating field | Brief is ambiguous; text area is safe; could be a 1–5 scale |
| Previous Coverage from Medelite | Yes/No dropdown (two options only) | Must be a `<select>` not a checkbox; reviewer specifically called out "dropdown" |

### Star Rating Display (Table Stakes Detail)

All 5 star ratings from `provider_name` data must appear:
- `overall_rating` — Overall Star Rating
- `health_inspection_rating` — Health Inspection Rating
- `qm_rating` — Quality Measure (QM) Rating
- `staffing_rating` — Staffing Rating
- `longstay_qm_rating` and `shortstay_qm_rating` — sub-ratings (show as supplementary)

Display pattern: filled star (★) vs outline star (☆) for 1–5. When footnote present and score is blank, show "N/A" or "Not Rated" rather than empty stars.

---

### Differentiators (Above Expectations)

| Feature | Value Proposition | Complexity | Notes |
|---------|-----------------|------------|-------|
| Live in-browser report preview | Reviewer can see the report forming before downloading | MEDIUM | Use `usePDF` hook + debounce (300–500ms); wrap in `dynamic(() => import(...), { ssr: false })` in Next.js; avoid `PDFViewer` (SSR issues); show skeleton while generating |
| 4 claims-based hospitalization/ED measures with scores | Demonstrates deep CMS data knowledge; shows adjusted vs. observed vs. expected | MEDIUM | Dataset `ijh5-nb2v`; display all 3 scores per measure (the "12 metrics"); include national average from `xcdc-v8bm` as fourth column for context |
| State/national benchmark comparison in claims metrics | Puts facility scores in context; shows sophisticated data handling | MEDIUM | Fetch state row from `xcdc-v8bm` by matching `state_or_nation` to facility's `state`; show delta from national avg |
| Visual star cards with filled/outline stars | Turns dry numeric ratings into scannable visual | LOW-MEDIUM | In both web UI and PDF; use consistent color system (green ≥4, amber =3, red ≤2) |
| Bar chart or gauge for claims metrics | Adjusted vs. expected vs. national in a visual bar | MEDIUM | Recharts in web UI (SVG); in PDF use `@react-pdf/renderer` `<Rect>` primitives to draw bars (no SVG in react-pdf) |
| .docx export | Additional export format signals production readiness | HIGH | `docx` or `officegen` npm package; must mirror PDF content fidelity |
| Suppressed measure handling with display | Quality detail that naive implementations miss | LOW | If `footnote_for_score` is non-empty and score is blank, show footnote description instead of blank cell |
| Loading skeleton during CMS fetch | Prevents "is this broken?" confusion during API round-trip | LOW | Tailwind animate-pulse placeholders in the shape of the result sections |
| Debounced live preview updates | Prevents jank when user types quickly in manual fields | LOW | 300ms debounce on `updateInstance()` call; show "Generating..." state |
| CCN leading-zero auto-format | Facility admins often type 5-digit CCNs for states with leading-zero codes | LOW | If 5 digits entered, pad to 6 with leading zero before API call; show both raw input and padded CCN |

### What "Above Expectations" Actually Looks Like for This Reviewer

The reviewer is grading a Medelite take-home, so they will:
1. Enter CCN `686123`, check the star ratings against Medicare.gov Care Compare
2. Fill manual fields and watch the preview update
3. Download the PDF and verify branding, hyperlink, and formatting
4. Look for crash/blank states by entering garbage CCNs

The differentiators that will stand out most:
- The live preview updating as they type (instant "wow" moment)
- Star ratings rendered as actual star glyphs rather than plain numbers
- Claims metrics with a "vs. national average" column (shows data sophistication)
- Zero blank/undefined states (every possible missing field gracefully handled)

---

### Anti-Features (Deliberately Skip)

| Anti-Feature | Why Requested | Why Problematic | What to Do Instead |
|-------------|--------------|-----------------|-------------------|
| All 17 MDS quality measures in the report | More data seems more complete | Clutter; the brief specifies 12 hospitalization/ED metrics (claims measures), not all MDS measures; adds no value for the operational "snapshot" purpose | Show only the 4 claims measures (521, 522, 551, 552) with their 3 scores each |
| Batch CCN lookup / multi-facility | Seems like a logical extension | Blows scope in the one-week timeline; the brief is explicit: "one CCN at a time" | Keep it single-CCN |
| Authentication / login | "Real" apps have auth | Single-use internal tool per brief; no user concept needed | No auth at all |
| Saving reports to a database | Persistence feels professional | Stateless generation is intentional; adds backend complexity with no reviewer benefit | Generate on demand; no persistence |
| Auto-refresh on CMS data changes | "Live data" sounds appealing | CMS data refreshes monthly; polling adds complexity with near-zero value | Fetch on submit; show `processing_date` so reviewer knows data currency |
| html2canvas / jsPDF PDF generation | Familiar, simpler API | Explicitly banned by CLAUDE.md rule #7; produces lower-quality PDFs | `@react-pdf/renderer` only |
| Server-side PDF generation | Better for production scale | This is a client-side demo app; SSR PDF generation in Next.js with react-pdf requires careful `dynamic()` handling that adds risk | Generate in browser; use `PDFDownloadLink` with `ssr: false` |
| Editable PDF fields | "Interactive PDF" sounds impressive | Outside react-pdf's capability; adds major scope | Static, print-ready PDF is the deliverable |
| Geocoded map of facility location | CMS provides lat/lng | Not part of the brief; adds external map API dependency | Show address as text only |

---

## Feature Dependencies

```
CCN Lookup (Feature 1)
    └──requires──> Zod Schema Validation (Feature 2) — data must be validated before display
                       └──requires──> Error Handling (all paths) — schema parse failures = explicit error

CMS Data Engine (Feature 2)
    └──enables──> Report Body (Feature 4) — body needs validated CMS fields
    └──enables──> Claims Metrics (Bonus) — separate API call to ijh5-nb2v

Manual Inputs (Feature 3)
    └──requires──> Facility name override scoped to body — no effect on header

Live Preview (Bonus)
    └──requires──> Report Body (Feature 4) — preview renders the same document component
    └──requires──> usePDF hook with debounce — not PDFViewer (SSR issues in Next.js)

PDF Export (Feature 5)
    └──requires──> Report Body (Feature 4) — same Document component, different output
    └──requires──> next/dynamic with ssr: false — react-pdf cannot run server-side

Claims Metrics (Bonus)
    └──requires──> CMS Data Engine (Feature 2) — needs facility state from provider info
    └──enables──> State/National Benchmark — xcdc-v8bm lookup by facility state

.docx Export (Bonus)
    └──requires──> Report Body (Feature 4) — must mirror the same content
    └──conflicts with──> using same react-pdf components — docx needs separate rendering path
```

---

## Edge-Case Behaviors That Signal Quality

### CCN Validation Edge Cases

| Input | Expected Behavior | Why It Matters |
|-------|-----------------|----------------|
| `686123` | Fetch succeeds, report renders | Happy path |
| `68612` (5 digits) | Auto-pad to `068612` or show "CCN must be 6 digits" | Common user error for states where first digit is 0 |
| `ABCDEF` | Inline error "CCN must be 6 digits" before any API call | Format check client-side |
| `000000` | API returns 0 results → "No facility found" | Not a real CCN |
| `999999` | API returns 0 results → "No facility found" | Same |
| Valid CCN from another provider type (e.g., hospital) | API returns 0 results → "No facility found for nursing homes" | CMS API is nursing-home-specific (dataset 4pq5-n9py) |

### CMS Response Edge Cases

| Scenario | Expected Behavior | Implementation |
|----------|-----------------|---------------|
| `overall_rating` is blank string, footnote is "2" | Display "Not Rated" in star field with footnote explanation | Zod schema: `z.string().or(z.null())` for all score fields |
| Claims measure has empty `adjusted_score` and `footnote_for_score: "9"` | Show "Not reported (small sample)" instead of blank or 0 | Display footnote code → text mapping |
| Network timeout / CORS error / 500 from CMS | Clear error message with retry button; no crash | Try/catch around fetch; Zod `.safeParse()` not `.parse()` |
| CMS API returns unexpected new fields | Zod ignores unknown fields by default with `.strict(false)` or use `z.object({...}).passthrough()` | No-crash on schema evolution |
| State field is blank or missing | Header shows "—" instead of empty string | `assembleHeader()` handles null state gracefully |
| `number_of_certified_beds` is "0" or blank | Display "Unknown" not "0 beds" | Rare but possible for newly certified facilities |
| Claims dataset returns only 2 of 4 measures (data gap) | Show available measures; mark missing as "Not Available" | Don't assume 4 records will always return |

### Manual Input Edge Cases

| Input | Expected Behavior |
|-------|-----------------|
| Current Census > number_of_certified_beds | Warning (not blocking): "Census exceeds certified bed count" |
| Current Census = 0 | Valid; some facilities are temporarily empty |
| Previous Coverage from Medelite = neither Yes nor No | Should not be possible with dropdown; default to empty/unselected (not auto-yes) |
| Facility name override = empty string | Fall back to `provider_name` from CMS |

---

## MVP Definition

### Launch With (v1 — Required Features)

- [ ] CCN input with 6-digit format validation and clear inline error
- [ ] CMS Provider Info lookup (dataset `4pq5-n9py`) with exact-match condition filter
- [ ] Zod schema covering all displayed fields; `.safeParse()` used everywhere
- [ ] Report body: facility name (with override), address, certified beds, all 5 star ratings (4 main + staffing is the required 4 per brief)
- [ ] Manual inputs: all 6 fields with correct types (especially Yes/No dropdown for Medelite coverage)
- [ ] Static header: exact "INFINITE — Managed by MEDELITE" + "FACILITY ASSESSMENT SNAPSHOT" + state abbrev
- [ ] PDF export via `PDFDownloadLink` with `ssr: false` dynamic import
- [ ] Medicare Care Compare clickable link in PDF
- [ ] Error states: invalid format, not found, network failure — all tested
- [ ] Vercel deployment + public GitHub repo

### Add After Core (Committed Bonuses)

- [ ] Claims measures (dataset `ijh5-nb2v`): 4 measures × 3 scores = 12 data points, with state/national context from `xcdc-v8bm`
- [ ] Live preview: `usePDF` hook + 300ms debounce + skeleton during generation
- [ ] Star rating visual cards: filled/outline glyphs with color-coded bands
- [ ] .docx export: `docx` npm package mirroring PDF content
- [ ] Suppressed measure display: footnote code → human-readable text

### Future Consideration (v2+)

- [ ] All 17 MDS quality measures in report (adds depth but not in brief)
- [ ] Historical star rating trend (requires multiple data fetches)
- [ ] Multi-facility comparison view

---

## Feature Prioritization Matrix

| Feature | Reviewer Value | Implementation Cost | Priority |
|---------|--------------|-------------------|----------|
| CCN lookup + error handling | HIGH | LOW | P1 |
| All 4 star ratings in report | HIGH | LOW | P1 |
| Manual inputs with correct field types | HIGH | LOW | P1 |
| PDF export with branding + link | HIGH | MEDIUM | P1 |
| Zod validation of CMS response | HIGH | MEDIUM | P1 |
| Deployment (live URL) | HIGH | LOW | P1 |
| Live preview | HIGH | MEDIUM | P2 |
| Claims measures (12 data points) | HIGH | MEDIUM | P2 |
| Star visual cards | MEDIUM | LOW | P2 |
| State/national benchmark column | MEDIUM | LOW | P2 |
| .docx export | MEDIUM | HIGH | P2 |
| Suppressed measure display | MEDIUM | LOW | P2 |
| CCN leading-zero auto-pad | LOW | LOW | P3 |
| Loading skeleton | MEDIUM | LOW | P2 |

---

## Sources

- CMS Provider Data Catalog API: `https://data.cms.gov/provider-data/` — live queries verified 2026-06-15
- NH Data Dictionary (May 2026): `https://data.cms.gov/provider-data/sites/default/files/data_dictionaries/nursing_home/NH_Data_Dictionary.pdf` — Tables 2, 11, 12, 15 extracted and verified
- Live API response for CCN 686123: dataset `4pq5-n9py` conditions query — HIGH confidence, verified
- Live API response for claims measures: dataset `ijh5-nb2v` — HIGH confidence, 4 measures confirmed
- State/national averages: dataset `xcdc-v8bm` — HIGH confidence, national benchmarks confirmed
- CMS ResDAC CCN documentation: `https://resdac.org/cms-data/variables/provider-number` — MEDIUM confidence on CCN structure details
- @react-pdf/renderer advanced docs: `https://react-pdf.org/advanced` — HIGH confidence on usePDF hook, BlobProvider, PDFDownloadLink
- @react-pdf/renderer live preview discussion: GitHub #2475 — MEDIUM confidence on debounce pattern

---

*Feature research for: nursing-home CMS facility-assessment report generator*
*Researched: 2026-06-15*
