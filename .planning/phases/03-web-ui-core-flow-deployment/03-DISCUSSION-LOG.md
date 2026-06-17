# Phase 3: Web UI, Core Flow & Deployment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-17
**Phase:** 3-Web UI, Core Flow & Deployment
**Areas discussed:** Layout & preview fidelity, Interaction & states, Deployment & repo

---

## Gray-area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Layout & preview fidelity | Two-pane vs stacked vs wizard; paper-like vs dashboard preview | ✓ |
| Interaction & states | Fetch trigger, initial/loading states, error placement, manual-input persistence | ✓ |
| Visual identity & polish | Aesthetic direction, brand accent, typography | |
| Deployment & repo | GitHub/Vercel setup, repo scope, deploy timing | ✓ |

**User's choice:** Interaction & states, Layout & preview fidelity, Deployment & repo
**Notes:** Visual identity declined — can be covered later via `/gsd:ui-phase 3`.

---

## Layout & preview fidelity

### Screen arrangement
| Option | Description | Selected |
|--------|-------------|----------|
| Two-pane side-by-side | Form left, live preview right; stacks on mobile | ✓ |
| Stacked | Form on top, full-width preview below | |
| Single-column wizard | Step through CCN → inputs → preview | |

### Preview fidelity
| Option | Description | Selected |
|--------|-------------|----------|
| Paper-like document page | White "page" with static header, mirrors the PDF | ✓ |
| Web dashboard cards | Web-native cards; looser PDF parity | |
| Hybrid | Dashboard chrome around a paper-like report panel | |

### Reference layout source
| Option | Description | Selected |
|--------|-------------|----------|
| I'll provide the reference | User supplies reference PDF/image; match labels & order to it | ✓ |
| Propose from CLAUDE.md | Propose body structure from the field list | |
| Exact match later | Lock label fidelity in PDF/claims phases | |

**User's choice:** Two-pane / Paper-like document page / User will provide the reference report
**Notes:** Reference artifact is NOT in the repo — flagged as a planner dependency (D-03). CLAUDE.md field list is the fallback if not supplied by planning.

---

## Interaction & states

### Fetch trigger
| Option | Description | Selected |
|--------|-------------|----------|
| Explicit Generate button | Click (or Enter) to fetch; no fetch on partial input | ✓ |
| Auto-fetch on valid CCN | Debounced fetch as soon as 6-char CCN entered | |
| You decide | Claude picks sensible default | |

### Initial / loading states
| Option | Description | Selected |
|--------|-------------|----------|
| Empty prompt + spinner | Placeholder before; spinner during fetch | |
| Skeleton preview | Greyed skeleton of report layout before/while loading | ✓ |
| Blank until data | Nothing until data arrives | |

### Error presentation
| Option | Description | Selected |
|--------|-------------|----------|
| Inline + UI copy | All errors beneath the field; UI-authored per-kind copy | |
| Inline + banner split | Input errors under field; system errors as banner; UI copy | ✓ |
| Inline + server copy | Beneath field; server default messages verbatim | |

### Manual-input persistence
| Option | Description | Selected |
|--------|-------------|----------|
| Persist | Keep manual inputs across lookups | |
| Persist + Clear button | Keep, but offer an explicit reset | |
| Reset on new lookup | Clear manual inputs on a new CCN lookup | ✓ |

**User's choice:** Explicit Generate button / Skeleton preview / Inline + banner split / Reset on new lookup
**Notes:** Error-kind mapping (D-07): inline = invalid_ccn, not_found; banner = network_error, cms_api_error, validation_error. Planner note: reset on *successful* fetch so a failed lookup doesn't wipe typed inputs (D-11).

---

## Deployment & repo

### Vercel setup
| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard Git integration | Connect repo, Root Dir = medelite-report, auto-deploy + PR previews | ✓ |
| Vercel CLI | Manual `vercel --prod` from subdir | |
| You decide | Claude picks the standard | |

### Repo scope (public)
| Option | Description | Selected |
|--------|-------------|----------|
| Keep everything public | Push all commits incl. .planning/ | ✓ |
| Curate app-only | Clean branch without .planning/ for reviewers | |
| You decide | Pragmatic default | |

### Deploy timing
| Option | Description | Selected |
|--------|-------------|----------|
| Early (skeleton-first) | Deploy minimal page early to establish CD | ✓ |
| End of phase | Build locally, deploy once at the end | |

**User's choice:** Dashboard Git integration / Keep everything public / Early (skeleton-first)
**Notes:** Repo already PUBLIC at github.com/1akashkalita/Infinite-Snapshot; 54 commits unpushed; gh authed; vercel CLI not installed. User must perform the one-time Vercel account connect (D-14). No env vars/secrets needed (D-17).

---

## Claude's Discretion

- Component structure / client-vs-server split / state approach / Tailwind details.
- Exact manual-input reset trigger (reset on successful fetch recommended — D-11).
- Whether to add a thin client fetch helper/hook around `GET /api/facility`.

## Deferred Ideas

- Visual identity / aesthetic polish → `/gsd:ui-phase 3`.
- 300ms manual-input debounce → Phase 7.
- Star-rating cards / charts → Phase 7.
- Download PDF / DOCX buttons → Phases 4 / 6.
- Claims metrics + exact garbled reference labels → Phase 5.
- Full "Looks Done But Isn't" deployment checklist + Vercel smoke test → Phase 7.
