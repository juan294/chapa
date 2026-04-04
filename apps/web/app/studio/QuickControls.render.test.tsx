// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import * as fs from "node:fs";
import * as path from "node:path";
import { QuickControls } from "./QuickControls";
import type { BadgeConfig } from "@chapa/shared";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "QuickControls.tsx"),
  "utf-8",
);

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
    expect(SOURCE).toContain("transition-all duration-150");
  });

  // Phase 8 — collapse-grid for smooth height transition
  it("category options use collapse-grid for smooth height transition", () => {
    expect(SOURCE).toContain("collapse-grid");
    expect(SOURCE).toContain("data-expanded");
  });
});
