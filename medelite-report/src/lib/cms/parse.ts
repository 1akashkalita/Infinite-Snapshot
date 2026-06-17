// parse.ts — typed parse helpers wrapping CMSRowSchema.
//
// parseCMSRow: throws a human-readable error on invalid input (for route handlers).
// safeParseCMSRow: returns the SafeParseReturn for callers that want structured error handling.
//
// Zod v4 note: on failure use result.error.issues (NOT the v3 .errors property — undefined in v4).
// Use z.prettifyError(result.error) for a human-readable error string.

import { z } from "zod";
import { CMSRowSchema, type ParsedProvider } from "@/lib/cms/schema";

/**
 * Parses a raw CMS provider row and returns a fully typed ParsedProvider.
 * Throws a human-readable Error if validation fails (e.g. missing required keys,
 * wrong shape, or a suppressed field that cannot be coerced).
 *
 * Callers that need structured error handling should use safeParseCMSRow instead.
 */
export function parseCMSRow(raw: unknown): ParsedProvider {
  const result = CMSRowSchema.safeParse(raw);
  if (!result.success) {
    // z.prettifyError works in Zod v4 (verified live 2026-06-16).
    // result.error.issues is the ZodIssue[] array in v4 (v3's .errors is undefined in v4).
    throw new Error(z.prettifyError(result.error));
  }
  return result.data;
}

/**
 * Non-throwing variant: returns the Zod SafeParseReturnType so callers can
 * inspect result.success / result.data / result.error.issues directly.
 */
export function safeParseCMSRow(raw: unknown) {
  return CMSRowSchema.safeParse(raw);
}
