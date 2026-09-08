import { describe, expect, it } from "vitest";
import { verifyObservedScoreReceipt } from "@chapa/shared";
import { buildScoringPointSeeds, scoringReportHtml, assertScoringFixtureEnvironment } from "./scoring-point-fixtures";
describe("disposable scoring browser fixture", () => {
  it("seals current46, expired unlocked and boundary69.99 with independent expected scalars", async () => {
    const seeds = await buildScoringPointSeeds("2026-09-08T10:00:00.000Z");
    expect(seeds).toHaveLength(4);
    for (const seed of seeds) {
      const receipt = await verifyObservedScoreReceipt(seed.envelope);
      expect(receipt.window.referenceTime).toBe("2026-09-08T10:00:00.000Z");
      expect(receipt.core.composite.displayValue).toBe(seed.handle.endsWith("boundary") ? 69.99 : 46);
      if (!seed.handle.endsWith("boundary")) expect(receipt.core.composite.exact).toBeCloseTo(46.40250879691149, 12);
      expect(seed.legacyImpact.adjustedComposite).toBe(80);
      expect(seed.legacyImpact.archetype).toBe("Builder");
      if (seed.handle.endsWith("expired")) expect(receipt.craft).toMatchObject({ status: "expired", unlocked: true });
      else expect(receipt.craft.status).toBe("no_report");
    }
  });
  it("renders sanitized report files with complete labels and an eligible past period", () => {
    const html = scoringReportHtml(57, "2026-09-08T10:00:00.000Z");
    expect(html).toContain("2026-09-01 to 2026-09-07");
    expect(html).toContain("Fully Achieved"); expect(html).toContain("Failed");
    expect(scoringReportHtml(0, "2026-09-08T10:00:00.000Z")).toContain('class="bar-value">10');
    expect(html).not.toMatch(/private|email|prompt|token/i);
  });
  it("refuses non-loopback or unacknowledged seed environments before any writes", () => {
    expect(() => assertScoringFixtureEnvironment({ SUPABASE_URL: "https://production.example", REDESIGN_DISPOSABLE_PROJECT: "chapa-redesign" })).toThrow(/loopback/);
    expect(() => assertScoringFixtureEnvironment({ SUPABASE_URL: "http://127.0.0.1:55331" })).toThrow(/acknowledgment/);
    expect(() => assertScoringFixtureEnvironment({ SUPABASE_URL: "http://127.0.0.1:55331", REDESIGN_DISPOSABLE_PROJECT: "chapa-redesign" })).not.toThrow();
    expect(() => assertScoringFixtureEnvironment({ SUPABASE_URL: "http://127.0.0.1:54331", REDESIGN_DISPOSABLE_PROJECT: "chapa-redesign" })).toThrow(/55331|dedicated/);
  });
});
