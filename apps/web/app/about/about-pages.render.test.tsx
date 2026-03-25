// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock("@/components/Navbar", () => ({
  Navbar: () => <nav data-testid="navbar" />,
}));

vi.mock("@/components/GlobalCommandBar", () => ({
  GlobalCommandBar: () => <div data-testid="command-bar" />,
}));

import AboutLoading from "./loading";
import AboutError from "./error";
import AboutPage from "./page";

afterEach(cleanup);

describe("AboutPage render", () => {
  it("renders the about page", () => {
    render(<AboutPage />);
    expect(screen.getByTestId("navbar")).toBeDefined();
  });
});

describe("AboutLoading render", () => {
  it("renders a status element", () => {
    render(<AboutLoading />);
    expect(screen.getByRole("status")).toBeDefined();
  });
});

describe("AboutError render", () => {
  it("renders the error heading", () => {
    const reset = vi.fn();
    render(<AboutError error={new Error("test") as Error & { digest?: string }} reset={reset} />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("calls reset on try again click", () => {
    const reset = vi.fn();
    render(<AboutError error={new Error("test") as Error & { digest?: string }} reset={reset} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
