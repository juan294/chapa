import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/cache/redis", () => ({
  pingRedis: vi.fn(),
}));

import { GET } from "./route";
import { pingRedis } from "@/lib/cache/redis";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/health", () => {
  it("returns 200 with status 'ok' when Redis is reachable", async () => {
    vi.mocked(pingRedis).mockResolvedValueOnce("ok");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.dependencies.redis).toBe("ok");
    expect(body.timestamp).toBeDefined();
    expect(body.version).toBeUndefined();
  });

  it("returns 503 with status 'degraded' when Redis ping fails", async () => {
    vi.mocked(pingRedis).mockResolvedValueOnce("error");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.dependencies.redis).toBe("error");
  });

  it("returns 503 with status 'degraded' when Redis client is null (missing env vars)", async () => {
    vi.mocked(pingRedis).mockResolvedValueOnce("unavailable");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.dependencies.redis).toBe("unavailable");
  });

  it("always returns a valid timestamp", async () => {
    vi.mocked(pingRedis).mockResolvedValueOnce("ok");

    const response = await GET();
    const body = await response.json();

    expect(() => new Date(body.timestamp)).not.toThrow();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });
});
