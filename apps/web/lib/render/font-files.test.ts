import { describe, it, expect, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { FONT_FILES, getMissingFontFiles, resolveFontFiles } from "./font-files";

// #1275 — the font loader used a template literal inside `new URL(...)`,
// which Turbopack collapsed into one asset, and the deployed function then
// rasterized every OG image with no text at all. These tests pin the shape
// that prevents a repeat: four distinct files, each resolvable, and a
// "missing" state that is reported rather than swallowed.
describe("font-files", () => {
  it("names the four bundled TTFs, two families in two weights", () => {
    expect(FONT_FILES).toEqual([
      "PlusJakartaSans-Regular.ttf",
      "PlusJakartaSans-SemiBold.ttf",
      "JetBrainsMono-Regular.ttf",
      "JetBrainsMono-Bold.ttf",
    ]);
  });

  it("resolves every font to a distinct file that exists on disk", () => {
    const resolved = resolveFontFiles();
    expect(resolved).toHaveLength(4);
    for (const r of resolved) {
      expect(r.found, `${r.name} should resolve (tried: ${r.tried.join(", ")})`).toBe(true);
      expect(existsSync(r.path)).toBe(true);
      expect(r.path.endsWith(`/${r.name}`)).toBe(true);
    }
    expect(new Set(resolved.map((r) => r.path)).size).toBe(4);
  });

  it("resolves each font to a real TrueType file, not a stub, and reports its size", () => {
    for (const r of resolveFontFiles()) {
      const file = readFileSync(r.path);
      // 0x00010000 is the TrueType sfnt version; every bundled file uses it.
      expect(Array.from(file.subarray(0, 4))).toEqual([0x00, 0x01, 0x00, 0x00]);
      expect(r.bytes).toBe(file.length);
      expect(r.bytes).toBeGreaterThan(60_000);
    }
  });

  // The fix's first preview deployment had every asset present and drew no
  // glyph. A present file is not a font until its header says so.
  it("skips a candidate that exists but is not a font (#1275)", async () => {
    vi.resetModules();
    // In this checkout the bundler-asset path and the monorepo-root path are
    // the same string, so the stub rejects the FIRST probe of every path
    // (size 4, a stub) and lets later probes through to the real file. The
    // resolver must survive that first rejection and still find the font.
    const seen = new Set<string>();
    vi.doMock("node:fs", async () => {
      const real = await vi.importActual<typeof import("node:fs")>("node:fs");
      return {
        ...real,
        statSync: (p: string) => {
          if (!seen.has(p)) {
            seen.add(p);
            return { size: 4 };
          }
          return real.statSync(p);
        },
      };
    });
    const mod = await import("./font-files");
    const resolved = mod.resolveFontFiles();
    for (const r of resolved) {
      expect(r.found, r.name).toBe(true);
      expect(r.bytes).toBeGreaterThan(60_000);
      expect(r.tried.length).toBeGreaterThanOrEqual(3);
    }
    vi.doUnmock("node:fs");
    vi.resetModules();
  });

  it("tries the bundler asset first and both cwd-anchored source paths after it", () => {
    for (const r of resolveFontFiles()) {
      expect(r.tried.length).toBeGreaterThanOrEqual(3);
      expect(r.tried[0]).toContain("/lib/render/fonts/");
      expect(r.tried).toContain(
        `${process.cwd()}/lib/render/fonts/${r.name}`,
      );
      expect(r.tried).toContain(
        `${process.cwd()}/apps/web/lib/render/fonts/${r.name}`,
      );
    }
  });

  it("reports no missing fonts in this checkout", () => {
    expect(getMissingFontFiles()).toEqual([]);
  });

  it("keeps the source literal per file so a bundler can trace each asset (#1275)", () => {
    const source = readFileSync(new URL("./font-files.ts", import.meta.url), "utf-8");
    for (const name of FONT_FILES) {
      expect(source).toContain(`new URL(\n    "./fonts/${name}",\n    import.meta.url,\n  )`);
    }
    expect(source).not.toMatch(/new URL\(`/);
  });
});
