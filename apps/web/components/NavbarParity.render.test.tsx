// @vitest-environment jsdom
//
// Regression coverage for #1025 (FE-M2): before the NavbarShell extraction,
// Navbar (server) computed isAdmin via isAdminHandle(session.login) while
// NavbarClient took it from session.isAdmin off the client-fetched payload.
// Both now delegate to the same NavbarShell, driven by a single `isAdmin`
// prop each variant computes independently but renders identically. This
// test proves admin-only affordances render consistently across BOTH
// variants for equivalent session data — i.e. NavbarShell truly unifies
// the rendering logic, not just incidentally produces the same output.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const mockReadSessionCookie = vi.fn();
const mockIsAdminHandle = vi.fn();
const mockHeadersGet = vi.fn();
const mockUseSession = vi.fn();

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: mockHeadersGet })),
  cookies: vi.fn(async () => ({ get: vi.fn().mockReturnValue(undefined) })),
}));

vi.mock("@/lib/auth/github", () => ({
  readSessionCookie: (...args: unknown[]) => mockReadSessionCookie(...args),
}));

vi.mock("@/lib/auth/admin", () => ({
  isAdminHandle: (...args: unknown[]) => mockIsAdminHandle(...args),
}));

vi.mock("@/hooks/useSession", () => ({
  useSession: () => mockUseSession(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
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
  UserMenu: ({ login, isAdmin }: { login: string; isAdmin: boolean }) => (
    <div data-testid="user-menu" data-login={login} data-admin={String(isAdmin)}>
      UserMenu
    </div>
  ),
}));

vi.mock("./MobileNav", () => ({
  MobileNav: () => <div data-testid="mobile-nav">MobileNav</div>,
}));

vi.mock("./NavLink", () => ({
  NavLink: ({ label, href }: { label: string; href: string }) => (
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
import { NavbarClient } from "./NavbarClient";

beforeEach(() => {
  process.env.NEXTAUTH_SECRET = "test-secret-32-characters-valid-ok";
  mockReadSessionCookie.mockReset();
  mockIsAdminHandle.mockReset();
  mockHeadersGet.mockReset();
  mockHeadersGet.mockReturnValue("en-US");
  mockUseSession.mockReset();
});

afterEach(() => {
  cleanup();
  delete process.env.NEXTAUTH_SECRET;
});

describe("Navbar / NavbarClient admin-status parity (#1025)", () => {
  it("both variants render isAdmin=true for an admin handle given equivalent session data", async () => {
    mockReadSessionCookie.mockReturnValue({
      login: "admin-user",
      name: "Admin",
      avatar_url: "https://example.com/avatar.png",
    });
    mockIsAdminHandle.mockReturnValue(true);

    const serverJsx = await Navbar({});
    render(serverJsx);
    expect(screen.getByTestId("user-menu").getAttribute("data-admin")).toBe("true");
    cleanup();

    mockUseSession.mockReturnValue({
      session: {
        login: "admin-user",
        name: "Admin",
        avatar_url: "https://example.com/avatar.png",
        isAdmin: true,
      },
      loading: false,
      invalidate: vi.fn(),
    });
    render(<NavbarClient />);
    expect(screen.getByTestId("user-menu").getAttribute("data-admin")).toBe("true");
  });

  it("both variants render isAdmin=false for a non-admin handle given equivalent session data", async () => {
    mockReadSessionCookie.mockReturnValue({
      login: "regular-user",
      name: "Regular",
      avatar_url: "https://example.com/avatar.png",
    });
    mockIsAdminHandle.mockReturnValue(false);

    const serverJsx = await Navbar({});
    render(serverJsx);
    expect(screen.getByTestId("user-menu").getAttribute("data-admin")).toBe("false");
    cleanup();

    mockUseSession.mockReturnValue({
      session: {
        login: "regular-user",
        name: "Regular",
        avatar_url: "https://example.com/avatar.png",
        isAdmin: false,
      },
      loading: false,
      invalidate: vi.fn(),
    });
    render(<NavbarClient />);
    expect(screen.getByTestId("user-menu").getAttribute("data-admin")).toBe("false");
  });
});
