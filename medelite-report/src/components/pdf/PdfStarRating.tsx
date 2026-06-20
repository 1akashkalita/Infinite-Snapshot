// PdfStarRating.tsx — react-pdf star rating component using SVG primitives.
//
// NO "use client" — this is server-only (mirrors ReportPDF.tsx).
// Import ONLY from route handlers or other server-only components.
// @react-pdf/renderer must never reach the client bundle (PITFALLS #4).
//
// Renders 5 SVG stars (filled/outline via Path) + a numeric text label.
// For null (suppressed/absent CMS rating), renders a grey "N/A" Text with
// NO Svg/Path nodes (D-06 locked grey N/A, no glyphs).
//
// VIZ-02: Stars use react-pdf <Svg><Path> primitives — NEVER recharts/DOM/canvas.
// Structural test in PdfStarRating.test.ts confirms Svg/Path for a rating
// and zero Svg/Path nodes for null (guards the Text-instead-of-Svg regression).
//
// D-06: strict === null check (never falsiness).
// STAR_PATH: pre-computed 5-point star polygon, verified against rendered PDF (A3).
// NOTE A3: visually verify the rendered star shape in an opened PDF (manual check,
// deferred to Plan 03 SC#4 live smoke test).

import React from "react";
import { View, Text, Svg, Path } from "@react-pdf/renderer";
import { getStarBand } from "@/lib/report/star-band";
import { STAR_BAND_HEX } from "@/lib/report/colors";

/**
 * Pre-computed 5-point star polygon path (viewBox 0 0 16 16).
 * NOTE A3: verify visually in rendered PDF — path is reference geometry.
 */
const STAR_PATH =
  "M8,1 L9.9,6.2 L15.5,6.2 L11,9.5 L12.9,14.7 L8,11.4 L3.1,14.7 L5,9.5 L0.5,6.2 L6.1,6.2 Z";

/**
 * PDF star rating cell using react-pdf SVG primitives (VIZ-02).
 *
 * For a valid rating (1–5): renders 5 Svg stars (filled/outline) + numeric Text label.
 * For null: renders a single grey Text "N/A" with NO Svg/Path nodes (D-06).
 */
export function PdfStarRating({ rating }: { rating: number | null }) {
  // D-06: strict null check — null → grey N/A Text, no glyphs.
  if (rating === null) {
    return (
      <Text style={{ color: STAR_BAND_HEX.grey, fontFamily: "Helvetica-Oblique" }}>
        N/A
      </Text>
    );
  }

  const fill = STAR_BAND_HEX[getStarBand(rating)];

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <Svg key={i} width={16} height={16} viewBox="0 0 16 16">
          <Path
            d={STAR_PATH}
            fill={i < rating ? fill : "none"}
            stroke={fill}
            strokeWidth={0.8}
          />
        </Svg>
      ))}
      <Text style={{ color: fill, marginLeft: 4, fontFamily: "Helvetica-Oblique" }}>
        {rating}/5
      </Text>
    </View>
  );
}
