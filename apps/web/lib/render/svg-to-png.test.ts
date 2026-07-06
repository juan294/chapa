import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock @resvg/resvg-js BEFORE importing the module under test.
// vi.hoisted() ensures these are available inside the vi.mock factory.
// ---------------------------------------------------------------------------

const { mockAsPng, mockRender } = vi.hoisted(() => ({
  mockAsPng: vi.fn(),
  mockRender: vi.fn(),
}));

vi.mock("@resvg/resvg-js", () => ({
  Resvg: vi.fn(function (this: Record<string, unknown>) {
    this.render = mockRender;
  }),
}));

import { svgToPng, stripSvgAnimations, getFontPaths, getFontBuffers } from "./svg-to-png";
import { Resvg } from "@resvg/resvg-js";

const MockResvg = vi.mocked(Resvg);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MINIMAL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect fill="red" width="100" height="50"/></svg>';

const FAKE_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes

// ---------------------------------------------------------------------------
// Tests: getFontPaths
// ---------------------------------------------------------------------------

describe("getFontPaths", () => {
  it("returns 4 TTF font file paths", () => {
    const paths = getFontPaths();
    expect(paths).toHaveLength(4);
    for (const p of paths) {
      expect(p).toMatch(/\.ttf$/);
      expect(p).toContain("/lib/render/fonts/");
    }
  });

  it("includes both Plus Jakarta Sans and JetBrains Mono", () => {
    const paths = getFontPaths();
    const names = paths.map((p) => p.split("/").pop());
    expect(names).toContain("PlusJakartaSans-Regular.ttf");
    expect(names).toContain("PlusJakartaSans-SemiBold.ttf");
    expect(names).toContain("JetBrainsMono-Regular.ttf");
    expect(names).toContain("JetBrainsMono-Bold.ttf");
  });

  it("resolves to font files that exist on disk", async () => {
    const { existsSync } = await import("node:fs");
    const paths = getFontPaths();
    for (const p of paths) {
      expect(existsSync(p), `font file should exist: ${p}`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: stripSvgAnimations (pure function — no mocks needed)
// ---------------------------------------------------------------------------

describe("stripSvgAnimations", () => {
  it("removes CSS @keyframes blocks", () => {
    const svg = `<svg><style>@keyframes fade{from{opacity:0}to{opacity:1}}</style></svg>`;
    const result = stripSvgAnimations(svg);
    expect(result).not.toContain("@keyframes");
    expect(result).toContain("<svg>");
  });

  it("removes CSS animation properties from style attributes", () => {
    const svg = `<svg><rect style="animation: fade 1s ease-in"/></svg>`;
    const result = stripSvgAnimations(svg);
    expect(result).not.toContain("animation");
  });

  it("removes self-closing SMIL <animate> elements", () => {
    const svg = `<svg><rect><animate attributeName="opacity" from="0" to="1" dur="1s"/></rect></svg>`;
    const result = stripSvgAnimations(svg);
    expect(result).not.toContain("<animate");
  });

  it("removes SMIL <animate> elements with content", () => {
    const svg = `<svg><rect><animate attributeName="opacity" from="0" to="1" dur="1s">content</animate></rect></svg>`;
    const result = stripSvgAnimations(svg);
    expect(result).not.toContain("<animate");
  });

  it("replaces opacity=\"0\" with opacity=\"1\"", () => {
    const svg = `<svg><rect opacity="0" x="10"/><rect opacity="0" x="20"/></svg>`;
    const result = stripSvgAnimations(svg);
    expect(result).not.toContain('opacity="0"');
    expect(result).toContain('opacity="1"');
  });

  it("does not modify SVG without animations", () => {
    const svg = `<svg><rect fill="blue" width="100" height="50"/></svg>`;
    const result = stripSvgAnimations(svg);
    expect(result).toBe(svg);
  });

  it("handles SVG with multiple animation types combined", () => {
    const svg = [
      '<svg><style>@keyframes pulse{from{opacity:0}to{opacity:1}}</style>',
      '<rect style="animation: pulse 2s" opacity="0"/>',
      '<animate attributeName="x" from="0" to="100" dur="1s"/>',
      "</svg>",
    ].join("");
    const result = stripSvgAnimations(svg);
    expect(result).not.toContain("@keyframes");
    expect(result).not.toContain("<animate");
    expect(result).not.toContain('opacity="0"');
    expect(result).toContain('opacity="1"');
  });
});

// ---------------------------------------------------------------------------
// Tests: svgToPng
// ---------------------------------------------------------------------------

describe("svgToPng", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAsPng.mockReturnValue(FAKE_PNG);
    mockRender.mockReturnValue({ asPng: mockAsPng });
    // Restore constructor mock — vi.clearAllMocks removes the implementation.
    // Cast needed because vi.fn() typing doesn't match `new Resvg(...)` constructor signature.
    (MockResvg as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      function (this: { render: typeof mockRender }) {
        this.render = mockRender;
      },
    );
  });

  it("returns a Uint8Array PNG buffer for valid SVG input", () => {
    const result = svgToPng(MINIMAL_SVG);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result).toBe(FAKE_PNG);
  });

  it("creates Resvg with fitTo width mode using the given width", () => {
    svgToPng(MINIMAL_SVG, 800);
    expect(MockResvg).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ fitTo: { mode: "width", value: 800 } }),
    );
  });

  it("defaults to width 1200 when no width is provided", () => {
    svgToPng(MINIMAL_SVG);
    expect(MockResvg).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ fitTo: { mode: "width", value: 1200 } }),
    );
  });

  it("passes font configuration to Resvg using pre-loaded buffers when available (PE-L3)", () => {
    svgToPng(MINIMAL_SVG);
    const opts = MockResvg.mock.calls[0]![1] as Record<string, unknown>;
    const font = opts.font as {
      loadSystemFonts: boolean;
      fontBuffers?: Buffer[];
      fontFiles?: string[];
    };
    expect(font).toBeDefined();
    expect(font.loadSystemFonts).toBe(false);
    // When font buffers were loaded at module scope (PE-L3), the route uses
    // fontBuffers. If loading failed (test sandbox without fonts), it falls
    // back to fontFiles. Either way, exactly one of the two must be present.
    const useBuffers = getFontBuffers() !== undefined;
    if (useBuffers) {
      expect(font.fontBuffers).toBeInstanceOf(Array);
      expect(font.fontBuffers!.length).toBe(4);
      expect(font.fontFiles).toBeUndefined();
    } else {
      expect(font.fontFiles).toBeInstanceOf(Array);
      expect(font.fontFiles!.length).toBe(4);
      expect(font.fontBuffers).toBeUndefined();
    }
  });

  it("fonts are read at most once across multiple svgToPng calls (PE-L3)", () => {
    // Call svgToPng three times and verify Resvg is constructed with the same
    // font config each time — no per-call disk reads (verified by stability of
    // the font option object, not by mocking readFileSync which is pre-module).
    svgToPng(MINIMAL_SVG);
    svgToPng(MINIMAL_SVG);
    svgToPng(MINIMAL_SVG);
    const useBuffers = getFontBuffers() !== undefined;
    for (const call of MockResvg.mock.calls) {
      const font = (call[1] as Record<string, unknown>).font as {
        fontBuffers?: Buffer[];
        fontFiles?: string[];
      };
      if (useBuffers) {
        expect(font.fontBuffers).toBe(getFontBuffers()); // same reference
      } else {
        expect(font.fontFiles).toBeDefined();
      }
    }
  });

  it("strips animations before passing SVG to Resvg", () => {
    const animatedSvg = `<svg><rect opacity="0"/><animate attributeName="x" from="0" to="100" dur="1s"/></svg>`;
    svgToPng(animatedSvg, 600);

    const passedSvg = MockResvg.mock.calls[0]![0] as string;
    expect(passedSvg).not.toContain("<animate");
    expect(passedSvg).not.toContain('opacity="0"');
    expect(passedSvg).toContain('opacity="1"');
  });

  it("calls render() and asPng() on the Resvg instance", () => {
    svgToPng(MINIMAL_SVG);
    expect(mockRender).toHaveBeenCalledOnce();
    expect(mockAsPng).toHaveBeenCalledOnce();
  });

  it("propagates errors from Resvg constructor", () => {
    (MockResvg as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      function () {
        throw new Error("Invalid SVG");
      },
    );
    expect(() => svgToPng("<not-svg>")).toThrow("Invalid SVG");
  });

  it("propagates errors from render()", () => {
    mockRender.mockImplementation(() => {
      throw new Error("Render failed");
    });
    expect(() => svgToPng(MINIMAL_SVG)).toThrow("Render failed");
  });
});

