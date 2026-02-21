import { describe, it, expect } from "vitest";
import { PARTICLE_PRESETS, type ParticleConfig } from "./ParticleBackground";

describe("ParticleBackground", () => {
  describe("PARTICLE_PRESETS", () => {
    const presetNames = ["dots", "constellation", "dust", "sparkle", "interactive"] as const;

    it("exports all expected presets", () => {
      for (const name of presetNames) {
        expect(PARTICLE_PRESETS[name]).toBeDefined();
      }
    });

    it("each preset has required ParticleConfig fields", () => {
      const requiredKeys: (keyof ParticleConfig)[] = [
        "count",
        "colors",
        "minRadius",
        "maxRadius",
        "speed",
        "minOpacity",
        "maxOpacity",
        "connections",
        "connectionDistance",
        "mouseRepulsion",
        "mouseRadius",
        "sparkle",
      ];

      for (const name of presetNames) {
        const preset = PARTICLE_PRESETS[name];
        for (const key of requiredKeys) {
          expect(preset).toHaveProperty(key);
        }
      }
    });

    it("all presets have positive particle count", () => {
      for (const name of presetNames) {
        expect(PARTICLE_PRESETS[name].count).toBeGreaterThan(0);
      }
    });

    it("all presets have valid radius range (min <= max)", () => {
      for (const name of presetNames) {
        const p = PARTICLE_PRESETS[name];
        expect(p.minRadius).toBeLessThanOrEqual(p.maxRadius);
      }
    });

    it("all presets have valid opacity range (min <= max)", () => {
      for (const name of presetNames) {
        const p = PARTICLE_PRESETS[name];
        expect(p.minOpacity).toBeLessThanOrEqual(p.maxOpacity);
      }
    });

    it("all presets have non-empty colors array", () => {
      for (const name of presetNames) {
        expect(PARTICLE_PRESETS[name].colors.length).toBeGreaterThan(0);
      }
    });

    it("all color values are valid hex strings", () => {
      for (const name of presetNames) {
        for (const color of PARTICLE_PRESETS[name].colors) {
          expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
        }
      }
    });

    it("sparkle preset has sparkle=true", () => {
      expect(PARTICLE_PRESETS.sparkle.sparkle).toBe(true);
    });

    it("constellation preset has connections enabled", () => {
      expect(PARTICLE_PRESETS.constellation.connections).toBe(true);
      expect(PARTICLE_PRESETS.constellation.connectionDistance).toBeGreaterThan(0);
    });

    it("interactive preset has mouse repulsion enabled", () => {
      expect(PARTICLE_PRESETS.interactive.mouseRepulsion).toBe(true);
      expect(PARTICLE_PRESETS.interactive.mouseRadius).toBeGreaterThan(0);
    });

    it("dots preset has no connections or mouse repulsion", () => {
      expect(PARTICLE_PRESETS.dots.connections).toBe(false);
      expect(PARTICLE_PRESETS.dots.mouseRepulsion).toBe(false);
    });
  });
});
