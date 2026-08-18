import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  ctorSpy,
  setSpy,
  getdelSpy,
} = vi.hoisted(() => ({
  ctorSpy: vi.fn(),
  setSpy: vi.fn(),
  getdelSpy: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: class MockRedis {
    constructor(options: unknown) {
      ctorSpy(options);
    }

    set = setSpy;
    getdel = getdelSpy;
  },
}));

describe("oauth-state store (redis)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    setSpy.mockResolvedValue("OK");
    getdelSpy
      .mockResolvedValueOnce("1")
      .mockResolvedValueOnce(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    // The retry test below switches to fake timers; without restoring real
    // timers here, a run where that test executes first leaves fake timers
    // active for the next test, and consumeOauthState's real setTimeout-based
    // retry `sleep()` calls never resolve — hanging until the test timeout.
    vi.useRealTimers();
  });

  it("enables read-your-writes consistency and consumes state exactly once", async () => {
    const { issueOauthState, consumeOauthState } = await import("./oauth-state");

    await issueOauthState("state-1");

    expect(ctorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://example.upstash.io",
        token: "test-token",
        readYourWrites: true,
      }),
    );
    expect(setSpy).toHaveBeenCalledWith("oauth-state:state-1", "1", { ex: 600 });

    await expect(consumeOauthState("state-1")).resolves.toBe(true);
    await expect(consumeOauthState("state-1")).resolves.toBe(false);

    expect(getdelSpy).toHaveBeenNthCalledWith(1, "oauth-state:state-1");
    expect(getdelSpy).toHaveBeenNthCalledWith(2, "oauth-state:state-1");
  });

  it("retries a brief Redis miss before rejecting the state", async () => {
    vi.useFakeTimers();
    getdelSpy.mockReset();
    getdelSpy
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("1");

    const { consumeOauthState } = await import("./oauth-state");

    const consumePromise = consumeOauthState("state-2");
    await vi.runAllTimersAsync();

    await expect(consumePromise).resolves.toBe(true);
    expect(getdelSpy).toHaveBeenCalledTimes(3);
  });
});
