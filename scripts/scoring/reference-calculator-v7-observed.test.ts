import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createScoringWindow, canonicalSha256, type CoreCountInputs } from "@chapa/shared";
import { calculateObservedCoreV7 } from "../../apps/web/lib/impact/observed-v7";
import { calculateReportCraftInputs } from "../../apps/web/lib/insights/report-craft";
import { observedReceiptFixture } from "../../apps/web/lib/history/__fixtures__/receipts-observed";
import { referenceCalculateObservedCore, referenceCalculateObservedCraft, referenceObservedDisplay, assertObservedReferenceParity } from "./reference-calculator-v7-observed";
import { replayReceipt } from "./reference-calculator";

describe("independent observed receipt replay", () => {
  it("replays the separately frozen owner fixture while the historical archive is unchanged", async () => {
    const file = "packages/shared/src/__fixtures__/observed-owner-envelope.json";
    const envelope = JSON.parse(readFileSync(file, "utf8"));
    const result = await replayReceipt(envelope);
    expect(result.core.composite).toEqual({ kind: "point", exact: 46.40250879691149, displayValue: 46, displayLabel: "46" });
    const archive = readFileSync("docs/plans/2026-09-07-local-e2e-verification-phases/evidence/phase6/receipt-envelope.json", "utf8");
    const before = createHash("sha256").update(archive).digest("hex");
    expect((await replayReceipt(JSON.parse(archive))).core.composite).toMatchObject({ kind: "range", displayLower: 46, displayUpper: 100 });
    expect(createHash("sha256").update(archive).digest("hex")).toBe(before);
  });
  it("matches every scalar over deterministic bounded counts, including saturation", () => {
    const window = createScoringWindow("2026-09-07T12:00:00Z");
    let seed = 1701;
    const next = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed; };
    const bounds = (cap: number) => { const lower = next() % (cap * 2 + 1); return { lower, upper: lower + next() % (cap + 1) }; };
    for (let index = 0; index < 200; index++) {
      const counts: CoreCountInputs = { deliveryUnits: bounds(120), quality: { rationale: bounds(12), verification: bounds(12), review_or_correction: bounds(12), outcome_followup: bounds(12) }, activeIsoWeeks: bounds(40), eligibleProjects: bounds(4), eligibleCategories: bounds(4) };
      const input = { policyVersion: "v7.2" as const, window, counts };
      const actual = calculateObservedCoreV7(input), expected = referenceCalculateObservedCore(input);
      assertObservedReferenceParity(actual.core, expected.core);
      assertObservedReferenceParity(actual.trace, expected.trace);
    }
  });
  it("independently reproduces report57, zero, insufficient and proportional samples", () => {
    const base = { policyVersion: "v7.2" as const, classifierRevision: "cc-outcomes-v7.2" as const, window: createScoringWindow("2026-09-07T12:00:00Z"), reportPeriod: { startInclusive: "2026-08-01T00:00:00.000Z", endExclusive: "2026-09-01T00:00:00.000Z" }, totalSessions: 10, outcomes: { fully_achieved: 4, mostly_achieved: 2, partially_achieved: 1, not_achieved: 1 }, unknownSessions: 1, unclassifiedSessions: 1 };
    for (const input of [base, { ...base, totalSessions: 20, outcomes: { fully_achieved: 8, mostly_achieved: 4, partially_achieved: 2, not_achieved: 2 }, unknownSessions: 2, unclassifiedSessions: 2 }, { ...base, outcomes: { fully_achieved: 0, mostly_achieved: 0, partially_achieved: 0, not_achieved: 10 }, unknownSessions: 0, unclassifiedSessions: 0 }, { ...base, outcomes: { fully_achieved: 0, mostly_achieved: 0, partially_achieved: 0, not_achieved: 0 }, unknownSessions: 0, unclassifiedSessions: 10 }]) {
      const production = calculateReportCraftInputs(input);
      if (production.status !== "valid") throw new Error("Fixture invalid");
      assertObservedReferenceParity(production.result, referenceCalculateObservedCraft(input));
    }
    const result = referenceCalculateObservedCraft(base);
    expect(result.status === "scored" && result.point.exact).toBe(57);
  });
  it("implements decimal and binary64 boundary labels independently", () => {
    const view = new DataView(new ArrayBuffer(8));
    for (const boundary of [30, 70, 85]) {
      view.setFloat64(0, boundary); view.setBigUint64(0, view.getBigUint64(0) - 1n);
      expect(referenceObservedDisplay(view.getFloat64(0), true).displayValue).toBe(boundary - 0.01);
      expect(referenceObservedDisplay(boundary - 0.001, true).displayValue).toBe(boundary - 0.01);
      expect(referenceObservedDisplay(boundary, true).displayValue).toBe(boundary);
    }
  });
  it("rejects trace mutation even after an attacker recomputes the content hash", async () => {
    const envelope = await observedReceiptFixture();
    const receipt = structuredClone(envelope.receipt);
    Object.assign(receipt.calculation.core.delivery, { normalized: 0.5 });
    await expect(replayReceipt({ receipt, contentHash: { algorithm: "SHA-256", value: await canonicalSha256(receipt) } })).rejects.toThrow();
    expect(() => assertObservedReferenceParity({ displayValue: 46 + 5e-11 }, { displayValue: 46 })).toThrow();
    expect(() => assertObservedReferenceParity({ observedCount: 65 + 5e-11 }, { observedCount: 65 })).toThrow();
  });
  it("uses no ambient clock during replay", async () => {
    const envelope = await observedReceiptFixture();
    const expected = await replayReceipt(envelope);
    vi.useFakeTimers(); vi.setSystemTime("2035-01-01T00:00:00Z");
    try { expect(await replayReceipt(envelope)).toEqual(expected); } finally { vi.useRealTimers(); }
  });
  it("runs the documented explicit-tsconfig CLI without inherited test or Git environment", () => {
    const cli = createRequire(import.meta.url).resolve("tsx/cli");
    const output = execFileSync(process.execPath, [cli, "--tsconfig", "tsconfig.scripts.json", "scripts/scoring/reference-calculator.ts", "packages/shared/src/__fixtures__/observed-owner-envelope.json"], {
      encoding: "utf8",
      env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, TZ: "UTC", TSX_DISABLE_CACHE: "1" },
    });
    expect(JSON.parse(output)).toMatchObject({ policyVersion: "v7.2", replayStatus: "arithmetic_reproduced" });
  });
  it("runs the actual CLI offline in two distant timezones", () => {
    const directory = mkdtempSync(join(tmpdir(), "chapa-observed-replay-"));
    const guard = join(directory, "offline.cjs");
    try {
      writeFileSync(guard, 'global.fetch = () => { throw Error("offline"); }; require("node:net").Socket.prototype.connect = () => { throw Error("offline"); };');
      const run = (zone: string) => execFileSync(process.execPath, ["--require", guard, "--import", "tsx", "scripts/scoring/reference-calculator.ts", "packages/shared/src/__fixtures__/observed-owner-envelope.json"], { encoding: "utf8", env: { ...process.env, TZ: zone } });
      const result = run("Pacific/Honolulu");
      expect(result).toBe(run("Asia/Tokyo"));
      expect(JSON.parse(result).policyVersion).toBe("v7.2");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
