import { describe, expect, it } from "vitest";
import { assembleHeader } from "@/lib/report/header";

// RPT-01: assembleHeader takes ONLY a state code — never a facility name.
// TypeScript enforces this at compile time (one parameter of type string).
// CLAUDE.md rule #2: static branding strings are exact constants, never derived from
// facility data.

describe("assembleHeader", () => {
  it("returns the exact static platformLine with em-dash (CLAUDE.md rule #2)", () => {
    const h = assembleHeader("FL");
    expect(h.platformLine).toBe("INFINITE — Managed by MEDELITE");
  });

  it("returns the exact static reportTitle", () => {
    const h = assembleHeader("FL");
    expect(h.reportTitle).toBe("FACILITY ASSESSMENT SNAPSHOT");
  });

  it("returns the state uppercased as stateLine", () => {
    const h = assembleHeader("FL");
    expect(h.stateLine).toBe("FL");
  });

  it("uppercases a lowercase state input", () => {
    const h = assembleHeader("fl");
    expect(h.stateLine).toBe("FL");
  });

  it("RPT-01 negative: platformLine does not contain any facility name", () => {
    const h = assembleHeader("FL");
    // The facility at CCN 686123 is Kendall Lakes — must not appear in header
    expect(h.platformLine).not.toContain("Kendall");
    expect(h.platformLine).not.toContain("KENDALL");
    expect(h.reportTitle).not.toContain("Kendall");
  });

  it("RPT-01 negative: stateLine does not contain any facility name", () => {
    const h = assembleHeader("FL");
    expect(h.stateLine).not.toContain("Kendall");
  });

  it("returns all three expected fields for a valid state", () => {
    const h = assembleHeader("TX");
    expect(h).toHaveProperty("platformLine");
    expect(h).toHaveProperty("reportTitle");
    expect(h).toHaveProperty("stateLine");
    expect(h.stateLine).toBe("TX");
  });
});
