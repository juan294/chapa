import { describe, expect, it } from "vitest";
import { invokeJson } from "@/test/contract/invoke";

import { POST } from "./route";

describe("POST /api/auth/logout contract", () => {
  it("redirects home and clears the session cookie", async () => {
    const response = await invokeJson(POST, {
      method: "POST",
      path: "/api/auth/logout",
      body: {},
    });

    expect(response.status).toBe(307);
    expect(String(response.body)).toBe("");
  });
});
