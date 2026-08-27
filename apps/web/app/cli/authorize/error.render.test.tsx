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
        "cliAuthorize.errorBoundaryHeading": "Authorization Error",
        "cliAuthorize.errorBoundaryBody": "Something went wrong during CLI authorization.",
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

describe("cli/authorize error.tsx render", () => {
  it("renders the error heading", async () => {
    const { default: ErrorPage } = await import("./error");
    const reset = vi.fn();
    render(<ErrorPage error={new Error("auth failed")} reset={reset} />);
    expect(screen.getByText("Authorization Error")).toBeDefined();
  });

  it("renders the error body message", async () => {
    const { default: ErrorPage } = await import("./error");
    render(<ErrorPage error={new Error("auth failed")} reset={vi.fn()} />);
    expect(screen.getByText("Something went wrong during CLI authorization.")).toBeDefined();
  });

  it("renders the Try Again button and calls reset on click", async () => {
    const { default: ErrorPage } = await import("./error");
    const reset = vi.fn();
    render(<ErrorPage error={new Error("auth failed")} reset={reset} />);
    const btn = screen.getByText("Try Again");
    expect(btn).toBeDefined();
    fireEvent.click(btn);
    expect(reset).toHaveBeenCalledOnce();
  });

  it("renders the Go Home link pointing to /", async () => {
    const { default: ErrorPage } = await import("./error");
    render(<ErrorPage error={new Error("auth failed")} reset={vi.fn()} />);
    const link = screen.getByText("Go Home");
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe("/");
  });

  it("has main landmark with id main-content", async () => {
    const { default: ErrorPage } = await import("./error");
    const { container } = render(<ErrorPage error={new Error("auth failed")} reset={vi.fn()} />);
    const main = container.querySelector("#main-content");
    expect(main).toBeDefined();
    expect(main?.tagName).toBe("MAIN");
  });

  it("renders with role=alert and terminal-red styling, never amber", async () => {
    const { default: ErrorPage } = await import("./error");
    const { container } = render(<ErrorPage error={new Error("auth failed")} reset={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeDefined();
    expect(container.querySelector(".text-terminal-red")).not.toBeNull();
    expect(container.innerHTML).not.toContain("amber");
  });

  it("reports the error to /api/telemetry with the cli-authorize-error source", async () => {
    const { default: ErrorPage } = await import("./error");
    render(<ErrorPage error={new Error("cli boundary boom")} reset={vi.fn()} />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe("/api/telemetry");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      event: "client_error",
      category: "route_error",
      source: "cli-authorize-error",
      message: "cli boundary boom",
    });
  });
});
