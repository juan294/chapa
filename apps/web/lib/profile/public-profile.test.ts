import { beforeEach, describe, expect, it, vi } from "vitest";
import { githubUserNotFound, isGitHubUserNotFound } from "@/lib/github/not-found";
import { makeFullStats } from "../test-helpers/fixtures";
import type { MaterializedProfile } from "./materialize-profile";
import {
  materializePublicProfile,
  runPublicProfileSideEffects,
} from "./public-profile";

const mockResolveScoreModel = vi.fn();
vi.mock("./score-model", () => ({ resolveScoreModel: (...args: unknown[]) => mockResolveScoreModel(...args) }));
const mockMaterializeProfile = vi.fn();
const mockTrackBadgeGenerated = vi.fn();
const mockNotifyFirstBadge = vi.fn();
const mockDbUpdateUserProfile = vi.fn();

vi.mock("./materialize-profile", () => ({
  materializeProfile: (...args: unknown[]) => mockMaterializeProfile(...args),
}));

vi.mock("@/lib/cache/redis", () => ({
  trackBadgeGenerated: (...args: unknown[]) => mockTrackBadgeGenerated(...args),
}));

vi.mock("@/lib/email/notifications", () => ({
  notifyFirstBadge: (...args: unknown[]) => mockNotifyFirstBadge(...args),
}));

vi.mock("@/lib/db/users", () => ({
  dbUpdateUserProfile: (...args: unknown[]) => mockDbUpdateUserProfile(...args),
}));

const SCORING = { policyVersion: "v7.2" as const, handle: "testuser" };

function makeMaterializedProfile(overrides: Partial<MaterializedProfile> = {}): MaterializedProfile {
  return {
    stats: makeFullStats({
      handle: "testuser",
      displayName: "Test User",
      avatarUrl: "https://avatars.example.com/testuser.png",
      commitsTotal: 42,
      prsMergedCount: 10,
      reviewsSubmittedCount: 5,
    }),
    craftResult: null,
    statsComplete: true,
    statsFreshness: "current",
    statsCapturedAt: "2026-04-17T12:00:00.000Z",
    scoring: SCORING as MaterializedProfile["scoring"],
    ...overrides,
  };
}

describe("materializePublicProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("LE-8-2: passes the not-found sentinel through to the public surfaces", async () => {
    mockMaterializeProfile.mockResolvedValue(githubUserNotFound("ghost"));

    expect(isGitHubUserNotFound(await materializePublicProfile("ghost"))).toBe(true);
  });

  it("delegates to the shared materializer", async () => {
    const materialized = makeMaterializedProfile();
    mockMaterializeProfile.mockResolvedValue(materialized);

    const result = await materializePublicProfile("testuser", { token: "oauth-token" });

    expect(mockMaterializeProfile).toHaveBeenCalledWith("testuser", {
      token: "oauth-token",
      scoringSelection: undefined,
      today: undefined,
      readOnly: undefined,
    });
    expect(result).toBe(materialized);
  });

  it("passes read-only mode to the shared materializer", async () => {
    const materialized = makeMaterializedProfile();
    mockMaterializeProfile.mockResolvedValue(materialized);

    await materializePublicProfile("testuser", { readOnly: true });

    expect(mockMaterializeProfile).toHaveBeenCalledWith("testuser", {
      token: undefined,
      scoringSelection: undefined,
      today: undefined,
      readOnly: true,
    });
  });
});

/**
 * #1335 phase 5 ("delete v6") — snapshot persistence and the v6 HMAC
 * verification record are gone: the receipt is the durable, attestable
 * artifact and it is minted at issuance (`lib/profile/issue-receipt.ts`),
 * never on the render path. What remains here is telemetry and the
 * owner-profile-metadata refresh.
 */
describe("runPublicProfileSideEffects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTrackBadgeGenerated.mockResolvedValue(undefined);
    mockNotifyFirstBadge.mockResolvedValue(undefined);
    mockDbUpdateUserProfile.mockResolvedValue(undefined);
  });

  it("does nothing for a read-only render", async () => {
    const materialized = makeMaterializedProfile();

    await runPublicProfileSideEffects("testuser", materialized, { readOnly: true });

    expect(mockTrackBadgeGenerated).not.toHaveBeenCalled();
    expect(mockDbUpdateUserProfile).not.toHaveBeenCalled();
  });

  it("tracks the badge generation event", async () => {
    const materialized = makeMaterializedProfile();

    await runPublicProfileSideEffects("testuser", materialized);

    expect(mockTrackBadgeGenerated).toHaveBeenCalledWith("testuser");
  });

  it("refreshes the registered user's display name and avatar (#1239 — never inserts)", async () => {
    const materialized = makeMaterializedProfile();

    await runPublicProfileSideEffects("testuser", materialized);

    expect(mockDbUpdateUserProfile).toHaveBeenCalledWith("testuser", {
      displayName: "Test User",
      avatarUrl: "https://avatars.example.com/testuser.png",
    });
  });

  it("skips the profile-metadata refresh when neither field is set", async () => {
    const materialized = makeMaterializedProfile({
      stats: makeFullStats({ handle: "testuser", displayName: undefined, avatarUrl: undefined }),
    });

    await runPublicProfileSideEffects("testuser", materialized);

    expect(mockDbUpdateUserProfile).not.toHaveBeenCalled();
  });

  it("sends the first-badge notification using the materialized scoring model when present", async () => {
    const materialized = makeMaterializedProfile();

    await runPublicProfileSideEffects("testuser", materialized, { sendFirstBadgeNotification: true });

    expect(mockResolveScoreModel).not.toHaveBeenCalled();
    expect(mockNotifyFirstBadge).toHaveBeenCalledWith("testuser", SCORING);
  });

  it("resolves a fresh scoring model when the materialized profile has none", async () => {
    const materialized = makeMaterializedProfile({ scoring: undefined });
    mockResolveScoreModel.mockResolvedValue(SCORING);

    await runPublicProfileSideEffects("testuser", materialized, { sendFirstBadgeNotification: true });

    expect(mockResolveScoreModel).toHaveBeenCalledWith("testuser");
    expect(mockNotifyFirstBadge).toHaveBeenCalledWith("testuser", SCORING);
  });

  it("sends no notification at all when there is nothing to score", async () => {
    const materialized = makeMaterializedProfile({ scoring: undefined });
    mockResolveScoreModel.mockResolvedValue(undefined);

    await runPublicProfileSideEffects("testuser", materialized, { sendFirstBadgeNotification: true });

    expect(mockNotifyFirstBadge).not.toHaveBeenCalled();
  });
});
