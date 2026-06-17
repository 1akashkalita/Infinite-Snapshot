# Phase 3: Web UI, Core Flow & Deployment - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers the **first end-to-end user-facing vertical slice** — the web UI on top of the Phase-2 API + view-model, plus the first live deployment.

In scope:
- A web page where the user enters a CCN, clicks **Generate**, and the app calls the existing `GET /api/facility?ccn=` (LOOK-01).
- Client-side CCN format validation + distinct inline/banner states for every error kind (LOOK-02/03, ERR-01/02).
- The six manual operational inputs + Yes/No control + optional name override (INPT-01/02/03, NAME-02).
- A **live in-browser report preview** that assembles via the existing `assembleViewModel` and updates as manual inputs change (PREV-01, RPT-01/02).
- First **Vercel deployment** of the app (in `medelite-report/`) from the already-public GitHub repo (DEP-01/02).
- Every error path covered by a test (ERR-02).

Out of scope (later phases):
- "Download PDF" button + real PDF rendering → Phase 4.
- Claims metrics section + exact garbled reference labels → Phase 5.
- ".docx" export → Phase 6.
- Star-rating visual cards / charts + 300ms manual-input debounce + the full "Looks Done But Isn't" Vercel checklist → Phase 7.
- A deep visual-design contract (brand/typography/color) → optional `/gsd:ui-phase 3` (not discussed this session).

</domain>

<decisions>
## Implementation Decisions

### Screen layout & preview fidelity
- **D-01: Two-pane side-by-side.** Form/controls on the left, live report preview on the right; collapses to a stacked layout on narrow/mobile viewports. This realizes PREV-01's "updates as you edit" payoff on desktop.
- **D-02: Preview renders as a paper-like document page.** A white "page" panel carrying the static header block (`assembleHeader` output) + report body, styled to mirror the eventual PDF/print layout. Sets the PDF==preview expectation early (RPT-02 / PDF-03 groundwork) and front-loads layout Phase 4 reuses.
- **D-03: Body labels & section order MUST match a user-provided reference report.** ⚠️ **Dependency:** the reference artifact (PDF/image) is **NOT in the repo** — the user will supply it (ideally at/before planning). **Fallback** if not supplied in time: propose the body structure from CLAUDE.md's field list (Name of Facility → Location → Census Capacity → the 4 Star Ratings → manual fields) and iterate. Phase 3 has no claims metrics; exact garbled-label fidelity (CLM-03) is a Phase-5 concern, but core body order should track the reference.

### Lookup flow & states
- **D-04: Explicit "Generate" button triggers the fetch** (Enter-to-submit also). No auto-fetch on keystroke — avoids fetches on partial/typo'd CCNs and keeps error timing predictable and testable.
- **D-05: Client-side CCN format pre-check mirrors the server gate** (`/^[A-Za-z0-9]{6}$/`, trim + uppercase) **before any fetch** — surfaces `invalid_ccn` inline without a round-trip (LOOK-02 "before any fetch"). The server route stays the source of truth; the client check is UX-only, never the sole gate.
- **D-06: Skeleton preview.** Show a greyed skeleton of the report layout before the first search and during loading — not a blank area, not just a spinner. Polished "above expectations" loading state.

### Error presentation & feedback
- **D-07: Error placement is split by the nature of the error:**
  - **Inline beneath the CCN field:** `invalid_ccn` (400) and `not_found` (404) — both are about the CCN value the user entered.
  - **Top banner (above form/preview):** `network_error`, `cms_api_error`, `validation_error` (all 502) — system/transient or operator-alert, not about the CCN value.
- **D-08: UI-authored, friendly per-kind copy.** The client overrides the server's default `message` with its own per-kind copy (Phase-2 D-02 explicitly allows this). Honor Phase-2 D-04 message honesty: `validation_error` uses **non-retry** copy (it won't heal on retry); `network_error`/`cms_api_error` may use retry copy.
- **D-09: Exhaustive kind handling in the UI.** The client maps `error.kind` via a switch using the **imported** `CmsApiError` union + `assertNever` (Phase-2 D-03), so adding a 6th kind later is a compile error in the UI, not a silent unhandled state. The UI imports the shared union — it never loosely hardcodes kind strings.
- **D-10: Partial/missing CMS fields are NOT an error state.** A successfully-fetched facility with suppressed fields renders the **full report with `N/A`** placeholders via the existing formatters (Phase-2 D-09/D-10). Only the 5 error kinds produce error UI. ERR-01's "missing/partial fields" branch = the N/A render path, already built.

