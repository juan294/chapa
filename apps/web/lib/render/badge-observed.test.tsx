import { describe, expect, it } from "vitest";
import { scoringConsistencyFixture } from "@/lib/profile/__fixtures__/scoring-consistency";
import { renderBadgeSvg } from "./BadgeSvg";
import { renderRadarChart } from "./RadarChart";
import { buildBadgeI18nStrings } from "./badge-i18n-strings";
import { resolveTranslation } from "@/lib/i18n/resolve";
import { es } from "@/lib/i18n/dictionaries/es";

describe("observed badge presentation", () => {
  it.each(["none", 57, 0, "expired"] as const)("renders the receipt's %s Craft state without legacy traps", async craft => {
    const fixture = await scoringConsistencyFixture({ craft });
    const svg = renderBadgeSvg(fixture.stats, { scoring: fixture.model, disableAnimation: true });
    expect(svg).toMatch(/data-element="score"[^>]*>46<\/text>/);
    expect(svg).not.toContain("Builder");
    expect(svg).not.toContain("Craft practice portfolio");
    expect(svg).not.toContain("Complete evidence: every value is an exact point");
    if (craft === "none") expect(svg).not.toContain('data-element="craft"');
    else expect(svg).toContain('data-element="craft"');
    if (typeof craft === "number") {
      expect(svg).toContain(`data-axis="craft" data-value="${craft}"`);
      expect(svg).toContain(`Craft: ${craft}/100`);
    } else if (craft === "expired") {
      expect(svg).toContain("Update insights");
      expect(svg).not.toContain('data-axis="craft" data-value=');
      expect(svg).toContain('data-role="radar-incomplete"');
    }
  });

  it("localizes trace-derived Craft evidence and unavailable state in Spanish", async () => {
    const fixture = await scoringConsistencyFixture({ craft: 57 });
    const strings = buildBadgeI18nStrings(key => resolveTranslation(key, es), fixture.model.tier);
    const svg = renderBadgeSvg(fixture.stats, { scoring: fixture.model, strings, disableAnimation: true });
    expect(svg).toContain("Craft: 57/100 a partir de 5.7 sesiones");
    expect(svg).toContain("Resultados clasificados: 8/10");
    expect(svg).toContain("fin exclusivo");
    expect(svg).not.toContain("Observed core score");
    const expired = await scoringConsistencyFixture({ craft: "expired" });
    const expiredSvg = renderBadgeSvg(expired.stats, { scoring: expired.model, strings, disableAnimation: true });
    expect(expiredSvg).toContain("Actualiza insights");
    expect(expiredSvg).not.toContain("Craft: 57/100");
  });

  it("identifies illustrative scoring models in the accessible description", async () => {
    const fixture = await scoringConsistencyFixture({ craft: 57 });
    const svg = renderBadgeSvg(fixture.stats, { scoring: { ...fixture.model, illustrative: true }, disableAnimation: true });
    expect(svg).toContain("Illustrative scoring example.");
  });

  it("preserves the canonical boundary decimal and its below-boundary tier", async () => {
    const fixture = await scoringConsistencyFixture({ craft: 57, boundary: true });
    const svg = renderBadgeSvg(fixture.stats, { scoring: fixture.model });
    expect(svg).toMatch(/data-element="score"[^>]*>69\.99<\/text>/);
    expect(svg).toMatch(/data-element="tier"[^>]*>Solid<\/text>/);
  });

  it("distinguishes a measured Craft zero from a missing fifth vertex even when core is zero", () => {
    const core = { delivery: 0, quality: 0, consistency: 0, breadth: 0 };
    const scored = renderRadarChart({ ...core, craft: 0 }, 200, 200, 60, undefined, undefined, { observed: true });
    expect(scored).toContain('data-axis="craft" data-value="0"');
    expect(scored).not.toContain("no data yet");
    const expired = renderRadarChart({ ...core, craft: null }, 200, 200, 60, undefined, undefined, { observed: true });
    expect(expired).toContain('data-element="craft"');
    expect(expired).not.toContain('data-axis="craft" data-value=');
  });
});
