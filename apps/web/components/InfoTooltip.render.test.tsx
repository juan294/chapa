// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { InfoTooltip } from "./InfoTooltip";

afterEach(cleanup);

describe("InfoTooltip", () => {
  it("renders trigger button", () => {
    render(<InfoTooltip id="test-tip" content="Test content" />);
    expect(screen.getByLabelText("More info")).toBeDefined();
  });

  it("renders tooltip content", () => {
    render(<InfoTooltip id="test-tip" content="Test content" />);
    expect(screen.getByRole("tooltip")).toBeDefined();
    expect(screen.getByText("Test content")).toBeDefined();
  });

  it("tooltip has correct id", () => {
    render(<InfoTooltip id="test-tip" content="Test content" />);
    expect(screen.getByRole("tooltip").id).toBe("test-tip");
  });

  it("button references tooltip via aria-describedby", () => {
    render(<InfoTooltip id="test-tip" content="Test content" />);
    const btn = screen.getByLabelText("More info");
    expect(btn.getAttribute("aria-describedby")).toBe("test-tip");
  });

  it("toggles open state on click", () => {
    render(
      <InfoTooltip id="test-tip" content="Test content" />,
    );
    const btn = screen.getByLabelText("More info");
    fireEvent.click(btn);
    // When open, tooltip should have opacity-100 class applied
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.className).toContain("!opacity-100");
  });

  it("closes on second click", () => {
    render(<InfoTooltip id="test-tip" content="Test content" />);
    const btn = screen.getByLabelText("More info");
    fireEvent.click(btn);
    fireEvent.click(btn);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.className).not.toContain("!opacity-100");
  });

  it("closes on Escape key", () => {
    render(<InfoTooltip id="test-tip" content="Test content" />);
    const btn = screen.getByLabelText("More info");
    fireEvent.click(btn);
    expect(screen.getByRole("tooltip").className).toContain("!opacity-100");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("tooltip").className).not.toContain("!opacity-100");
  });

  it("closes on outside click", () => {
    render(
      <div>
        <InfoTooltip id="test-tip" content="Test content" />
        <button data-testid="outside">Outside</button>
      </div>,
    );
    const btn = screen.getByLabelText("More info");
    fireEvent.click(btn);
    expect(screen.getByRole("tooltip").className).toContain("!opacity-100");
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.getByRole("tooltip").className).not.toContain("!opacity-100");
  });

  it("applies custom className", () => {
    const { container } = render(
      <InfoTooltip id="test-tip" content="Test content" className="custom-class" />,
    );
    expect(container.querySelector(".custom-class")).not.toBeNull();
  });

  it("positions tooltip below when position=bottom", () => {
    render(
      <InfoTooltip id="test-tip" content="Test content" position="bottom" />,
    );
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.className).toContain("top-full");
  });

  it("positions tooltip above when position=top", () => {
    render(
      <InfoTooltip id="test-tip" content="Test content" position="top" />,
    );
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.className).toContain("bottom-full");
  });
});
