import { describe, it, expect, vi } from "vitest";

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

describe("dynamic app icons", () => {
  it("renders the favicon ImageResponse at 32px", async () => {
    const { default: Icon, size, contentType } = await import("./icon");

    const response = Icon();

    expect(size).toEqual({ width: 32, height: 32 });
    expect(contentType).toBe("image/png");
    expect(response).toEqual(
      expect.objectContaining({ init: { width: 32, height: 32 } }),
    );
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
    expect(imageResponses).toHaveLength(2);
  });
});
