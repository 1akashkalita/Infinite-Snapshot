# Phase 03: Web UI, Core Flow & Deployment — Research

**Researched:** 2026-06-17
**Domain:** Next.js 16 App Router client components, React 19 state/fetch patterns, Tailwind v4, Vitest node-env testing, Vercel subdir deployment
**Confidence:** HIGH (all sources verified against project-local Next.js 16 docs + live codebase inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01**: Two-pane side-by-side layout. Form/controls left, live report preview right; collapses to stacked on narrow viewports.
- **D-02**: Preview renders as a paper-like document page (white "page" panel with static header + report body) mirroring the eventual PDF/print layout.
- **D-03**: Body labels and section order MUST match the user-provided reference report. Fallback if not supplied: Name of Facility → Location → Census Capacity → 4 Star Ratings → manual fields. Exact garbled label fidelity (CLM-03) is Phase 5.
- **D-04**: Explicit "Generate" button triggers fetch (Enter-to-submit also). No auto-fetch on keystroke.
- **D-05**: Client-side CCN format pre-check (`/^[A-Za-z0-9]{6}$/`, trim + uppercase) before any fetch. Server route stays the source of truth; the client check is UX-only.
- **D-06**: Skeleton preview (greyed layout skeleton) before first search and during loading — not blank, not just a spinner.
- **D-07**: Error placement split by nature:
  - **Inline beneath CCN field**: `invalid_ccn`, `not_found`
  - **Top banner (above form/preview)**: `network_error`, `cms_api_error`, `validation_error`
- **D-08**: UI-authored friendly per-kind copy. Client overrides server's default message (Phase-2 D-02 explicitly allows). `validation_error` uses non-retry copy; `network_error`/`cms_api_error` may use retry copy.
- **D-09**: Exhaustive kind handling via imported `CmsApiError` union + `assertNever`. Never loosely hardcode kind strings.
- **D-10**: Partial/missing CMS fields are NOT an error state — full report renders with N/A placeholders.
- **D-11**: Manual inputs reset on **successful** fetch (not on submit or error, so failed lookup doesn't wipe typed data).
- **D-12**: EMR (text), Current Census (numeric), Type of Patient (text), Medical Coverage (free text), Previous Provider Performance (text), Previous Coverage from Medelite (Yes/No control), optional facility-name override (text). Maps 1:1 to existing `ManualInputs` interface.
- **D-13**: Name override affects body's "Name of Facility" only (NAME-02). Already enforced in `assembleViewModel`.
- **D-14**: Vercel via dashboard Git integration. Root Directory = `medelite-report`. Auto-deploy on push to `main`; preview deploys on PRs. One-time account login/connect is a user action.
- **D-15**: Repo stays fully public including `.planning/`. Push all 54 unpushed commits to `github.com/1akashkalita/Infinite-Snapshot`.
- **D-16**: Skeleton-first early deploy. Deploy a minimal working page early in Phase 3 to establish CD and surface issues before full flow lands.
- **D-17**: No env vars/secrets. CMS Provider Data Catalog API is public (no key); Vercel needs no environment configuration.

### Claude's Discretion

- Component structure under `src/app/` and `src/components/`: form vs preview vs error components. The page is interactive so form/preview are client components (`"use client"`) while the existing route handler stays server-side.
- State approach (local React state vs a small hook) and Tailwind v4 styling details.
- Exact reset trigger nuance (D-11) — reset on **successful** fetch recommended.
- Whether to add a thin client fetch helper/hook around `GET /api/facility`.
- Vercel setup specifics beyond D-14 if needed; otherwise dashboard Git integration with Root Dir = `medelite-report`.

### Deferred Ideas (OUT OF SCOPE)

- Visual identity / aesthetic polish (brand accent, typography, color system) — run `/gsd:ui-phase 3` for deeper UI-SPEC design contract.
- 300ms manual-input debounce → Phase 7.
- Star-rating visual cards / charts (recharts, react-pdf-charts) → Phase 7.
- Download PDF / DOCX buttons → Phases 4 / 6.
- Claims metrics section + exact garbled reference labels (CLM-03) → Phase 5.
- Full "Looks Done But Isn't" deployment checklist + Vercel smoke test → Phase 7.
- v2 benchmarks (BENCH-01/02) — deferred at init.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOOK-01 | User can enter CCN in an input box and submit to fetch that facility's data | Client form with explicit submit trigger; `fetch GET /api/facility?ccn=` from client component |
| LOOK-02 | App validates CCN format (6-char alphanumeric, string, leading zeros preserved) and shows inline error before any fetch | D-05 client pre-check: `/^[A-Za-z0-9]{6}$/` on trim+uppercase; `<input type="text">` never `type="number"` |
| LOOK-03 | App distinguishes "invalid format" from "facility not found" with distinct user-friendly messaging | D-07 inline placement; imported `CmsApiError` union discriminates `invalid_ccn` vs `not_found` |
| INPT-01 | User can enter EMR, Current Census, Type of Patient, Medical Coverage, Previous Provider Performance | All map to `ManualInputs` interface already built; bind to React controlled inputs |
| INPT-02 | User can set "Previous Coverage from Medelite" via Yes/No control | `<select>` or radio group binding to `"Yes" \| "No" \| null` in `ManualInputs.previousCoverage` |
| INPT-03 | Manual inputs appear in the report body alongside CMS data | `assembleViewModel(facility, manual, generatedAt)` already handles this; preview renders `vm.manual.*` fields |
| PREV-01 | User sees in-browser preview of the report that updates as they edit manual inputs | Pure `assembleViewModel` called client-side on every manual input change; React state drives re-render |
| ERR-01 | Invalid CCN, facility-not-found, network/API failure, and missing/partial CMS fields each produce a distinct clean user-facing state | D-07 placement map covers all 5 kinds + N/A path; D-08 copy; D-09 exhaustive switch |
| ERR-02 | Every error path is covered by tests | Vitest node-env tests of error-kind-to-UI-message mapping; CCN pre-check logic; N/A render path |
| DEP-01 | App is deployed to a live, working Vercel URL | Vercel dashboard Git integration; Root Directory = `medelite-report`; build = `next build` |
| DEP-02 | A public code repository is available alongside the live URL | Push 54 unpushed commits to public `github.com/1akashkalita/Infinite-Snapshot` |
| NAME-02 | User can enter an optional custom name that overrides the CMS name on the report body only | Already in `assembleViewModel`; UI binds `ManualInputs.nameOverride`; static header unaffected |
</phase_requirements>

---

## Summary

Phase 3 wires a `"use client"` React UI on top of the already-built server-side `GET /api/facility` route handler, `assembleViewModel`, formatters, and `assembleHeader`. The server layer is complete and untouched. The entire UI lives in client components: an orchestrator (`SnapshotApp`) holds `facilityData`, `fetchState`, `errorState`, and `manualInputs` in local React state; a search bar triggers `fetch GET /api/facility?ccn=`; a manual inputs form updates state instantly; and a paper-like preview component renders `assembleViewModel(facility, manual, new Date())` on every state change.

The client fetch seam is straightforward: `fetch('/api/facility?ccn=...')`, parse the `{data}` / `{error}` JSON envelope, and map `error.kind` to inline vs banner placement using an exhaustive switch over the imported `CmsApiError` union + `assertNever`. All relevant types (`CmsApiError`, `FacilityData`, `ManualInputs`, `ReportViewModel`) are already built; the UI imports them directly. `assembleViewModel`, `assembleHeader`, and the formatters are pure TypeScript with no Node-only dependencies, confirmed safe to import in client components.

Vercel deployment requires only the Vercel dashboard Git integration pointing at the public repo with Root Directory = `medelite-report`; no env vars, no extra config. The `next.config.ts` already has `serverExternalPackages: ['@react-pdf/renderer']`. The first deploy should be a minimal "skeleton" page pushed early to establish the CD pipeline and surface any build/subdir issues before the full flow lands.

**Primary recommendation:** Use local React state in one `SnapshotApp.tsx` client component as the state owner. Do NOT use Server Actions for the CCN lookup — the lookup is a read triggered by user interaction, which is precisely the Route Handler pattern already built. Keep all shared lib modules (`view-model`, `formatters`, `header`, `errors`) as pure TypeScript with no framework directives so they are safe in both client and server contexts.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CCN input form + submit trigger | Browser/Client | — | Interactive event-driven UI; client component |
| CCN format pre-check (D-05) | Browser/Client | — | UX gate before fetch; mirrors server gate, never replaces it |
| CMS data fetch | API/Backend (Route Handler) | — | CORS constraint; server-only; already built in Phase 2 |
| Error kind → UI message mapping | Browser/Client | — | Presentational logic driven by typed error envelope |
| Manual inputs form | Browser/Client | — | Purely local state; no server interaction |
| assembleViewModel call | Browser/Client | — | Pure function, no Node-only deps; called client-side on state change |
| Paper-like preview render | Browser/Client | — | React render consuming `ReportViewModel`; updates on manual input |
| Static header render | Browser/Client | — | Uses `vm.header` from `assembleViewModel`; header.ts has no Node deps |
| Skeleton loading state | Browser/Client | — | CSS/Tailwind animation on client component |
| Vercel deployment | CDN/Static + Node.js serverless | — | `next build`; Route Handler runs in Node.js serverless; page is pre-rendered HTML + client JS |

---

## Standard Stack

Phase 3 installs **no new packages**. All dependencies are already present in `package.json` from Phases 1–2.

### Core (already installed)

| Library | Installed Version | Purpose | Why Standard |
|---------|------------------|---------|--------------|
| `next` | 16.2.9 | App Router, page.tsx, layout.tsx | Project foundation |
| `react` / `react-dom` | 19.2.4 | Client components, hooks (`useState`, `useCallback`) | Project foundation |
| `tailwindcss` | 4.3.1 (Tailwind v4) | Utility-class styling; CSS-only config via `@import "tailwindcss"` | Already configured; `globals.css` uses `@import "tailwindcss"` pattern |
| `zod` | 4.4.3 | Validate `CmsApiError` envelope client-side if desired (optional) | Already in project; `CmsApiErrorSchema` is importable |

### Supporting (already installed)

| Library | Installed Version | Purpose | When to Use |
|---------|------------------|---------|-------------|
| `@react-pdf/renderer` | 4.5.1 | Phase 4 PDF only — do not import in client components | Phase 4 |
| `recharts` | ^2.15.4 | Phase 7 charts only | Phase 7 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Local `useState` in `SnapshotApp` | React Context / Zustand | Overkill for a single page; no cross-route state needed |
| Plain `fetch` + `useState` | React Query / SWR | No caching needed; single-fetch-per-submit pattern is simpler |
| `useActionState` + Server Action | Plain `fetch` + `onClick` | Server Actions are for mutations; CCN lookup is a read; Route Handler is already built |
| Controlled inputs for manual fields | `useRef` + uncontrolled | Preview must update on every keystroke (PREV-01) — controlled inputs are required |

**Installation:** None. All packages already installed. Run `npm run verify` to confirm green before writing any Phase 3 code.

---

## Package Legitimacy Audit

Phase 3 installs no new packages. All packages in use were audited in Phases 1–2. No new audit required.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (Client Components — "use client")
  │
  ├─ SnapshotApp.tsx          [STATE OWNER]
  │    ├─ state: ccn: string
  │    ├─ state: fetchState: 'idle' | 'loading' | 'success' | 'error'
  │    ├─ state: facilityData: FacilityData | null
  │    ├─ state: errorState: CmsApiError | null
  │    ├─ state: manualInputs: ManualInputs
  │    │
  │    ├─ CCNSearchBar.tsx    [TRIGGERS FETCH]
  │    │    └─ input (type="text") + "Generate" button
  │    │         → client-side pre-check (/^[A-Za-z0-9]{6}$/)
  │    │         → fetch GET /api/facility?ccn=…
  │    │         → parse {data} / {error} envelope
  │    │         → dispatch facilityData or errorState
  │    │
  │    ├─ ErrorBanner.tsx      [BANNER ERRORS — network/cms/validation]
  │    │
  │    ├─ ManualInputsForm.tsx [MANUAL FIELDS]
  │    │    └─ controlled inputs → setManualInputs(...)
  │    │
  │    └─ ReportPreview.tsx    [PAPER-LIKE PREVIEW]
  │         └─ assembleViewModel(facilityData, manualInputs, new Date())
  │              → vm.header  → HeaderBlock (static branding + state)
  │              └─ vm.facility + vm.manual → ReportBody
  │                   (N/A via formatters for null fields)
  │
Server (Route Handler — Node.js, already built in Phase 2)
  └─ GET /api/facility?ccn=…  → { data: FacilityData } | { error: CmsApiError }

Shared Pure Modules (no "use client" / "use server" — safe everywhere)
  ├─ src/lib/report/view-model.ts  — assembleViewModel, ManualInputs, ReportViewModel
  ├─ src/lib/report/header.ts      — assembleHeader(state)
  ├─ src/lib/report/format.ts      — formatRating, formatBeds, formatLocation, formatDate
  └─ src/lib/cms/errors.ts         — CmsApiError union, assertNever

Vercel (Deployment)
  └─ Dashboard Git integration → github.com/1akashkalita/Infinite-Snapshot
       Root Directory = medelite-report
       Build Command = next build (auto-detected)
       No env vars (CMS API is public)
```

### Recommended Project Structure

```
medelite-report/src/
├─ app/
│   ├─ layout.tsx          — update: title "Infinite Snapshot", metadata
│   ├─ page.tsx            — thin server shell: renders <SnapshotApp />
│   └─ api/
│       └─ facility/
│           └─ route.ts    — UNCHANGED (Phase 2)
├─ components/
│   ├─ SnapshotApp.tsx     — 'use client' — state owner, two-pane layout
│   ├─ CCNSearchBar.tsx    — 'use client' — CCN input + Generate button
│   ├─ ManualInputsForm.tsx — 'use client' — six manual fields + name override
│   ├─ ReportPreview.tsx   — 'use client' — paper-like preview consumer
│   └─ ErrorBanner.tsx     — pure display (no hooks needed; can be 'use client' if inline error state needed)
└─ lib/
    ├─ cms/
    │   ├─ errors.ts       — UNCHANGED
    │   └─ types.ts        — UNCHANGED
    └─ report/
        ├─ view-model.ts   — UNCHANGED
        ├─ header.ts       — UNCHANGED
        └─ format.ts       — UNCHANGED
```

### Pattern 1: Client Component State Owner with Plain Fetch

**What:** A single `"use client"` component holds all interactive state. The fetch is triggered by a button click (`onClick` or form `onSubmit`), not a Server Action. The CCN lookup is a read — the Route Handler pattern is correct here. Server Actions are for writes/mutations and carry `FormData` semantics that add friction.

**When to use:** Interactive pages that call an internal Route Handler. This is the canonical pattern documented in the Next.js 16 `backend-for-frontend.md` guide (verified in `node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md`).

**Example:**
```typescript
// Source: Next.js 16 docs — server-and-client-components.md
// src/components/SnapshotApp.tsx
'use client'

import { useState, useCallback } from 'react'
import type { FacilityData } from '@/lib/cms/types'
import type { CmsApiError } from '@/lib/cms/errors'
import { assertNever } from '@/lib/cms/errors'
import type { ManualInputs } from '@/lib/report/view-model'
import { assembleViewModel } from '@/lib/report/view-model'
import { CCNSearchBar } from './CCNSearchBar'
import { ManualInputsForm } from './ManualInputsForm'
import { ReportPreview } from './ReportPreview'
import { ErrorBanner } from './ErrorBanner'

type FetchState = 'idle' | 'loading' | 'success' | 'error'

export function SnapshotApp() {
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [facilityData, setFacilityData] = useState<FacilityData | null>(null)
  const [errorState, setErrorState] = useState<CmsApiError | null>(null)
  const [manualInputs, setManualInputs] = useState<ManualInputs>({})

  const handleSearch = useCallback(async (ccn: string) => {
    setFetchState('loading')
    setErrorState(null)
    try {
      const res = await fetch(`/api/facility?ccn=${encodeURIComponent(ccn)}`)
      const json = await res.json()
      if (json.data) {
        setFacilityData(json.data)
        setManualInputs({})   // D-11: reset on successful fetch
        setFetchState('success')
      } else {
        setErrorState(json.error as CmsApiError)
        setFetchState('error')
      }
    } catch {
      // network-level failure (fetch itself rejected)
      const networkErr: CmsApiError = { kind: 'network_error', message: 'Network failure' }
      setErrorState(networkErr)
      setFetchState('error')
    }
  }, [])

  const vm = facilityData
    ? assembleViewModel(facilityData, manualInputs, new Date())
    : null

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6">
      {/* Left pane */}
      <div className="flex-1">
        {/* Banner errors sit above the form */}
        {errorState && isBannerError(errorState.kind) && (
          <ErrorBanner error={errorState} />
        )}
        <CCNSearchBar onSearch={handleSearch} loading={fetchState === 'loading'} />
        <ManualInputsForm
          inputs={manualInputs}
          onChange={setManualInputs}
          disabled={!facilityData}
        />
      </div>
      {/* Right pane */}
      <div className="flex-1">
        <ReportPreview vm={vm} fetchState={fetchState} errorState={errorState} />
      </div>
    </div>
  )
}

function isBannerError(kind: CmsApiError['kind']): boolean {
  switch (kind) {
    case 'network_error':
    case 'cms_api_error':
    case 'validation_error':
      return true
    case 'invalid_ccn':
    case 'not_found':
      return false
    default:
      return assertNever(kind)
  }
}
```

### Pattern 2: Exhaustive Error Kind Switch (D-09)

**What:** The UI imports `CmsApiError` and `assertNever` directly. A `switch` on `error.kind` maps to per-kind copy and placement. Adding a 6th kind without a new case is a TypeScript compile error.

**When to use:** Everywhere the UI handles an error from the API envelope.

**Example:**
```typescript
// Source: src/lib/cms/errors.ts — confirmed in codebase
import type { CmsApiError } from '@/lib/cms/errors'
import { assertNever } from '@/lib/cms/errors'

export function getErrorMessage(error: CmsApiError): string {
  switch (error.kind) {
    case 'invalid_ccn':
      return 'Please enter a valid 6-character CCN (letters and numbers only).'
    case 'not_found':
      return `No facility found for CCN "${error.ccn}". Check the number and try again.`
    case 'network_error':
      return 'Could not reach CMS. Check your connection and try again.'
    case 'cms_api_error':
      return 'CMS is temporarily unavailable. Please try again in a moment.'
    case 'validation_error':
      // D-08: non-retry copy — this won't heal on retry
      return 'Received an unexpected response from CMS. This issue has been noted.'
    default:
      return assertNever(error)
  }
}
```

### Pattern 3: Client-Side CCN Pre-Check Mirroring Server Gate (D-05)

**What:** Before fetching, the client validates the CCN format with the same regex the server uses. This surfaces `invalid_ccn` inline without a round-trip. The server gate stays the source of truth.

**Example:**
```typescript
// Matches server gate in route.ts: /^[A-Za-z0-9]{6}$/
// src/components/CCNSearchBar.tsx
'use client'

const CCN_REGEX = /^[A-Za-z0-9]{6}$/

export function CCNSearchBar({ onSearch, loading }: Props) {
  const [ccn, setCcn] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const normalized = ccn.trim().toUpperCase()
    if (!CCN_REGEX.test(normalized)) {
      setLocalError('CCN must be exactly 6 letters or numbers.')
      return
    }
    setLocalError(null)
    onSearch(normalized)
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"         // NEVER type="number" — leading zeros would be dropped
        inputMode="numeric"
        value={ccn}
        onChange={e => { setCcn(e.target.value); setLocalError(null) }}
        placeholder="Enter CCN (e.g. 686123)"
        maxLength={10}
        aria-describedby={localError ? 'ccn-error' : undefined}
      />
      {localError && (
        <p id="ccn-error" role="alert">{localError}</p>
      )}
      <button type="submit" disabled={loading}>Generate</button>
    </form>
  )
}
```

### Pattern 4: Live Preview via Pure assembleViewModel

**What:** `assembleViewModel(facility, manual, generatedAt)` is a pure function with no Node-only imports. It is safe to call in a `"use client"` component on every render triggered by `manualInputs` state change.

**Confirmed client-safe imports:**
- `src/lib/report/view-model.ts` — imports only `zod` and `@/lib/report/header` (pure TS)
- `src/lib/report/header.ts` — pure string literals, no Node deps
- `src/lib/report/format.ts` — uses only `toLocaleString`/`toLocaleDateString` (browser-safe)
- `src/lib/cms/errors.ts` — imports only `zod` (pure TS)
- `src/lib/cms/types.ts` — TypeScript interface, no runtime deps

None of these files have `import 'server-only'` or Node-only dependencies. All are safe to import in `'use client'` components. [VERIFIED: codebase inspection]

### Pattern 5: Vercel Subdir Deployment (D-14)

**What:** When the Next.js app lives in a subdirectory (`medelite-report/`), Vercel needs the Root Directory set to that subdirectory. Next.js build command is auto-detected as `next build`.

**Steps (user action required for account connect):**
1. Push commits to `github.com/1akashkalita/Infinite-Snapshot` (`git push origin main`)
2. Vercel dashboard → "Add New Project" → import from GitHub
3. Set **Root Directory** = `medelite-report`
4. Build Command: leave as default (`next build` — auto-detected)
5. Output Directory: leave as default (`.next`)
6. No Environment Variables required (CMS API is public, D-17)
7. Deploy — first deploy establishes CD; subsequent pushes to `main` auto-deploy

### Pattern 6: Skeleton Preview (D-06)

**What:** A greyed-out skeleton of the paper-like preview renders before the first search and during loading. Use CSS Tailwind animate-pulse on placeholder divs matching the report layout.

**Example structure:**
```typescript
// ReportPreview.tsx — skeleton state
{fetchState === 'idle' && (
  <div className="bg-white rounded shadow p-8 animate-pulse space-y-4">
    <div className="h-6 bg-gray-200 rounded w-3/4" />  {/* header line 1 */}
    <div className="h-4 bg-gray-200 rounded w-1/2" />  {/* header line 2 */}
    <div className="h-px bg-gray-100 my-4" />
    <div className="h-4 bg-gray-200 rounded w-2/3" />  {/* facility name */}
    <div className="h-4 bg-gray-200 rounded w-1/2" />  {/* location */}
    {/* ... more skeleton rows */}
  </div>
)}
```

### Anti-Patterns to Avoid

- **`<input type="number">` for CCN:** Leading zeros are silently dropped by the browser before the value reaches the event handler. Use `<input type="text" inputMode="numeric">`. [VERIFIED: PITFALLS.md + CLAUDE.md rule #3]
- **Importing the CMS `fetchFacility` function in a client component:** It contains Node-only `fetch` options and would cause the CMS URL to be called directly from the browser (CORS-blocked). Only `GET /api/facility` should be called client-side. [VERIFIED: route.ts inspection]
- **Importing `@react-pdf/renderer` in any client component:** It will attempt to bundle PDFKit into the browser bundle; either a build error or a 500KB+ bundle bloat. Phase 4 only. [VERIFIED: PITFALLS.md Pitfall 4]
- **Importing `@react-pdf/renderer` or `renderToBuffer` from a shared lib imported by a client component:** The entire import tree of a `'use client'` file gets bundled. Keep PDF code strictly in route handlers. [VERIFIED: Next.js 16 docs + PITFALLS.md]
- **Using `new Date()` inside `assembleViewModel` call at render time:** The existing function requires an injected timestamp (D-12). Pass `new Date()` from the component, not inside the lib. [VERIFIED: view-model.ts inspection]
- **Hardcoding error kind strings in the UI:** Use the imported `CmsApiError` union. If a 6th kind is ever added, the TypeScript compiler catches missing cases via `assertNever`. [VERIFIED: errors.ts + D-09]
- **Passing facilityData or manual inputs into assembleHeader:** `assembleHeader(state)` takes exactly one string parameter. TypeScript will catch this at compile time. [VERIFIED: header.ts inspection]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error kind → friendly copy mapping | Custom runtime kind-check strings | Imported `CmsApiError` union + exhaustive switch + `assertNever` | Already built in `errors.ts`; adding a kind without a case = compile error |
| Report data assembly | Custom object construction in components | `assembleViewModel(facility, manual, generatedAt)` | Already built in Phase 2; pure, deterministic, tested |
| Report header | Custom header string formatting | `assembleHeader(state)` | Already built; TypeScript enforces no facility-name arg |
| CMS field formatting | Custom null-check formatting | `formatRating`, `formatBeds`, `formatLocation`, `formatDate`, `formatPercent`, `formatRate` | Already built; checks `=== null` correctly (0 is valid data, D-10) |
| CCN format validation | Custom regex in component | `/^[A-Za-z0-9]{6}$/` (exact same gate as server) | Server already defines the canonical gate; client mirrors it |
| Preview → ViewModel | Ad-hoc shape for preview | `ReportViewModel` from `assembleViewModel` | Phase 4 PDF will POST this same object — single source of truth |

**Key insight:** The entire render pipeline (header, formatters, view-model) is already built and tested. Phase 3's implementation job is wiring: connect the form inputs to `fetch`, connect the response to state, and connect state to the pure render functions.

---

## Common Pitfalls

### Pitfall 1: Importing Server-Side Code into a Client Component

**What goes wrong:** Importing `@/lib/cms/client` (the CMS fetch function) or `@react-pdf/renderer` into `SnapshotApp.tsx` or any component in the `'use client'` module tree causes either a build error or runtime crash.

**Why it happens:** Once a file is marked `'use client'`, its entire import tree gets bundled into the browser. `@/lib/cms/client` calls `fetch` with CMS server URLs that will be CORS-blocked in the browser; `@react-pdf/renderer` includes Node-only APIs.

**How to avoid:** Only import from `@/lib/cms/errors`, `@/lib/cms/types`, `@/lib/report/view-model`, `@/lib/report/header`, and `@/lib/report/format` in client components. Never import `@/lib/cms/client` or anything from `@react-pdf/renderer` client-side.

**Warning signs:** Build output mentions `@react-pdf/renderer` in a module-not-found error; or browser DevTools Network tab shows requests to `data.cms.gov`.

### Pitfall 2: Using `type="number"` Input for CCN

**What goes wrong:** `<input type="number">` strips leading zeros from the value before it reaches React's `onChange` event handler. CCN `056789` becomes `56789`; the CMS query returns zero results.

**Why it happens:** Browser numeric input normalization.

**How to avoid:** Always `<input type="text" inputMode="numeric">`. The client pre-check regex `/^[A-Za-z0-9]{6}$/` catches non-alphanumeric input without needing a numeric input type.

**Warning signs:** `typeof ccn === 'number'` anywhere in the form handling; `Number(ccn)` in the fetch path.

### Pitfall 3: Error State Not Cleared on Subsequent Actions

**What goes wrong:** A stale `errorState` from a previous failed lookup stays visible when the user submits a new valid CCN, or a stale `facilityData` remains visible after a new lookup fails.

**Why it happens:** State updates are batched; clearing one slice without the other creates incoherent UI.

**How to avoid:** On every `handleSearch` call: immediately clear both `errorState` and set `fetchState = 'loading'`. On success: set `facilityData`, clear `errorState`. On error: clear `facilityData` (or leave it — depends on UX decision), set `errorState`. The D-11 reset of `manualInputs` happens only on success.

**Warning signs:** Error banner visible simultaneously with populated preview; or old facility data visible when an error occurred.

### Pitfall 4: `assertNever` Called with Wrong Argument Type

**What goes wrong:** The route handler's `assertNever(err.kind)` is typed correctly. But in the client switch, passing the entire `error` object instead of `error.kind` to `assertNever` gives a confusing type error.

**Why it happens:** The `CmsApiError` is a discriminated union with properties beyond `kind`. `assertNever` expects `never`, and `CmsApiError` itself is not `never` — only `error.kind` narrows to `never` after exhaustive cases.

**How to avoid:** `default: return assertNever(error.kind)` — pass the discriminant, not the whole object. Same pattern used in `route.ts` (verified: line 119 `return assertNever(err.kind)`).

**Warning signs:** TypeScript error "Argument of type 'CmsApiError' is not assignable to parameter of type 'never'" on the `assertNever` call.

### Pitfall 5: Tailwind v4 — No `tailwind.config.js`

**What goes wrong:** Tailwind v4 uses a CSS-first configuration (`@import "tailwindcss"` in `globals.css`, `@theme inline {}` for overrides). If a developer tries to create `tailwind.config.js` with `content: [...]` to add custom classes, it will be silently ignored or cause conflicts.

**Why it happens:** Tailwind v4 dropped the JS config file model. The project already uses the v4 pattern (verified in `globals.css`).

**How to avoid:** Use only CSS-based configuration. Utility classes work out of the box. For custom design tokens, add them under `@theme inline` in `globals.css`. Do not create `tailwind.config.js`.

**Warning signs:** Classes not applying; config file created by habit from Tailwind v3 knowledge.

### Pitfall 6: `page.tsx` Stays as a Server Component Importing Client State

**What goes wrong:** The root `page.tsx` is a Server Component by default. Putting `useState` or `fetch`-on-click logic directly in `page.tsx` will fail at runtime ("useState is not a function" or build error about hooks in Server Components).

**Why it happens:** Next.js App Router files without `'use client'` are Server Components.

**How to avoid:** Keep `page.tsx` as a thin Server Component that renders `<SnapshotApp />`. Put all interactive logic in `SnapshotApp.tsx` with `'use client'`. This is the exact pattern shown in the Next.js 16 `server-and-client-components.md` guide (verified).

**Warning signs:** `useState`/`useCallback` used directly in `page.tsx` without `'use client'`; TypeScript error about hooks.

### Pitfall 7: Vercel Cannot Find `next.config.ts` / App

**What goes wrong:** Vercel deployment fails to build because it treats the repo root (`/`) as the Next.js project, but the app lives in `medelite-report/`. The build command `next build` runs from the wrong directory.

**Why it happens:** Vercel's default is to detect Next.js at the repo root. Monorepo / subdir apps require explicit Root Directory configuration.

**How to avoid:** In the Vercel dashboard when importing the project: set **Root Directory** = `medelite-report`. Vercel then runs all commands from that directory. Verify by checking that `next.config.ts` is visible at the configured root.

**Warning signs:** Vercel build log shows "No Next.js project found at root" or "Cannot find package.json"; deploy URL returns 404.

---

## Runtime State Inventory

This is a greenfield UI phase (no rename/refactor). The shared lib modules (`view-model`, `formatters`, `header`, `errors`) are not being renamed. No runtime state inventory is required.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | next build, vitest | ✓ | v26.2.0 | — |
| npm | package management | ✓ | 11.13.0 | — |
| git | push to GitHub | ✓ | (default macOS git) | — |
| gh CLI | GitHub operations | ✓ | authenticated as 1akashkalita | — |
| vercel CLI | Deployment | ✗ | — | Use Vercel dashboard Git integration (D-14) |
| Next.js 16.2.9 | Build | ✓ | 16.2.9 | — |
| Tailwind v4 | Styling | ✓ | 4.3.1 | — |
| zod | Error schema | ✓ | 4.4.3 | — |

**Missing dependencies with no fallback:** None — all required tools are available.

**Missing dependencies with fallback:**
- Vercel CLI: Not installed (and not needed). Deployment via Vercel dashboard (D-14). This is the correct path — the one-time account connect is a user action that cannot be automated by an agent.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | `medelite-report/vitest.config.ts` |
| Quick run command | `npx vitest run tests/` |
| Full suite command | `npm run verify` (typecheck + lint + format:check + test) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOOK-02 | Client CCN pre-check: empty, too-short, special chars, valid 6-char | unit | `npx vitest run tests/lib/ccn-precheck.test.ts` | ❌ Wave 0 |
| LOOK-03 | `invalid_ccn` vs `not_found` distinct error messages | unit | `npx vitest run tests/lib/error-messages.test.ts` | ❌ Wave 0 |
| ERR-01 | All 5 error kind → message/placement mappings exhaustive | unit | `npx vitest run tests/lib/error-kind-mapping.test.ts` | ❌ Wave 0 |
| ERR-02 | N/A render path: `formatRating(null)` = "N/A", `formatBeds(null)` = "N/A" | unit | `npx vitest run tests/lib/report/format.test.ts` | ❌ Wave 0 |
| ERR-02 | `assertNever` exhaustiveness: switch covers all 5 kinds | compile-time | TypeScript strict mode catches at build | implicit |
| INPT-01/03 | `assembleViewModel` with all manual inputs populated → vm.manual fields set | unit | `npx vitest run tests/lib/report/view-model.test.ts` | ✅ (existing) |
| PREV-01 | `assembleViewModel` updates `displayName` when `nameOverride` changes | unit | `npx vitest run tests/lib/report/view-model.test.ts` | ✅ (existing) |
| NAME-02 | `assembleHeader` output never contains facility name | unit | `npx vitest run tests/lib/report/header.test.ts` | ✅ (existing) |
| DEP-01 | App builds and returns 200 at Vercel URL | smoke | manual: curl deployed URL | ❌ manual-only |

**Manual-only justifications:**
- DEP-01 smoke check: Requires live Vercel URL; cannot be automated in Vitest node env without deploying first. Plan a one-line `curl` check in the verify wave.

### Sampling Rate

- **Per task commit:** `npm run verify` (typecheck + lint + format:check + test)
- **Per wave merge:** `npm run verify:full` (verify + next build)
- **Phase gate:** `npm run verify:full` green + Vercel deploy URL returns 200 before closing phase

### Wave 0 Gaps

- [ ] `tests/lib/ccn-precheck.test.ts` — covers LOOK-02 (client format pre-check logic extracted from CCNSearchBar)
- [ ] `tests/lib/error-kind-mapping.test.ts` — covers ERR-01/ERR-02 (all 5 kinds → message copy + placement; exhaustive by construction via `assertNever`)
- [ ] `tests/lib/report/format.test.ts` — covers ERR-02 N/A render path (null formatters, `=== null` not falsiness)

**Note on testing client components in Vitest node env:** Vitest's `environment: "node"` cannot render React components. Do NOT attempt to test `CCNSearchBar` or `ReportPreview` as React components in this test setup — there is no DOM. The correct strategy for this project (as demonstrated by `tests/api/facility.test.ts`) is to extract pure logic (error mapping function, CCN regex check, formatter functions) into testable modules and test those directly. DOM/component tests would require adding `@testing-library/react` + jsdom environment, which is not in scope and not needed — the pure logic tests provide the ERR-02 coverage required.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth in this app |
| V3 Session Management | No | No sessions |
| V4 Access Control | No | Public tool, no access control |
| V5 Input Validation | Yes | CCN format validated client-side + server-side; user inputs are display-only (never used in DB queries or server calls) |
| V6 Cryptography | No | No secrets, no crypto |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CCN injection into fetch URL | Tampering | Client pre-check + server regex gate `/^[A-Za-z0-9]{6}$/`; CCN is only used as a URL query param value, not a path segment; `encodeURIComponent` in client fetch |
| XSS via CMS field values in preview | Tampering | React JSX auto-escapes string interpolation; no `dangerouslySetInnerHTML` used |
| CMS response leaking Zod internals | Information Disclosure | Phase-2 D-05 T-02-LEAK enforced in route.ts: `validation_error` body is `{ kind, message }` only |
| Facility name override as script injection | Tampering | Name override is displayed via React JSX (auto-escaped); never inserted into HTML as raw string |

**No new security surface in Phase 3.** All CMS calls remain server-side. The UI receives only the typed `FacilityData` / `CmsApiError` envelope from the Route Handler.

---

## Code Examples

### Error Kind → UI Message (Exhaustive)

```typescript
// Source: inferred from errors.ts CmsApiErrorSchema + CONTEXT.md D-07/D-08
// tests/lib/error-kind-mapping.test.ts can test this pure function

