import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockDbGetLinkedPlatform,
  mockDbUpsertLinkedPlatform,
} = vi.hoisted(() => ({
  mockDbGetLinkedPlatform: vi.fn(),
  mockDbUpsertLinkedPlatform: vi.fn(),
}));

vi.mock("@/lib/db/user-platforms", () => ({
  dbGetLinkedPlatform: mockDbGetLinkedPlatform,
  dbUpsertLinkedPlatform: mockDbUpsertLinkedPlatform,
}));

import {
  getSessionGitHubToken,
  getStoredGitHubToken,
  storeGitHubToken,
} from "./github-session-token";

describe("github-session-token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the GitHub token from the linked-platform store", async () => {
    mockDbGetLinkedPlatform.mockResolvedValue({
      remoteLogin: "octocat",
      tokens: {
        accessToken: "gho_stored",
        refreshToken: null,
        expiresAt: null,
      },
    });

    await expect(getStoredGitHubToken("octocat")).resolves.toBe("gho_stored");
    expect(mockDbGetLinkedPlatform).toHaveBeenCalledWith("octocat", "github");
  });

  it("returns null when no GitHub token is stored", async () => {
    mockDbGetLinkedPlatform.mockResolvedValue(null);
    await expect(getStoredGitHubToken("octocat")).resolves.toBeNull();
  });

  it("prefers the legacy session token when one is already present", async () => {
    await expect(
      getSessionGitHubToken({
        login: "octocat",
        token: "gho_cookie",
      }),
    ).resolves.toBe("gho_cookie");
    expect(mockDbGetLinkedPlatform).not.toHaveBeenCalled();
  });

  it("stores GitHub tokens server-side under the github platform key", async () => {
    mockDbUpsertLinkedPlatform.mockResolvedValue(true);

    await expect(storeGitHubToken("octocat", "gho_new")).resolves.toBe(true);
    expect(mockDbUpsertLinkedPlatform).toHaveBeenCalledWith(
      "octocat",
      "github",
      "octocat",
      "gho_new",
      null,
      null,
    );
  });
});
