import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockAfter, mockEnqueueCollectionJob, mockReadSourceAuthorization, mockCaptureServerError, mockRunCollectionTick } = vi.hoisted(() => ({
  mockAfter: vi.fn((cb: () => Promise<void>) => { void cb(); }),
  mockEnqueueCollectionJob: vi.fn(),
  mockReadSourceAuthorization: vi.fn(),
  mockCaptureServerError: vi.fn(),
  mockRunCollectionTick: vi.fn(),
}));

vi.mock("next/server", () => ({ after: mockAfter }));
vi.mock("@/lib/db/collection-queue", () => ({ enqueueCollectionJob: mockEnqueueCollectionJob }));
vi.mock("@/lib/platform/source-authorization", () => ({ readSourceAuthorization: mockReadSourceAuthorization }));
vi.mock("@/lib/analytics/server-errors", () => ({ captureServerError: mockCaptureServerError }));
vi.mock("./worker", () => ({ runCollectionTick: mockRunCollectionTick }));

import { enqueueCollection, scheduleCollectionAdvance } from "./enqueue";

beforeEach(() => {
  mockAfter.mockClear();
  mockEnqueueCollectionJob.mockReset().mockImplementation(async (_owner: string, provider: string) => ({ id: `job-${provider}`, provider }));
  mockReadSourceAuthorization.mockReset().mockImplementation(async (_owner: string, provider: string) =>
    provider === "github" ? { status: "authorized" } : { status: "unlinked" },
  );
  mockCaptureServerError.mockReset().mockResolvedValue(undefined);
  mockRunCollectionTick.mockReset().mockResolvedValue({ slicesRun: 0 });
});

describe("enqueueCollection", () => {
  it("enqueues only the authorized providers, github included", async () => {
    const jobs = await enqueueCollection("octocat", "signup");
    expect(mockEnqueueCollectionJob).toHaveBeenCalledTimes(1);
    expect(mockEnqueueCollectionJob).toHaveBeenCalledWith("octocat", "github", "signup", expect.any(String));
    expect(jobs).toHaveLength(1);
  });

  it("enqueues every connected provider when more than github is linked", async () => {
    mockReadSourceAuthorization.mockImplementation(async (_owner: string, provider: string) =>
      provider === "codeberg" ? { status: "disabled" } : { status: "authorized" },
    );
    const jobs = await enqueueCollection("octocat", "daily");
    const providers = jobs.map((j) => (j as { provider: string }).provider);
    expect(providers.sort()).toEqual(["bitbucket", "github", "gitlab"]);
    expect(mockEnqueueCollectionJob).not.toHaveBeenCalledWith("octocat", "codeberg", "daily", expect.any(String));
  });

  it("enqueues only the given provider when one is specified — the reconnect case", async () => {
    mockReadSourceAuthorization.mockResolvedValue({ status: "authorized" });
    const jobs = await enqueueCollection("octocat", "reconnect", "bitbucket");
    expect(mockEnqueueCollectionJob).toHaveBeenCalledTimes(1);
    expect(mockEnqueueCollectionJob).toHaveBeenCalledWith("octocat", "bitbucket", "reconnect", expect.any(String));
    expect(jobs).toHaveLength(1);
  });

  it("skips a provider whose authorization read fails, without throwing", async () => {
    mockReadSourceAuthorization.mockImplementation(async (_owner: string, provider: string) =>
      provider === "github" ? { status: "authorized" } : { status: "unavailable" },
    );
    const jobs = await enqueueCollection("octocat", "signup");
    expect(jobs).toHaveLength(1);
  });

  it("captures, and does not throw, when one provider's enqueue itself fails — other providers still enqueue", async () => {
    mockReadSourceAuthorization.mockResolvedValue({ status: "authorized" });
    mockEnqueueCollectionJob.mockImplementation(async (_owner: string, provider: string) => {
      if (provider === "gitlab") throw new Error("db unavailable");
      return { id: `job-${provider}`, provider };
    });
    const jobs = await enqueueCollection("octocat", "daily");
    const providers = jobs.map((j) => (j as { provider: string }).provider);
    expect(providers.sort()).toEqual(["bitbucket", "codeberg", "github"]);
    expect(mockCaptureServerError).toHaveBeenCalledOnce();
    const [captured] = mockCaptureServerError.mock.calls[0]!;
    expect(captured.route).toContain("collection/enqueue");
    expect((captured.error as Error).message).toContain("gitlab");
  });

  it("never enqueues for a subject with no connected providers at all", async () => {
    mockReadSourceAuthorization.mockResolvedValue({ status: "unavailable" });
    const jobs = await enqueueCollection("octocat", "signup");
    expect(jobs).toEqual([]);
    expect(mockEnqueueCollectionJob).not.toHaveBeenCalled();
  });
});

describe("scheduleCollectionAdvance", () => {
  it("registers a bounded collection tick with after(), before returning", () => {
    scheduleCollectionAdvance(30_000);
    expect(mockAfter).toHaveBeenCalledOnce();
  });

  it("runs the tick with the given budget", async () => {
    scheduleCollectionAdvance(30_000);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockRunCollectionTick).toHaveBeenCalledWith(30_000);
  });

  it("defaults to a bounded budget when none is given", async () => {
    scheduleCollectionAdvance();
    await new Promise((r) => setTimeout(r, 0));
    expect(mockRunCollectionTick).toHaveBeenCalledWith(expect.any(Number));
  });

  it("captures, rather than throws, when the tick itself fails", async () => {
    mockRunCollectionTick.mockRejectedValue(new Error("boom"));
    scheduleCollectionAdvance(30_000);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockCaptureServerError).toHaveBeenCalledOnce();
  });
});
