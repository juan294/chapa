// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./BadgeSkeleton", () => ({
  BadgeSkeleton: () => <div data-testid="badge-skeleton" />,
}));

vi.mock("next/dynamic", () => ({
  default: vi.fn(
    (
      _loader: () => Promise<{ default: React.ComponentType }>,
      opts?: { ssr?: boolean; loading?: () => React.ReactNode },
    ) =>
      function DynamicOwnerContentMock(props: { handle: string }) {
        return (
          <div
            data-testid="owner-content-lazy"
            data-handle={props.handle}
            data-ssr={String(opts?.ssr)}
          >
            {opts?.loading?.()}
          </div>
        );
      },
  ),
}));

describe("SharePageOwnerContentLazy render", () => {
  it("renders the dynamic owner content wrapper with its loading fallback", async () => {
    const { SharePageOwnerContentLazy } = await import(
      "./SharePageOwnerContentLazy"
    );

    render(
      <SharePageOwnerContentLazy
        handle="octocat"
        stats={null}
        impact={null}
      />,
    );

    const wrapper = screen.getByTestId("owner-content-lazy");
    expect(wrapper.getAttribute("data-handle")).toBe("octocat");
    expect(wrapper.getAttribute("data-ssr")).toBe("undefined");
    expect(screen.getByTestId("badge-skeleton")).toBeTruthy();
  });
});
