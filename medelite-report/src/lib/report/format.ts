// format.ts — null-safe formatter family for report render targets.
//
// D-08: ReportViewModel carries raw number | null — formatters run at render time.
// D-09: All null inputs return the shared PLACEHOLDER ("N/A").
// D-10: Formatters check === null (NEVER falsiness) — a real 0 is valid data, not "N/A".
//       The nullableNum pattern in schema.ts (lines 26-27) preserves "0" as 0,
//       so `if (!value)` would incorrectly convert 0 to "N/A".
// D-11: Chart paths (Phase 7) read raw number | null — never route through these formatters.
// DATA-03 / D-17: formatLocation emits NO ZIP (address parts are stored separately).
// D-13: formatDate uses explicit timeZone: 'UTC' to prevent server/client midnight disagreement.

/** Shared null placeholder (D-09). Private to this module — not exported. */
const PLACEHOLDER = "N/A";

/**
 * Formats a star rating (1–5 integers) or null.
 * D-10: 0 → "0" (real data), null → "N/A".
 */
export function formatRating(value: number | null): string {
  if (value === null) return PLACEHOLDER;
  return String(value);
}

/**
 * Formats a certified-beds count with locale-appropriate thousands separator.
 * D-10: 0 → "0" (real data), null → "N/A".
 */
export function formatBeds(value: number | null): string {
  if (value === null) return PLACEHOLDER;
  return value.toLocaleString();
}

/**
 * Formats a percentage value to one decimal place (e.g. 18.7 → "18.7%").
 * D-10: 0 → "0.0%" (real data), null → "N/A".
 */
export function formatPercent(value: number | null): string {
  if (value === null) return PLACEHOLDER;
  return `${value.toFixed(1)}%`;
}

/**
 * Formats a rate to two decimal places (e.g. 1.86 → "1.86").
 * D-10: 0 → "0.00" (real data), null → "N/A".
 */
export function formatRate(value: number | null): string {
  if (value === null) return PLACEHOLDER;
  return value.toFixed(2);
}

/**
 * Composes a display address from street, city, and state — NO ZIP (DATA-03 / D-17).
 * Example: "5280 SW 157 AVENUE, MIAMI, FL"
 */
export function formatLocation(address: {
  street: string;
  city: string;
  state: string;
}): string {
  return `${address.street}, ${address.city}, ${address.state}`;
}

/**
 * Formats a date value using an explicit UTC timezone (D-13).
 * Prevents the midnight off-by-one where server (UTC) and client (user TZ) disagree.
 * Example: "2026-05-01" → "May 1, 2026" (never "April 30, 2026").
 *
 * @param value — Date object or ISO string (date-only "YYYY-MM-DD" or full ISO).
 */
export function formatDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
