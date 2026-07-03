import { describe, expect, it, vi } from "vitest";
import { declareField, generatePayloads, runMatrix } from "@/test/contract/payload-matrix";
import { bodyAsRecord, invokeJson } from "@/test/contract/invoke";

const { mockRequireSession } = vi.hoisted(() => ({
  mockRequireSession: vi.fn(() => ({
    session: { login: "octocat", name: "Octocat", avatar_url: "" },
    error: null,
  })),
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

import { POST } from "./route";

describe("POST /api/cli/auth/approve contract", () => {
  it("runs the approval payload matrix with zero 5xx", async () => {
    const fields = [
      declareField("sessionId", {
        candidates: [
          "1feae8e3-6bc0-47da-84aa-0e24e2510454",
          "not-a-uuid",
          "",
        ],
        includeAbsent: true,
        includeNull: true,
        typical: "1feae8e3-6bc0-47da-84aa-0e24e2510454",
      }),
    ];
    const payloads = generatePayloads({ fields, seed: 0xa991, randomCount: 20 });

    await runMatrix(
      payloads,
      (payload) =>
        invokeJson(POST, {
          method: "POST",
          path: "/api/cli/auth/approve",
          body: payload,
        }),
      { allowedStatuses: [400] },
    );
  });

  it("returns 400 for a top-level null JSON body", async () => {
    const response = await invokeJson(POST, {
      method: "POST",
      path: "/api/cli/auth/approve",
      body: "null",
    });

    expect(response.status).toBe(400);
    expect(bodyAsRecord(response).error).toBe("Invalid JSON");
  });
});
