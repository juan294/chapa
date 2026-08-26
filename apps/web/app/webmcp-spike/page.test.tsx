import { beforeEach, describe, expect, it, vi } from "vitest";

const mockNotFound = vi.fn();
const mockGetVercelEnv = vi.fn<() => string | undefined>();
const notFoundError = new Error("NEXT_NOT_FOUND");

vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
}));

vi.mock("@/lib/env", () => ({
  getVercelEnv: () => mockGetVercelEnv(),
}));

describe("WebMCP spike page", () => {
  beforeEach(() => {
    mockNotFound.mockReset();
    mockGetVercelEnv.mockReset();
  });

  it("is noindex and nofollow", async () => {
    const mod = await import("./page");

    expect(mod.metadata.robots).toEqual({ index: false, follow: false });
  });

  it("returns not found in production", async () => {
    mockGetVercelEnv.mockReturnValue("production");
    mockNotFound.mockImplementation(() => {
      throw notFoundError;
    });
    const mod = await import("./page");

    expect(() => mod.default()).toThrow(notFoundError);

    expect(mockNotFound).toHaveBeenCalledOnce();
  });

  it("renders in preview deployments", async () => {
    mockGetVercelEnv.mockReturnValue("preview");
    const mod = await import("./page");

    expect(mod.default()).toBeTruthy();
    expect(mockNotFound).not.toHaveBeenCalled();
  });
});
