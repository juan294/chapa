import { describe, it, expect, vi, beforeEach } from "vitest";
import { withTimeout, TimeoutError } from "@/lib/async/with-timeout";

// ---------------------------------------------------------------------------
// Mock @resvg/resvg-js BEFORE importing the module under test.
// vi.hoisted() ensures these are available inside the vi.mock factory.
//
// PE-M5 (#1090): svgToPng now uses resvg-js's `renderAsync` — a genuinely
// async native binding offloaded to libuv's threadpool — instead of the
// synchronous `Resvg.render()`, so the OG-image route's `withTimeout` can
// actually interrupt a slow rasterization instead of the timeout branch
// being dead code.
// ---------------------------------------------------------------------------

const { mockAsPng, mockRenderAsync } = vi.hoisted(() => ({
  mockAsPng: vi.fn(),
  mockRenderAsync: vi.fn(),
}));

vi.mock("@resvg/resvg-js", () => ({
  renderAsync: mockRenderAsync,
}));

const { mockCaptureServerError } = vi.hoisted(() => ({
  mockCaptureServerError: vi.fn(async () => {}),
}));
vi.mock("@/lib/analytics/server-errors", () => ({
  captureServerError: mockCaptureServerError,
}));

import { svgToPng, stripSvgAnimations, getFontPaths, getFontBuffers } from "./svg-to-png";

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

  // #1168 UX-M6 (critical note) — the original regex
  // (/@keyframes[^}]*\{[^}]*\{[^}]*\}[^}]*\}/) only consumes exactly 2 levels
  // of nested braces. A @keyframes block with 2+ percentage/from-to rules (the
  // real badge's pulse-glow has "0%, 100% {...}" AND "50% {...}") closes its
  // own outer brace UNCONSUMED, leaving a stray "}" right before whatever
  // follows — here, the new prefers-reduced-motion @media block added for
  // #1168. Verified against real (non-mocked) resvg rendering: the stray
  // brace doesn't visibly break rasterization, but it's a latent parsing
  // fragility this test closes.
  it("fully consumes a @keyframes block with 2+ inner rules, leaving no stray closing brace", () => {
    const css = [
      "@keyframes pulse-glow {",
      "  0%, 100% { opacity: 0.7; }",
      "  50% { opacity: 1; }",
      "}",
      "@media (prefers-reduced-motion: reduce) {",
      "  .badge-score-pulse { animation: none; }",
      "}",
    ].join("\n");
    const svg = `<svg><style>${css}</style></svg>`;
    const result = stripSvgAnimations(svg);
    expect(result).not.toContain("@keyframes");
    // No stray "}" sitting between the stripped keyframes and the @media block.
    expect(result).not.toMatch(/\}\s*@media/);
    // The @media block itself must survive fully intact and brace-balanced.
    expect(result).toContain("@media (prefers-reduced-motion: reduce)");
    expect(result).toContain(".badge-score-pulse");
    const openBraces = (result.match(/\{/g) ?? []).length;
    const closeBraces = (result.match(/\}/g) ?? []).length;
    expect(openBraces).toBe(closeBraces);
  });

  it("fully consumes multiple consecutive @keyframes blocks with no stray braces between them", () => {
    const css = [
      "@keyframes pulse-glow {",
      "  0%, 100% { opacity: 0.7; }",
      "  50% { opacity: 1; }",
      "}",
      "@keyframes ring-draw {",
      "  from { stroke-dashoffset: 289.03; }",
      "  to   { stroke-dashoffset: 75.15; }",
      "}",
      ".other-rule { color: red; }",
    ].join("\n");
    const svg = `<svg><style>${css}</style></svg>`;
    const result = stripSvgAnimations(svg);
    expect(result).not.toContain("@keyframes");
    expect(result).toContain(".other-rule { color: red; }");
    const openBraces = (result.match(/\{/g) ?? []).length;
    const closeBraces = (result.match(/\}/g) ?? []).length;
    expect(openBraces).toBe(closeBraces);
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
    mockRenderAsync.mockResolvedValue({ asPng: mockAsPng });
  });

  it("returns a Promise resolving to a Uint8Array PNG buffer for valid SVG input", async () => {
    const result = await svgToPng(MINIMAL_SVG);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result).toBe(FAKE_PNG);
  });

  it("calls renderAsync with fitTo width mode using the given width", async () => {
    await svgToPng(MINIMAL_SVG, 800);
    expect(mockRenderAsync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ fitTo: { mode: "width", value: 800 } }),
    );
  });

  it("defaults to width 1200 when no width is provided", async () => {
    await svgToPng(MINIMAL_SVG);
    expect(mockRenderAsync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ fitTo: { mode: "width", value: 1200 } }),
    );
  });

  it("passes font configuration to renderAsync using pre-loaded buffers when available (PE-L3)", async () => {
    await svgToPng(MINIMAL_SVG);
    const opts = mockRenderAsync.mock.calls[0]![1] as Record<string, unknown>;
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

  it("fonts are read at most once across multiple svgToPng calls (PE-L3)", async () => {
    // Call svgToPng three times and verify renderAsync is invoked with the
    // same font config each time — no per-call disk reads (verified by
    // stability of the font option object, not by mocking readFileSync
    // which is pre-module).
    await svgToPng(MINIMAL_SVG);
    await svgToPng(MINIMAL_SVG);
    await svgToPng(MINIMAL_SVG);
    const useBuffers = getFontBuffers() !== undefined;
    for (const call of mockRenderAsync.mock.calls) {
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

  it("strips animations before passing SVG to renderAsync", async () => {
    const animatedSvg = `<svg><rect opacity="0"/><animate attributeName="x" from="0" to="100" dur="1s"/></svg>`;
    await svgToPng(animatedSvg, 600);

    const passedSvg = mockRenderAsync.mock.calls[0]![0] as string;
    expect(passedSvg).not.toContain("<animate");
    expect(passedSvg).not.toContain('opacity="0"');
    expect(passedSvg).toContain('opacity="1"');
  });

  it("calls renderAsync() and asPng() on the resolved image", async () => {
    await svgToPng(MINIMAL_SVG);
    expect(mockRenderAsync).toHaveBeenCalledOnce();
    expect(mockAsPng).toHaveBeenCalledOnce();
  });

  it("propagates errors from renderAsync", async () => {
    mockRenderAsync.mockRejectedValue(new Error("Invalid SVG"));
    await expect(svgToPng("<not-svg>")).rejects.toThrow("Invalid SVG");
  });

  it("propagates errors from asPng()", async () => {
    mockAsPng.mockImplementation(() => {
      throw new Error("Render failed");
    });
    await expect(svgToPng(MINIMAL_SVG)).rejects.toThrow("Render failed");
  });
});

// ---------------------------------------------------------------------------
// Tests: event-loop non-blocking behavior (#1090 / PE-M5)
//
// The core regression this issue targets: the OLD synchronous `Resvg.render()`
// call ran the entire rasterization on the JS main thread with no yield
// point. `withTimeout` races the wrapped promise against a `setTimeout`
// macrotask — but a macrotask can never be serviced while a synchronous
// call is still running, so the timeout branch was unreachable dead code.
//
// `renderAsync` returns a genuinely pending Promise (backed by napi-rs's
// libuv threadpool offload), so a slow rasterization can actually be
// interrupted by `withTimeout`. These tests would fail against the old
// synchronous implementation, because `svgToPng` would resolve immediately
// (synchronously) regardless of how long the mocked renderAsync claims to
// take, and `withTimeout`'s race would never reject.
// ---------------------------------------------------------------------------

describe("svgToPng — non-blocking rasterization (#1090)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAsPng.mockReturnValue(FAKE_PNG);
  });

  it("allows withTimeout to actually fire when rasterization exceeds the budget", async () => {
    mockRenderAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ asPng: mockAsPng }), 100);
        }),
    );

    await expect(
      withTimeout(svgToPng(MINIMAL_SVG), 20, "svgToPng"),
    ).rejects.toThrow(TimeoutError);
  });

  it("does not resolve before the underlying async render settles", async () => {
    mockRenderAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ asPng: mockAsPng }), 30);
        }),
    );

    const settled = { done: false };
    const pngPromise = svgToPng(MINIMAL_SVG).then((result) => {
      settled.done = true;
      return result;
    });

    // A concurrent timer scheduled after svgToPng is called must still be
    // able to run while rasterization is in flight — proving the call does
    // not block the event loop synchronously.
    let concurrentTimerRan = false;
    setTimeout(() => {
      concurrentTimerRan = true;
    }, 5);

    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(concurrentTimerRan).toBe(true);
    expect(settled.done).toBe(false);

    const result = await pngPromise;
    expect(result).toBe(FAKE_PNG);
    expect(settled.done).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: font buffer load failure fallback (module-scope try/catch branch)
