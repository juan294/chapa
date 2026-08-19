/**
 * Badge reference PNG generator + validator.
 *
 * This test file serves dual purpose:
 * 1. Generates docs/assets/badge-reference.png using the production rendering
 *    pipeline (renderBadgeSvg + svgToPng) with demo data
 * 2. Validates the generated PNG is well-formed and non-trivial
 *
 * Run with: pnpm run test -- --run scripts/generate-badge-reference.test.ts
 */
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { renderBadgeSvg } from "../apps/web/lib/render/BadgeSvg";
import { svgToPng } from "../apps/web/lib/render/svg-to-png";
import { DEMO_STATS, DEMO_IMPACT } from "../apps/web/lib/render/demoData";

const REFERENCE_PNG_PATH = join(
  __dirname,
  "..",
  "docs",
  "assets",
  "badge-reference.png",
);

/**
 * PNG magic bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
 * Every valid PNG file starts with these 8 bytes.
 */
const PNG_MAGIC = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

describe("badge reference PNG", () => {
  beforeAll(async () => {
    // Generate the reference PNG using the production rendering pipeline
    mkdirSync(dirname(REFERENCE_PNG_PATH), { recursive: true });

    const svg = renderBadgeSvg(DEMO_STATS, DEMO_IMPACT, {
      includeBranding: true,
      demoMode: true,
    });

    const png = await svgToPng(svg, 1200);
    writeFileSync(REFERENCE_PNG_PATH, png);
  });

  it("exists at docs/assets/badge-reference.png", () => {
    expect(existsSync(REFERENCE_PNG_PATH)).toBe(true);
  });

  it("has valid PNG magic bytes", () => {
    const buffer = readFileSync(REFERENCE_PNG_PATH);
    const header = new Uint8Array(buffer.buffer, buffer.byteOffset, 8);
    expect(Array.from(header)).toEqual(Array.from(PNG_MAGIC));
  });

  it("is larger than 10KB (contains real badge content)", () => {
    const buffer = readFileSync(REFERENCE_PNG_PATH);
    expect(buffer.length).toBeGreaterThan(10_000);
  });

  it("is a reasonable file size (under 500KB)", () => {
    const buffer = readFileSync(REFERENCE_PNG_PATH);
    expect(buffer.length).toBeLessThan(500_000);
  });
});
