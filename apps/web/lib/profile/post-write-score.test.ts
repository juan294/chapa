import { beforeEach, describe, expect, it, vi } from "vitest";
import { scoringConsistencyFixture } from "./__fixtures__/scoring-consistency";
const receipt = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/score-receipts-observed", () => ({ dbReadObservedReceipt: receipt }));
import { postWriteScore } from "./post-write-score";
const selection = { enabled: true, machinePolicy: "v7.2" as const, cacheable: true, capturedAt: Date.parse("2026-09-08T10:00:00Z") };
beforeEach(() => vi.clearAllMocks());
describe("final write response score authority", () => {
  it("reads the final published revision after issuance and copies canonical display precision", async () => {
    const fixture = await scoringConsistencyFixture({ boundary: true, craft: 0 });
    receipt.mockResolvedValue({ status: "found", envelope: fixture.envelope, trend: null, semanticDigest: "private", coreSemanticDigest: null, isCurrent: true });
    const result = await postWriteScore("alice", selection, "issued");
    expect(result).toMatchObject({ status: "current", publication: "published", projection: { policyVersion: "v7.2", displayScore: 69.99, compositeScore: 69.99, adjustedComposite: 69.99, identity: { revisionId: fixture.envelope.receipt.revisionId } } });
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("marks publication failure pending even if an earlier valid receipt remains", async () => {
    const fixture = await scoringConsistencyFixture({ craft: 57 });
    receipt.mockResolvedValue({ status: "found", envelope: fixture.envelope, trend: null, isCurrent: true });
    expect(await postWriteScore("alice", selection, "failed")).toMatchObject({ status: "current", publication: "pending", projection: { displayScore: 46, freshness: "stale" } });
    receipt.mockResolvedValue({ status: "unavailable" });
    expect(await postWriteScore("alice", selection, "failed")).toEqual({ status: "unavailable", publication: "pending" });
  });
});
