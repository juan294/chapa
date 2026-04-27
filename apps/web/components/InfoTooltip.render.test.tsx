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

  it("shows tooltip on click", () => {
    render(<InfoTooltip id="test-tip" content="Test content" />);
    const btn = screen.getByLabelText("More info");
    fireEvent.click(btn);
    expect(screen.getByRole("tooltip")).toBeDefined();
    expect(screen.getByText("Test content")).toBeDefined();
  });

  it("tooltip has correct id when visible", () => {
    render(<InfoTooltip id="test-tip" content="Test content" />);
    fireEvent.click(screen.getByLabelText("More info"));
    expect(screen.getByRole("tooltip").id).toBe("test-tip");
  });

  it("button references tooltip via aria-describedby", () => {
    render(<InfoTooltip id="test-tip" content="Test content" />);
    const btn = screen.getByLabelText("More info");
    expect(btn.getAttribute("aria-describedby")).toBe("test-tip");
  });

  it("hides tooltip on second click", () => {
    render(<InfoTooltip id="test-tip" content="Test content" />);
    const btn = screen.getByLabelText("More info");
    fireEvent.click(btn);
    expect(screen.getByRole("tooltip")).toBeDefined();
    fireEvent.click(btn);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("closes on Escape key", () => {
    render(<InfoTooltip id="test-tip" content="Test content" />);
    fireEvent.click(screen.getByLabelText("More info"));
    expect(screen.getByRole("tooltip")).toBeDefined();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("closes on outside click", () => {
    render(
      <div>
        <InfoTooltip id="test-tip" content="Test content" />
        <button data-testid="outside">Outside</button>
      </div>,
    );
    fireEvent.click(screen.getByLabelText("More info"));
    expect(screen.getByRole("tooltip")).toBeDefined();
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("applies custom className", () => {
    const { container } = render(
      <InfoTooltip id="test-tip" content="Test content" className="custom-class" />,
    );
    expect(container.querySelector(".custom-class")).not.toBeNull();
  });

  it("renders tooltip with fixed positioning via portal", () => {
    render(<InfoTooltip id="test-tip" content="Test content" />);
    fireEvent.click(screen.getByLabelText("More info"));
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.className).toContain("fixed");
    expect(tooltip.className).toContain("z-[99999]");
  });

  it("tooltip not visible before interaction", () => {
    render(<InfoTooltip id="test-tip" content="Test content" />);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
