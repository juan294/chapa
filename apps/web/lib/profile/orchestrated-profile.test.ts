import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFullStats, makeSnapshot } from "../test-helpers/fixtures";
import {
  materializeImpactState,
  type MaterializedProfile,
} from "./materialize-profile";
import {
  materializeOrchestratedProfile,
  persistOrchestratedSnapshot,
} from "./orchestrated-profile";

const mockMaterializeProfile = vi.fn();
const mockDbInsertSnapshot = vi.fn();
const mockDbReplaceSnapshot = vi.fn();
const mockUpdateSnapshotCache = vi.fn();

vi.mock("./materialize-profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./materialize-profile")>();
  return {
    ...actual,
    materializeProfile: (...args: unknown[]) => mockMaterializeProfile(...args),
  };
});

vi.mock("@/lib/db/snapshots", () => ({
  dbInsertSnapshot: (...args: unknown[]) => mockDbInsertSnapshot(...args),
  dbReplaceSnapshot: (...args: unknown[]) => mockDbReplaceSnapshot(...args),
}));

vi.mock("@/lib/cache/snapshot-cache", () => ({
  updateSnapshotCache: (...args: unknown[]) => mockUpdateSnapshotCache(...args),
}));

function makeMaterializedProfile(): MaterializedProfile {
  const stats = makeFullStats({ handle: "testuser" });
  const impactState = materializeImpactState(stats, {
    latestSnapshot: makeSnapshot({
      date: "2026-04-16",
      adjustedComposite: 91,
    }),
    today: "2026-04-17",
  });

  return {
    stats,
    ...impactState,
  };
}

describe("materializeOrchestratedProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to the shared materializer with the public display policy", async () => {
    const materialized = makeMaterializedProfile();
    mockMaterializeProfile.mockResolvedValue(materialized);

    const result = await materializeOrchestratedProfile("testuser", {
      token: "oauth-token",
      craftMode: "recompute",
      today: "2026-04-17",
    });

    expect(mockMaterializeProfile).toHaveBeenCalledWith("testuser", {
      token: "oauth-token",
      craftMode: "recompute",
      today: "2026-04-17",
      policy: "public-display",
    });
    expect(result).toBe(materialized);
  });
});

describe("persistOrchestratedSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbInsertSnapshot.mockResolvedValue(true);
    mockDbReplaceSnapshot.mockResolvedValue(true);
    mockUpdateSnapshotCache.mockResolvedValue(undefined);
  });

  it("inserts and caches the canonical snapshot for warm-cache flows", async () => {
    const materialized = makeMaterializedProfile();

    const persisted = await persistOrchestratedSnapshot("testuser", materialized, {
      mode: "insert",
    });

    expect(persisted).toBe(true);
    expect(mockDbInsertSnapshot).toHaveBeenCalledWith("testuser", materialized.snapshot);
    expect(mockUpdateSnapshotCache).toHaveBeenCalledWith("testuser", materialized.snapshot);
  });

  it("replaces and caches the canonical snapshot for explicit refresh flows", async () => {
    const materialized = makeMaterializedProfile();

    const persisted = await persistOrchestratedSnapshot("testuser", materialized, {
      mode: "replace",
    });

    expect(persisted).toBe(true);
    expect(mockDbReplaceSnapshot).toHaveBeenCalledWith("testuser", materialized.snapshot);
    expect(mockUpdateSnapshotCache).toHaveBeenCalledWith("testuser", materialized.snapshot);
  });

  it("keeps same-day public reads aligned with a replaced orchestration snapshot", () => {
    const stats = makeFullStats({ handle: "testuser" });
    const replaced = materializeImpactState(stats, {
      latestSnapshot: makeSnapshot({
        date: "2026-04-16",
        adjustedComposite: 91,
      }),
      today: "2026-04-17",
    });

    const sameDayPublicRead = materializeImpactState(stats, {
      latestSnapshot: replaced.snapshot,
      today: "2026-04-17",
    });

    expect(sameDayPublicRead.displayImpact.adjustedComposite).toBe(
      replaced.snapshot.adjustedComposite,
    );
  });
});
