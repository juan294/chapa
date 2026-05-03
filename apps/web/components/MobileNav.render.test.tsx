// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

const { mockUsePathname } = vi.hoisted(() => ({
  mockUsePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
}));

vi.mock("./LanguageSwitcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher">LanguageSwitcher</div>,
}));

vi.mock("./ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">ThemeToggle</div>,
}));

import { MobileNav } from "./MobileNav";

beforeEach(() => {
  mockUsePathname.mockReturnValue("/");
});

afterEach(cleanup);

const LINKS = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Studio", href: "/studio" },
];

describe("MobileNav", () => {
  it("renders toggle button", () => {
    render(<MobileNav links={LINKS} />);
    expect(screen.getByLabelText("Toggle navigation")).toBeDefined();
  });

  it("menu is closed by default", () => {
    render(<MobileNav links={LINKS} />);
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("opens menu on button click", () => {
    render(<MobileNav links={LINKS} />);
    fireEvent.click(screen.getByLabelText("Toggle navigation"));
    expect(screen.getByRole("navigation")).toBeDefined();
  });

  it("renders all links when open", () => {
    render(<MobileNav links={LINKS} />);
    fireEvent.click(screen.getByLabelText("Toggle navigation"));
    expect(screen.getByText(/home/i)).toBeDefined();
    expect(screen.getByText(/about/i)).toBeDefined();
    expect(screen.getByText(/studio/i)).toBeDefined();
  });

  it("closes menu when a link is clicked", () => {
    render(<MobileNav links={LINKS} />);
    fireEvent.click(screen.getByLabelText("Toggle navigation"));
    expect(screen.getByRole("navigation")).toBeDefined();
    fireEvent.click(screen.getByText(/home/i));
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("renders LanguageSwitcher in drawer when open", () => {
    render(<MobileNav links={LINKS} />);
    fireEvent.click(screen.getByLabelText("Toggle navigation"));
    expect(screen.getByTestId("language-switcher")).toBeDefined();
  });

  it("closes menu on Escape key", () => {
    render(<MobileNav links={LINKS} />);
    fireEvent.click(screen.getByLabelText("Toggle navigation"));
    expect(screen.getByRole("navigation")).toBeDefined();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("aria-expanded reflects open state", () => {
    render(<MobileNav links={LINKS} />);
    const btn = screen.getByLabelText("Toggle navigation");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });

  describe("focus trap (lines 31-49)", () => {
    it("traps Tab at the last focusable element, cycling to the first", () => {
      render(<MobileNav links={LINKS} />);
      fireEvent.click(screen.getByLabelText("Toggle navigation"));

      const nav = screen.getByRole("navigation");
      const links = nav.querySelectorAll("a");
      expect(links.length).toBeGreaterThanOrEqual(3);

      const lastLink = links[links.length - 1]!;
      // Focus the last link
      lastLink.focus();
      expect(document.activeElement).toBe(lastLink);

      // Tab from the last link should cycle to the first
      fireEvent.keyDown(document, { key: "Tab" });

      const firstLink = links[0]!;
      expect(document.activeElement).toBe(firstLink);
    });

    it("traps Shift+Tab at the first focusable element, cycling to the last", () => {
      render(<MobileNav links={LINKS} />);
      fireEvent.click(screen.getByLabelText("Toggle navigation"));

      const nav = screen.getByRole("navigation");
      const links = nav.querySelectorAll("a");
      expect(links.length).toBeGreaterThanOrEqual(3);

      const firstLink = links[0]!;
      // Focus the first link
      firstLink.focus();
      expect(document.activeElement).toBe(firstLink);

      // Shift+Tab from the first link should cycle to the last
      fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

      const lastLink = links[links.length - 1]!;
      expect(document.activeElement).toBe(lastLink);
    });

    it("does not trap Tab when focus is on a middle element", () => {
      render(<MobileNav links={LINKS} />);
      fireEvent.click(screen.getByLabelText("Toggle navigation"));

      const nav = screen.getByRole("navigation");
      const links = nav.querySelectorAll("a");
      expect(links.length).toBeGreaterThanOrEqual(3);

      const middleLink = links[1]!;
      middleLink.focus();
      expect(document.activeElement).toBe(middleLink);

      // Tab from the middle should NOT be prevented (browser handles it normally)
      const event = new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");
      document.dispatchEvent(event);

      // preventDefault should NOT have been called for middle elements
      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it("focuses first link when menu opens", () => {
      render(<MobileNav links={LINKS} />);
      fireEvent.click(screen.getByLabelText("Toggle navigation"));

      const nav = screen.getByRole("navigation");
      const links = nav.querySelectorAll("a");
      expect(document.activeElement).toBe(links[0]);
    });

    it("does nothing on non-Tab keys in focus trap handler", () => {
      render(<MobileNav links={LINKS} />);
      fireEvent.click(screen.getByLabelText("Toggle navigation"));

      const nav = screen.getByRole("navigation");
      const firstLink = nav.querySelectorAll("a")[0]!;
      firstLink.focus();

      // Press a non-Tab key — should not change focus
      fireEvent.keyDown(document, { key: "a" });
      expect(document.activeElement).toBe(firstLink);
    });
  });

  describe("Escape cleanup", () => {
    it("does not close menu on Escape when already closed", () => {
      render(<MobileNav links={LINKS} />);
      // Menu is already closed; Escape should be a no-op
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("navigation")).toBeNull();
    });
  });

  describe("aria-current on active links", () => {
    it("sets aria-current='page' on the link matching the current pathname", () => {
      mockUsePathname.mockReturnValue("/about");

      render(<MobileNav links={LINKS} />);
      fireEvent.click(screen.getByLabelText("Toggle navigation"));

      const nav = screen.getByRole("navigation");
      const aboutLink = nav.querySelector('a[href="/about"]')!;
      expect(aboutLink.getAttribute("aria-current")).toBe("page");
    });

    it("does NOT set aria-current on links that do not match the pathname", () => {
      mockUsePathname.mockReturnValue("/about");

      render(<MobileNav links={LINKS} />);
      fireEvent.click(screen.getByLabelText("Toggle navigation"));

      const nav = screen.getByRole("navigation");
      const homeLink = nav.querySelector('a[href="/"]')!;
      const studioLink = nav.querySelector('a[href="/studio"]')!;
      expect(homeLink.getAttribute("aria-current")).toBeNull();
      expect(studioLink.getAttribute("aria-current")).toBeNull();
    });
  });
});
