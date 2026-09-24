// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

vi.mock("@/components/badge/BadgeContent", () => ({
  BadgeContent: () => <div data-testid="badge-content">badge</div>,
}));

afterEach(cleanup);

describe("glassmorphism experiment page", () => {
  it("renders without throwing", async () => {
    const { default: Page } = await import("./page");
    const { container } = render(<Page />);
    expect(container.querySelector("main")).toBeTruthy();
  });

  it("gives every two-up grid an explicit mobile column so no track inherits a child's min-content width", async () => {
    // Without `grid-cols-1`, the single implicit `auto` track sizes to the
    // widest item's min-content: the Generated CSS block's longest line is
    // ~415px, which widened the whole Playground grid past a 393px viewport
    // (link-crawl LE-3-1). `grid-cols-1` is `minmax(0, 1fr)` and caps that.
    const { default: Page } = await import("./page");
    const { container } = render(<Page />);
    const grids = Array.from(container.querySelectorAll(".grid"));
    expect(grids.length).toBeGreaterThan(0);
    for (const grid of grids) {
      expect(grid.className, grid.className).toContain("grid-cols-1");
    }
  });
});