// ---------------------------------------------------------------------------

describe("svgToPng — font buffer load failure fallback", () => {
  it("falls back to fontFiles when readFileSync throws at module load", async () => {
    vi.resetModules();
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => true),
      readFileSync: vi.fn(() => {
        throw new Error("ENOENT: font file missing");
      }),
    }));

    const mod = await import("./svg-to-png");
    const { renderAsync: freshRenderAsync } = await import("@resvg/resvg-js");
    const freshMockRenderAsync = vi.mocked(freshRenderAsync);
    freshMockRenderAsync.mockResolvedValue({ asPng: () => FAKE_PNG } as never);

    expect(mod.getFontBuffers()).toBeUndefined();

    const result = await mod.svgToPng(MINIMAL_SVG);
    expect(result).toBeInstanceOf(Uint8Array);
    const font = freshMockRenderAsync.mock.calls.at(-1)![1]!.font as {
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

  // #1275 — the failure used to be silent. It is now captured once per
  // module instance, with the underlying read error, and never more than once.
  it("captures the font load failure once, and asks resvg to log font warnings", async () => {
    vi.resetModules();
    mockCaptureServerError.mockClear();
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(() => true),
      readFileSync: vi.fn(() => {
        throw new Error("ENOENT: font file missing");
      }),
    }));

    const mod = await import("./svg-to-png");
    const { renderAsync: freshRenderAsync } = await import("@resvg/resvg-js");
    const freshMockRenderAsync = vi.mocked(freshRenderAsync);
    freshMockRenderAsync.mockResolvedValue({ asPng: () => FAKE_PNG } as never);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await mod.svgToPng(MINIMAL_SVG);
    await mod.svgToPng(MINIMAL_SVG);

    expect(mockCaptureServerError).toHaveBeenCalledTimes(1);
    expect(mockCaptureServerError).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "lib/render/svg-to-png",
        statusCode: 500,
        error: expect.objectContaining({ message: expect.stringContaining("ENOENT") }),
      }),
    );
    expect(consoleError).toHaveBeenCalledTimes(1);
    const opts = freshMockRenderAsync.mock.calls.at(-1)![1] as { logLevel?: string };
    expect(opts.logLevel).toBe("warn");

    consoleError.mockRestore();
    vi.doUnmock("node:fs");
    vi.resetModules();
  });

  it("does not capture anything when the fonts loaded", async () => {
    mockCaptureServerError.mockClear();
    await svgToPng(MINIMAL_SVG);
    expect(mockCaptureServerError).not.toHaveBeenCalled();
    const opts = mockRenderAsync.mock.calls.at(-1)![1] as { logLevel?: string };
    expect(opts.logLevel).toBe("warn");
  });
});
