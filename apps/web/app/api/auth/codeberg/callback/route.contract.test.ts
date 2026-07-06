import { describe, expect, it, vi } from "vitest";
import { invokeJson } from "@/test/contract/invoke";

const { mockRequireSession } = vi.hoisted(() => ({
  mockRequireSession: vi.fn(() => ({
    session: { login: "octocat", name: "Octocat", avatar_url: "" },
    error: null,
  })),
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

import { GET } from "./route";

describe("GET /api/auth/codeberg/callback contract", () => {
  it("redirects missing OAuth code without a 5xx", async () => {
    const response = await invokeJson(GET, {
      method: "GET",
      path: "/api/auth/codeberg/callback",
    });

    expect(response.status).toBe(307);
    expect(String(response.body)).toBe("");
  });
});
