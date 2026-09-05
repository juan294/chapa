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
    expect(css).toContain("#F4F0E7");
    // Dark-mode background (design-system --color-bg dark value)
    expect(css).toContain("#141719");
  });

  it("marks each language's text with its own lang attribute instead of a blanket lang=\"en\"", () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("test") as Error & { digest?: string }} reset={reset} />);

    const spanish = screen.getByText("Algo salió mal");
    expect(spanish.getAttribute("lang")).toBe("es");

    const english = screen.getByText("Something went wrong");
    expect(english.getAttribute("lang")).toBe("en");
  });

  it("uses the approved secondary text pair in its independent light and dark CSS", () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("test") as Error & { digest?: string }} reset={reset} />);
    const css = document.head.querySelector("style")?.textContent ?? "";
    expect(css).toContain(".global-error-subtext { color: #64625E; }");
    expect(css).toContain(".global-error-subtext { color: #B3B9B9; }");
  });

  it("pairs retry and home colors with readable hover and focus states in both themes", () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("test") as Error & { digest?: string }} reset={reset} />);
    const link = screen.getByText(/Go home/).closest("a");
    const retry = screen.getByText(/Try again/).closest("button");
    const css = document.head.querySelector("style")?.textContent ?? "";
    expect(link?.className).toBe("global-error-home");
    expect(retry?.className).toBe("global-error-retry");
    expect(css).toContain(".global-error-home { color: #1B1B19; }");
    expect(css).toContain(".global-error-home { color: #EEEAE1; }");
    expect(css).toContain("background-color: #1B1B19; color: #F4F0E7");
    expect(css).toContain("background-color: #FF795F; color: #17191A");
    expect(css).toContain(".global-error-retry:hover { background-color: #AA2D1A; }");
    expect(css).toContain(".global-error-retry:hover { background-color: #FF9D88; }");
    expect(css).toContain("outline: 2px solid #AA2D1A");
    expect(css).toContain("outline-color: #FF927D");
  });
});
