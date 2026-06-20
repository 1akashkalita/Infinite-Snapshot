// rasterize.test.ts — Unit tests for svgToPngBuffer.
//
// Tests run in node env (no jsdom, no NAPI DOM dependencies).
// Primary assertion: the returned Buffer's first 8 bytes are the PNG magic number:
//   0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A  (%PNG\r\n\x1a\n)
//
// The test uses a minimal hand-written SVG (a simple colored rectangle) rather than
// a recharts-generated SVG, to isolate the rasterizer from the chart renderer.
// @resvg/resvg-js must be available in node_modules (installed in Task 1) and listed
// in next.config.ts serverExternalPackages — but the unit test does not go through
// Next.js, so it loads @resvg/resvg-js directly from node_modules.

import { describe, expect, it } from "vitest";
import { svgToPngBuffer } from "@/lib/charts/rasterize";

// Minimal valid SVG string — a 100×80 viewBox with a blue rectangle.
// Hand-written to avoid recharts dependency in this test.
const SIMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="140" viewBox="0 0 300 140">
  <rect x="10" y="10" width="100" height="80" fill="#3b82f6"/>
  <rect x="120" y="20" width="100" height="70" fill="#16a34a"/>
  <rect x="230" y="30" width="60" height="60" fill="#f59e0b"/>
</svg>`;

// PNG magic bytes: 0x89 P N G \r \n \x1a \n
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe("svgToPngBuffer", () => {
  it("returns a Buffer (not null or undefined)", () => {
    const buf = svgToPngBuffer(SIMPLE_SVG);
    expect(buf).toBeInstanceOf(Buffer);
  });

  it("PNG magic byte 0 is 0x89", () => {
    const buf = svgToPngBuffer(SIMPLE_SVG);
    expect(buf[0]).toBe(PNG_MAGIC[0]);
  });

  it("PNG magic byte 1 is 0x50 (P)", () => {
    const buf = svgToPngBuffer(SIMPLE_SVG);
    expect(buf[1]).toBe(PNG_MAGIC[1]);
  });

  it("PNG magic byte 2 is 0x4E (N)", () => {
    const buf = svgToPngBuffer(SIMPLE_SVG);
    expect(buf[2]).toBe(PNG_MAGIC[2]);
  });

  it("PNG magic byte 3 is 0x47 (G)", () => {
    const buf = svgToPngBuffer(SIMPLE_SVG);
    expect(buf[3]).toBe(PNG_MAGIC[3]);
  });

  it("PNG magic bytes 0-7 are all correct (full magic sequence)", () => {
    const buf = svgToPngBuffer(SIMPLE_SVG);
    for (let i = 0; i < PNG_MAGIC.length; i++) {
      expect(buf[i], `byte[${i}] mismatch`).toBe(PNG_MAGIC[i]);
    }
  });

  it("output buffer is non-empty (rasterization produced data)", () => {
    const buf = svgToPngBuffer(SIMPLE_SVG);
    expect(buf.length).toBeGreaterThan(100);
  });

  it("accepts custom width parameter without throwing", () => {
    expect(() => svgToPngBuffer(SIMPLE_SVG, 200, 100)).not.toThrow();
  });

  it("smaller width produces a smaller buffer than default", () => {
    const bufDefault = svgToPngBuffer(SIMPLE_SVG, 300, 140);
    const bufSmall = svgToPngBuffer(SIMPLE_SVG, 100, 50);
    // Smaller dimensions = fewer pixels = smaller PNG (generally)
    expect(bufSmall.length).toBeLessThan(bufDefault.length);
  });
});
