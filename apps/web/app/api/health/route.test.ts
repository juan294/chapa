import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/cache/redis", () => ({
  pingRedis: vi.fn(),
}));

vi.mock("@/lib/db/supabase", () => ({
  pingSupabase: vi.fn(),
}));

import { GET } from "./route";
import { pingRedis } from "@/lib/cache/redis";
import { pingSupabase } from "@/lib/db/supabase";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/health", () => {
  it("returns 200 with status 'ok' when both Redis and Supabase are reachable", async () => {
    vi.mocked(pingRedis).mockResolvedValueOnce("ok");
    vi.mocked(pingSupabase).mockResolvedValueOnce("ok");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.dependencies.redis).toBe("ok");
    expect(body.dependencies.supabase).toBe("ok");
    expect(body.timestamp).toBeDefined();
    expect(body.version).toBeUndefined();
  });

  it("returns 503 with status 'degraded' when Redis ping fails", async () => {
    vi.mocked(pingRedis).mockResolvedValueOnce("error");
    vi.mocked(pingSupabase).mockResolvedValueOnce("ok");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.dependencies.redis).toBe("error");
    expect(body.dependencies.supabase).toBe("ok");
  });

  it("returns 503 with status 'degraded' when Redis client is null (missing env vars)", async () => {
    vi.mocked(pingRedis).mockResolvedValueOnce("unavailable");
    vi.mocked(pingSupabase).mockResolvedValueOnce("ok");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.dependencies.redis).toBe("unavailable");
  });

  it("returns 503 with status 'degraded' when Supabase is unavailable", async () => {
    vi.mocked(pingRedis).mockResolvedValueOnce("ok");
    vi.mocked(pingSupabase).mockResolvedValueOnce("unavailable");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.dependencies.redis).toBe("ok");
    expect(body.dependencies.supabase).toBe("unavailable");
  });

  it("returns 503 with status 'degraded' when Supabase errors", async () => {
    vi.mocked(pingRedis).mockResolvedValueOnce("ok");
    vi.mocked(pingSupabase).mockResolvedValueOnce("error");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.dependencies.redis).toBe("ok");
    expect(body.dependencies.supabase).toBe("error");
  });

  it("returns 503 with status 'degraded' when both Redis and Supabase fail", async () => {
    vi.mocked(pingRedis).mockResolvedValueOnce("error");
    vi.mocked(pingSupabase).mockResolvedValueOnce("error");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.dependencies.redis).toBe("error");
    expect(body.dependencies.supabase).toBe("error");
  });

  it("always returns a valid timestamp", async () => {
    vi.mocked(pingRedis).mockResolvedValueOnce("ok");
    vi.mocked(pingSupabase).mockResolvedValueOnce("ok");

    const response = await GET();
    const body = await response.json();

    expect(() => new Date(body.timestamp)).not.toThrow();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });
});
