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
