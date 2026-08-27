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

// `data-next-link="true"` marks output that went through `next/link` so
// tests can distinguish it from a plain `<a>` — both render an anchor tag,
// so the DOM shape alone can't tell them apart otherwise.
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} data-next-link="true" {...props}>
      {children}
    </a>
  ),
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

  // #1184 (FE-L3): real internal routes must use next/link for client-side
  // navigation instead of a full document reload.
  describe("real route vs. anchor branching (#1184 FE-L3)", () => {
    it("renders a real internal route (e.g. /about) via next/link", () => {
      mockUsePathname.mockReturnValue("/");

      render(<NavLink href="/about" label="About" />);

      const link = screen.getByRole("link", { name: /about/i });
      expect(link.getAttribute("data-next-link")).toBe("true");
      expect(link.getAttribute("href")).toBe("/about");
    });

    it("renders a hash anchor as a plain <a>, not next/link", () => {
      mockUsePathname.mockReturnValue("/");

      render(<NavLink href="#features" label="Features" />);

      const link = screen.getByRole("link", { name: /features/i });
      expect(link.getAttribute("data-next-link")).toBeNull();
      expect(link.getAttribute("href")).toBe("#features");
    });

    it("renders an external URL as a plain <a>, not next/link", () => {
      mockUsePathname.mockReturnValue("/");

      render(<NavLink href="https://github.com/chapa" label="GitHub" />);

      const link = screen.getByRole("link", { name: /github/i });
      expect(link.getAttribute("data-next-link")).toBeNull();
      expect(link.getAttribute("href")).toBe("https://github.com/chapa");
    });

    it("renders a /u/:handle profile link as a plain <a>, never next/link (avoids speculative materializePublicProfile prefetch + preserves Studio's beforeunload guard)", () => {
      mockUsePathname.mockReturnValue("/studio");

      render(<NavLink href="/u/octocat" label="Your Badge" />);

      const link = screen.getByRole("link", { name: /your badge/i });
      expect(link.getAttribute("data-next-link")).toBeNull();
      expect(link.getAttribute("href")).toBe("/u/octocat");
    });

    it("still sets aria-current='page' on a next/link-rendered real route", () => {
      mockUsePathname.mockReturnValue("/about");

      render(<NavLink href="/about" label="About" />);

      const link = screen.getByRole("link", { name: /about/i });
      expect(link.getAttribute("data-next-link")).toBe("true");
      expect(link.getAttribute("aria-current")).toBe("page");
    });
  });
});
