// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

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

afterEach(cleanup);

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
});
