import { describe, expect, it } from "vitest";
import { invokeJson } from "@/test/contract/invoke";

import { GET } from "./route";

describe("GET /api/auth/callback contract", () => {
  it("redirects missing OAuth code without a 5xx", async () => {
    const response = await invokeJson(GET, {
      method: "GET",
      path: "/api/auth/callback",
    });

    expect(response.status).toBe(307);
    expect(String(response.body)).toBe("");
  });
});
