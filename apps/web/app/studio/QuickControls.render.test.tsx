// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { QuickControls } from "./QuickControls";
import type { BadgeConfig } from "@chapa/shared";
import { LanguageProvider } from "@/lib/i18n";
import { es } from "@/lib/i18n/dictionaries/es";

vi.mock("@/lib/effects/defaults", () => ({
  STUDIO_PRESETS: [
    // Real-shaped configs: #1243 marks the applied preset by comparing every
    // category, so an empty config would never match and the marker would be
    // untestable.
    {
      id: "minimal",
      label: "Minimal",
      config: {
        background: "solid",
        cardStyle: "flat",
        border: "solid-amber",
        scoreEffect: "standard",
        heatmapAnimation: "fade-in",
        tierTreatment: "standard",
        colorPalette: "jade",
      },
    },
    {
      id: "flashy",
      label: "Flashy",
      config: {
        background: "aurora",
        cardStyle: "crystal",
        border: "gradient-rotating",
        scoreEffect: "gold-shimmer",
        heatmapAnimation: "scatter",
        tierTreatment: "enhanced",
        colorPalette: "indigo",
      },
    },
  ],
}));

afterEach(cleanup);

const baseConfig: BadgeConfig = {
  background: "solid",
  cardStyle: "flat",
  border: "solid-amber",
  scoreEffect: "standard",
  heatmapAnimation: "fade-in",
  tierTreatment: "standard",
  colorPalette: "jade",
};

