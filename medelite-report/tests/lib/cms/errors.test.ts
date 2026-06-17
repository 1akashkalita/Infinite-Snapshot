import { describe, expect, it } from "vitest";
import {
  CmsApiErrorSchema,
  CmsError,
  assertNever,
} from "@/lib/cms/errors";

// Coverage per CLAUDE.md rule #6: every error path tested.
// TDD RED: this file is written before errors.ts exists.

describe("CmsApiErrorSchema — discriminated union (D-01/D-03)", () => {
  it("accepts kind=invalid_ccn with message", () => {
    const result = CmsApiErrorSchema.safeParse({
      kind: "invalid_ccn",
      message: "CCN must be 6 alphanumeric characters",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe("invalid_ccn");
    }
  });

  it("accepts kind=not_found with message and ccn", () => {
    const result = CmsApiErrorSchema.safeParse({
      kind: "not_found",
      message: "Facility not found",
      ccn: "686123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe("not_found");
      // ccn field present on not_found variant
      if (result.data.kind === "not_found") {
        expect(result.data.ccn).toBe("686123");
      }
    }
  });

  it("accepts kind=network_error with message", () => {
    const result = CmsApiErrorSchema.safeParse({
      kind: "network_error",
      message: "Network timeout",
    });
    expect(result.success).toBe(true);
  });

  it("accepts kind=cms_api_error with message", () => {
    const result = CmsApiErrorSchema.safeParse({
      kind: "cms_api_error",
      message: "CMS returned HTTP 500",
    });
    expect(result.success).toBe(true);
  });

  it("accepts kind=validation_error with message (and NO extra fields required)", () => {
    const result = CmsApiErrorSchema.safeParse({
      kind: "validation_error",
      message: "CMS response failed validation",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe("validation_error");
    }
  });

  it("REJECTS an unknown kind", () => {
    const result = CmsApiErrorSchema.safeParse({
      kind: "boom",
      message: "should not parse",
    });
    expect(result.success).toBe(false);
  });

  it("REJECTS not_found without ccn field", () => {
    const result = CmsApiErrorSchema.safeParse({
      kind: "not_found",
      message: "no ccn provided",
    });
    expect(result.success).toBe(false);
  });

  it("validation_error carries NO extra detail field (D-05 leak prevention)", () => {
    // The schema should not define any extra field beyond kind+message for validation_error.
    // Test that the parsed output only has kind and message on this variant.
    const result = CmsApiErrorSchema.safeParse({
      kind: "validation_error",
      message: "schema mismatch",
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.kind === "validation_error") {
      const keys = Object.keys(result.data);
      expect(keys).toContain("kind");
      expect(keys).toContain("message");
      // There must be no extra keys beyond kind+message on this variant
      expect(keys.length).toBe(2);
    }
  });
});

describe("CmsError class (D-18)", () => {
  it("is instanceof Error and instanceof CmsError", () => {
    const err = new CmsError("not_found", "Facility not found", {
      ccn: "686123",
    });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CmsError);
  });

  it("carries .kind, .message, and .extra", () => {
    const err = new CmsError("not_found", "msg", { ccn: "686123" });
    expect(err.kind).toBe("not_found");
    expect(err.message).toBe("msg");
    expect(err.extra).toEqual({ ccn: "686123" });
  });

  it("works without the optional extra argument", () => {
    const err = new CmsError("invalid_ccn", "bad ccn");
    expect(err.kind).toBe("invalid_ccn");
    expect(err.extra).toBeUndefined();
  });

  it(".name is 'CmsError'", () => {
    const err = new CmsError("network_error", "timeout");
    expect(err.name).toBe("CmsError");
  });

  it("can be thrown and caught with instanceof CmsError", () => {
    expect(() => {
      throw new CmsError("cms_api_error", "upstream error");
    }).toThrow(CmsError);
  });
});

describe("assertNever (D-03 exhaustiveness guard)", () => {
  it("throws at runtime when called with an out-of-union value", () => {
    // Cast to never to simulate an unhandled switch default branch.
    expect(() => {
      assertNever("unknown-kind" as never);
    }).toThrow('Unhandled CmsError kind: "unknown-kind"');
  });
});
