import { beforeEach, describe, expect, it } from "vitest";
import { cacheSet } from "@/lib/cache/redis";
import { bodyAsRecord, invokeJson } from "@/test/contract/invoke";
import { redisFake } from "@/test/contract/redis-fake";

import { GET } from "./route";

describe("GET /api/cli/auth/poll contract", () => {
  beforeEach(() => {
    redisFake.__reset();
  });

  it("rejects malformed session IDs as user input", async () => {
    const response = await invokeJson(GET, {
      method: "GET",
      path: "/api/cli/auth/poll?session=not-a-uuid",
    });

    expect(response.status).toBe(400);
    expect(bodyAsRecord(response).error).toBe("Invalid session ID");
  });

  it("creates a pending device session on first poll", async () => {
    const response = await invokeJson(GET, {
      method: "GET",
      path: "/api/cli/auth/poll?session=1feae8e3-6bc0-47da-84aa-0e24e2510454",
    });

    expect(response.status).toBe(200);
    expect(bodyAsRecord(response).status).toBe("pending");
    expect(typeof bodyAsRecord(response).device_code).toBe("string");
  });

  it("fails closed when the pending device session cannot be stored", async () => {
    redisFake.__failNext("cacheSet");

    const response = await invokeJson(GET, {
      method: "GET",
      path: "/api/cli/auth/poll?session=3feae8e3-6bc0-47da-84aa-0e24e2510454",
    });

    expect(response.status).toBe(503);
    expect(bodyAsRecord(response).error).toMatch(/temporarily unavailable/i);
    expect(bodyAsRecord(response).device_code).toBeUndefined();
  });

  it("fails closed when device confirmation cannot be stored", async () => {
    const sessionId = "4feae8e3-6bc0-47da-84aa-0e24e2510454";
    const deviceCode = "contract-device-code-abc123";
    await cacheSet(
      `cli:device:${sessionId}`,
      { status: "approved", handle: "octocat", deviceCode },
      300,
    );
    redisFake.__failNext("cacheMergeJson");

    const response = await invokeJson(GET, {
      method: "GET",
      path: `/api/cli/auth/poll?session=${sessionId}&device_code=${deviceCode}`,
    });

    expect(response.status).toBe(503);
    expect(bodyAsRecord(response).error).toMatch(/temporarily unavailable/i);
    expect(bodyAsRecord(response).token).toBeUndefined();
    expect(await redisFake.cacheGet(`cli:device:${sessionId}`)).toEqual({
      status: "approved",
      handle: "octocat",
      deviceCode,
    });
  });

  it("redeems an approved device session once", async () => {
    await cacheSet(
      "cli:device:2feae8e3-6bc0-47da-84aa-0e24e2510454",
      { status: "approved", handle: "octocat" },
      300,
    );

    const response = await invokeJson(GET, {
      method: "GET",
      path: "/api/cli/auth/poll?session=2feae8e3-6bc0-47da-84aa-0e24e2510454",
    });

    const body = bodyAsRecord(response);
    expect(response.status).toBe(200);
    expect(body.status).toBe("approved");
    expect(body.handle).toBe("octocat");
    expect(typeof body.token).toBe("string");
  });
});