import type { CmsApiError } from '@/lib/cms/errors'
import { assertNever } from '@/lib/cms/errors'

export type ErrorPlacement = 'inline' | 'banner'

export function getErrorPresentation(error: CmsApiError): {
  message: string
  placement: ErrorPlacement
} {
  switch (error.kind) {
    case 'invalid_ccn':
      return {
        message: 'Please enter a valid 6-character CCN (letters and numbers only).',
        placement: 'inline',   // D-07: beneath CCN field
      }
    case 'not_found':
      return {
        message: `No facility found for CCN "${error.ccn}". Check the number and try again.`,
        placement: 'inline',   // D-07: beneath CCN field
      }
    case 'network_error':
      return {
        message: 'Could not reach CMS. Check your connection and try again.',
        placement: 'banner',   // D-07: top banner
      }
    case 'cms_api_error':
      return {
        message: 'CMS is temporarily unavailable. Please try again in a moment.',
        placement: 'banner',   // D-07: top banner
      }
    case 'validation_error':
      // D-08: non-retry copy — won't heal on retry
      return {
        message: 'Received an unexpected response from CMS. This issue has been noted.',
        placement: 'banner',   // D-07: top banner
      }
    default:
      return assertNever(error.kind)  // compile error if 6th kind added without case
  }
}
```

### CCN Pre-Check (Extracted Pure Function for Testing)

```typescript
// Source: D-05 — mirrors route.ts line 58 exactly
// Extracting this as a pure function allows Vitest node-env unit testing