### Manual inputs & name override
- **D-11: Manual inputs reset on a new lookup** — looking up a new CCN clears the six manual fields for a clean per-facility slate. **Refinement (discretion):** reset on a **successful** fetch, so a failed/errored lookup does not wipe data the user already typed. Planner confirms the exact trigger.
- **D-12: Field types per CLAUDE.md / CHECKLIST.md.** EMR (text), Current Census (numeric), Type of Patient (text), Medical Coverage (free text), Previous Provider Performance (text), Previous Coverage from Medelite (Yes/No control), + optional facility-name override (text). These map 1:1 to the existing `ManualInputs` interface — no new shape needed.
- **D-13: Name override affects the body's "Name of Facility" only** (NAME-02); the static header (`assembleHeader`) is unaffected. Already enforced in `assembleViewModel` (`displayName = nameOverride?.trim() || providerName`) — the UI just binds the field.

### Deployment & repo
- **D-14: Vercel via dashboard Git integration.** Connect the existing GitHub repo in the Vercel dashboard, set **Root Directory = `medelite-report`** (app is in a subdir), enable auto-deploy on push to `main` + preview deploys on PRs. ⚠️ **User action:** the one-time Vercel account login/connect must be done by the user — an agent cannot authenticate their Vercel account.
- **D-15: Repo stays fully public including `.planning/`.** Push all currently-unpushed local commits (54 as of this session), GSD artifacts included, to the already-PUBLIC `github.com/1akashkalita/Infinite-Snapshot`. No curated/app-only branch.
- **D-16: Skeleton-first early deploy.** Deploy a minimal working page early in Phase 3 to establish CD and surface Vercel/subdir/runtime/font issues before the full flow lands. De-risks the "live URL" deliverable (DEP-01).
- **D-17: No env vars/secrets.** The CMS Provider Data Catalog API is public (no key), so Vercel needs no environment configuration for the data flow.

