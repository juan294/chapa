import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("oauth-state store", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T00:00:00.000Z"));
    vi.stubEnv("UPSTASH_REDIS_REST_URL", undefined);
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.doUnmock("@upstash/redis");
  });

  describe("in-memory fallback (no Redis configured)", () => {
    it("consume returns true on first call and false on subsequent calls", async () => {
      const { issueOauthState, consumeOauthState } = await import("./oauth-state");
      await issueOauthState("s1");

      await expect(consumeOauthState("s1")).resolves.toBe(true);
      await expect(consumeOauthState("s1")).resolves.toBe(false);
    });

    it("expires state entries after 10 minutes", async () => {
      const { issueOauthState, consumeOauthState } = await import("./oauth-state");
      await issueOauthState("s2");

      await vi.advanceTimersByTimeAsync(11 * 60 * 1000);

      await expect(consumeOauthState("s2")).resolves.toBe(false);
    });
  });

  // Regression for production incident 2026-05-01:
  // Upstash Redis client auto-deserializes the stored literal `"1"` as the
  // JSON number `1`, so the previous strict equality (`existed === "1"`) was
  // always false on the first consume → every fresh login returned 400
  // state_already_used. The fix disables auto-deserialization for the OAuth
  // state client (or accepts both shapes). This test pins down both behaviours.
  describe("Upstash deserializes stored \"1\" — accept what the client returns", () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    it("consume returns true when getdel returns the string \"1\"", async () => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");

      const setMock = vi.fn().mockResolvedValue("OK");
      const getdelMock = vi.fn().mockResolvedValueOnce("1");
      class FakeRedis {
        set = setMock;
        getdel = getdelMock;
      }
      vi.doMock("@upstash/redis", () => ({ Redis: FakeRedis }));

      const { issueOauthState, consumeOauthState } = await import("./oauth-state");
      await issueOauthState("string-state");
      await expect(consumeOauthState("string-state")).resolves.toBe(true);
    });

    it("consume returns true when getdel returns the number 1 (real Upstash behaviour)", async () => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");

      const setMock = vi.fn().mockResolvedValue("OK");
      // Upstash auto-parses the JSON-shaped string "1" into the number 1.
      // This was confirmed against production Redis on 2026-05-01.
      const getdelMock = vi.fn().mockResolvedValueOnce(1);
      class FakeRedis {
        set = setMock;
        getdel = getdelMock;
      }
      vi.doMock("@upstash/redis", () => ({ Redis: FakeRedis }));

      const { issueOauthState, consumeOauthState } = await import("./oauth-state");
      await issueOauthState("number-state");
      await expect(consumeOauthState("number-state")).resolves.toBe(true);
    });

    it("consume returns false when getdel returns null (genuine miss / replay)", async () => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");

      const setMock = vi.fn().mockResolvedValue("OK");
      const getdelMock = vi.fn().mockResolvedValue(null);
      class FakeRedis {
        set = setMock;
        getdel = getdelMock;
      }
      vi.doMock("@upstash/redis", () => ({ Redis: FakeRedis }));

      const { issueOauthState, consumeOauthState } = await import("./oauth-state");
      await issueOauthState("missing-state");
      await expect(consumeOauthState("missing-state")).resolves.toBe(false);
    });
  });
});
