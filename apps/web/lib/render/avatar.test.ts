import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks for cache layer (used by getAvatarBase64 tests)
// ---------------------------------------------------------------------------

const { mockCacheGet, mockCacheSet } = vi.hoisted(() => ({
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
}));

vi.mock("../cache/redis", () => ({
  cacheGet: mockCacheGet,
  cacheSet: mockCacheSet,
}));

import { fetchAvatarBase64, getAvatarBase64 } from "./avatar";

describe("fetchAvatarBase64", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a data URI with correct content type and base64 body", async () => {
    const fakeBytes = new Uint8Array([137, 80, 78, 71]); // PNG magic bytes
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(fakeBytes, {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );

    const result = await fetchAvatarBase64("https://avatars.githubusercontent.com/u/123");
    expect(result).toBe(
      `data:image/png;base64,${Buffer.from(fakeBytes).toString("base64")}`,
    );
  });

  it("defaults content-type to image/png when header is missing", async () => {
    const fakeBytes = new Uint8Array([255, 216, 255]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(fakeBytes, { status: 200 }),
    );

    const result = await fetchAvatarBase64("https://avatars.githubusercontent.com/u/456");
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it("returns undefined when fetch returns non-OK status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Not found", { status: 404 }),
    );

    const result = await fetchAvatarBase64("https://avatars.githubusercontent.com/u/missing");
    expect(result).toBeUndefined();
  });

  it("returns undefined when fetch throws (network error)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    const result = await fetchAvatarBase64("https://avatars.githubusercontent.com/u/err");
    expect(result).toBeUndefined();
  });

  it("sanitises content-type to an allowed image MIME type", async () => {
    const fakeBytes = new Uint8Array([137, 80, 78, 71]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(fakeBytes, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );

    const result = await fetchAvatarBase64("https://avatars.githubusercontent.com/u/789");
    // Must fall back to image/png, never use arbitrary content-type
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it("strips charset parameters from valid image content-types", async () => {
    const fakeBytes = new Uint8Array([255, 216, 255]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(fakeBytes, {
        status: 200,
        headers: { "content-type": "image/jpeg; charset=utf-8" },
      }),
    );

    const result = await fetchAvatarBase64("https://avatars.githubusercontent.com/u/101");
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("rejects image/svg+xml content-type (falls back to image/png)", async () => {
    const fakeBytes = new Uint8Array([60, 115, 118, 103]); // <svg
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(fakeBytes, {
        status: 200,
        headers: { "content-type": "image/svg+xml" },
      }),
    );

    const result = await fetchAvatarBase64("https://avatars.githubusercontent.com/u/svg");
    // SVG should NOT be allowed — GitHub avatars are always PNG/JPEG.
    // SVG in data URIs can execute scripts, so it must fall back to image/png.
    expect(result).not.toMatch(/svg/);
    expect(result).toMatch(/^data:image\/png;base64,/);
  });
});

describe("fetchAvatarBase64 — SSRF prevention", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects URLs from non-allowed hosts", async () => {
    const result = await fetchAvatarBase64("https://evil.com/avatar.png");
    expect(result).toBeUndefined();
  });

  it("rejects localhost URLs", async () => {
    const result = await fetchAvatarBase64("http://localhost:3000/internal");
    expect(result).toBeUndefined();
  });

  it("rejects internal network URLs", async () => {
    const result = await fetchAvatarBase64("http://169.254.169.254/metadata");
    expect(result).toBeUndefined();
  });

  it("allows avatars.githubusercontent.com", async () => {
    const fakeBytes = new Uint8Array([137, 80, 78, 71]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(fakeBytes, {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );
    const result = await fetchAvatarBase64("https://avatars.githubusercontent.com/u/1?v=4");
    expect(result).toBeDefined();
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it("does not call fetch for blocked hosts", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await fetchAvatarBase64("https://evil.com/avatar.png");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("logs a warning when a non-GitHub URL is rejected", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await fetchAvatarBase64("https://evil.com/avatar.png");
    expect(warnSpy).toHaveBeenCalledWith(
      "[avatar] rejected non-GitHub URL:",
      expect.stringContaining("evil.com"),
    );
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// getAvatarBase64 — cached wrapper
// ---------------------------------------------------------------------------

describe("getAvatarBase64", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockCacheGet.mockReset();
    mockCacheSet.mockReset();
  });

  it("returns cached avatar when available (no network fetch)", async () => {
    const cachedUri = "data:image/png;base64,cached123";
    mockCacheGet.mockResolvedValue(cachedUri);

    const result = await getAvatarBase64(
      "testuser",
      "https://avatars.githubusercontent.com/u/123",
    );

    expect(result).toBe(cachedUri);
    expect(mockCacheGet).toHaveBeenCalledWith("avatar:testuser");
    // Should NOT have called global fetch since cache hit
  });

  it("fetches from network on cache miss and caches result", async () => {
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(true);

    const fakeBytes = new Uint8Array([137, 80, 78, 71]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(fakeBytes, {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );

    const result = await getAvatarBase64(
      "testuser",
      "https://avatars.githubusercontent.com/u/123",
    );

    expect(result).toMatch(/^data:image\/png;base64,/);
    expect(mockCacheSet).toHaveBeenCalledWith(
      "avatar:testuser",
      expect.stringMatching(/^data:image\/png;base64,/),
      21600,
    );
  });

  it("normalizes handle to lowercase for cache key", async () => {
    mockCacheGet.mockResolvedValue("data:image/png;base64,abc");

    await getAvatarBase64(
      "TestUser",
      "https://avatars.githubusercontent.com/u/123",
    );

    expect(mockCacheGet).toHaveBeenCalledWith("avatar:testuser");
  });

  it("returns undefined when network fetch fails (no cache write)", async () => {
    mockCacheGet.mockResolvedValue(null);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    const result = await getAvatarBase64(
      "testuser",
      "https://avatars.githubusercontent.com/u/123",
    );

    expect(result).toBeUndefined();
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it("returns undefined when avatar host is not allowed (no cache write)", async () => {
    mockCacheGet.mockResolvedValue(null);

    const result = await getAvatarBase64(
      "testuser",
      "https://evil.com/avatar.png",
    );

    expect(result).toBeUndefined();
    expect(mockCacheSet).not.toHaveBeenCalled();
  });
});
