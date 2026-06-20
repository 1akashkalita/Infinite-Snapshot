"use client";

// StarRating.tsx — band-colored star glyph component for the web preview.
//
// Renders a Unicode star string (★★★★☆) + numeric rating (4/5) with Tailwind
// band-color classes. For null (suppressed/absent CMS rating), renders the locked
// grey "N/A" string with NO glyphs (D-06).
//
// All glyph/band logic is delegated to the Task-1 pure helpers so the logic
// stays unit-tested in .ts files (CLAUDE.md rule #5 / TDD discipline).
//
// D-06: null → grey "N/A", no glyphs (strict === null, never falsiness).
// D-05: green for 4–5 stars, amber for 3, red for 1–2.
// "use client" — Unicode star rendering happens in the browser (DOM).

import React from "react";
import { getStarBand, buildStarGlyphs } from "@/lib/report/star-band";
import { STAR_BAND_WEB } from "@/lib/report/colors";

/**
 * Renders a star rating value cell for the web preview.
 *
 * For a valid rating (1–5): renders colored glyph string + number, e.g. "★★★★☆ 4/5".
 * For null (suppressed/absent): renders grey "N/A" with no glyphs (D-06).
 */
export function StarRating({ rating }: { rating: number | null }) {
  // D-06: strict null check (never falsiness — 0 is valid data even if not a valid CMS rating).
  if (rating === null) {
    return <span className="text-zinc-400 not-italic">N/A</span>;
  }

  const band = getStarBand(rating);
  const glyphs = buildStarGlyphs(rating);

  return (
    <span className={`${STAR_BAND_WEB[band]} font-medium`}>
      {glyphs} {rating}/5
    </span>
  );
}
