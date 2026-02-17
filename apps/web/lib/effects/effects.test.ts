import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// Read source files to verify exports exist and are correct types
// For React components that use canvas/WebGL, we verify exports and structure
// rather than rendering (no DOM/canvas available in vitest).

const EFFECTS_DIR = path.resolve(__dirname);

function readFile(relative: string): string {
  return fs.readFileSync(path.resolve(EFFECTS_DIR, relative), "utf-8");
}

describe("effects library exports", () => {
  describe("backgrounds/ParticleCanvas", () => {
    it("exports a default component", () => {
      const src = readFile("backgrounds/ParticleCanvas.tsx");
      expect(src).toContain("export default function ParticleCanvas");
    });

    it("is a client component", () => {
      const src = readFile("backgrounds/ParticleCanvas.tsx");
      expect(src).toMatch(/^["']use client["']/m);
    });

    it("renders a canvas element", () => {
      const src = readFile("backgrounds/ParticleCanvas.tsx");
      expect(src).toContain("<canvas");
    });
  });

  describe("backgrounds/AuroraBackground", () => {
    it("exports a component", () => {
      const src = readFile("backgrounds/AuroraBackground.tsx");
      expect(src).toMatch(/export (default )?function/);
    });
  });

  describe("backgrounds/ParticleBackground", () => {
    it("exports PARTICLE_PRESETS", () => {
      const src = readFile("backgrounds/ParticleBackground.tsx");
      expect(src).toContain("PARTICLE_PRESETS");
    });

    it("exports useParticles hook", () => {
      const src = readFile("backgrounds/ParticleBackground.tsx");
      expect(src).toContain("export function useParticles");
    });
  });

  describe("borders/GradientBorder", () => {
    it("exports a named GradientBorder component", () => {
      const src = readFile("borders/GradientBorder.tsx");
      expect(src).toContain("export function GradientBorder");
    });

    it("is a client component", () => {
      const src = readFile("borders/GradientBorder.tsx");
      expect(src).toMatch(/^["']use client["']/m);
    });

    it("re-exports GRADIENT_BORDER_CSS", () => {
      const src = readFile("borders/GradientBorder.tsx");
      expect(src).toContain("GRADIENT_BORDER_CSS");
    });
  });

  describe("borders/gradient-border-css", () => {
    it("exports GRADIENT_BORDER_CSS string constant", () => {
      const src = readFile("borders/gradient-border-css.ts");
      expect(src).toContain("export const GRADIENT_BORDER_CSS");
    });

    it("contains @keyframes for animation", () => {
      const src = readFile("borders/gradient-border-css.ts");
      expect(src).toContain("@keyframes");
    });

    it("includes reduced-motion media query", () => {
      const src = readFile("borders/gradient-border-css.ts");
      expect(src).toContain("prefers-reduced-motion");
    });
  });

  describe("cards/glass-presets", () => {
    it("exports GLASS_PRESETS record", () => {
      const src = readFile("cards/glass-presets.ts");
      expect(src).toContain("export const GLASS_PRESETS");
    });

    it("exports glassStyle function", () => {
      const src = readFile("cards/glass-presets.ts");
      expect(src).toContain("export function glassStyle");
    });

    it("exports GlassVariant type", () => {
      const src = readFile("cards/glass-presets.ts");
      expect(src).toContain("export type GlassVariant");
    });

    it("has all four glass variants", () => {
      const src = readFile("cards/glass-presets.ts");
      expect(src).toContain("frost");
      expect(src).toContain("smoke");
      expect(src).toContain("crystal");
      expect(src).toContain("aurora-glass");
    });
  });

  describe("interactions/HolographicOverlay", () => {
    it("exports a named HolographicOverlay component", () => {
      const src = readFile("interactions/HolographicOverlay.tsx");
      expect(src).toContain("export function HolographicOverlay");
    });

    it("is a client component", () => {
      const src = readFile("interactions/HolographicOverlay.tsx");
      expect(src).toMatch(/^["']use client["']/m);
    });

    it("re-exports HOLOGRAPHIC_CSS", () => {
      const src = readFile("interactions/HolographicOverlay.tsx");
      expect(src).toContain("HOLOGRAPHIC_CSS");
    });
  });

  describe("interactions/holographic-css", () => {
    it("exports HOLOGRAPHIC_CSS string constant", () => {
      const src = readFile("interactions/holographic-css.ts");
      expect(src).toContain("export const HOLOGRAPHIC_CSS");
    });

    it("includes reduced-motion media query", () => {
      const src = readFile("interactions/holographic-css.ts");
      expect(src).toContain("prefers-reduced-motion");
    });
  });

  describe("text/ScoreEffectText", () => {
    it("exports SCORE_EFFECT_CSS constant", () => {
      const src = readFile("text/ScoreEffectText.tsx");
      expect(src).toContain("export const SCORE_EFFECT_CSS");
    });

    it("is a client component", () => {
      const src = readFile("text/ScoreEffectText.tsx");
      expect(src).toMatch(/^["']use client["']/m);
    });

    it("exports ScoreEffect type", () => {
      const src = readFile("text/ScoreEffectText.tsx");
      expect(src).toContain("export type ScoreEffect");
    });
  });

  describe("tier/TierVisuals", () => {
    it("exports a component", () => {
      const src = readFile("tier/TierVisuals.tsx");
      expect(src).toMatch(/export (default )?function/);
    });
  });

  describe("defaults", () => {
    it("exports STUDIO_PRESETS array", () => {
      const src = readFile("defaults.ts");
      expect(src).toContain("export const STUDIO_PRESETS");
    });

    it("exports StudioPreset interface", () => {
      const src = readFile("defaults.ts");
      expect(src).toContain("export interface StudioPreset");
    });
  });
});
