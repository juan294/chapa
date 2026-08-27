// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: "en",
    t: (key: string) => {
      const map: Record<string, string> = {
        "errors.sharePage.title": "Couldn't load this profile",
        "errors.sharePage.description": "Something went wrong loading this share page.",
        "errors.tryAgain": "Try Again",
        "errors.goHome": "Go Home",
      };
      return map[key] ?? key;
    },
    setLocale: async () => {},
  }),
}));

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("u/[handle] error.tsx render", () => {
  it("renders the share-page-specific error heading and description", async () => {
    const { default: SharePageError } = await import("./error");
    render(<SharePageError error={new Error("boom")} reset={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Couldn't load this profile" })).toBeDefined();
    expect(screen.getByText("Something went wrong loading this share page.")).toBeDefined();
  });

  it("calls reset when Try Again is clicked", async () => {
    const { default: SharePageError } = await import("./error");
    const reset = vi.fn();
    render(<SharePageError error={new Error("boom")} reset={reset} />);
    fireEvent.click(screen.getByText("Try Again"));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("renders a Go Home link pointing to /", async () => {
    const { default: SharePageError } = await import("./error");
    render(<SharePageError error={new Error("boom")} reset={vi.fn()} />);
    const link = screen.getByText("Go Home");
    expect(link.getAttribute("href")).toBe("/");
  });

  it("uses terminal-red error styling, not amber", async () => {
    const { default: SharePageError } = await import("./error");
    const { container } = render(<SharePageError error={new Error("boom")} reset={vi.fn()} />);
    expect(container.querySelector(".text-terminal-red")).not.toBeNull();
    expect(container.innerHTML).not.toContain("amber");
  });

  it("reports the error to /api/telemetry with the share-page-error source", async () => {
    const { default: SharePageError } = await import("./error");
    render(<SharePageError error={new Error("share page boundary boom")} reset={vi.fn()} />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/telemetry");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      event: "client_error",
      category: "route_error",
      source: "share-page-error",
      message: "share page boundary boom",
    });
  });
});
