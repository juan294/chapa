// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

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
        "errors.general.title": "Something went wrong",
        "errors.general.description": "An unexpected error occurred.",
        "common.tryAgain": "Try Again",
        "common.goHome": "Go Home",
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

describe("[locale]/archetypes error.tsx render", () => {
  it("renders the error heading and description", async () => {
    const { default: ErrorPage } = await import("./error");
    render(<ErrorPage error={new Error("boom")} reset={vi.fn()} />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
    expect(screen.getByText("An unexpected error occurred.")).toBeDefined();
  });

  it("calls reset when Try Again is clicked", async () => {
    const { default: ErrorPage } = await import("./error");
    const { fireEvent } = await import("@testing-library/react");
    const reset = vi.fn();
    render(<ErrorPage error={new Error("boom")} reset={reset} />);
    fireEvent.click(screen.getByText("Try Again"));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("renders a Go Home link pointing to /", async () => {
    const { default: ErrorPage } = await import("./error");
    render(<ErrorPage error={new Error("boom")} reset={vi.fn()} />);
    const link = screen.getByText("Go Home");
    expect(link.getAttribute("href")).toBe("/");
  });

  it("renders with role=alert and terminal-red styling, never amber", async () => {
    const { default: ErrorPage } = await import("./error");
    const { container } = render(<ErrorPage error={new Error("boom")} reset={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeDefined();
    expect(container.querySelector(".text-terminal-red")).not.toBeNull();
    expect(container.innerHTML).not.toContain("amber");
  });

  it("reports the error to /api/telemetry with the archetypes-error source", async () => {
    const { default: ErrorPage } = await import("./error");
    render(<ErrorPage error={new Error("archetypes boundary boom")} reset={vi.fn()} />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe("/api/telemetry");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      event: "client_error",
      category: "route_error",
      source: "archetypes-error",
      message: "archetypes boundary boom",
    });
  });
});
