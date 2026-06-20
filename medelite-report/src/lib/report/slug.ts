// slug.ts — Pure filename slug helper for export routes (D-06 / D-13).
//
// slugFilename(displayName, ccn, ext) → "<slug>-Snapshot{ext}"
//
// Algorithm:
//   1. Lowercase + trim the displayName.
//   2. Replace every run of non-[a-z0-9] characters with a single hyphen.
//   3. Strip leading/trailing hyphens.
//   4. If the resulting slug is empty (blank/whitespace OR all-special-chars), use CCN fallback.
//
// Fallback: when displayName is blank/whitespace or the slug empties out, return
//   "<sanitized-ccn>-Snapshot{ext}". The CCN keeps only [A-Za-z0-9] (leading zeros and
//   alphanumeric state codes preserved); if nothing survives, a safe constant is used.
//
// Security note (T-04-03 / CR-01): The filename flows into the Content-Disposition header,
//   and BOTH inputs are client-controlled — the POST body validates `ccn` only as z.string(),
//   so the CCN fallback is just as attacker-reachable as the displayName path. Allowlist-
//   sanitizing both inputs (strip every char outside [a-z0-9] / [A-Za-z0-9]) ensures quotes,
//   CRLF, slashes, "..", and other header-injection / path-traversal payloads cannot survive
//   into the response header. Both paths are tested in tests/lib/slug.test.ts.
//   The `ext` parameter is route-handler-supplied (never user input) so it needs no sanitization.
//
// No imports — pure string transform. The named export satisfies TypeScript isolatedModules.

/**
 * Converts a facility displayName into a URL-safe filename stem and appends "-Snapshot{ext}".
 * Falls back to "<sanitized-ccn>-Snapshot{ext}" when displayName is blank, whitespace-only,
 * or all-special-chars; falls back to a safe constant when the CCN has no usable characters.
 *
 * D-06 / D-13: Filename = `<slug(displayName)>-Snapshot{ext}`; fallback `<sanitized-CCN>-Snapshot{ext}`.
 * The default ext is ".pdf" so all existing callers (PDF route) are unaffected (backward-compat).
 * The ext param is route-handler-supplied — never derived from user input — so no sanitization needed.
 *
 * @param displayName — Override-aware facility display name (may be blank or unsafe).
 * @param ccn — CMS certification number; sanitized to [A-Za-z0-9] (leading zeros preserved).
 * @param ext — File extension including the dot (default ".pdf"). Route-supplied, never user input.
 * @returns A safe, ASCII-only filename ending in "-Snapshot{ext}".
 */
export function slugFilename(
  displayName: string,
  ccn: string,
  ext = ".pdf",
): string {
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumeric runs → single hyphen
    .replace(/^-+|-+$/g, ""); // strip leading/trailing hyphens

  if (slug) return `${slug}-Snapshot${ext}`;

  // CR-01: the CCN reaches the Content-Disposition header too, and the POST body only
  // validates it as z.string() — so it must be allowlist-sanitized just like the slug.
  // Keep [A-Za-z0-9] (preserves leading zeros + alphanumeric state codes); if nothing
  // survives (CCN was entirely unsafe chars), use a safe constant.
  const safeCcn = ccn.replace(/[^A-Za-z0-9]+/g, "");
  return `${safeCcn || "facility"}-Snapshot${ext}`;
}
