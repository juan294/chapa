import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consumeOauthState, issueOauthState } from "./oauth-state";

describe("oauth-state store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T00:00:00.000Z"));
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("consume returns true on first call and false on subsequent calls", async () => {
    await issueOauthState("s1");

    await expect(consumeOauthState("s1")).resolves.toBe(true);
    await expect(consumeOauthState("s1")).resolves.toBe(false);
  });

  it("expires state entries after 10 minutes", async () => {
    await issueOauthState("s2");

    await vi.advanceTimersByTimeAsync(11 * 60 * 1000);

    await expect(consumeOauthState("s2")).resolves.toBe(false);
  });
});
