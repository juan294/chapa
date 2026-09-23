import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./source-authorization", () => ({ readSourceAuthorization: vi.fn() }));

import { findUnusableSourceLinks } from "./source-diagnostics";
import { readSourceAuthorization, type SourceAuthorization, type SourceProvider } from "./source-authorization";

const mockRead = vi.mocked(readSourceAuthorization);

function link(expiresAt: Date | null): Extract<SourceAuthorization, { status: "authorized" }> {
  return {
    status: "authorized",
    subjectVersion: "legacy-unpublished",
    link: {
      id: "3f1a2b4c-1111-2222-3333-444455556666",
      updatedAt: "2026-09-06T00:00:00.000Z",
      handle: "juan294",
      platform: "bitbucket",
      remoteLogin: "juan294",
      tokens: { accessToken: "at", refreshToken: "rt", expiresAt },
    },
  };
}

function byProvider(map: Partial<Record<SourceProvider, SourceAuthorization>>) {
  mockRead.mockImplementation(async (_owner, provider) => map[provider] ?? { status: "unlinked" });
}

describe("findUnusableSourceLinks", () => {
  beforeEach(() => vi.resetAllMocks());

  it("reports nothing when no platform is connected", async () => {
    byProvider({});
    await expect(findUnusableSourceLinks("juan294")).resolves.toEqual([]);
  });

  it("treats a live token as usable", async () => {
    byProvider({ gitlab: link(new Date(Date.now() + 3_600_000)) });
    await expect(findUnusableSourceLinks("juan294")).resolves.toEqual([]);
  });

  it("names a connected platform whose token has expired", async () => {
    byProvider({ bitbucket: link(new Date(Date.now() - 1000)), gitlab: link(new Date(Date.now() + 3_600_000)) });
    await expect(findUnusableSourceLinks("juan294")).resolves.toEqual(["bitbucket"]);
  });

  it("names a platform whose authorization cannot be read at all", async () => {
    byProvider({ codeberg: { status: "unavailable" } });
    await expect(findUnusableSourceLinks("juan294")).resolves.toEqual(["codeberg"]);
  });

  it("ignores a disabled integration, which removes nothing from the aggregate", async () => {
    byProvider({ gitlab: { status: "disabled" } });
    await expect(findUnusableSourceLinks("juan294")).resolves.toEqual([]);
  });

  it("never inspects GitHub, which is not a linked source", async () => {
    byProvider({});
    await findUnusableSourceLinks("juan294");
    expect(mockRead.mock.calls.map(([, provider]) => provider)).toEqual(["bitbucket", "codeberg", "gitlab"]);
  });

  // Called on a failure path, beside a refresh attempt that just failed.
  it("reads authorization without consent and never refreshes", async () => {
    byProvider({});
    await findUnusableSourceLinks("juan294");
    for (const call of mockRead.mock.calls) expect(call[2]).toBe(false);
  });
});
