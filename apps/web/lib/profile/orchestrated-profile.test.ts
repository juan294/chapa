import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFullStats } from "../test-helpers/fixtures";
import type { MaterializedProfile } from "./materialize-profile";
import { materializeOrchestratedProfile } from "./orchestrated-profile";
import { githubUserNotFound } from "@/lib/github/not-found";

const mockMaterializeProfile = vi.fn();

vi.mock("./materialize-profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./materialize-profile")>();
  return {
    ...actual,
    materializeProfile: (...args: unknown[]) => mockMaterializeProfile(...args),
  };
});

// #1335 phase 5 ("delete v6") — `persistOrchestratedSnapshot` and the EMA/
// snapshot machinery `materializeImpactState` fed are deleted along with
// `metrics_snapshots`; `materializeOrchestratedProfile` is now a thin
// delegation to `materializeProfile` with no snapshot side effect of its own.
function makeMaterializedProfile(): MaterializedProfile {
  const stats = makeFullStats({ handle: "testuser" });
  return {
    stats,
    craftResult: null,
    statsComplete: true,
    statsFreshness: "current",
    statsCapturedAt: "2026-04-17T12:00:00.000Z",
    scoring: { policyVersion: "v7.2", handle: "testuser" } as MaterializedProfile["scoring"],
  };
}

describe("materializeOrchestratedProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to the shared materializer", async () => {
    const materialized = makeMaterializedProfile();
    mockMaterializeProfile.mockResolvedValue(materialized);

    const result = await materializeOrchestratedProfile("testuser", {
      token: "oauth-token",
    });

    expect(mockMaterializeProfile).toHaveBeenCalledWith("testuser", {
      token: "oauth-token",
    });
    expect(result).toBe(materialized);
  });
});

describe("materializeOrchestratedProfile — a handle GitHub does not know (LE-8-2)", () => {
  it("collapses the not-found sentinel to null: the refresh, recalculate and warm-cache writers have nothing to persist", async () => {
    mockMaterializeProfile.mockResolvedValue(githubUserNotFound("ghost"));

    expect(await materializeOrchestratedProfile("ghost")).toBeNull();
  });
});
