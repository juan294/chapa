// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import dynamic from "next/dynamic";
import { resolveDynamicLoader } from "@/lib/test-helpers/dynamic-mock";
import { makeScoring } from "@/lib/test-helpers/fixtures";

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
        scoring={makeScoring()}
      />,
    );

    const wrapper = screen.getByTestId("owner-content-lazy");
    expect(wrapper.getAttribute("data-handle")).toBe("octocat");
    expect(wrapper.getAttribute("data-ssr")).toBe("undefined");
    expect(screen.getByRole("status", { name: "Loading..." })).toBeTruthy();
  });

  // LE-5-1 — this chunk loads below a badge that is already on screen. Its
  // fallback used to be BadgeSkeleton, a second badge-shaped plate captioned
  // "Building the badge", so a slow chunk (Turbopack compiles it on first
  // demand in dev) drew a badge under the badge. The wait belongs to the
  // breakdown, so the placeholder is shaped like the breakdown.
  it("does not draw a second badge plate while the chunk loads", async () => {
    const { SharePageOwnerContentLazy } = await import(
      "./SharePageOwnerContentLazy"
    );

    render(
      <SharePageOwnerContentLazy
        handle="octocat"
        stats={null}
        scoring={makeScoring()}
      />,
    );

    expect(screen.queryByText("Building the badge")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    expect(document.querySelector(".aspect-\\[1200\\/630\\]")).toBeNull();
  });

  it("resolves the deferred loader to SharePageOwnerContent", async () => {
    await import("./SharePageOwnerContentLazy");
    const { SharePageOwnerContent } = await import(
      "./SharePageOwnerContent"
    );

    const resolved = await resolveDynamicLoader<typeof SharePageOwnerContent>(
      dynamic,
    );

    expect(resolved).toBe(SharePageOwnerContent);
  });
});
