// PdfStarRating.test.ts — structural unit tests for PdfStarRating component.
//
// Node env, no jsdom — element-tree inspection only (no renderToBuffer/DOM).
// Per the TEST MECHANISM note in 07-01-PLAN.md:
//   Import the component from the .tsx file into a .test.ts file.
//   Call it as a plain function to get the returned React element.
//   Walk the type/props.children tree with a recursive findByType() helper.
//   Assert structure (Svg/Path for a rating, grey Text for null).
//
// This guards the VIZ-02 invariant: PDF stars use react-pdf SVG primitives,
// NEVER a Text-glyph fallback. The integration test (export-pdf.test.ts) only
// asserts renderToBuffer success and PDF bytes — it would NOT catch a
// PdfStarRating that returned <Text>★★★★☆</Text> instead of <Svg><Path/></Svg>.

import { describe, it, expect } from "vitest";
import React from "react";
import { Svg, Path, Text, View } from "@react-pdf/renderer";
import { PdfStarRating } from "./PdfStarRating";

// ---------------------------------------------------------------------------
// findByType — recursive element-tree walker (no DOM, no jsdom)
// Walks props.children (handling arrays + nested elements) and returns all
// nodes whose element.type matches the given type reference.
//
// Handles two kinds of array children:
//   - props.children is an array (standard multi-child)
//   - props.children[i] is itself an array (from Array.from() in JSX)
//
// Uses `any` internally for tree walking since react-pdf element types have
// opaque TypeScript shapes that block generic props.children access.
// This is acceptable in a structural test-only file.
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findByType(node: any, type: React.ElementType): any[] {
  if (node === null || node === undefined) return [];

  // Handle arrays directly (from Array.from() children, flat arrays, etc.)
  if (Array.isArray(node)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = [];
    for (const child of node) {
      results.push(...findByType(child, type));
    }
    return results;
  }

  if (typeof node !== "object") return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: any[] = [];

  if (node.type === type) {
    results.push(node);
  }

  // Walk children (may be a single element, array of elements, nested array, or primitive)
  const children = node.props?.children;
  if (children !== undefined && children !== null) {
    if (Array.isArray(children)) {
      for (const child of children) {
        results.push(...findByType(child, type));
      }
    } else {
      results.push(...findByType(children, type));
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PdfStarRating — rated input (rating: 4)", () => {
  // Call PdfStarRating as a plain function to get the returned React element.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = PdfStarRating({ rating: 4 }) as any;

  it("returns a React element (not null)", () => {
    expect(element).not.toBeNull();
    expect(typeof element).toBe("object");
  });

  it("VIZ-02: element tree contains at least 1 Svg node (react-pdf SVG primitive, NOT Text glyph)", () => {
    const svgNodes = findByType(element, Svg);
    expect(svgNodes.length).toBeGreaterThanOrEqual(1);
  });

  it("VIZ-02: element tree contains at least 1 Path node (SVG fill/outline star)", () => {
    const pathNodes = findByType(element, Path);
    expect(pathNodes.length).toBeGreaterThanOrEqual(1);
  });

  it("VIZ-02: element tree contains exactly 5 Svg nodes (one per star position)", () => {
    const svgNodes = findByType(element, Svg);
    expect(svgNodes).toHaveLength(5);
  });

  it("VIZ-02: element tree contains exactly 5 Path nodes", () => {
    const pathNodes = findByType(element, Path);
    expect(pathNodes).toHaveLength(5);
  });

  it("renders a View wrapper (flexDirection: row)", () => {
    const viewNodes = findByType(element, View);
    expect(viewNodes.length).toBeGreaterThanOrEqual(1);
  });

  it("first 4 Path nodes are filled (i < rating = 4) and last 1 is outline (fill='none')", () => {
    const pathNodes = findByType(element, Path);
    // Path props: fill=hex for i<4, fill='none' for i>=4
    expect(pathNodes[0]!.props.fill).not.toBe("none"); // filled
    expect(pathNodes[3]!.props.fill).not.toBe("none"); // filled
    expect(pathNodes[4]!.props.fill).toBe("none"); // outline
  });

  it("does NOT return a bare Text element at the top level (VIZ-02: must be Svg-based)", () => {
    // Top-level element must be View (for a rated input), not Text
    expect(element.type).toBe(View);
  });
});

describe("PdfStarRating — null rating (suppressed/absent — D-06)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = PdfStarRating({ rating: null }) as any;

  it("returns a React element (not null)", () => {
    expect(element).not.toBeNull();
  });

  it("D-06: element tree contains ZERO Svg nodes (no star glyphs for null)", () => {
    const svgNodes = findByType(element, Svg);
    expect(svgNodes).toHaveLength(0);
  });

  it("D-06: element tree contains ZERO Path nodes (no star glyphs for null)", () => {
    const pathNodes = findByType(element, Path);
    expect(pathNodes).toHaveLength(0);
  });

  it("D-06: top-level element is a Text node (grey N/A)", () => {
    expect(element.type).toBe(Text);
  });

  it("D-06: the grey N/A Text renders the string 'N/A'", () => {
    // Text node's children should be the string "N/A"
    const textNodes = findByType(element, Text);
    expect(textNodes.length).toBeGreaterThanOrEqual(1);
    const naNode = textNodes.find((t) => t.props?.children === "N/A");
    expect(naNode).toBeDefined();
  });

  it("D-06: N/A Text has grey color from STAR_BAND_HEX.grey", () => {
    // The top-level Text element should have color: STAR_BAND_HEX.grey = "#9ca3af"
    expect(element.type).toBe(Text);
    expect(element.props.style?.color).toBe("#9ca3af");
  });
});

describe("PdfStarRating — different ratings produce different fill counts", () => {
  it("rating 5 → all 5 Path nodes are filled (no 'none' fill)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const el = PdfStarRating({ rating: 5 }) as any;
    const pathNodes = findByType(el, Path);
    expect(pathNodes).toHaveLength(5);
    for (const path of pathNodes) {
      expect(path.props.fill).not.toBe("none");
    }
  });

  it("rating 1 → only first Path is filled, remaining 4 are outlines", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const el = PdfStarRating({ rating: 1 }) as any;
    const pathNodes = findByType(el, Path);
    expect(pathNodes).toHaveLength(5);
    expect(pathNodes[0]!.props.fill).not.toBe("none"); // filled
    expect(pathNodes[1]!.props.fill).toBe("none"); // outline
    expect(pathNodes[4]!.props.fill).toBe("none"); // outline
  });

  it("rating 3 → first 3 filled, last 2 are outlines", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const el = PdfStarRating({ rating: 3 }) as any;
    const pathNodes = findByType(el, Path);
    expect(pathNodes[0]!.props.fill).not.toBe("none");
    expect(pathNodes[2]!.props.fill).not.toBe("none");
    expect(pathNodes[3]!.props.fill).toBe("none");
    expect(pathNodes[4]!.props.fill).toBe("none");
  });
});
