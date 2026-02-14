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

import { svgToPng, stripSvgAnimations } from "./svg-to-png";
import { Resvg } from "@resvg/resvg-js";

const MockResvg = vi.mocked(Resvg);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MINIMAL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect fill="red" width="100" height="50"/></svg>';

const FAKE_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes

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
      { fitTo: { mode: "width", value: 800 } },
    );
  });

  it("defaults to width 1200 when no width is provided", () => {
    svgToPng(MINIMAL_SVG);
    expect(MockResvg).toHaveBeenCalledWith(
      expect.any(String),
      { fitTo: { mode: "width", value: 1200 } },
    );
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
