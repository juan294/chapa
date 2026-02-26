// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// Mock BadgeContent — heavy component with CSS injection
vi.mock("@/components/badge/BadgeContent", () => ({
  BadgeContent: () => <div data-testid="badge-content">badge</div>,
  getBadgeContentCSS: () => [""],
}));

// Mock the tilt module
vi.mock("@/lib/effects/interactions/use-tilt", () => ({
  computeTilt: () => ({
    rotateX: 0,
    rotateY: 0,
    mouseX: "50%",
    mouseY: "50%",
    isHovering: false,
  }),
}));

describe("3d-tilt experiment page", () => {
  it("renders without throwing", async () => {
    const { default: Page } = await import("./page");
    const { container } = render(<Page />);
    expect(container.querySelector("main")).toBeTruthy();
  });
});
