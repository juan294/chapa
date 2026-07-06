import { describe, expect, it } from "vitest";
import { cacheSet } from "@/lib/cache/redis";
import { bodyAsRecord, invokeJson } from "@/test/contract/invoke";

import { GET } from "./route";

describe("GET /api/cli/auth/poll contract", () => {
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
