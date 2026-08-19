// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import GlobalError from "./global-error";

afterEach(cleanup);

describe("GlobalError render", () => {
  it("renders the error heading (bilingual: es/en)", () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("test") as Error & { digest?: string }} reset={reset} />);
    // global-error replaces root layout — bilingual static copy (es + en)
    expect(screen.getByText(/Something went wrong/)).toBeDefined();
  });

  it("calls reset when try again is clicked", () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("test") as Error & { digest?: string }} reset={reset} />);
    fireEvent.click(screen.getByText(/Try again/));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("has a Go home link", () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("test") as Error & { digest?: string }} reset={reset} />);
    const link = screen.getByText(/Go home/).closest("a");
    expect(link?.getAttribute("href")).toBe("/");
  });

  it("defines both light and dark palette values via a prefers-color-scheme media query", () => {
    // Tailwind/next-themes are unavailable here (global-error replaces the root
    // layout), so light/dark must come from a plain inline <style> media query.
    // React treats <html>/<head>/<body> as document singletons and reconciles
    // them onto the real `document`, so the <style> lands in document.head
    // rather than under the render() container.
    const reset = vi.fn();
    render(<GlobalError error={new Error("test") as Error & { digest?: string }} reset={reset} />);
    const style = document.head.querySelector("style");
    expect(style).not.toBeNull();
    const css = style?.textContent ?? "";
    expect(css).toContain("prefers-color-scheme: dark");
    // Light-mode background (design-system --color-bg light value)
    expect(css).toContain("#FFFFFF");
    // Dark-mode background (design-system --color-bg dark value)
    expect(css).toContain("#0A0A0F");
  });

  it("marks each language's text with its own lang attribute instead of a blanket lang=\"en\"", () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("test") as Error & { digest?: string }} reset={reset} />);

    const spanish = screen.getByText("Algo salió mal");
    expect(spanish.getAttribute("lang")).toBe("es");

    const english = screen.getByText("Something went wrong");
    expect(english.getAttribute("lang")).toBe("en");
  });
});
