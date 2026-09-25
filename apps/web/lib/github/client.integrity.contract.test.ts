import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStats, _resetInflight } from "./client";
import { materializeProfile } from "@/lib/profile/materialize-profile";
import { dbUpsertSupplemental } from "@/lib/db/supplemental";
import { getServiceClient } from "@/test/contract/invoke";
import { redisFake } from "@/test/contract/redis-fake";
import { stubLegacyGitHub } from "@/test/contract/github-fixture";
import { makeFullStats } from "@/lib/test-helpers/fixtures";
import { expectFound } from "@/lib/test-helpers/found";

// Real legacy collection/materialization/persistence; only GitHub HTTP is
// synthetic. Local Supabase requests use the original fetch implementation.
const handles = ["contract-empty-sample", "contract-old-baseline", "contract-durable-overlay", "contract-valid-pr-0", "contract-valid-pr-1", "contract-unbound-cache"];
function isGitHubApiRequest(input: unknown): boolean {
  const value = input instanceof Request
    ? input.url
    : input instanceof URL
      ? input.href
      : String(input);
  try {
    return new URL(value).origin === "https://api.github.com";
  } catch {
    return false;
  }
}
async function cleanup() {
  const db = getServiceClient();
  for (const handle of handles) {
    for (const [table, column] of [["supplemental_stats", "target_handle"]] as const) {
      expect((await db.from(table).delete().eq(column, handle)).error).toBeNull();
    }
  }
}
beforeEach(async () => { redisFake.__reset(); _resetInflight(); await cleanup(); });
afterEach(async () => { vi.unstubAllGlobals(); await cleanup(); });

describe("source integrity through actual legacy collection and local persistence", () => {
  it("accepts a valid empty PR sample and caches it only under a bound entry", async () => {
    const handle = handles[0]!; const http = stubLegacyGitHub(handle);
    expect(await getStats(handle)).toMatchObject({ prsMergedCount: 904, prsMergedWeight: 0 });
    // The pre-S08 handle-only keys stay empty; the replacement carries the
    // binding that decides whether a later reader may have the row at all.
    expect(await redisFake.cacheGet(`stats:v2:merged:${handle}`)).toBeNull();
    expect(await redisFake.cacheGet(`stats:stale:v2:${handle}`)).toBeNull();
    expect(await redisFake.cacheGet(`stats:v3:${handle}`)).toMatchObject({
      schemaVersion: 2, authorizationBinding: expect.any(String), referenceDate: expect.any(String),
      capturedAt: expect.any(String), freshUntil: expect.any(String), stats: { prsMergedCount: 904 },
    });
    // Same grant, same scoring day: the second read is served from that entry.
    const before = http.mock.calls.filter(([input]) => isGitHubApiRequest(input)).length;
    _resetInflight();
    expect(await getStats(handle)).toMatchObject({ prsMergedCount: 904 });
    expect(http.mock.calls.filter(([input]) => isGitHubApiRequest(input))).toHaveLength(before);
  });
  it("does not substitute a larger unbound legacy baseline for the current small observation", async () => {
    const handle = handles[1]!;
    const old = makeFullStats({ handle, prsMergedCount: 999, prsMergedWeight: 120, fetchScope: "authenticated" });
    await redisFake.cacheSet(`stats:stale:v2:${handle}`, old, 604800); stubLegacyGitHub(handle, 1);
    expect(await getStats(handle)).toMatchObject({ prsMergedCount: 1, prsMergedWeight: 0 });
    expect(await redisFake.cacheGet(`stats:stale:v2:${handle}`)).toEqual(old);
  });
  it("composes the actual durable supplemental without using its retired Redis mirror", async () => {
    const handle = handles[2]!;
    const supplemental = { targetHandle: handle, sourceHandle: `${handle}-emu`, uploadedAt: new Date().toISOString(),
      stats: makeFullStats({ handle: `${handle}-emu`, prsMergedCount: 32, commitsTotal: 453 }) };
    expect(await dbUpsertSupplemental(handle, supplemental)).toBe(true);
    await redisFake.cacheSet(`supplemental:${handle}`, { ...supplemental, stats: makeFullStats({ prsMergedCount: 999 }) }, 86400);
    stubLegacyGitHub(handle);
    expect(await getStats(handle)).toMatchObject({ prsMergedCount: 936, hasSupplementalData: true });
    expect(await redisFake.cacheGet(`stats:v2:merged:${handle}`)).toBeNull();
  });
  // #1335 phase 5 ("delete v6") — `persistProfileSnapshot` and
  // `getPublicProfileVerification` (the v6 snapshot/HMAC path this test
  // exercised) are deleted; the receipt is the durable, attestable artifact
  // now, minted at issuance rather than on the render path.
  it.each([0, 1])("materializes an actually fetched valid legacy PR count of %i without recomputing v6 aggregates", async prsMergedCount => {
    const handle = `contract-valid-pr-${prsMergedCount}`; stubLegacyGitHub(handle, prsMergedCount);
    const materialized = expectFound(await materializeProfile(handle));
    expect(materialized.statsComplete).toBe(true);
    expect(materialized.stats.prsMergedCount).toBe(prsMergedCount);
  });
  it("never fetches live on a read-only call against a malformed unbound hot-cache row (#1335 phase 5 — there is no snapshot left to poison)", async () => {
    const handle = handles[5]!;
    await redisFake.cacheSet(`stats:v2:merged:${handle}`, makeFullStats({ handle, fetchedAt: "invalid" }), 21600);
    const http = stubLegacyGitHub(handle);
    expect(await materializeProfile(handle, { readOnly: true })).toBeNull();
    expect(http.mock.calls.filter(([input]) => isGitHubApiRequest(input))).toHaveLength(0);
  });
});
