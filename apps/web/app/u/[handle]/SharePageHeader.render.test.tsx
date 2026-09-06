// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SharePageHeader } from "./SharePageHeader";

afterEach(cleanup);

function renderHeader(overrides: Partial<Parameters<typeof SharePageHeader>[0]> = {}) {
  return render(
    <SharePageHeader
      handle="bertramgilfoyle"
      displayLabel="Bertram Gilfoyle"
      {...overrides}
    />,
  );
}

describe("SharePageHeader (#1217)", () => {
  // The badge below draws the score, tier and verification state, so the
  // header no longer repeats them.
  it("shows identity only, leaving the score to the badge", () => {
    render(<SharePageHeader handle="juan294" displayLabel="Juan González" />);

    expect(screen.getByText("Juan González")).toBeDefined();
    expect(screen.queryByText("82")).toBeNull();
    expect(screen.queryByText(/verified metrics/i)).toBeNull();
  });

  it("names whose profile this is in a real, visible h1", () => {
    renderHeader();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toBe("Bertram Gilfoyle");
    expect(h1.className).not.toContain("sr-only");
  });

  it("shows the terminal marker for the handle", () => {
    const { container } = renderHeader();
    expect(container.textContent).toContain("% chapa profile @bertramgilfoyle");
  });



  it("omits the verification pill when the profile has no seal", () => {
    renderHeader();
    expect(screen.queryByRole("link", { name: /verified metrics/i })).toBeNull();
  });

  // #1311 — the score/tier props are gone rather than merely unrendered. A v6
  // score arriving at a component that looks like it displays one is what a
  // reviewer read as a live contradiction with the v7 badge below it.
  it("takes no score or tier at all, so none can contradict the badge", () => {
    renderHeader();
    expect(screen.queryByText("impact score")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
  });
});
