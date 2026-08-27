import { describe, it, expect } from "vitest";
import { resolveBadgeLocale } from "./badge-locale";
import { buildBadgeSvgCacheKey, buildBadgeSvgRenderLockKey } from "./badge-svg-cache";

// ---------------------------------------------------------------------------
// resolveBadgeLocale — the single source of truth for "locale-consistent
// content + cache key" (#1181 follow-up).
//
// Bug this module exists to prevent: two call sites (share page,
// warm-cache cron) independently called `renderBadgeSvg` (defaults to
// ENGLISH strings when `strings` is omitted) and `buildBadgeSvgCacheKey`
// (defaults to DEFAULT_LOCALE, which is SPANISH, when `locale` is omitted).
// Both wrote an English-rendered badge into the Spanish-keyed cache slot —
// content and key silently disagreed. `resolveBadgeLocale` makes that
// structurally impossible: every value it returns (strings, cache key,
// render-lock key) is derived from the ONE locale passed in, so a caller
// cannot get content for one locale paired with a key for another out of a
// single resolved object.
// ---------------------------------------------------------------------------

describe("resolveBadgeLocale", () => {
  it("resolves Spanish strings for locale 'es'", () => {
    const resolved = resolveBadgeLocale("es");
    expect(resolved.locale).toBe("es");
    const strings = resolved.stringsFor("Solid");
    expect(strings.metricsVerified).toBe("Métricas verificadas");
    expect(strings.metricsPublic).toBe("Métricas públicas");
    expect(strings.metricsSimulated).toBe("Métricas simuladas");
    expect(strings.radarLabels).toEqual({
      delivery: "Entrega",
      quality: "Calidad",
      consistency: "Constancia",
      breadth: "Alcance",
      craft: "Oficio",
    });
    expect(strings.radarNoData).toBe("aún sin datos");
    expect(strings.verifiedLabel).toBe("VERIFICADO");
    expect(strings.sampleDisclosure).toBe(
      "MUESTRA · NO ES UNA CHAPA REAL · SOLO PARA ILUSTRACIÓN",
    );
    expect(strings.tierLabel).toBe("Sólido");
  });

  it("resolves English strings for locale 'en' (byte-identical to renderBadgeSvg's own English defaults)", () => {
    const resolved = resolveBadgeLocale("en");
    const strings = resolved.stringsFor("Solid");
    expect(strings.metricsVerified).toBe("Verified metrics");
    expect(strings.metricsPublic).toBe("Public metrics");
    expect(strings.metricsSimulated).toBe("Simulated metrics");
    expect(strings.radarLabels).toEqual({
      delivery: "Delivery",
      quality: "Quality",
      consistency: "Consistency",
      breadth: "Breadth",
      craft: "Craft",
    });
    expect(strings.radarNoData).toBe("no data yet");
    expect(strings.verifiedLabel).toBe("VERIFIED");
    expect(strings.sampleDisclosure).toBe(
      "SAMPLE · NOT A REAL BADGE · FOR ILLUSTRATION ONLY",
    );
    expect(strings.tierLabel).toBe("Solid");
  });

  it("resolves a tier-specific label per call to stringsFor", () => {
    const resolved = resolveBadgeLocale("es");
    expect(resolved.stringsFor("Emerging").tierLabel).toBe("Emergente");
    expect(resolved.stringsFor("High").tierLabel).toBe("Alto");
    expect(resolved.stringsFor("Elite").tierLabel).toBe("Elite");
  });

  // The core regression test: content and key must be derivable ONLY
  // together, from the same resolved locale — never independently.
  describe("cache key and content always agree (regression)", () => {
    it("cacheKey matches buildBadgeSvgCacheKey for the SAME locale used by stringsFor", () => {
      const resolvedEs = resolveBadgeLocale("es");
      const resolvedEn = resolveBadgeLocale("en");

      expect(resolvedEs.cacheKey("octocat", "2026-05-01")).toBe(
        buildBadgeSvgCacheKey("octocat", "2026-05-01", "es"),
      );
      expect(resolvedEn.cacheKey("octocat", "2026-05-01")).toBe(
        buildBadgeSvgCacheKey("octocat", "2026-05-01", "en"),
      );
      // The two locales must never collide.
      expect(resolvedEs.cacheKey("octocat", "2026-05-01")).not.toBe(
        resolvedEn.cacheKey("octocat", "2026-05-01"),
      );
    });

    it("renderLockKey matches buildBadgeSvgRenderLockKey for the SAME locale", () => {
      const resolvedEs = resolveBadgeLocale("es");
      expect(resolvedEs.renderLockKey("octocat", "2026-05-01")).toBe(
        buildBadgeSvgRenderLockKey("octocat", "2026-05-01", "es"),
      );
    });

    it("an English-resolved bundle's cache key always carries the :en segment, never :es", () => {
      const resolved = resolveBadgeLocale("en");
      const key = resolved.cacheKey("octocat", "2026-05-01");
      const strings = resolved.stringsFor("High");
      // If content is English (this locale), the key must be tagged :en —
      // never silently fall back to the cache key's own DEFAULT_LOCALE (es).
      expect(key.endsWith(":en")).toBe(true);
      expect(strings.metricsVerified).toBe("Verified metrics");
    });
  });
});
