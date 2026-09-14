import { describe, expect, it } from "vitest";
import { CACHE_VERSION, SCORING_V7_CACHE_VERSION } from "../../apps/web/lib/cache/version";
import { assertApplyAllowed, planHandle, planMigration, renderPlan } from "./migrate-v7";

describe("v7 transition rehearsal", () => {
  it("is idempotent: the same handles always produce the same plan", () => {
    const first = planMigration(["alice", "bob"]);
    const second = planMigration(["Bob", "ALICE", "alice"]);

    expect(second).toEqual(first);
    expect(second.totals.handles).toBe(2);
    expect(renderPlan(second)).toBe(renderPlan(first));
  });

  it("counts a bounded recompute, one per handle, before anyone asks for production", () => {
    const plan = planMigration(["a", "b", "c"]);

    expect(plan.totals.recomputes).toBe(3);
    expect(plan.totals.writes).toBe(6);
    expect(plan.dataAccess.length).toBeGreaterThan(0);
  });

  it("writes only into the v7 namespace and never over a v6 key", () => {
    const plan = planHandle("alice");
    const written = plan.actions.filter(action => action.kind === "write").map(action => action.what);

    expect(written.some(what => what.includes(`receipt:${SCORING_V7_CACHE_VERSION}:alice`))).toBe(true);
    for (const what of written) {
      expect(what).not.toContain(`snapshot:${CACHE_VERSION}`);
      expect(what).not.toContain(`stats:${CACHE_VERSION}`);
    }
  });

  it("names what it preserves rather than leaving the blast radius to inference", () => {
    const plan = planHandle("alice");

    expect(plan.preserved).toEqual([
      `snapshot:${CACHE_VERSION}:latest:alice`,
      `stats:${CACHE_VERSION}:merged:alice`,
      `stats:stale:${CACHE_VERSION}:alice`,
      "metrics_snapshots rows for alice",
      "existing verification records for alice",
    ]);
  });

  it("modifies no existing receipt revision, so rollback deletes nothing", () => {
    const written = planHandle("alice").actions.filter(action => action.kind === "write");

    expect(written.some(action => action.what.includes("new revision, additive"))).toBe(true);
    expect(written.every(action => !/delete|drop|overwrite/i.test(action.what))).toBe(true);
  });

  it("refuses to apply without an explicit local target", () => {
    expect(() => assertApplyAllowed(undefined)).toThrow(/separate explicit authorization/);
    expect(() => assertApplyAllowed("production")).toThrow(/Refusing to apply/);
    expect(() => assertApplyAllowed("local")).not.toThrow();
  });

  it("rejects an empty handle instead of planning against everyone", () => {
    expect(() => planHandle("   ")).toThrow(/Empty handle/);
    expect(planMigration(["", "  ", "alice"]).totals.handles).toBe(1);
  });
});
