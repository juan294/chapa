import { describe, it, expect } from "vitest";
import { buildBadgeI18nStrings } from "./badge-i18n-strings";

/**
 * #1191 step 6 — Creator Studio renders the real badge SVG, so it needs the
 * same `BadgeI18nStrings` bundle the server routes pass. `resolveBadgeLocale`
 * cannot supply it: that module reaches for `getServerT` and is server-only.
 * The key list therefore lives here, in one pure function both sides call,
 * rather than being written out twice and drifting.
 */
describe("buildBadgeI18nStrings", () => {
  const echo = (key: string) => key;

  it("resolves every literal the badge renders", () => {
    expect(buildBadgeI18nStrings(echo, "Solid")).toEqual({
      metricsSimulated: "badge.metricsSimulated",
      metricsVerified: "badge.metricsVerified",
      metricsPublic: "badge.metricsPublic",
      radarLabels: {
        delivery: "dimensions.delivery.label",
        quality: "dimensions.quality.label",
        consistency: "dimensions.consistency.label",
        breadth: "dimensions.breadth.label",
        craft: "dimensions.craft.label",
      },
      radarNoData: "badge.radarNoData",
      verifiedLabel: "badge.verifiedLabel",
      sampleDisclosure: "badge.sampleDisclosure",
      tierLabel: "tiers.solid",
    });
  });

  it("lowercases the tier when keying its label", () => {
    expect(buildBadgeI18nStrings(echo, "Exceptional").tierLabel).toBe(
      "tiers.exceptional",
    );
    expect(buildBadgeI18nStrings(echo, "High").tierLabel).toBe("tiers.high");
  });

  it("passes translated values straight through", () => {
    const spanish = (key: string) =>
      key === "badge.verifiedLabel" ? "Verificado" : key;
    expect(buildBadgeI18nStrings(spanish, "Solid").verifiedLabel).toBe(
      "Verificado",
    );
  });

  it("is pure — same inputs, equal output, no shared mutable state", () => {
    const first = buildBadgeI18nStrings(echo, "Solid");
    const second = buildBadgeI18nStrings(echo, "Solid");
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.radarLabels).not.toBe(second.radarLabels);
  });

  // The point of this module is that it runs in the browser. An import of
  // the server-only translation module would defeat it, so assert on the
  // import statements rather than on any mention of the name (the module
  // documents why it avoids `getServerT`, and saying so is not importing it).
  it("imports nothing server-only", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(
      path.resolve(__dirname, "badge-i18n-strings.ts"),
      "utf8",
    );
    const imports = source
      .split("\n")
      .filter((line) => /^\s*import\b/.test(line));
    for (const line of imports) {
      expect(line).not.toMatch(/i18n\/server/);
      expect(line).not.toMatch(/\bgetServerT\b/);
    }
    expect(imports.length).toBeGreaterThan(0);
  });
});
