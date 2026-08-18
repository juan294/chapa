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

afterEach(cleanup);

describe("[locale]/about error.tsx render", () => {
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
});
