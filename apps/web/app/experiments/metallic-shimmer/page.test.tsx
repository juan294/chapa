// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// Mock clipboard API
Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

describe("metallic-shimmer experiment page", () => {
  afterEach(cleanup);

  it("renders without throwing", async () => {
    const { default: Page } = await import("./page");
    const { container } = render(<Page />);
    expect(container.querySelector("main")).toBeTruthy();
  });

  it("updates shimmer controls and replays animation", async () => {
    const { default: Page } = await import("./page");
    render(<Page />);

    fireEvent.change(screen.getByLabelText(/Speed:/), {
      target: { value: "4.5" },
    });
    fireEvent.change(screen.getByLabelText(/Highlight intensity:/), {
      target: { value: "75" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Replay Animation" }));

    expect(screen.getByText("4.5s")).toBeTruthy();
    expect(screen.getByText("75%")).toBeTruthy();
    expect(
      screen.getByRole("img", {
        name: /Impact score 87, tier Elite with metallic shimmer effect/,
      }),
    ).toBeTruthy();
  });
});
