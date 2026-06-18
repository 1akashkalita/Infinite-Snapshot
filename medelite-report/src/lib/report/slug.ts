// slug.ts — Pure filename slug helper for PDF export (D-06).
//
// slugFilename(displayName, ccn) → "<slug>-Snapshot.pdf"
//
// Algorithm:
//   1. Lowercase + trim the displayName.
//   2. Replace every run of non-[a-z0-9] characters with a single hyphen.
//   3. Strip leading/trailing hyphens.
//   4. If the resulting slug is empty (blank/whitespace OR all-special-chars), use CCN fallback.
//
// Fallback: when displayName is blank/whitespace or the slug empties out, return "<ccn>-Snapshot.pdf".
// The CCN is used verbatim (leading zeros preserved).
//
// Security note (T-04-03): The filename flows into the Content-Disposition header.
//   Stripping every non-[a-z0-9] char to hyphens ensures quotes, CRLF, slashes, "..", and
//   other header-injection / path-traversal payloads cannot survive into the response header.
//   Tested explicitly by the injection-safety case in tests/lib/slug.test.ts.
//
// No imports — pure string transform. The named export satisfies TypeScript isolatedModules.

/**
 * Converts a facility displayName into a URL-safe filename stem and appends "-Snapshot.pdf".
 * Falls back to "<ccn>-Snapshot.pdf" when displayName is blank, whitespace-only, or all-special-chars.
 *
 * D-06: Filename = `<slug(displayName)>-Snapshot.pdf`; fallback `<CCN>-Snapshot.pdf`.
 *
 * @param displayName — Override-aware facility display name (may be blank or unsafe).
 * @param ccn — CMS certification number (preserved verbatim, including leading zeros).
 * @returns A safe, ASCII-only filename ending in "-Snapshot.pdf".
 */
export function slugFilename(displayName: string, ccn: string): string {
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumeric runs → single hyphen
    .replace(/^-+|-+$/g, ""); // strip leading/trailing hyphens

  if (!slug) return `${ccn}-Snapshot.pdf`;
  return `${slug}-Snapshot.pdf`;
}
