import { describe, expect, it, vi } from "vitest";
import { declareField, generatePayloads, runMatrix } from "@/test/contract/payload-matrix";
import { bodyAsRecord, invokeJson } from "@/test/contract/invoke";

const { mockRequireSession, mockSendChallengeEmail } = vi.hoisted(() => ({
  mockRequireSession: vi.fn(() => ({
    session: { login: "octocat", name: "Octocat", avatar_url: "" },
    error: null,
  })),
  mockSendChallengeEmail: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

vi.mock("@/lib/email/challenge", () => ({
  sendChallengeEmail: mockSendChallengeEmail,
}));

import { POST } from "./route";

describe("POST /api/challenge contract", () => {
  it("runs the challenge payload matrix with zero 5xx", async () => {
    const validReason =
      "My delivery score seems off because several merged pull requests are missing.";
    const fields = [
      declareField("handle", {
        candidates: ["octocat", "OctoCat", "someone-else", "-bad", ""],
        includeAbsent: true,
        includeNull: true,
        typical: "octocat",
      }),
      declareField("reason", {
        candidates: [validReason, "short", "a".repeat(1001), ""],
        includeAbsent: true,
        includeNull: true,
        typical: validReason,
      }),
    ];
    const payloads = generatePayloads({ fields, seed: 0xc4a11, randomCount: 40 });

    await runMatrix(
      payloads,
      (payload) =>
        invokeJson(POST, {
          method: "POST",
          path: "/api/challenge",
          body: payload,
        }),
      { allowedStatuses: [400, 403] },
    );
  });

  it("accepts a valid challenge submission", async () => {
    const response = await invokeJson(POST, {
      method: "POST",
      path: "/api/challenge",
      body: {
        handle: "octocat",
        reason: "My delivery score seems off because all merged PRs are missing.",
      },
    });

    expect(response.status).toBe(200);
    expect(bodyAsRecord(response).success).toBe(true);
    expect(mockSendChallengeEmail).toHaveBeenCalledWith(
      "octocat",
      "My delivery score seems off because all merged PRs are missing.",
    );
  });
});
