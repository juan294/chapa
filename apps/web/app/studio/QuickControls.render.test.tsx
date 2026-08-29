// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { QuickControls } from "./QuickControls";
import type { BadgeConfig } from "@chapa/shared";
import { LanguageProvider } from "@/lib/i18n";
import { es } from "@/lib/i18n/dictionaries/es";

vi.mock("@/lib/effects/defaults", () => ({
  STUDIO_PRESETS: [
    { id: "minimal", label: "Minimal", config: {} },
    { id: "flashy", label: "Flashy", config: {} },
  ],
}));

afterEach(cleanup);

const baseConfig: BadgeConfig = {
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

  it("shows /save and /reset action buttons", () => {
    render(
      <QuickControls
        config={baseConfig}
        onCommand={vi.fn()}
        visible={true}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("/save")).toBeDefined();
    expect(screen.getByText("/reset")).toBeDefined();
  });

  it("sends /save command", () => {
    const onCommand = vi.fn();
    render(
      <QuickControls
        config={baseConfig}
        onCommand={onCommand}
        visible={true}
        onToggle={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("/save"));
    expect(onCommand).toHaveBeenCalledWith("/save");
  });

  it("sends /reset command", () => {
    const onCommand = vi.fn();
    render(
      <QuickControls
        config={baseConfig}
        onCommand={onCommand}
        visible={true}
        onToggle={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("/reset"));
    expect(onCommand).toHaveBeenCalledWith("/reset");
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

  it("disables the save entry point while a save is in progress", () => {
    render(
      <QuickControls
        config={baseConfig}
        onCommand={vi.fn()}
        visible={true}
        onToggle={vi.fn()}
        saveDisabled
      />,
    );

    expect(
      screen.getByRole("button", { name: "/save" }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("renders and dispatches the human confirmation gate for an agent save", () => {
    const onConfirmAgentSave = vi.fn();
    const onDismissAgentSave = vi.fn();
    render(
      <QuickControls
        config={baseConfig}
        onCommand={vi.fn()}
        visible={true}
        onToggle={vi.fn()}
        agentSaveProposal={{
          onConfirm: onConfirmAgentSave,
          onDismiss: onDismissAgentSave,
        }}
      />,
    );

    expect(
      screen.getByText("An agent wants to save this preview configuration."),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Confirm save" }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onConfirmAgentSave).toHaveBeenCalledOnce();
    expect(onDismissAgentSave).toHaveBeenCalledOnce();
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
    expect(screen.getByRole("button", { name: "/save" })).toBeDefined();
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
        config={{ ...baseConfig, background: "aurora", celebration: "confetti" }}
        onCommand={vi.fn()}
        visible
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByTestId("studio-changed-count").textContent).toBe(
      "2 of 9 changed",
    );
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
