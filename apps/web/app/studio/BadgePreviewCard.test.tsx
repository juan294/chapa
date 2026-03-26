// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import * as fs from "node:fs";
import * as path from "node:path";

// ---------- Browser API mock ----------

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ---------- Module mocks ----------

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<{ default: React.ComponentType }>, opts?: { loading?: () => React.ReactNode }) => {
    const MockComponent = (props: Record<string, unknown>) => {
      if (opts?.loading) {
        return opts.loading();
      }
      return <div data-testid="dynamic-component" {...props} />;
    };
    MockComponent.displayName = "DynamicMock";
    return MockComponent;
  },
}));

vi.mock("@/lib/effects/cards/glass-presets", () => ({
  glassStyle: vi.fn((variant: string) => ({
    background: `glass-${variant}`,
    backdropFilter: "blur(10px)",
  })),
}));

vi.mock("@/lib/effects/borders/gradient-border-css", () => ({
  GRADIENT_BORDER_CSS: "/* gradient-border-css */",
}));

vi.mock("@/lib/effects/interactions/use-tilt", () => ({
  useTilt: vi.fn(() => ({
    ref: { current: null },
    tilt: { rotateX: 0, rotateY: 0, mouseX: "50%", mouseY: "50%", isHovering: false },
    handleMouseMove: vi.fn(),
    handleMouseLeave: vi.fn(),
  })),
}));

vi.mock("@/lib/effects/interactions/holographic-css", () => ({
  HOLOGRAPHIC_CSS: "/* holographic-css */",
}));

vi.mock("@/lib/effects/celebrations/confetti", () => ({
  fireSingleBurst: vi.fn(),
}));

vi.mock("@/components/badge/BadgeContent", () => ({
  BadgeContent: ({
    stats,
    impact,
    scoreEffect,
    heatmapAnimation,
    statsDisplay,
    tierTreatment,
  }: {
    stats: { handle: string };
    impact: { compositeScore: number };
    scoreEffect: string;
    heatmapAnimation: string;
    statsDisplay: string;
    tierTreatment: string;
  }) => (
    <div
      data-testid="badge-content"
      data-handle={stats.handle}
      data-score={impact.compositeScore}
      data-score-effect={scoreEffect}
      data-heatmap-animation={heatmapAnimation}
      data-stats-display={statsDisplay}
      data-tier-treatment={tierTreatment}
    />
  ),
  getBadgeContentCSS: vi.fn(() => ["/* badge-content-css */"]),
}));

import { BadgePreviewCard } from "./BadgePreviewCard";
import type { BadgeConfig, StatsData, ImpactV4Result } from "@chapa/shared";
import { glassStyle } from "@/lib/effects/cards/glass-presets";

// ---------- Fixtures ----------

const defaultConfig: BadgeConfig = {
  background: "solid",
  cardStyle: "flat",
  border: "solid-amber",
  scoreEffect: "standard",
  heatmapAnimation: "fade-in",
  interaction: "static",
  statsDisplay: "static",
  tierTreatment: "standard",
  celebration: "none",
};

const stats: StatsData = {
  handle: "testuser",
  commitsTotal: 100,
  activeDays: 50,
  prsMergedCount: 10,
  prsMergedWeight: 20,
  reviewsSubmittedCount: 5,
  issuesClosedCount: 3,
  linesAdded: 5000,
  linesDeleted: 2000,
  reposContributed: 4,
  topRepoShare: 0.5,
  maxCommitsIn10Min: 3,
  totalStars: 10,
  totalForks: 2,
  totalWatchers: 5,
  heatmapData: [],
  fetchedAt: new Date().toISOString(),
};

const impact: ImpactV4Result = {
  handle: "testuser",
  profileType: "solo",
  dimensions: { delivery: 60, quality: 70, consistency: 80, breadth: 50 },
  archetype: "Builder",
  compositeScore: 65,
  confidence: 85,
  confidencePenalties: [],
  adjustedComposite: 65,
  tier: "Solid",
  computedAt: new Date().toISOString(),
};

// ---------- Setup / Teardown ----------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------- Source-code static assertions ----------

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "BadgePreviewCard.tsx"),
  "utf-8",
);

