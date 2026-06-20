// slug.test.ts — unit tests for the filename slug helper (D-06).
//
// slugFilename(displayName, ccn) → "<slug>-Snapshot.pdf"
// Edge cases: blank → CCN fallback; all-special-chars → CCN fallback;
//   normal name → slug; CCN with leading zeros preserved;
//   injection chars (quotes/slashes/control) stripped (T-04-03).

import { describe, expect, it } from "vitest";
import { slugFilename } from "@/lib/report/slug";

describe("slugFilename", () => {
  it("D-06: blank displayName returns '<ccn>-Snapshot.pdf'", () => {
    expect(slugFilename("", "686123")).toBe("686123-Snapshot.pdf");
  });

  it("D-06: whitespace-only displayName returns '<ccn>-Snapshot.pdf'", () => {
    expect(slugFilename("   ", "686123")).toBe("686123-Snapshot.pdf");
  });

  it("D-06: all-special-chars displayName returns '<ccn>-Snapshot.pdf'", () => {
    expect(slugFilename("---///", "686123")).toBe("686123-Snapshot.pdf");
  });

  it("D-06: normal name slugifies correctly", () => {
    expect(
      slugFilename("Kendall Lakes Healthcare and Rehab Center", "686123"),
    ).toBe("kendall-lakes-healthcare-and-rehab-center-Snapshot.pdf");
  });

  it("D-06: CCN with leading zeros is preserved as-is in fallback", () => {
    expect(slugFilename("", "012345")).toBe("012345-Snapshot.pdf");
  });

  it("T-04-03: injection chars (quotes/slashes/backslash) are stripped from filename", () => {
    const result = slugFilename('A/B "C" \\ D', "686123");
    expect(result).not.toContain('"');
    expect(result).not.toContain("/");
    expect(result).not.toContain("\\");
    expect(result).not.toContain(" ");
  });

  it("CR-01: header-injection chars in the CCN fallback are stripped", () => {
    // displayName slugs to empty → CCN fallback path. CCN is client-controlled
    // (POST body validates only z.string()) and flows into Content-Disposition.
    const result = slugFilename("###", '686123"\r\nSet-Cookie: x=y');
    expect(result).not.toContain('"');
    expect(result).not.toContain("\r");
    expect(result).not.toContain("\n");
    expect(result).not.toContain(" ");
    expect(result).not.toContain(":");
    // Alphanumerics survive; every separator/control char is dropped.
    expect(result).toBe("686123SetCookiexy-Snapshot.pdf");
  });

  it("CR-01: an all-unsafe CCN fallback yields a safe constant filename", () => {
    expect(slugFilename("", '"\r\n/\\')).toBe("facility-Snapshot.pdf");
  });

  // D-13: ext parameter — .docx extension
  it("D-13: slugFilename with .docx ext returns slug-Snapshot.docx", () => {
    expect(
      slugFilename("Kendall Lakes Healthcare and Rehab Center", "686123", ".docx"),
    ).toBe("kendall-lakes-healthcare-and-rehab-center-Snapshot.docx");
  });

  it("D-13: blank displayName with .docx ext returns ccn-Snapshot.docx", () => {
    expect(slugFilename("", "686123", ".docx")).toBe("686123-Snapshot.docx");
  });

  it("D-13: default ext is still .pdf (backward compat)", () => {
    // No third arg — existing callers unaffected
    expect(slugFilename("Facility Name", "686123")).toBe(
      "facility-name-Snapshot.pdf",
    );
  });
});
