// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AuthorTypewriter } from "./AuthorTypewriter";

beforeEach(() => {
  // AuthorTypewriter calls window.matchMedia for prefers-reduced-motion
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: true, // reduced motion = skip animation
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(cleanup);

describe("AuthorTypewriter", () => {
  it("renders trigger button", () => {
    render(<AuthorTypewriter />);
    expect(screen.getByRole("button")).toBeDefined();
  });

  it("has aria-label with author name", () => {
    render(<AuthorTypewriter />);
    expect(screen.getByLabelText(/Made by/)).toBeDefined();
  });

  it("renders initial home text", () => {
    render(<AuthorTypewriter />);
    expect(screen.getByText("</> JG")).toBeDefined();
  });

  it("renders social link icons", () => {
    render(<AuthorTypewriter />);
    expect(screen.getByLabelText("X (Twitter)")).toBeDefined();
    expect(screen.getByLabelText("LinkedIn")).toBeDefined();
    expect(screen.getByLabelText("Medium")).toBeDefined();
    expect(screen.getByLabelText("GitHub")).toBeDefined();
  });

  it("renders author name in popover", () => {
    render(<AuthorTypewriter />);
    expect(screen.getByText(/Juan Gonz/)).toBeDefined();
  });

  it("applies custom className", () => {
    const { container } = render(<AuthorTypewriter className="test-class" />);
    expect(container.querySelector(".test-class")).not.toBeNull();
  });

  it("outer wrapper has role=presentation", () => {
    render(<AuthorTypewriter />);
    expect(screen.getByRole("presentation")).toBeDefined();
  });
});
