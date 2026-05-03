// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mockComputeTilt = vi.hoisted(() => vi.fn());

// Mock BadgeContent — heavy component with CSS injection
vi.mock("@/components/badge/BadgeContent", () => ({
  BadgeContent: () => <div data-testid="badge-content">badge</div>,
  getBadgeContentCSS: () => [""],
}));

// Mock the tilt module
vi.mock("@/lib/effects/interactions/use-tilt", () => ({
  computeTilt: mockComputeTilt,
}));

describe("3d-tilt experiment page", () => {
  afterEach(() => {
    cleanup();
    mockComputeTilt.mockReset();
  });

  it("renders without throwing", async () => {
    mockComputeTilt.mockReturnValue({
      rotateX: 0,
      rotateY: 0,
      mouseX: "50%",
      mouseY: "50%",
      isHovering: false,
    });
    const { default: Page } = await import("./page");
    const { container } = render(<Page />);
    expect(container.querySelector("main")).toBeTruthy();
  });

  it("updates tilt sensitivity, glare, hover state, and reset state", async () => {
    mockComputeTilt.mockReturnValue({
      rotateX: 7.5,
      rotateY: -4.5,
      mouseX: "60%",
      mouseY: "35%",
      isHovering: true,
    });
    const { default: Page } = await import("./page");
    const { container } = render(<Page />);

    fireEvent.change(screen.getByLabelText(/Tilt sensitivity:/), {
      target: { value: "22" },
    });
    expect(screen.getByText("22°")).toBeTruthy();

    const card = container.querySelector(".cursor-default") as HTMLElement;
    card.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 600,
        height: 315,
        right: 600,
        bottom: 315,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.mouseMove(card, { clientX: 320, clientY: 120 });
    expect(mockComputeTilt).toHaveBeenCalledWith(
      320,
      120,
      expect.any(Object),
      22,
    );
    expect(screen.getByText("7.5°")).toBeTruthy();
    expect(screen.getByText("-4.5°")).toBeTruthy();

    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe(
      "false",
    );

    fireEvent.mouseLeave(card);
    expect(screen.getAllByText("0.0°")).toHaveLength(2);
  });
});
