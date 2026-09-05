import { beforeEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow } from "@chapa/shared";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("./supabase", () => ({ getSupabase: () => ({ rpc: mocks.rpc }) }));
import { dbStoreCraftReportV7, dbReadCraftV7, dbPurgeExpiredCraftRawV7 } from "./craft-v7";
const window = createScoringWindow("2026-09-05T12:00:00Z");
const report = { schemaVersion: "v7" as const, tool: "claude-code" as const, reportPeriod: { start: "2026-02-20", end: "2026-03-07" },
  totalSessions: 10, outcomes: { fully_achieved: 1 }, satisfaction: { likely_satisfied: 1 }, toolUsage: {}, totalToolCalls: 0,
  responseTime: { medianSeconds: null, averageSeconds: null }, volume: null, sessionTypes: null, friction: null, toolErrors: null, multiClauding: null };
beforeEach(() => { mocks.rpc.mockReset(); });
describe("Craft private storage", () => {
  it("canonicalizes reports for replay dedup and stores no client assessment", async () => {
    mocks.rpc.mockResolvedValue({ data: "upload", error: null });
    expect(await dbStoreCraftReportV7("Owner", report, window.referenceTime)).toEqual({ uploadId: "upload" });
    const args = mocks.rpc.mock.calls[0]?.[1];
    expect(args.p_owner).toBe("owner");
    expect(args.p_actor).toBe("owner");
    expect(args.p_diagnostics).not.toHaveProperty("episodes");
    expect(args.p_digest).toMatch(/^[a-f0-9]{64}$/);
    await dbStoreCraftReportV7("owner", { ...report, toolUsage: { B: 1, A: 1 }, totalToolCalls: 2 }, window.referenceTime);
    const hash = mocks.rpc.mock.calls[1]?.[1].p_digest;
    await dbStoreCraftReportV7("owner", { ...report, toolUsage: { A: 1, B: 1 }, totalToolCalls: 2 }, window.referenceTime);
    expect(mocks.rpc.mock.calls[2]?.[1].p_digest).toBe(hash);
  });
  it("does not read raw bodies, returns absent separately, and propagates failed access", async () => {
    mocks.rpc.mockResolvedValue({ data: { evidence: [], assessments: [], grants: [], references: [] }, error: null });
    expect(await dbReadCraftV7("owner", "reviewer", window)).toMatchObject({ result: { status: "not_observed" }, reports: [] });
    expect(mocks.rpc).toHaveBeenCalledWith("scoring_v7_read_craft", { p_owner: "owner", p_actor: "reviewer", p_reference: window.referenceTime });
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "private" } });
    await expect(dbReadCraftV7("owner", "stranger", window)).rejects.toThrow("Craft portfolio read failed");
    await expect(dbPurgeExpiredCraftRawV7()).rejects.toThrow("Craft raw retention purge failed");
  });
  it("does not turn persistence or purge failures into reported success", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    await expect(dbStoreCraftReportV7("owner", report, window.referenceTime)).rejects.toThrow();
    await expect(dbPurgeExpiredCraftRawV7()).rejects.toThrow();
    mocks.rpc.mockResolvedValue({ data: 2, error: null });
    expect(await dbPurgeExpiredCraftRawV7()).toBe(2);
  });
});