describe("BadgePreviewCard", () => {
  describe("component directive", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  describe("props interface", () => {
    it("accepts BadgeConfig prop", () => {
      expect(SOURCE).toContain("config: BadgeConfig");
    });

    it("accepts StatsData prop", () => {
      expect(SOURCE).toContain("stats: StatsData");
    });

    it("accepts ImpactV4Result prop", () => {
      expect(SOURCE).toContain("impact: ImpactV4Result");
    });

    it("has optional interactive flag", () => {
      expect(SOURCE).toContain("interactive?:");
    });
  });

  describe("delegates content to BadgeContent", () => {
    it("imports BadgeContent component", () => {
      expect(SOURCE).toContain("BadgeContent");
    });

    it("imports getBadgeContentCSS helper", () => {
      expect(SOURCE).toContain("getBadgeContentCSS");
    });

    it("passes scoreEffect to BadgeContent", () => {
      expect(SOURCE).toContain("scoreEffect={config.scoreEffect}");
    });

    it("passes heatmapAnimation to BadgeContent", () => {
      expect(SOURCE).toContain("heatmapAnimation={config.heatmapAnimation}");
    });

    it("passes statsDisplay to BadgeContent", () => {
      expect(SOURCE).toContain("statsDisplay={config.statsDisplay}");
    });

    it("passes tierTreatment to BadgeContent", () => {
      expect(SOURCE).toContain("tierTreatment={config.tierTreatment}");
    });
  });

  describe("testability attributes", () => {
    it("has badge-preview test id on outer container", () => {
      expect(SOURCE).toContain('data-testid="badge-preview"');
    });

    it("has badge-card test id on card element", () => {
      expect(SOURCE).toContain('data-testid="badge-card"');
    });

    it("tracks card style via data attribute", () => {
      expect(SOURCE).toContain("data-card-style={config.cardStyle}");
    });
  });

  describe("background layer", () => {
    it("conditionally renders AuroraBackground for aurora config", () => {
      expect(SOURCE).toContain('config.background === "aurora"');
      expect(SOURCE).toContain("AuroraBackground");
    });

    it("marks aurora with data-effect attribute", () => {
      expect(SOURCE).toContain("data-effect=\"aurora\"");
    });

    it("conditionally renders particles for particles config", () => {
      expect(SOURCE).toContain('config.background === "particles"');
      expect(SOURCE).toContain("data-effect=\"particles\"");
    });
  });

  describe("border layer", () => {
    it("conditionally renders GradientBorder", () => {
      expect(SOURCE).toContain('config.border === "gradient-rotating"');
      expect(SOURCE).toContain("GradientBorder");
    });

    it("marks gradient border with data-effect attribute", () => {
      expect(SOURCE).toContain("data-effect=\"gradient-border\"");
    });
  });

  describe("card styling", () => {
    it("uses glassStyle for non-flat card styles", () => {
      expect(SOURCE).toContain("glassStyle");
    });

    it("handles flat card style differently", () => {
      expect(SOURCE).toContain('"flat"');
    });
  });

  describe("interaction layer", () => {
    it("supports tilt-3d interaction", () => {
      expect(SOURCE).toContain('"tilt-3d"');
      expect(SOURCE).toContain("useTilt");
    });

    it("supports holographic interaction", () => {
      expect(SOURCE).toContain('"holographic"');
      expect(SOURCE).toContain("HolographicOverlay");
    });
  });

  describe("celebration layer", () => {
    it("supports confetti celebration", () => {
      expect(SOURCE).toContain('config.celebration === "confetti"');
      expect(SOURCE).toContain("fireSingleBurst");
    });
  });

  describe("CSS injection", () => {
    it("injects required CSS via style tag", () => {
      expect(SOURCE).toContain("<style>");
    });

    it("uses getBadgeContentCSS for content CSS", () => {
      expect(SOURCE).toContain("getBadgeContentCSS");
    });

    it("conditionally includes GRADIENT_BORDER_CSS", () => {
      expect(SOURCE).toContain("GRADIENT_BORDER_CSS");
    });

    it("conditionally includes HOLOGRAPHIC_CSS", () => {
      expect(SOURCE).toContain("HOLOGRAPHIC_CSS");
    });
  });

  describe("lazy-loaded effects (dynamic imports)", () => {
    it("imports next/dynamic", () => {
      expect(SOURCE).toContain("from \"next/dynamic\"");
    });

    it("lazy-loads AuroraBackground via dynamic()", () => {
      expect(SOURCE).toMatch(
        /dynamic\(\s*\(\)\s*=>\s*import\(["']@\/lib\/effects\/backgrounds\/AuroraBackground["']\)/,
      );
    });

    it("lazy-loads ParticleCanvas via dynamic()", () => {
      // ParticleCanvas wraps useParticles and should be in its own dynamic chunk
      expect(SOURCE).toMatch(
        /dynamic\(\s*\(\)\s*=>\s*import\(["'].*Particle/,
      );
    });

    it("lazy-loads GradientBorder via dynamic()", () => {
      expect(SOURCE).toMatch(
        /dynamic\(\s*\(\)\s*=>\s*import\(["']@\/lib\/effects\/borders\/GradientBorder["']\)/,
      );
    });

    it("lazy-loads HolographicOverlay via dynamic()", () => {
      expect(SOURCE).toMatch(
        /dynamic\(\s*\(\)\s*=>\s*import\(["']@\/lib\/effects\/interactions\/HolographicOverlay["']\)/,
      );
    });

    it("disables SSR for all dynamic effect components", () => {
      // Count occurrences of ssr: false in dynamic() option objects
      const ssrFalseCount = (SOURCE.match(/ssr:\s*false/g) ?? []).length;
      expect(ssrFalseCount).toBeGreaterThanOrEqual(4);
    });

    it("provides loading fallbacks for dynamic components", () => {
      // Count occurrences of loading: in dynamic() option objects
      const loadingCount = (SOURCE.match(/loading:\s*\(\)/g) ?? []).length;
      expect(loadingCount).toBeGreaterThanOrEqual(4);
    });

    it("does NOT eagerly import AuroraBackground component", () => {
      // Static import of AuroraBackground should be gone
      expect(SOURCE).not.toMatch(
        /^import\s+\{[^}]*AuroraBackground[^}]*\}\s+from/m,
      );
    });

    it("does NOT eagerly import ParticleBackground module", () => {
      // Static import of useParticles/PARTICLE_PRESETS should be gone
      expect(SOURCE).not.toMatch(
        /^import\s+\{[^}]*useParticles[^}]*\}\s+from/m,
      );
    });

    it("does NOT eagerly import GradientBorder component", () => {
      // Static import of GradientBorder component should be gone (CSS constant may still be imported)
      expect(SOURCE).not.toMatch(
        /^import\s+\{[^}]*GradientBorder[^}]*\}\s+from\s+["']@\/lib\/effects\/borders\/GradientBorder["']/m,
      );
    });

    it("does NOT eagerly import HolographicOverlay component", () => {
      // Static import of HolographicOverlay component should be gone (CSS constant may still be imported)
      expect(SOURCE).not.toMatch(
        /^import\s+\{[^}]*HolographicOverlay[^}]*\}\s+from\s+["']@\/lib\/effects\/interactions\/HolographicOverlay["']/m,
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Runtime tests (render + behavior)
// ═══════════════════════════════════════════════════════════════════════

describe("BadgePreviewCard — runtime render", () => {
  describe("basic render", () => {
    it("renders the card container and BadgeContent", () => {
      render(
        <BadgePreviewCard config={defaultConfig} stats={stats} impact={impact} />,
      );
      expect(screen.getByTestId("badge-preview")).toBeDefined();
      expect(screen.getByTestId("badge-card")).toBeDefined();
      expect(screen.getByTestId("badge-content")).toBeDefined();
    });
  });

  describe("glass styling", () => {
    it("applies glass inline styles when cardStyle is glass variant", () => {
      render(
        <BadgePreviewCard
          config={{ ...defaultConfig, cardStyle: "frost" }}
          stats={stats}
          impact={impact}
        />,
      );
      expect(glassStyle).toHaveBeenCalledWith("frost");
      const card = screen.getByTestId("badge-card");
      // glassStyle mock returns { backdropFilter: "blur(10px)" } — jsdom applies valid CSS
      const styleAttr = card.getAttribute("style") ?? "";
      expect(styleAttr).toContain("blur(10px)");
      // Card should NOT have bg-card class when glass is active
      expect(card.className).not.toContain("bg-card");
    });

    it("does not apply glass styles when cardStyle is flat", () => {
      render(
        <BadgePreviewCard
          config={{ ...defaultConfig, cardStyle: "flat" }}
          stats={stats}
          impact={impact}
        />,
      );
      expect(glassStyle).not.toHaveBeenCalled();
      const card = screen.getByTestId("badge-card");
      expect(card.style.backdropFilter).toBe("");
    });
  });

  describe("tilt interaction disabled", () => {
    it("renders without tilt when interactive is false", () => {
      render(
        <BadgePreviewCard
          config={{ ...defaultConfig, interaction: "tilt-3d" }}
          stats={stats}
          impact={impact}
          interactive={false}
        />,
      );
      const card = screen.getByTestId("badge-card");
      // No perspective transform when tilt is disabled
      expect(card.style.transform).toBe("");
    });

    it("mouse events do not crash when tilt is disabled", () => {
      render(
        <BadgePreviewCard
          config={{ ...defaultConfig, interaction: "tilt-3d" }}
          stats={stats}
          impact={impact}
          interactive={false}
        />,
      );
      const card = screen.getByTestId("badge-card");
      // Should not throw
      fireEvent.mouseMove(card);
      fireEvent.mouseLeave(card);
      expect(screen.getByTestId("badge-preview")).toBeDefined();
    });
  });

  describe("conditional overlay rendering", () => {
    it("renders aurora background wrapper when background is aurora", () => {
      render(
        <BadgePreviewCard
          config={{ ...defaultConfig, background: "aurora" }}
          stats={stats}
          impact={impact}
        />,
      );
      const preview = screen.getByTestId("badge-preview");
      expect(preview.querySelector('[data-effect="aurora"]')).not.toBeNull();
    });

    it("does not render aurora wrapper when background is solid", () => {
      render(
        <BadgePreviewCard
          config={{ ...defaultConfig, background: "solid" }}
          stats={stats}
          impact={impact}
        />,
      );
      const preview = screen.getByTestId("badge-preview");
      expect(preview.querySelector('[data-effect="aurora"]')).toBeNull();
    });

    it("renders particles background wrapper when background is particles", () => {
      render(
        <BadgePreviewCard
          config={{ ...defaultConfig, background: "particles" }}
          stats={stats}
          impact={impact}
        />,
      );
      const preview = screen.getByTestId("badge-preview");
      expect(preview.querySelector('[data-effect="particles"]')).not.toBeNull();
    });

    it("renders gradient-border wrapper when border is gradient-rotating", () => {
      render(
        <BadgePreviewCard
          config={{ ...defaultConfig, border: "gradient-rotating" }}
          stats={stats}
          impact={impact}
        />,
      );
      const preview = screen.getByTestId("badge-preview");
      expect(preview.querySelector('[data-effect="gradient-border"]')).not.toBeNull();
    });

    it("renders holographic overlay when interaction is holographic and interactive", () => {
      render(
        <BadgePreviewCard
          config={{ ...defaultConfig, interaction: "holographic" }}
          stats={stats}
          impact={impact}
          interactive={true}
        />,
      );
      // The holographic overlay is a dynamic component; in test it renders the loading fallback
      const preview = screen.getByTestId("badge-preview");
      // The HolographicOverlay wraps the card content — check that the loading element appears
      const holographicLoading = preview.querySelector('[data-effect="holographic-loading"]');
      // Dynamic mock renders loading fallback which has data-effect="holographic-loading"
      expect(holographicLoading).not.toBeNull();
    });
  });

  describe("badge content props pass-through", () => {
    it("passes scoreEffect and heatmapAnimation to BadgeContent", () => {
      render(
        <BadgePreviewCard
          config={{
            ...defaultConfig,
            scoreEffect: "gold-shimmer",
            heatmapAnimation: "ripple",
          }}
          stats={stats}
          impact={impact}
        />,
      );
      const content = screen.getByTestId("badge-content");
      expect(content.getAttribute("data-score-effect")).toBe("gold-shimmer");
      expect(content.getAttribute("data-heatmap-animation")).toBe("ripple");
    });

    it("passes statsDisplay and tierTreatment to BadgeContent", () => {
      render(
        <BadgePreviewCard
          config={{
            ...defaultConfig,
            statsDisplay: "animated-ease",
            tierTreatment: "enhanced",
          }}
          stats={stats}
          impact={impact}
        />,
      );
      const content = screen.getByTestId("badge-content");
      expect(content.getAttribute("data-stats-display")).toBe("animated-ease");
      expect(content.getAttribute("data-tier-treatment")).toBe("enhanced");
    });

    it("passes stats handle and impact score to BadgeContent", () => {
      render(
        <BadgePreviewCard config={defaultConfig} stats={stats} impact={impact} />,
      );
      const content = screen.getByTestId("badge-content");
      expect(content.getAttribute("data-handle")).toBe("testuser");
      expect(content.getAttribute("data-score")).toBe("65");
    });
  });
});
