import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCaptureServerError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/server-errors", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics/server-errors")>()),
  captureServerError: (...args: unknown[]) => mockCaptureServerError(...args),
}));
const mockReadSourceAuthorization = vi.hoisted(() => vi.fn());
vi.mock("@/lib/platform/source-authorization", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/platform/source-authorization")>()),
  readSourceAuthorization: (...args: unknown[]) => mockReadSourceAuthorization(...args),
}));

import { resolveCredential } from "./worker";

beforeEach(() => { vi.clearAllMocks(); });

describe("resolveCredential", () => {
  // Production, 2026-09-24: 23 jobs failed as not_accessible and the real
  // exception was swallowed, so the cause was invisible without reading rows.
  it("captures the underlying error before reporting not_accessible", async () => {
    mockReadSourceAuthorization.mockRejectedValue(new Error("Invalid scoring window ghp_secret123"));
    await expect(resolveCredential("octocat", "github", "2026-09-24T09:13:45.123Z")).resolves.toEqual({ status: "not_accessible" });
    expect(mockCaptureServerError).toHaveBeenCalledTimes(1);
    const captured = mockCaptureServerError.mock.calls[0]![0] as { route: string; error: Error };
    expect(captured.route).toBe("lib/collection/worker:resolveCredential");
    expect(captured.error.message).toContain("octocat/github");
    expect(captured.error.message).toContain("Invalid scoring window");
  });

  it("does not capture an ordinary unauthorized result", async () => {
    mockReadSourceAuthorization.mockResolvedValue({ status: "unlinked" });
    await expect(resolveCredential("octocat", "gitlab", "2026-09-24T09:13:45.123Z")).resolves.toEqual({ status: "not_accessible" });
    expect(mockCaptureServerError).not.toHaveBeenCalled();
  });
});
