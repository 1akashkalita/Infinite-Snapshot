// header.ts — assembleHeader(state): HeaderData
//
// RPT-01 / CLAUDE.md rule #2: the header block is STATIC — never overwritten by
// the facility name. assembleHeader takes ONLY a state code (one parameter).
// Passing a facility-name argument is a TypeScript compile error.
//
// Exact branding strings (copy verbatim, em-dash — not a hyphen):
//   platformLine: "INFINITE — Managed by MEDELITE"
//   reportTitle:  "FACILITY ASSESSMENT SNAPSHOT"
//   stateLine:    <state code uppercased>

export interface HeaderData {
  /** "INFINITE — Managed by MEDELITE" — exact static string (CLAUDE.md rule #2). */
  platformLine: string;
  /** "FACILITY ASSESSMENT SNAPSHOT" — exact static string. */
  reportTitle: string;
  /** State abbreviation uppercased, e.g. "FL". Dynamic from the CMS state field. */
  stateLine: string;
}

/**
 * Assembles the static report header.
 *
 * @param state — CMS state abbreviation (e.g. "FL"). This is the ONLY argument.
 *   TypeScript enforces that no facility-name can be passed (RPT-01 / CLAUDE.md rule #2).
 * @returns HeaderData with the exact static branding strings + uppercased state.
 */
export function assembleHeader(state: string): HeaderData {
  return {
    platformLine: "INFINITE — Managed by MEDELITE",
    reportTitle: "FACILITY ASSESSMENT SNAPSHOT",
    stateLine: state.toUpperCase(),
  };
}
