// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DeltaIndicator } from "./DeltaIndicator";

afterEach(cleanup);

describe("DeltaIndicator", () => {
  it("shows green text and up arrow for positive delta", () => {
    render(<DeltaIndicator delta={12} />);

    const el = screen.getByLabelText("Score changed by +12 points");
    expect(el.classList.contains("text-terminal-green")).toBe(true);
    expect(el.textContent).toContain("\u2191"); // ↑
  });

  it("shows red text and down arrow for negative delta", () => {
    render(<DeltaIndicator delta={-5} />);

    const el = screen.getByLabelText("Score changed by -5 points");
    expect(el.classList.contains("text-terminal-red")).toBe(true);
    expect(el.textContent).toContain("\u2193"); // ↓
  });

  it("shows gray text and right arrow for zero delta (abs < 0.5)", () => {
    render(<DeltaIndicator delta={0.3} />);

    const el = screen.getByLabelText("Score unchanged");
    expect(el.classList.contains("text-text-secondary")).toBe(true);
    expect(el.textContent).toContain("\u2192"); // →
    expect(el.textContent).toContain("\u2014"); // em dash
  });

  it("treats exactly zero as unchanged", () => {
    render(<DeltaIndicator delta={0} />);

    const el = screen.getByLabelText("Score unchanged");
    expect(el.classList.contains("text-text-secondary")).toBe(true);
    expect(el.textContent).toContain("\u2192"); // →
  });

  it("formats delta to 1 decimal if fractional", () => {
    render(<DeltaIndicator delta={3.7} />);

    expect(screen.getByLabelText("Score changed by +3.7 points").textContent).toContain("+3.7");
  });

  it("formats delta as integer if whole number", () => {
    render(<DeltaIndicator delta={12} />);

    const el = screen.getByLabelText("Score changed by +12 points");
    expect(el.textContent).toContain("+12");
    // Should NOT show "+12.0"
    expect(el.textContent).not.toContain("+12.0");
  });

  it("has correct aria-label for positive delta", () => {
    render(<DeltaIndicator delta={8} />);
    expect(screen.getByLabelText("Score changed by +8 points")).toBeDefined();
  });

  it("has correct aria-label for negative delta", () => {
    render(<DeltaIndicator delta={-3.2} />);
    expect(screen.getByLabelText("Score changed by -3.2 points")).toBeDefined();
  });

  it("shows optional label text", () => {
    render(<DeltaIndicator delta={5} label="vs last week" />);

    const el = screen.getByLabelText("Score changed by +5 points");
    expect(el.textContent).toContain("vs last week");
  });

  it("renders in small size by default (text-xs)", () => {
    render(<DeltaIndicator delta={4} />);

    const el = screen.getByLabelText("Score changed by +4 points");
    expect(el.classList.contains("text-xs")).toBe(true);
  });

  it('renders in medium size when size="md" (text-sm)', () => {
    render(<DeltaIndicator delta={4} size="md" />);

    const el = screen.getByLabelText("Score changed by +4 points");
    expect(el.classList.contains("text-sm")).toBe(true);
  });
});