// ---------------------------------------------------------------------------
// Tests: font buffer load failure fallback (module-scope try/catch branch)
// ---------------------------------------------------------------------------

describe("svgToPng — font buffer load failure fallback", () => {
  it("falls back to fontFiles when readFileSync throws at module load", async () => {
    vi.resetModules();
    vi.doMock("node:fs", () => ({
      readFileSync: vi.fn(() => {
        throw new Error("ENOENT: font file missing");
      }),
    }));

    const mod = await import("./svg-to-png");
    const { Resvg: FreshResvg } = await import("@resvg/resvg-js");
    const FreshMockResvg = vi.mocked(FreshResvg);
    FreshMockResvg.mockImplementation(function (this: { render: () => unknown }) {
      this.render = () => ({ asPng: () => FAKE_PNG });
    });

    expect(mod.getFontBuffers()).toBeUndefined();

    const result = mod.svgToPng(MINIMAL_SVG);
    expect(result).toBeInstanceOf(Uint8Array);
    const font = FreshMockResvg.mock.calls.at(-1)![1]!.font as {
      loadSystemFonts: boolean;
      fontBuffers?: Buffer[];
      fontFiles?: string[];
    };
    expect(font.fontBuffers).toBeUndefined();
    expect(font.fontFiles).toBeInstanceOf(Array);
    expect(font.fontFiles!.length).toBe(4);

    vi.doUnmock("node:fs");
    vi.resetModules();
  });
});
