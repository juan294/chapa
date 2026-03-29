// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NavbarClient } from "./NavbarClient";
import type { SessionUser } from "@/hooks/useSession";

interface UseSessionReturn { session: SessionUser | null; loading: boolean; invalidate: () => void }
const mockUseSession = vi.fn<() => UseSessionReturn>();

vi.mock("@/hooks/useSession", () => ({
  useSession: () => mockUseSession(),
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
  }: {
    login: string;
    name: string | null;
    avatarUrl: string;
    isAdmin?: boolean;
  }) => <div data-testid="user-menu">{login}</div>,
}));

vi.mock("./ThemeToggle", () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Toggle</button>,
}));

beforeEach(() => {
  mockUseSession.mockReturnValue({ session: null, loading: false, invalidate: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("NavbarClient", () => {
  // ─── Basic rendering ──────────────────────────────────────────────────

  it("renders nav with aria-label 'Main navigation'", () => {
    render(<NavbarClient />);
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeDefined();
  });

  it("renders Chapa logo linking to home", () => {
    render(<NavbarClient />);
    expect(screen.getByText("Chapa")).toBeDefined();
    const link = screen.getByText("Chapa").closest("a");
    expect(link?.getAttribute("href")).toBe("/");
  });

  it("renders ThemeToggle", () => {
    render(<NavbarClient />);
    expect(screen.getByTestId("theme-toggle")).toBeDefined();
  });

  // ─── Logged-out state ─────────────────────────────────────────────────

  it("renders login link when session is loading", () => {
    mockUseSession.mockReturnValue({ session: null, loading: true, invalidate: vi.fn() });
    render(<NavbarClient />);
    const loginLink = screen.getByText("login");
    expect(loginLink.closest("a")?.getAttribute("href")).toBe(
      "/api/auth/login",
    );
  });

  it("keeps login link when fetch returns no user", () => {
    mockUseSession.mockReturnValue({ session: null, loading: false, invalidate: vi.fn() });
    render(<NavbarClient />);

    expect(screen.getByText("login")).toBeDefined();
    expect(screen.queryByTestId("user-menu")).toBeNull();
  });

  // ─── Logged-in state ──────────────────────────────────────────────────

  it("shows UserMenu after successful session fetch", () => {
    mockUseSession.mockReturnValue({
      session: {
        login: "testuser",
        name: "Test User",
        avatar_url: "https://example.com/avatar.png",
        isAdmin: false,
      },
      loading: false,
      invalidate: vi.fn(),
    });
    render(<NavbarClient />);

    expect(screen.getByTestId("user-menu")).toBeDefined();
    expect(screen.getByTestId("user-menu").textContent).toBe("testuser");
    expect(screen.queryByText("login")).toBeNull();
  });

  // ─── Fetch failure ────────────────────────────────────────────────────

  it("stays on login link when fetch fails", () => {
    mockUseSession.mockReturnValue({ session: null, loading: false, invalidate: vi.fn() });
    render(<NavbarClient />);

    expect(screen.getByText("login")).toBeDefined();
    expect(screen.queryByTestId("user-menu")).toBeNull();
  });
});
