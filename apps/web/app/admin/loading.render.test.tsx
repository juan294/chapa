// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import AdminLoading from "./loading";

afterEach(cleanup);

describe("AdminLoading render", () => {
  it("renders a status element", () => {
    render(<AdminLoading />);
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("renders skeleton pulse elements", () => {
    const { container } = render(<AdminLoading />);
    const pulseEls = container.querySelectorAll(".animate-pulse");
    expect(pulseEls.length).toBeGreaterThan(0);
  });

  it("has loading text for screen readers", () => {
    render(<AdminLoading />);
    expect(screen.getByText("Loading admin dashboard...")).toBeDefined();
  });
});
