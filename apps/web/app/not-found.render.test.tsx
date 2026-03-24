// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import NotFound from "./not-found";

afterEach(cleanup);

describe("NotFound render", () => {
  it("renders 404 heading", () => {
    render(<NotFound />);
    expect(screen.getByText("404")).toBeDefined();
  });

  it("renders Page not found text", () => {
    render(<NotFound />);
    expect(screen.getByText("Page not found")).toBeDefined();
  });

  it("has a Go home link", () => {
    render(<NotFound />);
    expect(screen.getByText("Go home")).toBeDefined();
  });
});
