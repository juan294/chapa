// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock next/navigation before importing the component
// ---------------------------------------------------------------------------

const { mockUsePathname } = vi.hoisted(() => ({
  mockUsePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
}));

import { NavLink } from "./NavLink";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("NavLink", () => {
  it("renders a link with the correct href", () => {
    mockUsePathname.mockReturnValue("/");

    render(<NavLink href="/studio" label="Studio" />);

    const link = screen.getByRole("link", { name: /studio/i });
    expect(link.getAttribute("href")).toBe("/studio");
  });

  it("adds aria-current='page' when href matches current pathname", () => {
    mockUsePathname.mockReturnValue("/studio");

    render(<NavLink href="/studio" label="Studio" />);

    const link = screen.getByRole("link", { name: /studio/i });
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  it("does NOT add aria-current when href does not match pathname", () => {
    mockUsePathname.mockReturnValue("/");

    render(<NavLink href="/studio" label="Studio" />);

    const link = screen.getByRole("link", { name: /studio/i });
    expect(link.getAttribute("aria-current")).toBeNull();
  });

  it("renders label in lowercase with / prefix", () => {
    mockUsePathname.mockReturnValue("/");

    render(<NavLink href="/about" label="About" />);

    const link = screen.getByRole("link", { name: /about/i });
    expect(link.textContent).toContain("about");
    expect(link.textContent).toContain("/");
  });

  it("passes className to the anchor element", () => {
    mockUsePathname.mockReturnValue("/");

    render(
      <NavLink
        href="/studio"
        label="Studio"
        className="custom-class"
      />,
    );

    const link = screen.getByRole("link", { name: /studio/i });
    expect(link.classList.contains("custom-class")).toBe(true);
  });
});
