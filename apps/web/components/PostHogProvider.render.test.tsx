// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import PostHogProvider from "./PostHogProvider";

vi.mock("@/lib/analytics/posthog", () => ({
  setPosthogInstance: vi.fn(),
}));

afterEach(cleanup);

describe("PostHogProvider", () => {
  it("renders children", () => {
    const { container } = render(
      <PostHogProvider>
        <div data-testid="child">Hello</div>
      </PostHogProvider>,
    );
    expect(container.querySelector("[data-testid='child']")).not.toBeNull();
  });

  it("renders PostHogInit component (returns null visually)", () => {
    const { container } = render(
      <PostHogProvider>
        <span>Content</span>
      </PostHogProvider>,
    );
    // The children should be the only visible content
    expect(container.textContent).toBe("Content");
  });
});
