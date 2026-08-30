// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import * as confetti from "@/lib/effects/celebrations/confetti";

vi.mock("@/components/badge/BadgeContent", () => ({
  BadgeContent: () => <div data-testid="badge-content">badge</div>,
}));

// Mock confetti — depends on canvas-confetti
vi.mock("@/lib/effects/celebrations/confetti", () => ({
  fireSingleBurst: vi.fn(),
  fireMultiBurst: vi.fn(),
  fireFireworks: vi.fn(),
  fireSubtleSparkle: vi.fn().mockResolvedValue(() => {}),
}));

describe("confetti experiment page", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders without throwing", async () => {
    const { default: Page } = await import("./page");
    const { container } = render(<Page />);
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("fires the initial demo burst after mount", async () => {
    const { default: Page } = await import("./page");

    render(<Page />);
    await vi.advanceTimersByTimeAsync(600);

    expect(confetti.fireSingleBurst).toHaveBeenCalledWith(80, "amber");
  });

  it("updates controls and fires each confetti effect", async () => {
    const { default: Page } = await import("./page");

    render(<Page />);
    fireEvent.change(screen.getByLabelText(/Particles:/), {
      target: { value: "150" },
    });
    fireEvent.change(screen.getByLabelText(/Speed:/), {
      target: { value: "2.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rainbow" }));

    fireEvent.click(screen.getByRole("button", { name: "Fire Burst" }));
    expect(confetti.fireSingleBurst).toHaveBeenLastCalledWith(150, "rainbow");

    fireEvent.click(screen.getByRole("button", { name: "Fire Multi-Burst" }));
    expect(confetti.fireMultiBurst).toHaveBeenLastCalledWith(150, "rainbow");

    fireEvent.click(screen.getByRole("button", { name: "Launch Fireworks" }));
    expect(confetti.fireFireworks).toHaveBeenLastCalledWith(
      150,
      "rainbow",
      2.5,
    );
  });

  it("starts, stops, replays, and cleans up subtle sparkle", async () => {
    const stopSparkle = vi.fn();
    vi.mocked(confetti.fireSubtleSparkle).mockResolvedValueOnce(stopSparkle);
    const { default: Page } = await import("./page");

    const { unmount } = render(<Page />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Start Sparkle" }));
    });
    expect(screen.getByRole("button", { name: "Stop Sparkle" })).toBeTruthy();
    expect(confetti.fireSubtleSparkle).toHaveBeenCalledWith("amber", 1);

    fireEvent.click(screen.getByRole("button", { name: "Stop Sparkle" }));
    expect(stopSparkle).toHaveBeenCalledTimes(1);

    vi.mocked(confetti.fireSubtleSparkle).mockResolvedValueOnce(stopSparkle);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Start Sparkle" }));
    });
    expect(screen.getByRole("button", { name: "Stop Sparkle" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Replay All" }));
    await vi.advanceTimersByTimeAsync(800);
    expect(confetti.fireMultiBurst).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1200);
    expect(confetti.fireFireworks).toHaveBeenCalled();

    unmount();
    expect(stopSparkle).toHaveBeenCalledTimes(2);
  });
});
