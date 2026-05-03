// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const mockReadSessionCookie = vi.fn();
const mockIsAdminHandle = vi.fn();
const mockHeadersGet = vi.fn();

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: mockHeadersGet,
  })),
  // readLocaleCookie uses cookies() — return empty jar (locale resolved via Accept-Language below)
  cookies: vi.fn(async () => ({
    get: vi.fn().mockReturnValue(undefined),
  })),
}));

vi.mock("@/lib/auth/github", () => ({
  readSessionCookie: (...args: unknown[]) => mockReadSessionCookie(...args),
}));

vi.mock("@/lib/auth/admin", () => ({
  isAdminHandle: (...args: unknown[]) => mockIsAdminHandle(...args),
}));

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
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("./UserMenu", () => ({
  UserMenu: ({
    login,
    isAdmin,
  }: {
    login: string;
    name: string | null;
    avatarUrl: string;
    isAdmin: boolean;
  }) => (
    <div data-testid="user-menu" data-login={login} data-admin={String(isAdmin)}>
      UserMenu
    </div>
  ),
}));

vi.mock("./MobileNav", () => ({
  MobileNav: () => <div data-testid="mobile-nav">MobileNav</div>,
}));

vi.mock("./NavLink", () => ({
  NavLink: ({ label, href }: { label: string; href: string; className?: string }) => (
    <a href={href} data-testid="nav-link">
      {label}
    </a>
  ),
}));

vi.mock("./ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">ThemeToggle</div>,
}));

vi.mock("./LanguageSwitcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher">LanguageSwitcher</div>,
}));

import { Navbar } from "./Navbar";

beforeEach(() => {
  process.env.NEXTAUTH_SECRET = "test-secret";
  mockReadSessionCookie.mockReset();
  mockIsAdminHandle.mockReset();
  mockHeadersGet.mockReset();
  // Navbar renders in English — set Accept-Language so tests don't depend on DEFAULT_LOCALE
  mockHeadersGet.mockReturnValue('en-US');
});

afterEach(() => {
  cleanup();
  delete process.env.NEXTAUTH_SECRET;
});

describe("Navbar", () => {
  describe("unauthenticated", () => {
    it("renders login link when no session", async () => {
      mockReadSessionCookie.mockReturnValue(null);

      const jsx = await Navbar({});
      render(jsx);

      expect(screen.getByText("login")).toBeDefined();
      const loginLink = screen.getByText("login").closest("a");
      expect(loginLink?.getAttribute("href")).toBe("/api/auth/login");
    });

    it("renders login link when NEXTAUTH_SECRET is missing", async () => {
      delete process.env.NEXTAUTH_SECRET;

      const jsx = await Navbar({});
      render(jsx);

      expect(screen.getByText("login")).toBeDefined();
      expect(screen.queryByTestId("user-menu")).toBeNull();
    });
  });

  describe("authenticated", () => {
    it("renders UserMenu when session exists", async () => {
      mockReadSessionCookie.mockReturnValue({
        login: "juan",
        name: "Juan",
        avatar_url: "https://example.com/avatar.png",
      });
      mockIsAdminHandle.mockReturnValue(false);

      const jsx = await Navbar({});
      render(jsx);

      const userMenu = screen.getByTestId("user-menu");
      expect(userMenu).toBeDefined();
      expect(userMenu.getAttribute("data-login")).toBe("juan");
      expect(userMenu.getAttribute("data-admin")).toBe("false");
    });

    it("passes isAdmin=true when handle is admin", async () => {
      mockReadSessionCookie.mockReturnValue({
        login: "admin-user",
        name: "Admin",
        avatar_url: "https://example.com/avatar.png",
      });
      mockIsAdminHandle.mockReturnValue(true);

      const jsx = await Navbar({});
      render(jsx);

      const userMenu = screen.getByTestId("user-menu");
      expect(userMenu.getAttribute("data-admin")).toBe("true");
    });
  });

  describe("branding", () => {
    it("renders Chapa logo linking to home", async () => {
      mockReadSessionCookie.mockReturnValue(null);

      const jsx = await Navbar({});
      render(jsx);

      expect(screen.getByText(/Chapa/)).toBeDefined();
      const logoLink = screen.getByText(/Chapa/).closest("a");
      expect(logoLink?.getAttribute("href")).toBe("/");
    });
  });

  describe("navigation links", () => {
    it("renders nav links when provided", async () => {
      mockReadSessionCookie.mockReturnValue(null);

      const jsx = await Navbar({
        navLinks: [
          { label: "About", href: "/about" },
          { label: "Docs", href: "/docs" },
        ],
      });
      render(jsx);

      const links = screen.getAllByTestId("nav-link");
      expect(links).toHaveLength(2);
      expect(links[0]!.textContent).toBe("About");
      expect(links[1]!.textContent).toBe("Docs");
    });

    it("does not render nav links when empty", async () => {
      mockReadSessionCookie.mockReturnValue(null);

      const jsx = await Navbar({ navLinks: [] });
      render(jsx);

      expect(screen.queryByTestId("nav-link")).toBeNull();
      expect(screen.queryByTestId("mobile-nav")).toBeNull();
    });

    it("renders MobileNav when navLinks provided", async () => {
      mockReadSessionCookie.mockReturnValue(null);

      const jsx = await Navbar({
        navLinks: [{ label: "About", href: "/about" }],
      });
      render(jsx);

      expect(screen.getByTestId("mobile-nav")).toBeDefined();
    });
  });

  describe("accessibility", () => {
    it("has nav element with aria-label", async () => {
      mockReadSessionCookie.mockReturnValue(null);

      const jsx = await Navbar({});
      render(jsx);

      expect(
        screen.getByRole("navigation", { name: "Main navigation" }),
      ).toBeDefined();
    });
  });

  describe("theme toggle", () => {
    it("always renders ThemeToggle", async () => {
      mockReadSessionCookie.mockReturnValue(null);

      const jsx = await Navbar({});
      render(jsx);

      expect(screen.getByTestId("theme-toggle")).toBeDefined();
    });
  });

  describe("language switcher", () => {
    it("always renders LanguageSwitcher", async () => {
      mockReadSessionCookie.mockReturnValue(null);

      const jsx = await Navbar({});
      render(jsx);

      expect(screen.getByTestId("language-switcher")).toBeDefined();
    });
  });
});
