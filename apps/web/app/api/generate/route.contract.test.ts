import { describe, expect, it, vi } from "vitest";
import { declareField, generatePayloads, runMatrix } from "@/test/contract/payload-matrix";
import { bodyAsRecord, invokeJson } from "@/test/contract/invoke";

const {
  mockComputeImpactV6,
  mockGetSessionGitHubToken,
  mockGetStats,
  mockRequireSession,
} = vi.hoisted(() => ({
  mockComputeImpactV6: vi.fn(() => ({ archetype: "Builder" })),
  mockGetSessionGitHubToken: vi.fn(async () => "ghp_contract"),
  mockGetStats: vi.fn(async () => ({ handle: "octocat", commitsTotal: 12 })),
  mockRequireSession: vi.fn(() => ({
    session: { login: "octocat", name: "Octocat", avatar_url: "" },
    error: null,
  })),
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

vi.mock("@/lib/auth/github-session-token", () => ({
  getSessionGitHubToken: mockGetSessionGitHubToken,
}));

vi.mock("@/lib/github/client", () => ({
  getStats: mockGetStats,
}));

vi.mock("@/lib/impact/v6", () => ({
  computeImpactV6: mockComputeImpactV6,
}));

import { POST } from "./route";

describe("POST /api/generate contract", () => {
  it("runs ignored-body payload variants with zero 5xx", async () => {
    const payloads = generatePayloads({
      fields: [
        declareField("ignored", {
          candidates: ["value", 1, { nested: true }],
          includeAbsent: true,
          includeNull: true,
          typical: "value",
        }),
      ],
      seed: 0x6e,
      randomCount: 12,
    });

    await runMatrix(payloads, (payload) =>
      invokeJson(POST, {
        method: "POST",
        path: "/api/generate",
        body: payload,
      }),
    );
  });

  it("returns success for an authenticated user with a stored GitHub token", async () => {
    const response = await invokeJson(POST, {
      method: "POST",
      path: "/api/generate",
      body: {},
    });

    expect(response.status).toBe(200);
    expect(bodyAsRecord(response)).toMatchObject({ success: true, handle: "octocat" });
    expect(mockGetStats).toHaveBeenCalledWith("octocat", "ghp_contract");
    expect(mockComputeImpactV6).toHaveBeenCalled();
  });
});