describe("QuickControls", () => {
  it("shows expand button when not visible", () => {
    render(
      <QuickControls
        config={baseConfig}
        onCommand={vi.fn()}
        visible={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("Quick Controls")).toBeDefined();
    const toggle = screen.getByRole("button", { name: "Quick Controls" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBeTruthy();
  });

  // UX-M1 (#1173): the toggle was the only pointer affordance for Studio's 9
  // customization categories, styled at ~2.3:1 contrast (text-terminal-dim).
  // Promoted to the standard secondary-text token.
  it("uses text-text-secondary (not the low-contrast text-terminal-dim) for the toggle label", () => {
    render(
      <QuickControls
        config={baseConfig}
        onCommand={vi.fn()}
        visible={false}
        onToggle={vi.fn()}
      />,
    );
    const toggle = screen.getByRole("button", { name: "Quick Controls" });
    expect(toggle.className).toContain("text-text-secondary");
    expect(toggle.className).not.toContain("text-terminal-dim");
  });

  it("calls onToggle when expand button clicked", () => {
    const toggle = vi.fn();
    render(
      <QuickControls
        config={baseConfig}
        onCommand={vi.fn()}
        visible={false}
        onToggle={toggle}
      />,
    );
    fireEvent.click(screen.getByText("Quick Controls"));
    expect(toggle).toHaveBeenCalled();
  });

  it("renders presets when visible", () => {
    render(
      <QuickControls
        config={baseConfig}
        onCommand={vi.fn()}
        visible={true}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("Minimal")).toBeDefined();
    expect(screen.getByText("Flashy")).toBeDefined();
  });

  it("sends preset command on click", () => {
    const onCommand = vi.fn();
    render(
      <QuickControls
        config={baseConfig}
        onCommand={onCommand}
        visible={true}
        onToggle={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Minimal"));
    expect(onCommand).toHaveBeenCalledWith("/preset minimal");
  });

  // UX-L1 (#1187): the current-value indicator next to each category label
  // was `text-[10px]` — below the design-system's documented 11px type-scale
  // floor, and compounded by the low-contrast `text-terminal-dim` color.
  // Unlike the uppercase tracking-wide section headings in this file (which
  // are intentionally left at 10px as hierarchy micro-labels), this is
  // ordinary content text the user needs to read, so it's raised to the
  // standard text-xs (12px) step already used by its sibling label span.
  it("renders the category current-value indicator at text-xs, not a sub-11px arbitrary size", () => {
    render(
      <QuickControls
        config={baseConfig}
        onCommand={vi.fn()}
        visible={true}
        onToggle={vi.fn()}
      />,
    );
    const valueSpan = screen.getByText("solid");
    expect(valueSpan.className).toContain("text-xs");
    expect(valueSpan.className).not.toContain("text-[10px]");
  });

  it("renders category labels", () => {
    render(
      <QuickControls
        config={baseConfig}
        onCommand={vi.fn()}
        visible={true}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("Background")).toBeDefined();
    expect(screen.getByText("Score Effect")).toBeDefined();
  });

  it("expands category on click to show options", () => {
    render(
      <QuickControls
        config={baseConfig}
        onCommand={vi.fn()}
        visible={true}
        onToggle={vi.fn()}
      />,
    );
    // Click on the Background category button
    fireEvent.click(screen.getByText("Background"));
    // Options should now be visible — "Solid Dark" should appear as an option
    expect(screen.getByText("Solid Dark")).toBeDefined();
  });

  it("sends set command when option clicked", () => {
    const onCommand = vi.fn();
    render(
      <QuickControls
        config={baseConfig}
        onCommand={onCommand}
        visible={true}
        onToggle={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Background"));
    // Find and click Aurora Glow option
    fireEvent.click(screen.getByText("Aurora Glow"));
    expect(onCommand).toHaveBeenCalledWith("/set bg aurora");
  });

  it("collapses expanded category when clicked again", () => {
    render(
      <QuickControls
        config={baseConfig}
        onCommand={vi.fn()}
        visible={true}
        onToggle={vi.fn()}
      />,
    );
    const bgButton = screen.getByText("Background");
    fireEvent.click(bgButton);
    expect(screen.getByText("Aurora Glow")).toBeDefined();
  });

  // Phase 6 — icon cross-fade transition
  it("toggle button icons use cross-fade transition", () => {
    render(
      <QuickControls
        config={baseConfig}
        onCommand={vi.fn()}
        visible={true}
        onToggle={vi.fn()}
      />,
    );
    const toggleButton = screen.getByText("Quick Controls").closest("button")!;
    const icons = toggleButton.querySelectorAll("svg");
    expect(icons).toHaveLength(2);
    icons.forEach((icon) => {
      expect(icon.getAttribute("class")).toContain("transition-all duration-150");
    });
  });

  // Phase 8 — collapse-grid for smooth height transition
  it("category options use collapse-grid for smooth height transition", () => {
    render(
      <QuickControls
        config={baseConfig}
        onCommand={vi.fn()}
        visible={true}
        onToggle={vi.fn()}
      />,
    );
    const bgButton = screen.getByText("Background");
    const wrapper = bgButton.closest("button")!.nextElementSibling as HTMLElement;
    expect(wrapper.className).toContain("collapse-grid");
    expect(wrapper.getAttribute("data-expanded")).toBe("false");
    expect(wrapper.getAttribute("aria-hidden")).toBe("true");
    expect(wrapper.hasAttribute("inert")).toBe(true);
    expect(bgButton.closest("button")!.getAttribute("aria-controls")).toBe(
      wrapper.id,
    );

    fireEvent.click(bgButton);
    expect(wrapper.getAttribute("data-expanded")).toBe("true");
    expect(wrapper.getAttribute("aria-hidden")).toBe("false");
    expect(wrapper.hasAttribute("inert")).toBe(false);
  });

  it("renders Spanish control copy while command identifiers stay unchanged", () => {
    render(
      <LanguageProvider initialLocale="es" dictionary={es}>
        <QuickControls
          config={baseConfig}
          onCommand={vi.fn()}
          visible={true}
          onToggle={vi.fn()}
        />
      </LanguageProvider>,
    );

    expect(screen.getByText("Controles rápidos")).toBeDefined();
    expect(screen.getByText("Preajustes")).toBeDefined();
    expect(screen.getByText("Fondo")).toBeDefined();
    fireEvent.click(screen.getByText("Fondo"));
    expect(screen.getByText("Aurora luminosa")).toBeDefined();
  });
});

// #1216 — Quick Controls stops being a 48-64px accordion window. The category
// list owns the column, every option carries its description, and a counter
// says how far the config has drifted from the default.
describe("QuickControls — v2 controls column (#1216)", () => {
  it("shows 'default config' when nothing has changed", () => {
    render(
      <QuickControls
        config={baseConfig}
        onCommand={vi.fn()}
        visible
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByTestId("studio-changed-count").textContent).toBe(
      "default config",
    );
  });

  it("counts how many categories differ from the default", () => {
    render(
      <QuickControls
        config={{ ...baseConfig, background: "aurora", scoreEffect: "chrome" }}
        onCommand={vi.fn()}
        visible
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByTestId("studio-changed-count").textContent).toBe(
      "2 of 7 changed",
    );
  });

  // #1245 — the pixel spec in CHANGE-color-palette.md, value for value.
  it("builds the palette swatch strip to the pixel spec (#1245)", () => {
    render(
      <QuickControls
        config={baseConfig}
        onCommand={vi.fn()}
        visible
        onToggle={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Color Palette"));

    const strip = screen.getByTestId("swatch-colorPalette-indigo");
    // Third child of the button, under label and description - never beside
    // the label, never outside the button.
    const chip = strip.closest("button") as HTMLElement;
    expect(Array.from(chip.children).indexOf(strip)).toBe(2);
    expect(strip.className).toContain("mt-[3px]");
    expect(strip.className).toContain("gap-1");

    const dots = Array.from(strip.children) as HTMLElement[];
    expect(dots).toHaveLength(3);
    for (const dot of dots) {
      // 14x14, 4px radius (a rounded square - a circle reads as a radio input),
      // and the heavier hairline, without which dark primaries vanish into a
      // dark-theme chip.
      expect(dot.className).toContain("size-3.5");
      expect(dot.className).toContain("rounded-[4px]");
      expect(dot.className).toContain("border-stroke-strong");
    }
  });

  it("shows the palette's own colours on each palette option (#1242)", () => {
    render(
      <QuickControls
        config={baseConfig}
        onCommand={vi.fn()}
        visible
        onToggle={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Color Palette"));

    // The swatch is the ground, card and accent the badge will actually use,
    // read from the renderer rather than re-typed here.
    const swatch = screen.getByTestId("swatch-colorPalette-indigo");
    const colors = Array.from(swatch.children).map(
      (dot) => (dot as HTMLElement).style.backgroundColor,
    );
    expect(colors).toHaveLength(3);
    expect(colors).toContain("rgb(155, 170, 255)"); // #9BAAFF, the indigo accent
    // Decorative: the label and description carry the meaning.
    expect(swatch.getAttribute("aria-hidden")).toBe("true");
  });

  it("puts swatches only on the category whose choice is a colour", () => {
    render(
      <QuickControls
        config={baseConfig}
        onCommand={vi.fn()}
        visible
        onToggle={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Background"));
    expect(screen.queryByTestId("swatch-background-aurora")).toBeNull();
  });

  it("keeps the counter out of the toggle button's accessible name", () => {
    render(
      <QuickControls
        config={baseConfig}
        onCommand={vi.fn()}
        visible
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Quick Controls" })).toBeDefined();
  });

  it("shows a description under every option label", () => {
    render(
      <QuickControls
        config={baseConfig}
        onCommand={vi.fn()}
        visible
        onToggle={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Background"));
    expect(screen.getByText("Animated color waves")).toBeDefined();
    expect(screen.getByText("Floating sparkle particles")).toBeDefined();
  });

  it("marks the selected option with aria-pressed rather than a glyph in its label", () => {
    render(
      <QuickControls
        config={{ ...baseConfig, background: "aurora" }}
        onCommand={vi.fn()}
        visible
        onToggle={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Background"));
    const selected = screen
      .getByText("Aurora Glow")
      .closest("button") as HTMLButtonElement;
    expect(selected.getAttribute("aria-pressed")).toBe("true");
    const other = screen
      .getByText("Particles")
      .closest("button") as HTMLButtonElement;
    expect(other.getAttribute("aria-pressed")).toBe("false");
  });

  it("carries selection in the text-safe accent, never the raw fill token", () => {
    render(
      <QuickControls
        config={baseConfig}
        onCommand={vi.fn()}
        visible={true}
        onToggle={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Background"));

    // The raw fill token `text-amber` measures 2.75:1 against the light
    // ground. The label uses `text-amber-text` instead (#1243) — the
    // theme-aware, text-safe counterpart at 5.28:1 light and 11.94:1 dark —
    // which is what makes the handoff's accent-coloured selected label
    // (#1245) affordable at all.
    const selected = screen.getByRole("button", { name: /Solid Dark/ });
    expect(selected.getAttribute("aria-pressed")).toBe("true");
    expect(selected.className).toContain("border-amber");
    const label = selected.querySelector("span")!;
    expect(label.className).toContain("text-amber-text");
    expect(label.className.split(/\s+/)).not.toContain("text-amber");
  });

  it("gives every option a 44px hit area", () => {
    render(
      <QuickControls
        config={baseConfig}
        onCommand={vi.fn()}
        visible
        onToggle={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Background"));
    const option = screen
      .getByText("Aurora Glow")
      .closest("button") as HTMLButtonElement;
    expect(option.className).toContain("min-h-[44px]");
  });
});

// #1191 step 5 — the three categories that could never reach the embeddable
// badge were removed rather than labelled, so Quick Controls now offers only
// controls that change the artifact. No "preview only" marker survives,
// because there is nothing left to mark.
// #1243 — the shipped column drifted from templates/studio-v3: the category
// list was capped at the height that suited #1216's narrow sticky column, the
// presets were buried under the Quick Controls label with no selected state,
// and the rows had no disclosure affordance.
describe("QuickControls — v3 fidelity (#1243)", () => {
  const render_ = (config = baseConfig) =>
    render(
      <QuickControls
        config={config}
        onCommand={vi.fn()}
        visible
        onToggle={vi.fn()}
      />,
    );

  it("lets the category list flow instead of capping it to a scroll window", () => {
    render_();
    const list = screen.getByTestId("qc-categories");
    // 256px was right beside a 50%-width preview; in the v3 tools column it is
    // a small scroll window above a large void.
    expect(list.className).not.toContain("max-h-64");
    expect(list.className).not.toContain("overflow-y-auto");
  });

  it("gives presets their own section above Quick Controls", () => {
    render_();
    const presets = screen.getByTestId("qc-presets");
    const label = screen.getByText("Quick Controls");
    expect(
      presets.compareDocumentPosition(label) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("marks the preset whose config is currently applied", () => {
    // baseConfig is the default, which is exactly the Minimal preset.
    render_();
    const minimal = screen.getByRole("button", { name: /Minimal/ });
    expect(minimal.getAttribute("aria-pressed")).toBe("true");
    expect(minimal.className).toContain("bg-amber/10");

    const flashy = screen.getByRole("button", { name: /Flashy/ });
    expect(flashy.getAttribute("aria-pressed")).toBe("false");
    expect(flashy.className).not.toContain("bg-amber/10");
    expect(flashy.className).toContain("border-stroke");
  });

  it("gives every preset and category row a 44px+ hit area", () => {
    render_();
    for (const preset of screen.getAllByTestId(/^qc-preset-/)) {
      expect(preset.className).toContain("min-h-[44px]");
    }
    for (const row of screen.getAllByTestId(/^qc-category-/)) {
      expect(row.className).toContain("min-h-[52px]");
    }
  });

  it("shows a disclosure chevron that follows the expanded state", () => {
    render_();
    const row = screen.getByTestId("qc-category-background");
    const chevron = screen.getByTestId("qc-chevron-background");
    expect(chevron.textContent).toBe("\u25b8");
    expect(chevron.getAttribute("aria-hidden")).toBe("true");

    fireEvent.click(row);
    expect(screen.getByTestId("qc-chevron-background").textContent).toBe(
      "\u25be",
    );
  });

  it("renders the current value in an accent that clears AA on the column ground", () => {
    render_();
    // `text-amber` measures 2.75:1 on the light ground. `--color-amber-text` is
    // the theme-aware, text-safe counterpart (5.28:1 light, 11.94:1 dark), the
    // same shape as --color-complement-text.
    const value = screen.getByTestId("qc-value-background");
    expect(value.className).toContain("text-amber-text");
    expect(value.className).not.toContain("text-terminal-dim");
  });

  it("wraps options as chips rather than stacking them one per row", () => {
    render_();
    fireEvent.click(screen.getByTestId("qc-category-background"));
    const options = screen.getByTestId("qc-options-background");
    expect(options.className).toContain("flex-wrap");
    expect(options.className).not.toContain("flex-col");
  });
});

describe("QuickControls offers only categories that reach the badge (#1191)", () => {
  function renderControls() {
    render(
      <QuickControls
        config={baseConfig}
        onCommand={vi.fn()}
        visible
        onToggle={vi.fn()}
      />,
    );
  }

  it("renders no preview-only marker at all", () => {
    renderControls();
    expect(
      document.querySelectorAll('[data-testid^="preview-only-"]'),
    ).toHaveLength(0);
  });

  it("offers exactly the six shipping categories", () => {
    renderControls();
    for (const label of [
      "Background",
      "Card Style",
      "Border",
      "Score Effect",
      "Heatmap Animation",
      "Tier Treatment",
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("offers none of the retired categories", () => {
    renderControls();
    for (const label of ["Interaction", "Stats Display", "Celebration"]) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });
});
