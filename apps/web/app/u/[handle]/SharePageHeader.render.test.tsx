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
      score={82}
      tier="High"
      {...overrides}
    />,
  );
}

describe("SharePageHeader (#1217)", () => {
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

  it("pairs the score with its caption and tier", () => {
    renderHeader();
    expect(screen.getByText("82")).toBeDefined();
    expect(screen.getByText("impact score")).toBeDefined();
    expect(screen.getByText("High")).toBeDefined();
  });

  it("links the verification pill to the verify page, in the complement family", () => {
    renderHeader({ verificationHash: "abc123" });
    const pill = screen.getByRole("link", { name: /verified metrics/i });
    expect(pill.getAttribute("href")).toBe("/verify/abc123");
    expect(pill.className).toContain("border-complement");
    expect(pill.className).toContain("text-complement-text");
    // Verification is never jade — that is the brand accent, a different signal.
    expect(pill.className).not.toContain("text-amber");
  });

  it("omits the verification pill when the profile has no seal", () => {
    renderHeader();
    expect(screen.queryByRole("link", { name: /verified metrics/i })).toBeNull();
  });

  it("omits the whole score block when there is no score yet", () => {
    renderHeader({ score: null, tier: null });
    expect(screen.queryByText("impact score")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
  });
});
