import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAvatarBase64 } from "./avatar";

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

    const result = await fetchAvatarBase64("https://example.com/avatar.jpg");
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it("returns undefined when fetch returns non-OK status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Not found", { status: 404 }),
    );

    const result = await fetchAvatarBase64("https://example.com/missing.png");
    expect(result).toBeUndefined();
  });

  it("returns undefined when fetch throws (network error)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    const result = await fetchAvatarBase64("https://example.com/avatar.png");
    expect(result).toBeUndefined();
  });
});
