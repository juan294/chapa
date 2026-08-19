import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAvatarBase64 } = vi.hoisted(() => ({
  mockGetAvatarBase64: vi.fn(),
}));

vi.mock("./avatar", () => ({
  getAvatarBase64: (...args: unknown[]) => mockGetAvatarBase64(...args),
}));

import { resolveBadgeAvatar } from "./avatar-outcome";

describe("resolveBadgeAvatar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("distinguishes resolved, definitive absence, missing URL, and transient failure", async () => {
    mockGetAvatarBase64.mockResolvedValueOnce("data:image/png;base64,abc");
    await expect(resolveBadgeAvatar("alice", "https://example.com/avatar.png")).resolves.toEqual({
      status: "resolved",
      dataUri: "data:image/png;base64,abc",
    });

    mockGetAvatarBase64.mockResolvedValueOnce(undefined);
    await expect(resolveBadgeAvatar("alice", "https://example.com/missing.png")).resolves.toEqual({
      status: "definitive-absence",
    });

    await expect(resolveBadgeAvatar("alice", undefined)).resolves.toEqual({ status: "missing-url" });

    mockGetAvatarBase64.mockRejectedValueOnce(new Error("503"));
    await expect(resolveBadgeAvatar("alice", "https://example.com/avatar.png")).resolves.toEqual({
      status: "transient-failure",
    });
  });

  it("reports a deadline timeout separately", async () => {
    vi.useFakeTimers();
    mockGetAvatarBase64.mockReturnValue(new Promise(() => undefined));
    try {
      const outcome = resolveBadgeAvatar("alice", "https://example.com/avatar.png", {
        deadlineMs: 250,
      });
      await vi.advanceTimersByTimeAsync(250);
      await expect(outcome).resolves.toEqual({ status: "timeout" });
    } finally {
      vi.useRealTimers();
    }
  });
});
