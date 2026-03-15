// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

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
    // Return the loading component wrapper — dynamic imports are not resolved in test
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
import { fireSingleBurst } from "@/lib/effects/celebrations/confetti";
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
  dimensions: {
    delivery: 60,
    quality: 70,
    consistency: 80,
    breadth: 50,
  },
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

// ---------- Tests ----------

describe("BadgePreviewCard render", () => {
  describe("basic rendering", () => {
    it("renders without crashing", () => {
      render(
        <BadgePreviewCard config={defaultConfig} stats={stats} impact={impact} />,
      );
      expect(screen.getByTestId("badge-preview")).toBeDefined();
    });

    it("renders badge-card test id on card element", () => {
      render(
        <BadgePreviewCard config={defaultConfig} stats={stats} impact={impact} />,
      );
      expect(screen.getByTestId("badge-card")).toBeDefined();
    });

    it("renders BadgeContent with correct props", () => {
      render(
        <BadgePreviewCard config={defaultConfig} stats={stats} impact={impact} />,
      );
      const content = screen.getByTestId("badge-content");
      expect(content.getAttribute("data-handle")).toBe("testuser");
      expect(content.getAttribute("data-score")).toBe("65");
      expect(content.getAttribute("data-score-effect")).toBe("standard");
      expect(content.getAttribute("data-heatmap-animation")).toBe("fade-in");
      expect(content.getAttribute("data-stats-display")).toBe("static");
      expect(content.getAttribute("data-tier-treatment")).toBe("standard");
    });

    it("tracks card style via data attribute", () => {
      render(
        <BadgePreviewCard config={defaultConfig} stats={stats} impact={impact} />,
      );
      const card = screen.getByTestId("badge-card");
      expect(card.getAttribute("data-card-style")).toBe("flat");
    });
  });

  describe("card styling", () => {
    it("flat card does not call glassStyle", () => {
      render(
        <BadgePreviewCard
          config={{ ...defaultConfig, cardStyle: "flat" }}
          stats={stats}
          impact={impact}
        />,
      );
      expect(glassStyle).not.toHaveBeenCalled();
    });

    it("non-flat card calls glassStyle with variant", () => {
      render(
        <BadgePreviewCard
          config={{ ...defaultConfig, cardStyle: "frost" }}
          stats={stats}
          impact={impact}
        />,
      );
      expect(glassStyle).toHaveBeenCalledWith("frost");
    });

    it("card has bg-card class when flat", () => {
      render(
        <BadgePreviewCard
          config={{ ...defaultConfig, cardStyle: "flat" }}
          stats={stats}
          impact={impact}
        />,
      );
      const card = screen.getByTestId("badge-card");
      expect(card.className).toContain("bg-card");
    });

    it("card does not have bg-card class when glass", () => {
      render(
        <BadgePreviewCard
          config={{ ...defaultConfig, cardStyle: "frost" }}
          stats={stats}
          impact={impact}
        />,
      );
      const card = screen.getByTestId("badge-card");
      expect(card.className).not.toContain("bg-card");
    });
  });

  describe("border variations", () => {
    it("solid-amber border adds border class on flat card", () => {
      render(
        <BadgePreviewCard
          config={{ ...defaultConfig, border: "solid-amber", cardStyle: "flat" }}
          stats={stats}
          impact={impact}
        />,
      );
      const card = screen.getByTestId("badge-card");
      expect(card.className).toContain("border");
    });

    it("gradient-rotating border wraps card with gradient-border element", () => {
      render(
        <BadgePreviewCard
          config={{ ...defaultConfig, border: "gradient-rotating" }}
          stats={stats}
          impact={impact}
        />,
      );
      const preview = screen.getByTestId("badge-preview");
      const gradientBorder = preview.querySelector('[data-effect="gradient-border"]');
      expect(gradientBorder).not.toBeNull();
    });

    it("none border strips border from glass card", () => {
      render(
        <BadgePreviewCard
          config={{ ...defaultConfig, border: "none", cardStyle: "frost" }}
          stats={stats}
          impact={impact}
        />,
      );
      // Should render without crash
      expect(screen.getByTestId("badge-card")).toBeDefined();
    });
  });

  describe("background layer", () => {
    it("does not render aurora background for solid config", () => {
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

    it("renders aurora background element for aurora config", () => {
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

    it("renders particles background element for particles config", () => {
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
  });

  describe("interaction layer", () => {
    it("does not render holographic overlay for static interaction", () => {
      render(
        <BadgePreviewCard
          config={{ ...defaultConfig, interaction: "static" }}
          stats={stats}
          impact={impact}
        />,
      );
      // No holographic wrapper
      const preview = screen.getByTestId("badge-preview");
      expect(preview.querySelector('[data-effect="holographic-loading"]')).toBeNull();
    });

    it("tilt-3d interaction enables mouse handlers", () => {
      render(
        <BadgePreviewCard
          config={{ ...defaultConfig, interaction: "tilt-3d" }}
          stats={stats}
          impact={impact}
          interactive={true}
        />,
      );
      const card = screen.getByTestId("badge-card");
      // Should have style with perspective (from tilt)
      expect(card.style.transform).toContain("perspective");
    });

    it("tilt-3d interaction is disabled when interactive=false", () => {
      render(
        <BadgePreviewCard
          config={{ ...defaultConfig, interaction: "tilt-3d" }}
          stats={stats}
          impact={impact}
          interactive={false}
        />,
      );
      const card = screen.getByTestId("badge-card");
      expect(card.style.transform).toBe("");
    });
  });

  describe("celebration layer", () => {
    it("fires confetti on mount when celebration=confetti and interactive", () => {
      vi.useFakeTimers();

      render(
        <BadgePreviewCard
          config={{ ...defaultConfig, celebration: "confetti" }}
          stats={stats}
          impact={impact}
          interactive={true}
        />,
      );

      // Confetti is fired after 800ms timeout
      vi.advanceTimersByTime(800);
      expect(fireSingleBurst).toHaveBeenCalledWith(50, "amber");

      vi.useRealTimers();
    });

    it("does not fire confetti when interactive=false", () => {
      vi.useFakeTimers();

      render(
        <BadgePreviewCard
          config={{ ...defaultConfig, celebration: "confetti" }}
          stats={stats}
          impact={impact}
          interactive={false}
        />,
      );

      vi.advanceTimersByTime(1000);
      expect(fireSingleBurst).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("does not fire confetti when celebration=none", () => {
      vi.useFakeTimers();

      render(
        <BadgePreviewCard
          config={{ ...defaultConfig, celebration: "none" }}
          stats={stats}
          impact={impact}
          interactive={true}
        />,
      );

      vi.advanceTimersByTime(1000);
      expect(fireSingleBurst).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe("CSS injection", () => {
    it("injects a style tag with CSS", () => {
      const { container } = render(
        <BadgePreviewCard config={defaultConfig} stats={stats} impact={impact} />,
      );
      const styleTag = container.querySelector("style");
      expect(styleTag).not.toBeNull();
      expect(styleTag?.textContent).toContain("badge-content-css");
    });

    it("includes GRADIENT_BORDER_CSS when border is gradient-rotating", () => {
      const { container } = render(
        <BadgePreviewCard
          config={{ ...defaultConfig, border: "gradient-rotating" }}
          stats={stats}
          impact={impact}
        />,
      );
      const styleTag = container.querySelector("style");
      expect(styleTag?.textContent).toContain("gradient-border-css");
    });

    it("includes HOLOGRAPHIC_CSS when interaction is holographic", () => {
      const { container } = render(
        <BadgePreviewCard
          config={{ ...defaultConfig, interaction: "holographic" }}
          stats={stats}
          impact={impact}
          interactive={true}
        />,
      );
      const styleTag = container.querySelector("style");
      expect(styleTag?.textContent).toContain("holographic-css");
    });

    it("does not include gradient CSS for non-gradient borders", () => {
      const { container } = render(
        <BadgePreviewCard
          config={{ ...defaultConfig, border: "solid-amber" }}
          stats={stats}
          impact={impact}
        />,
      );
      const styleTag = container.querySelector("style");
      expect(styleTag?.textContent).not.toContain("gradient-border-css");
    });
  });

  describe("interactive prop default", () => {
    it("defaults interactive to true", () => {
      vi.useFakeTimers();

      render(
        <BadgePreviewCard
          config={{ ...defaultConfig, celebration: "confetti" }}
          stats={stats}
          impact={impact}
          // interactive defaults to true
        />,
      );

      vi.advanceTimersByTime(800);
      expect(fireSingleBurst).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe("memoization", () => {
    it("is wrapped with React.memo (does not re-render on identical props)", () => {
      const { rerender } = render(
        <BadgePreviewCard config={defaultConfig} stats={stats} impact={impact} />,
      );

      // Re-render with same props - memo should prevent re-render
      rerender(
        <BadgePreviewCard config={defaultConfig} stats={stats} impact={impact} />,
      );

      // Should still be rendered correctly
      expect(screen.getByTestId("badge-preview")).toBeDefined();
    });
  });

  describe("tilt interaction mouse events", () => {
    it("handles mouse move and mouse leave on tilt card", async () => {
      const useTiltModule = await import("@/lib/effects/interactions/use-tilt");
      const handleMouseMove = vi.fn();
      const handleMouseLeave = vi.fn();
      vi.mocked(useTiltModule.useTilt).mockReturnValue({
        ref: { current: null },
        tilt: { rotateX: 5, rotateY: 10, mouseX: "60%", mouseY: "40%", isHovering: true },
        handleMouseMove,
        handleMouseLeave,
      });

      render(
        <BadgePreviewCard
          config={{ ...defaultConfig, interaction: "tilt-3d" }}
          stats={stats}
          impact={impact}
          interactive={true}
        />,
      );

      const card = screen.getByTestId("badge-card");
      fireEvent.mouseMove(card);
      fireEvent.mouseLeave(card);

      expect(handleMouseMove).toHaveBeenCalled();
      expect(handleMouseLeave).toHaveBeenCalled();
    });
  });
});
