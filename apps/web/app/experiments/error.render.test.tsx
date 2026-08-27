// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import ErrorPage from "./error";

afterEach(cleanup);

describe("experiments ErrorPage render", () => {
  it("renders the error heading and home link", () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("boom")} reset={reset} />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
    const homeLink = screen.getByRole("link", { name: "Go home" });
    expect(homeLink.getAttribute("href")).toBe("/");
  });

  it("calls reset when try again is clicked", () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("boom")} reset={reset} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("renders with role=alert and terminal-red styling, never amber", () => {
    const reset = vi.fn();
    const { container } = render(<ErrorPage error={new Error("boom")} reset={reset} />);
    expect(screen.getByRole("alert")).toBeDefined();
    expect(container.querySelector(".text-terminal-red")).not.toBeNull();
    expect(container.innerHTML).not.toContain("amber");
  });
});