### Claude's Discretion
- Component structure under `src/app/` (and any `src/components/`): form vs preview vs error components; the page is interactive so the form/preview are **client components** (`"use client"`) while the existing route handler stays server-side. State approach (local React state vs a small hook) and Tailwind v4 styling details.
- Exact reset trigger nuance (D-11) — reset on **successful** fetch recommended.
- Whether to add a thin client fetch helper/hook around `GET /api/facility`.
- Vercel setup specifics beyond D-14 if needed; otherwise dashboard Git integration with Root Dir = `medelite-report`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative spec & rules
- `CLAUDE.md` (repo root) — standing rules (#1–#7), field-mapping table (report body field list + sources), branding rule #2 (static header), test CCN 686123. **Body-layout fallback source for D-03.**
- `CHECKLIST.md` (repo root) — manual-input field types (Current Census numeric, Previous Coverage Yes/No dropdown, name override body-only, input validation tested) + error-path/deployment criteria. ⚠️ **Note:** CHECKLIST.md uses its **own** phase numbering distinct from ROADMAP.md — ROADMAP "Phase 3" is authoritative for GSD execution.
- `medelite-report/AGENTS.md` — **Next.js 16 caveat**: read the relevant guide in `medelite-report/node_modules/next/dist/docs/` before writing/changing Next.js code. For Phase 3 the App Router **client-component / `"use client"` / forms** guides are the relevant ones.

### Planning artifacts
- `.planning/ROADMAP.md` §"Phase 3: Web UI, Core Flow & Deployment" — goal + 5 success criteria.
- `.planning/REQUIREMENTS.md` — LOOK-01/02/03, INPT-01/02/03, PREV-01, ERR-01/02, DEP-01/02 (this phase); NAME-02 (override body-only).
- `.planning/phases/02-api-routes-view-model-config/02-CONTEXT.md` — the API seam this UI consumes: 5-kind error taxonomy (D-01..D-07), `assembleViewModel`/formatters (D-08..D-13), `FacilityData` shape (D-14..D-17), error envelope (D-02/D-03).
- `.planning/phases/01-foundation-cms-data-layer/01-CONTEXT.md` — schema suppression behavior (empty→null, real `"0"` preserved) underpinning the N/A render path (D-10 here).

### Research (structure & pitfalls — with the standing field-name caution)
- `.planning/research/PITFALLS.md` — font CDN URLs (Phase 4), `serverExternalPackages`, recharts v2 (Phase 7); **Vercel deploy pitfalls** + any "Looks Done But Isn't" checklist (leading-zero CCN, etc.).
- `.planning/research/ARCHITECTURE.md` — single-flow SPA: CCN → `/api/facility` → `assembleViewModel` → preview/PDF/docx; UI-structure rationale. ⚠️ **Caution:** do NOT copy its CMS field names from memory (it sketches wrong ones — see Phase-2 D-15/D-16).
- `.planning/research/STACK.md` — library versions; CMS API specifics.

### Source files (the Phase-3 integration seam — the UI consumes these)
- `medelite-report/src/app/api/facility/route.ts` — `GET /api/facility?ccn=` → `200 {data: FacilityData}` or `{error:{kind,message,...}}` (400/404/502). The contract the form calls.
- `medelite-report/src/lib/cms/errors.ts` — `CmsApiError` discriminated union (5 kinds) + `assertNever`; import for the UI's exhaustive error switch (D-09).
- `medelite-report/src/lib/cms/types.ts` — `FacilityData` shape the preview renders.
- `medelite-report/src/lib/report/view-model.ts` — `assembleViewModel(facility, manual, generatedAt)` + `ManualInputs` interface + `ReportViewModelSchema`; preview assembles via this (RPT-02).
- `medelite-report/src/lib/report/format.ts` — null-safe formatters (`formatRating/Beds/Percent/Rate/Location/Date`); preview uses these for the N/A render path (D-10).
- `medelite-report/src/lib/report/header.ts` — `assembleHeader(state)`; the static header block in the paper-like preview (D-02).
- `medelite-report/src/app/page.tsx` — current default Next scaffold; to be replaced by the Phase-3 UI.

### External (not yet a repo file)
- **User-provided reference report (PDF/image)** — NOT yet in repo; **D-03 dependency**. Body labels & order match it. Add its path here once supplied.
- CMS Care Compare profile URL pattern (already in `careCompareUrl`): `https://www.medicare.gov/care-compare/details/nursing-home/{CCN}`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`GET /api/facility`** — the UI's only data source; client fetches and parses the `{data}` / `{error}` envelope.
- **`assembleViewModel` + `ManualInputs` + formatters + `assembleHeader`** — the entire render pipeline is built and **client-safe** (pure, no Node-only deps). The preview is a thin React rendering over `assembleViewModel`'s output.
- **`CmsApiError` union + `assertNever`** — import for the UI's exhaustive, future-proof error handling (D-09).
- **`ReportViewModelSchema`** — already the POST body contract; the same assembled vm will feed Phase 4's "Download PDF".

### Established Patterns
- Next.js 16 App Router; the route handler is server-side; the interactive page needs **client components** (`"use client"`). Read `node_modules/next/dist/docs` guides first (AGENTS.md).
- TypeScript strict + `isolatedModules` (every `.ts` needs import/export); `@/*` path alias; Tailwind v4; Vitest node env (`tests/**/*.test.ts`, `src/**/*.test.ts`).
- `npm run verify` gate (typecheck → lint → format:check → test); `verify:full` adds `next build`. Phase 3 closes green.

### Integration Points
- `page.tsx` (currently the default scaffold) → the two-pane UI (form left, paper-like preview right).
- Form → `fetch GET /api/facility` → on success `assembleViewModel(facility, manual, generatedAt)` → render preview; on error map `kind` → inline/banner (D-07).
- The same assembled `ReportViewModel` is the input Phase 4's "Download PDF" will POST to `/api/export/pdf`.
- Vercel: Root Directory = `medelite-report`; build = `next build` (already green via `verify:full`).

</code_context>

<specifics>
## Specific Ideas

- Reference CCN **686123** (Kendall Lakes, FL) — the demo/test facility; the live two-pane flow must work end-to-end on it (ROADMAP SC#1).
- Error-kind → surface map (D-07): **inline** = `invalid_ccn`, `not_found`; **banner** = `network_error`, `cms_api_error`, `validation_error`.
- Manual field types (CHECKLIST): Current Census **numeric**; Previous Coverage **Yes/No dropdown**; the rest text/free-text; name override text.
- Repo state this session: already PUBLIC at `github.com/1akashkalita/Infinite-Snapshot`, branch `main`, **54 commits unpushed**; `gh` authed as `1akashkalita`; `vercel` CLI **not** installed.
- "Reset on successful fetch" preferred over "reset on submit" so a failed lookup doesn't wipe typed manual inputs (D-11 refinement).

</specifics>

<deferred>
## Deferred Ideas

- **Visual identity / aesthetic polish** (brand accent, typography, color system) — not discussed this session; run `/gsd:ui-phase 3` for a deeper UI-SPEC design contract. (User declined this gray area in discussion.)
- **300ms manual-input debounce** → Phase 7 (Phase-3 manual inputs update instantly per SC#3).
- **Star-rating visual cards / charts** (recharts, react-pdf-charts) → Phase 7; Phase 3 renders ratings as formatted text/values.
- **Download PDF / DOCX buttons** → Phases 4 / 6.
- **Claims metrics section + exact garbled reference labels** (CLM-03) → Phase 5.
- **Full "Looks Done But Isn't" deployment checklist + Vercel smoke test** → Phase 7 (Phase 3 does the *first* deploy; the exhaustive checklist is Phase 7).
- **v2 benchmarks** (BENCH-01/02) — deferred at init.

None of the above is scope creep into Phase 3 — they are downstream consumers of this phase's UI + live deploy.

</deferred>

---

*Phase: 3-Web UI, Core Flow & Deployment*
*Context gathered: 2026-06-17*
