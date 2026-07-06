import { describe, expect, it, vi } from "vitest";
import { bodyAsRecord, invokeJson } from "@/test/contract/invoke";

const { mockDbDeleteLinkedPlatform, mockMarkStatsDirty, mockRequireSession } =
  vi.hoisted(() => ({
    mockDbDeleteLinkedPlatform: vi.fn(async () => true),
    mockMarkStatsDirty: vi.fn(async () => undefined),
    mockRequireSession: vi.fn(() => ({
      session: { login: "octocat", name: "Octocat", avatar_url: "" },
      error: null,
    })),
  }));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

vi.mock("@/lib/db/user-platforms", () => ({
  dbDeleteLinkedPlatform: mockDbDeleteLinkedPlatform,
  dbGetLinkedPlatforms: vi.fn(async () => []),
  dbUpsertLinkedPlatform: vi.fn(async () => true),
}));

vi.mock("@/lib/cache/dirty-stats", () => ({
  markStatsDirty: mockMarkStatsDirty,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { POST } from "./route";

describe("POST /api/auth/codeberg/disconnect contract", () => {
  it("deletes the linked platform and returns the write result", async () => {
    const response = await invokeJson(POST, {
      method: "POST",
      path: "/api/auth/codeberg/disconnect",
      body: {},
    });

    expect(response.status).toBe(200);
    expect(bodyAsRecord(response).success).toBe(true);
    expect(mockDbDeleteLinkedPlatform).toHaveBeenCalledWith("octocat", "codeberg");
    expect(mockMarkStatsDirty).toHaveBeenCalledWith("octocat");
  });
});
