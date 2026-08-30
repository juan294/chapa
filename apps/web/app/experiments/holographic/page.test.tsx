// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/components/badge/BadgeContent", () => ({
  BadgeContent: () => <div data-testid="badge-content">badge</div>,
}));

describe("holographic experiment page", () => {
  afterEach(cleanup);

  it("renders without throwing", async () => {
    const { default: Page } = await import("./page");
    const { container } = render(<Page />);
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("updates controls and mouse-tracks when auto animation is off", async () => {
    const { default: Page } = await import("./page");
    const { container } = render(<Page />);

    fireEvent.change(screen.getByLabelText(/Intensity/), {
      target: { value: "0.7" },
    });
    fireEvent.change(screen.getByLabelText(/Speed/), {
      target: { value: "5" },
    });
    expect(screen.getByText("70%")).toBeTruthy();
    expect(screen.getByText("5s")).toBeTruthy();

    const autoSwitch = screen.getByRole("switch");
    expect(autoSwitch.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(autoSwitch);
    expect(autoSwitch.getAttribute("aria-checked")).toBe("false");

    const mouseCard = container.querySelectorAll(".holo-card")[2] as HTMLElement;
    mouseCard.getBoundingClientRect = () =>
      ({
        left: 10,
        top: 20,
        width: 200,
        height: 100,
        right: 210,
        bottom: 120,
        x: 10,
        y: 20,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.mouseEnter(mouseCard);
    expect(mouseCard.querySelector(".holo-overlay")?.className).toContain(
      "active",
    );

    fireEvent.mouseMove(mouseCard, { clientX: 160, clientY: 80 });
    expect(mouseCard.style.getPropertyValue("--holo-x")).toBe("75%");
    expect(mouseCard.style.getPropertyValue("--holo-y")).toBe("60%");

    fireEvent.mouseLeave(mouseCard);
    expect(mouseCard.style.getPropertyValue("--holo-angle")).toBe("115deg");
    expect(mouseCard.style.getPropertyValue("--holo-x")).toBe("50%");
    expect(mouseCard.style.getPropertyValue("--holo-y")).toBe("50%");
  });
});
