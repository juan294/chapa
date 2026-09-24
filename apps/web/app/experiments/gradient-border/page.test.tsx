// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

vi.mock("@/components/badge/BadgeContent", () => ({
  BadgeContent: () => <div data-testid="badge-content">badge</div>,
}));

afterEach(cleanup);

describe("gradient-border experiment page", () => {
  it("renders without throwing", async () => {
    const { default: Page } = await import("./page");
    const { container } = render(<Page />);
    expect(container.querySelector("main")).toBeTruthy();
  });
});
