// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import GlobalError from "./global-error";

afterEach(cleanup);

describe("GlobalError render", () => {
  it("renders the error heading", () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("test") as Error & { digest?: string }} reset={reset} />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("calls reset when try again is clicked", () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("test") as Error & { digest?: string }} reset={reset} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("has a Go home link", () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("test") as Error & { digest?: string }} reset={reset} />);
    const link = screen.getByText("Go home");
    expect(link.getAttribute("href")).toBe("/");
  });
});
