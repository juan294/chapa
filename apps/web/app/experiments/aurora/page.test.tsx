// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/components/badge/BadgeContent", () => ({
  BadgeContent: () => <div data-testid="badge-content">badge</div>,
  getBadgeContentCSS: () => [""],
}));

describe("aurora experiment page", () => {
  it("renders without throwing", async () => {
    const { default: Page } = await import("./page");
    const { container } = render(<Page />);
    expect(container.querySelector("div")).toBeTruthy();
  });
});
