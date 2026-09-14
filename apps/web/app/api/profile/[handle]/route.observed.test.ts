import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { scoringConsistencyFixture } from "@/lib/profile/__fixtures__/scoring-consistency";
const mocks = vi.hoisted(() => ({ receipt: vi.fn(), selection: vi.fn(), legacy: vi.fn(), tool: vi.fn(), materialize: vi.fn() }));
vi.mock("@/lib/scoring-render-selection", () => ({ readScoringRenderSelection: mocks.selection }));
vi.mock("@/lib/db/score-receipts-observed", () => ({ dbReadObservedReceipt: mocks.receipt }));
vi.mock("@/lib/cache/redis", () => ({ rateLimit: vi.fn().mockResolvedValue({ allowed: true }) }));
vi.mock("@/lib/cache/snapshot-cache", () => ({ getCachedLatestSnapshot: mocks.legacy }));
vi.mock("@/lib/db/tool-insights", () => ({ dbGetToolInsights: mocks.tool }));
vi.mock("@/lib/profile/materialize-profile", () => ({ materializeDisplayProfile: mocks.materialize }));
vi.mock("@/lib/profile/score-receipt-v7", () => ({ readScoreReceiptV7: vi.fn() }));
import { GET } from "./route";
import { GET as insights } from "../../insights/[handle]/route";
const request = new NextRequest("https://chapa.test/api/profile/alice");
const context = { params: Promise.resolve({ handle: "alice" }) };
beforeEach(() => { vi.clearAllMocks(); mocks.selection.mockResolvedValue({ enabled: true, machinePolicy: "v7.2", cacheable: true, capturedAt: Date.parse("2026-09-08T10:00:00Z") }); mocks.legacy.mockResolvedValue(null); mocks.tool.mockResolvedValue({ craftScore: 83, tier: "Expert", raw_data: "private" }); });
describe("published observed public API agreement", () => {
  it.each([57, 0] as const)("returns core46 and report%s without requiring a legacy snapshot", async craft => {
    const fixture = await scoringConsistencyFixture({ craft });
    mocks.receipt.mockResolvedValue({ status: "found", envelope: fixture.envelope, semanticDigest: "private-semantic", coreSemanticDigest: "private-core", trend: null, isCurrent: true });
    const response = await GET(request, context), body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ policyVersion: "v7.2", displayScore: 46, adjustedComposite: 46, compositeScore: 46, archetype: null, identity: { revisionId: fixture.envelope.receipt.revisionId }, craft: { status: "scored", report: { result: { point: { exact: craft } } } } });
    expect(JSON.stringify(body)).not.toMatch(/private-semantic|private-core|raw_data|confidencePenalties|"Builder"/);
    expect(mocks.legacy).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store");
    const craftBody = await (await insights(request, context)).json();
    expect(craftBody).toMatchObject({ policyVersion: "v7.2", identity: body.identity, craft: body.craft });
    expect(mocks.tool).not.toHaveBeenCalled();
  });
  it("uses canonical69.99 at every current top-level score and retains exact separately", async () => {
    const fixture = await scoringConsistencyFixture({ boundary: true });
    mocks.receipt.mockResolvedValue({ status: "found", envelope: fixture.envelope, semanticDigest: "a", coreSemanticDigest: "b", trend: null, isCurrent: true });
    const body = await (await GET(request, context)).json();
    expect(body).toMatchObject({ displayScore: 69.99, compositeScore: 69.99, adjustedComposite: 69.99, tier: "Solid" });
    expect(body.exactScore).toBe(fixture.envelope.receipt.core.composite.exact);
  });
  it("keeps the no-receipt fallback explicitly v6 with the same captured selection", async () => {
    const fixture = await scoringConsistencyFixture();
    mocks.receipt.mockResolvedValue({ status: "missing" });
    mocks.legacy.mockResolvedValue({ ...fixture.impact, ...fixture.impact.dimensions, craft: 83, date: "2026-09-08", capturedAt: "2026-09-08T10:00:00Z" });
    mocks.materialize.mockResolvedValue({ displayImpact: fixture.impact });
    const body = await (await GET(request, context)).json();
    expect(body).toMatchObject({ policyVersion: "v6", displayScore: 80, scoring: { policyVersion: "v6", identity: null } });
    expect(mocks.materialize).toHaveBeenCalledWith("alice", expect.objectContaining({ readOnly: true, scoringSelection: expect.objectContaining({ enabled: false, machinePolicy: "v6", capturedAt: Date.parse("2026-09-08T10:00:00Z") }) }));
    expect(mocks.selection).toHaveBeenCalledTimes(1);
  });
  it("fails closed when policy selection is unavailable", async () => {
    mocks.selection.mockResolvedValue({ enabled: false, machinePolicy: "v6", cacheable: false, capturedAt: Date.now() });
    expect((await GET(request, context)).status).toBe(503);
    expect((await insights(request, context)).status).toBe(503);
    expect(mocks.legacy).not.toHaveBeenCalled();
    expect(mocks.tool).not.toHaveBeenCalled();
  });
  it("does not expose legacy report83 as current when receipt authority fails", async () => {
    mocks.receipt.mockResolvedValue({ status: "unavailable" });
    expect((await GET(request, context)).status).toBe(503);
    expect((await insights(request, context)).status).toBe(503);
    expect(mocks.tool).not.toHaveBeenCalled();
  });
});
