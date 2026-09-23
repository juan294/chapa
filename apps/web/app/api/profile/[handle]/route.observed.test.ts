import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { scoringConsistencyFixture } from "@/lib/profile/__fixtures__/scoring-consistency";
const mocks = vi.hoisted(() => ({ receipt: vi.fn(), status: vi.fn() }));
vi.mock("@/lib/db/score-receipts-observed", () => ({ dbReadObservedReceipt: mocks.receipt }));
vi.mock("@/lib/cache/redis", () => ({ rateLimit: vi.fn().mockResolvedValue({ allowed: true }) }));
vi.mock("@/lib/collection/read-scoring-status", () => ({ readScoringStatus: mocks.status }));
import { GET } from "./route";
import { GET as insights } from "../../insights/[handle]/route";
const request = new NextRequest("https://chapa.test/api/profile/alice");
const context = { params: Promise.resolve({ handle: "alice" }) };
beforeEach(() => { vi.clearAllMocks(); mocks.status.mockResolvedValue({ kind: "collecting", percent: 40, sources: [], hasPriorReceipt: false }); });
describe("published observed public API agreement", () => {
  it.each([57, 0] as const)("returns core46 and report%s without requiring a legacy snapshot", async craft => {
    const fixture = await scoringConsistencyFixture({ craft });
    mocks.receipt.mockResolvedValue({ status: "found", envelope: fixture.envelope, semanticDigest: "private-semantic", coreSemanticDigest: "private-core", trend: null, isCurrent: true });
    const response = await GET(request, context), body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ policyVersion: "v7.2", displayScore: 46, adjustedComposite: 46, compositeScore: 46, archetype: null, identity: { revisionId: fixture.envelope.receipt.revisionId }, craft: { status: "scored", report: { result: { point: { exact: craft } } } } });
    expect(JSON.stringify(body)).not.toMatch(/private-semantic|private-core|raw_data|confidencePenalties|"Builder"/);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const craftBody = await (await insights(request, context)).json();
    expect(craftBody).toMatchObject({ policyVersion: "v7.2", identity: body.identity, craft: body.craft });
  });
  it("uses canonical69.99 at every current top-level score and retains exact separately", async () => {
    const fixture = await scoringConsistencyFixture({ boundary: true });
    mocks.receipt.mockResolvedValue({ status: "found", envelope: fixture.envelope, semanticDigest: "a", coreSemanticDigest: "b", trend: null, isCurrent: true });
    const body = await (await GET(request, context)).json();
    expect(body).toMatchObject({ displayScore: 69.99, compositeScore: 69.99, adjustedComposite: 69.99, tier: "Solid" });
    expect(body.exactScore).toBe(fixture.envelope.receipt.core.composite.exact);
  });
  it("returns scoringStatus, never a legacy fallback, when there is no drawable current receipt", async () => {
    mocks.receipt.mockResolvedValue({ status: "missing" });
    mocks.status.mockResolvedValue({ kind: "action_needed", sources: [], hasPriorReceipt: true });

    const body = await (await GET(request, context)).json();
    expect(body).toEqual({ handle: "alice", scoringStatus: { kind: "action_needed", sources: [], hasPriorReceipt: true } });
    expect(mocks.status).toHaveBeenCalledWith("alice");

    const craftBody = await (await insights(request, context)).json();
    expect(craftBody).toEqual({ handle: "alice", scoringStatus: { kind: "action_needed", sources: [], hasPriorReceipt: true } });
  });
  it("fails closed when the scoring status authority read itself fails", async () => {
    mocks.receipt.mockResolvedValue({ status: "missing" });
    mocks.status.mockResolvedValue(null);
    expect((await GET(request, context)).status).toBe(503);
    expect((await insights(request, context)).status).toBe(503);
  });
  it("does not expose a stale receipt as current when receipt authority fails", async () => {
    mocks.receipt.mockResolvedValue({ status: "unavailable" });
    expect((await GET(request, context)).status).toBe(503);
    expect((await insights(request, context)).status).toBe(503);
  });
});
