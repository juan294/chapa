// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import ErrorPage from "./error";

afterEach(cleanup);

describe("ErrorPage render", () => {
  it("renders the error heading", () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("test") as Error & { digest?: string }} reset={reset} />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("calls reset when try again is clicked", () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("test") as Error & { digest?: string }} reset={reset} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