const CCN_REGEX = /^[A-Za-z0-9]{6}$/

export function normalizeCcn(raw: string): string {
  return raw.trim().toUpperCase()
}

export function isValidCcnFormat(ccn: string): boolean {
  return CCN_REGEX.test(ccn)
}

// In the component:
// const normalized = normalizeCcn(ccn)
// if (!isValidCcnFormat(normalized)) { setLocalError(...); return }
// onSearch(normalized)
```

### assembleViewModel Client-Side Usage

```typescript
// Source: view-model.ts — confirmed pure, no Node-only deps
// Called in SnapshotApp or ReportPreview on every render that has facilityData

import { assembleViewModel } from '@/lib/report/view-model'
import type { FacilityData } from '@/lib/cms/types'
import type { ManualInputs } from '@/lib/report/view-model'

// Called client-side — generatedAt injected from caller (D-12)
const vm = assembleViewModel(facilityData, manualInputs, new Date())

// vm.header.platformLine === "INFINITE — Managed by MEDELITE"
// vm.header.reportTitle  === "FACILITY ASSESSMENT SNAPSHOT"
// vm.header.stateLine    === "FL"
// vm.facility.displayName === manual.nameOverride?.trim() || facility.providerName
// vm.facility.certifiedBeds — raw number | null (formatBeds() at render time)
// vm.facility.starRatings.* — raw number | null (formatRating() at render time)
```

### Report Preview Structure (Paper-Like)

```typescript
// Source: CONTEXT.md D-02/D-03, view-model.ts, format.ts
// ReportPreview.tsx renders the assembled vm

