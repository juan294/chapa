/**
 * Badge reference PNG pipeline validator.
 *
 * #1277 — this test used to write `docs/assets/badge-reference.png` in
 * `beforeAll` on every run, so the tracked file changed bytes after almost
 * every `pnpm run test` (the output depends on the host's resvg binary and
 * font resolution). It now renders into a temporary directory and validates
 * that output, and separately checks that the committed asset is a
 * well-formed PNG so it cannot silently vanish or be replaced by a stub.
 *
 * Regenerate the committed asset on purpose: `pnpm run generate:badge-reference`.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  REFERENCE_PNG_PATH,
  REFERENCE_PNG_WIDTH,
  writeBadgeReferencePng,
} from "./badge-reference";

/** Every valid PNG file starts with these 8 bytes. */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngWidth(buffer: Buffer): number {
  // IHDR is the first chunk: 8-byte signature, 4-byte length, 4-byte type, then width.
  return buffer.readUInt32BE(16);
}

function expectWellFormedBadgePng(buffer: Buffer): void {
  expect(Array.from(buffer.subarray(0, 8))).toEqual(PNG_MAGIC);
  expect(pngWidth(buffer)).toBe(REFERENCE_PNG_WIDTH);
  expect(buffer.length).toBeGreaterThan(10_000);
  expect(buffer.length).toBeLessThan(500_000);
}

describe("badge reference PNG pipeline (rendered into a temp dir)", () => {
  let dir: string;
  let output: string;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "chapa-badge-reference-"));
    output = join(dir, "badge-reference.png");
    await writeBadgeReferencePng(output);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("renders a well-formed 1200px-wide PNG with real badge content", () => {
    expectWellFormedBadgePng(readFileSync(output));
  });

  it("never writes the tracked documentation asset (#1277)", () => {
    expect(output).not.toBe(REFERENCE_PNG_PATH);
    expect(output.startsWith(tmpdir())).toBe(true);
  });
});

describe("committed docs/assets/badge-reference.png", () => {
  it("exists and is a well-formed 1200px-wide PNG", () => {
    expect(existsSync(REFERENCE_PNG_PATH)).toBe(true);
    expectWellFormedBadgePng(readFileSync(REFERENCE_PNG_PATH));
  });
});
