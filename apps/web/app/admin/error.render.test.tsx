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
        "errors.admin.title": "Admin dashboard error",
        "errors.admin.description": "Something went wrong loading the admin dashboard.",
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

describe("admin error.tsx render", () => {
  it("renders the admin-specific error heading and description", async () => {
    const { default: AdminErrorPage } = await import("./error");
    render(<AdminErrorPage error={new Error("boom")} reset={vi.fn()} />);
    expect(screen.getByText("Admin dashboard error")).toBeDefined();
    expect(screen.getByText("Something went wrong loading the admin dashboard.")).toBeDefined();
  });

  it("calls reset when Try Again is clicked", async () => {
    const { default: AdminErrorPage } = await import("./error");
    const { fireEvent } = await import("@testing-library/react");
    const reset = vi.fn();
    render(<AdminErrorPage error={new Error("boom")} reset={reset} />);
    fireEvent.click(screen.getByText("Try Again"));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("renders a Go Home link pointing to /", async () => {
    const { default: AdminErrorPage } = await import("./error");
    render(<AdminErrorPage error={new Error("boom")} reset={vi.fn()} />);
    const link = screen.getByText("Go Home");
    expect(link.getAttribute("href")).toBe("/");
  });

  it("renders with role=alert and terminal-red styling, never amber", async () => {
    const { default: AdminErrorPage } = await import("./error");
    const { container } = render(<AdminErrorPage error={new Error("boom")} reset={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeDefined();
    expect(container.querySelector(".text-terminal-red")).not.toBeNull();
    expect(container.innerHTML).not.toContain("amber");
  });

  it("reports the error to /api/telemetry with the admin-error source", async () => {
    const { default: AdminErrorPage } = await import("./error");
    render(<AdminErrorPage error={new Error("admin boundary boom")} reset={vi.fn()} />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe("/api/telemetry");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      event: "client_error",
      category: "route_error",
      source: "admin-error",
      message: "admin boundary boom",
    });
  });
});