import { formatRating, formatBeds, formatLocation, formatDate } from '@/lib/report/format'
import type { ReportViewModel } from '@/lib/report/view-model'

function ReportBody({ vm }: { vm: ReportViewModel }) {
  const { facility, manual } = vm
  return (
    <section>
      {/* Static header block (RPT-01 / D-02) */}
      <header>
        <p>{vm.header.platformLine}</p>  {/* "INFINITE — Managed by MEDELITE" */}
        <p>{vm.header.reportTitle}</p>   {/* "FACILITY ASSESSMENT SNAPSHOT" */}
        <p>{vm.header.stateLine}</p>     {/* "FL" */}
      </header>
      {/* Report body — D-03 field order (fallback from CLAUDE.md) */}
      <dl>
        <dt>Name of Facility</dt>
        <dd>{facility.displayName}</dd>  {/* override or providerName */}
        <dt>Location</dt>
        <dd>{formatLocation(facility.address)}</dd>
        <dt>Census Capacity</dt>
        <dd>{formatBeds(facility.certifiedBeds)}</dd>
        <dt>Overall Rating</dt>
        <dd>{formatRating(facility.starRatings.overall)}</dd>
        {/* ... other star ratings, then manual fields */}
        <dt>EMR</dt>
        <dd>{manual.emr ?? '—'}</dd>
        <dt>Current Census</dt>
        <dd>{manual.currentCensus != null ? String(manual.currentCensus) : '—'}</dd>
        <dt>Type of Patient</dt>
        <dd>{manual.typeOfPatient ?? '—'}</dd>
        <dt>Medical Coverage</dt>
        <dd>{manual.medicalCoverage ?? '—'}</dd>
        <dt>Previous Coverage from Medelite</dt>
        <dd>{manual.previousCoverage ?? '—'}</dd>
      </dl>
    </section>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` for request logic | `proxy.ts` or Route Handlers | Next.js 16 | Never use `middleware.ts` — silently does nothing in NJS16 |
| Sync `params`/`searchParams` access | `await ctx.params` / `await props.params` | Next.js 15→16 | This route uses query string (non-dynamic), so no params issue here |
| `serverComponentsExternalPackages` in next.config | `serverExternalPackages` (renamed at NJS15) | Next.js 15 | Already correct in `next.config.ts` |
| `useFormState` (React 18 experimental) | `useActionState` (React 19 stable) | React 19 | Not used here — plain `fetch` + `useState` is simpler for this read pattern |
| Tailwind v3 `tailwind.config.js` | Tailwind v4 `@import "tailwindcss"` in CSS | Tailwind v4 | No JS config file; `@theme inline` in globals.css for custom tokens |

**Deprecated/outdated:**
- `webpack()` in `next.config.ts`: Silently ignored under Turbopack (NJS16 default). Do not add.
- `serverComponentsExternalPackages`: Old key name; NJS16 requires `serverExternalPackages` (already correct).
- `middleware.ts`: Renamed to `proxy.ts` in NJS16. Not used in this project (correct).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `assembleViewModel`, `formatters`, `header`, and `errors` have no Node-only transitive dependencies (safe to import client-side) | Standard Stack / Patterns | If any transitive dep is Node-only, client bundle errors at build time. Mitigation: `npm run verify:full` after first Wave 1 task catches this. Low risk — all verified by codebase inspection. |
| A2 | Vercel auto-detects `next build` when Root Directory is set to `medelite-report` | Architecture Patterns / Vercel | If Vercel doesn't auto-detect, user must set build command manually to `next build`. Low risk — standard Vercel behavior for Next.js. |
| A3 | `ManualInputs.previousCoverage` accepts `"Yes" \| "No" \| null` which maps cleanly to a `<select>` control | Standard Stack | If the type is changed in Phase 4+, the select binding breaks. Low risk — type is locked in view-model.ts. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. A1-A3 are LOW-risk assumptions already mitigated by `npm run verify:full`.

---

## Open Questions (RESOLVED)

1. **Reference report PDF (D-03)**
   - What we know: CONTEXT.md D-03 states the user will supply a reference PDF/image for the body label order and section structure.
   - What's unclear: The reference report has not been added to the repo as of research time (2026-06-17).
   - Recommendation: Plan tasks using the CLAUDE.md fallback order (Name of Facility → Location → Census Capacity → 4 Star Ratings → manual fields). Add a `checkpoint:user-confirm` task at the body layout task to verify against the reference report if/when supplied. Do not block planning on this.

2. **`previousProviderPerformance` field missing from `ManualInputs`**
   - What we know: REQUIREMENTS.md INPT-01 lists "Previous Provider Performance" as one of the six manual inputs. CLAUDE.md field mapping table lists it as a manual field. But `ManualInputs` in `view-model.ts` does NOT include a `previousProviderPerformance` field — the interface has `emr`, `currentCensus`, `typeOfPatient`, `medicalCoverage`, `previousCoverage` (Yes/No) but no `previousProviderPerformance`.
   - What's unclear: Was this field intentionally omitted in Phase 2 (as a deferred addition), or is it an oversight?
   - Recommendation: Add `previousProviderPerformance?: string` to `ManualInputs` and `ReportViewModelSchema` as a Wave 0 task. This is a small addition to Phase 2 types — it does not break any existing tests. The planner should include this as an explicit task.

---

## Project Constraints (from CLAUDE.md)

The following directives from `CLAUDE.md` (repo root) are binding on all Phase 3 implementation:

1. **`npm run verify` after every change** — typecheck + lint + format:check + test; task is not done while red. Never weaken tests, lint rules, or tsconfig to pass.
2. **Static header branding** — `assembleHeader()` takes no facility-name argument; the static block (`INFINITE — Managed by MEDELITE` / `FACILITY ASSESSMENT SNAPSHOT` / state) never appears with the facility name. The facility name appears ONLY in the report body under "Name of Facility".
3. **Never trust a CMS field name from memory** — Phase 3 adds no new CMS field names; it consumes the already-typed `FacilityData`. Do NOT copy field names from `ARCHITECTURE.md` sketches (they contain incorrect names like `federal_provider_number`).
4. **Validate every CMS response with Zod** — the Route Handler already does this; the UI must never bypass it (no raw `fetch` to `data.cms.gov`).
5. **Tests first or alongside, never after** — write unit tests for the CCN pre-check and error-kind mapping logic in Wave 0.
6. **Handle and test every error path** — all 5 error kinds + N/A render path must be tested.
7. **PDF uses `@react-pdf/renderer` only** — not relevant to Phase 3 (PDF is Phase 4), but do NOT import `@react-pdf/renderer` in any Phase 3 client component.

**Next.js 16 caveat** (`medelite-report/AGENTS.md`): Read guides in `medelite-report/node_modules/next/dist/docs/` before writing/changing Next.js code. For Phase 3, the relevant guides are:
- `01-getting-started/05-server-and-client-components.md` — `'use client'` boundary, module graph, composition patterns [VERIFIED: read during research]
- `02-guides/forms.md` — Form patterns, `useActionState`, programmatic submit [VERIFIED: read during research]
- `02-guides/single-page-applications.md` — SPA with Route Handler pattern [VERIFIED: read during research]

---

## Sources

### Primary (HIGH confidence)
- `medelite-report/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` — `'use client'` boundary rules, module graph inclusion, interleaving patterns
- `medelite-report/node_modules/next/dist/docs/01-app/02-guides/forms.md` — Form submission patterns, `useActionState`, programmatic submit with `requestSubmit()`
- `medelite-report/node_modules/next/dist/docs/01-app/02-guides/single-page-applications.md` — SPA with client-side fetch; Route Handler as BFF
- `medelite-report/node_modules/next/dist/docs/01-app/01-getting-started/17-deploying.md` — Deployment options; Vercel adapter
- `medelite-report/src/lib/cms/errors.ts` — `CmsApiError` union, `assertNever` signature, `CmsError` class [codebase]
- `medelite-report/src/lib/cms/types.ts` — `FacilityData` interface [codebase]
- `medelite-report/src/lib/report/view-model.ts` — `assembleViewModel`, `ManualInputs`, `ReportViewModel` [codebase]
- `medelite-report/src/lib/report/format.ts` — all formatter functions [codebase]
- `medelite-report/src/lib/report/header.ts` — `assembleHeader(state)` [codebase]
- `medelite-report/src/app/api/facility/route.ts` — API contract, error envelope shape [codebase]
- `.planning/research/PITFALLS.md` — Vercel deploy pitfalls, Tailwind v4 gotchas, Next.js 16 breaking changes [project research]
- `.planning/research/ARCHITECTURE.md` — Component structure recommendations (with field-name caution applied) [project research]
- `medelite-report/package.json` — confirmed installed versions [codebase]
- `medelite-report/vitest.config.ts` — node environment, include patterns [codebase]

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — Accumulated project decisions (D-14/D-24/D-21/D-25 etc.) [project artifact]
- `medelite-report/src/app/globals.css` — Tailwind v4 `@import "tailwindcss"` pattern confirmed [codebase]

### Tertiary (LOW confidence)
- None — all findings verified against primary sources.

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all packages confirmed installed via `npm list`; no new packages needed
- Architecture Patterns: HIGH — verified against Next.js 16 bundled docs + codebase inspection of actual source files
- Client fetch seam: HIGH — `route.ts`, `errors.ts`, `types.ts` all read directly; API contract confirmed
- assembleViewModel client-safety: HIGH — all imports traced in source; no Node-only deps found
- Error handling patterns: HIGH — `CmsApiError` union read directly from `errors.ts`
- Vercel subdir deployment: MEDIUM — standard Vercel behavior for Next.js subdir apps; verified via Next.js docs; specific Vercel dashboard steps are [ASSUMED] but well-documented convention
- Testing strategy: HIGH — existing test patterns in `tests/api/facility.test.ts` confirm node-env approach; component DOM testing correctly identified as out-of-scope for this setup

**Research date:** 2026-06-17
**Valid until:** 2026-07-17 (30 days — Next.js/Vercel stable; no fast-moving dependencies)
