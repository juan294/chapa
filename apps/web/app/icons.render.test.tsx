import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const imageResponses = vi.hoisted(() => [] as unknown[]);

vi.mock("next/og", () => ({
  ImageResponse: vi.fn(function ImageResponseMock(
    this: { element: React.ReactNode; init: unknown },
    element: React.ReactNode,
    init: unknown,
  ) {
    this.element = element;
    this.init = init;
    imageResponses.push(this);
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Manual side-channel array, not a vi mock — vi.clearAllMocks() doesn't
  // touch it, so it needs its own reset. Without this, "renders the Apple
  // icon..." only passes when it runs second (order-dependent: it asserted
  // a cumulative count across both tests instead of its own render).
  imageResponses.length = 0;
});

describe("dynamic app icons", () => {
  it("renders the favicon ImageResponse at 32px", async () => {
    const { default: Icon, size, contentType } = await import("./icon");

    const response = Icon();

    expect(size).toEqual({ width: 32, height: 32 });
    expect(contentType).toBe("image/png");
    expect(response).toEqual(
      expect.objectContaining({ init: { width: 32, height: 32 } }),
    );
    expect(imageResponses).toHaveLength(1);
  });

  it("preserves the shield paths with ink and vermilion on both icons", async () => {
    const { default: Icon } = await import("./icon");
    const { default: AppleIcon } = await import("./apple-icon");
    for (const renderIcon of [Icon, AppleIcon]) {
      renderIcon();
      const markup = renderToStaticMarkup((imageResponses.at(-1) as {element: React.ReactNode}).element);
      expect(markup).toContain('M16 1 L29 6 L29 15 C29 23 23 29 16 31 C9 29 3 23 3 15 L3 6 Z');
      expect(markup).toContain('M10 20 L16 12 L22 20');
      expect(markup).toContain('#0C141B');
      expect(markup).toContain('#ED4930');
      expect(markup).not.toContain('#1BD093');
    }
  });

  it("renders the Apple icon ImageResponse at 180px", async () => {
    const { default: AppleIcon, size, contentType } = await import(
      "./apple-icon"
    );

    const response = AppleIcon();

    expect(size).toEqual({ width: 180, height: 180 });
    expect(contentType).toBe("image/png");
    expect(response).toEqual(
      expect.objectContaining({ init: { width: 180, height: 180 } }),
    );
    expect(imageResponses).toHaveLength(1);
  });
});
