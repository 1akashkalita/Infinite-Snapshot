import { describe, expect, it } from "vitest";
import {
  formatBeds,
  formatDate,
  formatFootnote,
  formatLocation,
  formatPercent,
  formatRate,
  formatRating,
} from "@/lib/report/format";

// D-08 through D-11: formatter family tests.
// D-10: formatters check === null (NEVER falsiness) — a real 0 is NOT "N/A".
// D-09: all null inputs return the shared "N/A" placeholder.
// DATA-03: formatLocation emits NO ZIP.
// D-13: formatDate is TZ-stable (UTC pinning prevents server/client midnight disagreement).

describe("formatRating", () => {
  it("D-10: returns '0' for a real zero (not 'N/A')", () => {
    expect(formatRating(0)).toBe("0");
  });

  it("D-09: returns 'N/A' for null", () => {
    expect(formatRating(null)).toBe("N/A");
  });

  it("returns the string value for a positive integer rating", () => {
    expect(formatRating(5)).toBe("5");
  });

  it("returns the string value for rating 1", () => {
    expect(formatRating(1)).toBe("1");
  });

  it("returns the string value for rating 3", () => {
    expect(formatRating(3)).toBe("3");
  });
});

describe("formatBeds", () => {
  it("D-10: returns '0' for a real zero (not 'N/A')", () => {
    expect(formatBeds(0)).toBe("0");
  });

  it("D-09: returns 'N/A' for null", () => {
    expect(formatBeds(null)).toBe("N/A");
  });

  it("returns the formatted number for 150 beds", () => {
    expect(formatBeds(150)).toBe("150");
  });

  it("returns the formatted number for large bed count", () => {
    // toLocaleString may add commas for large numbers
    const result = formatBeds(1500);
    expect(result).toMatch(/1.?500/); // "1,500" or "1500" depending on locale
  });
});

describe("formatPercent", () => {
  it("D-10: returns '0.0%' for a real zero (not 'N/A')", () => {
    expect(formatPercent(0)).toBe("0.0%");
  });

  it("D-09: returns 'N/A' for null", () => {
    expect(formatPercent(null)).toBe("N/A");
  });

  it("formats 18.7 as '18.7%'", () => {
    expect(formatPercent(18.7)).toBe("18.7%");
  });

  it("formats 100 as '100.0%'", () => {
    expect(formatPercent(100)).toBe("100.0%");
  });

  it("rounds to 1 decimal place", () => {
    expect(formatPercent(18.75)).toBe("18.8%");
  });
});

describe("formatRate", () => {
  it("D-10: returns '0.00' for a real zero (not 'N/A')", () => {
    expect(formatRate(0)).toBe("0.00");
  });

  it("D-09: returns 'N/A' for null", () => {
    expect(formatRate(null)).toBe("N/A");
  });

  it("formats 1.86 as '1.86'", () => {
    expect(formatRate(1.86)).toBe("1.86");
  });

  it("formats 1.8651 to 2 decimal places", () => {
    // 1.8651 rounds clearly to 1.87 (avoids floating-point halfway ambiguity)
    expect(formatRate(1.8651)).toBe("1.87");
  });
});

describe("formatLocation", () => {
  it("DATA-03: composes street, city, state with no ZIP", () => {
    const result = formatLocation({
      street: "5280 SW 157 AVENUE",
      city: "MIAMI",
      state: "FL",
    });
    expect(result).toBe("5280 SW 157 AVENUE, MIAMI, FL");
  });

  it("DATA-03: does NOT include the ZIP code in the output", () => {
    const result = formatLocation({
      street: "5280 SW 157 AVENUE",
      city: "MIAMI",
      state: "FL",
    });
    // ZIP for 686123 is 33185 — must not appear
    expect(result).not.toContain("33185");
  });

  it("handles generic address input correctly", () => {
    const result = formatLocation({
      street: "123 Main St",
      city: "Anytown",
      state: "TX",
    });
    expect(result).toBe("123 Main St, Anytown, TX");
  });
});

describe("formatDate", () => {
  it("D-13: formats '2026-05-01' as May 1, 2026 (TZ-stable, UTC pinning)", () => {
    const result = formatDate("2026-05-01");
    // With timeZone: 'UTC', the ISO date string is interpreted in UTC,
    // so May 1 stays May 1 regardless of the host timezone.
    expect(result).toBe("May 1, 2026");
  });

  it("D-13: date-only string does not shift to Apr 30 (the midnight off-by-one trap)", () => {
    const result = formatDate("2026-05-01");
    expect(result).not.toContain("April");
    expect(result).not.toContain("30");
  });

  it("accepts a Date object and formats it in UTC", () => {
    const d = new Date("2026-06-17T12:00:00Z");
    const result = formatDate(d);
    expect(result).toBe("June 17, 2026");
  });

  it("accepts an ISO string and formats it correctly", () => {
    const result = formatDate("2026-06-17T12:00:00Z");
    expect(result).toBe("June 17, 2026");
  });
});

describe("formatFootnote", () => {
  it("returns 'Not reported (small sample)' for footnote code 9", () => {
    expect(formatFootnote("9")).toBe("Not reported (small sample)");
  });
  it("returns 'Not available' for footnote code 7", () => {
    expect(formatFootnote("7")).toBe("Not available");
  });
  it("returns 'Not submitted' for footnote code 10", () => {
    expect(formatFootnote("10")).toBe("Not submitted");
  });
  it("returns 'Not enough data' for footnote code 1", () => {
    expect(formatFootnote("1")).toBe("Not enough data");
  });
  it("returns 'Not enough data' for footnote code 2", () => {
    expect(formatFootnote("2")).toBe("Not enough data");
  });
  it("returns 'Not enough data (annual measure)' for footnote code 28", () => {
    expect(formatFootnote("28")).toBe("Not enough data (annual measure)");
  });
  it("returns 'Not available' for an unknown code (safe generic fallback)", () => {
    expect(formatFootnote("99")).toBe("Not available");
  });
  it("returns 'Not available' for an empty string (no-footnote suppressed case)", () => {
    expect(formatFootnote("")).toBe("Not available");
  });
  it("returns 'Not available' for undefined", () => {
    expect(formatFootnote(undefined)).toBe("Not available");
  });
});
