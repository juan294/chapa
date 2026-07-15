// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NavbarClient } from "./NavbarClient";
import { LanguageProvider } from "@/lib/i18n";
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

vi.mock("./LanguageSwitcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher">LanguageSwitcher</div>,
}));

vi.mock("./MobileNav", () => ({
  MobileNav: ({ links }: { links: Array<{ label: string; href: string }> }) => (
    <div data-testid="mobile-nav">
      {links.map((l) => (
        <span key={l.href} data-testid={`mobile-link-${l.href}`}>{l.label}</span>
      ))}
    </div>
  ),
}));

vi.mock("./NavLink", () => ({
  NavLink: ({ label, href }: { label: string; href: string }) => (
    <a href={href} data-testid={`nav-link-${href}`}>{label}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
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

  it("renders LanguageSwitcher", () => {
    render(<NavbarClient />);
    expect(screen.getByTestId("language-switcher")).toBeDefined();
  });

  // ─── Logged-out state ─────────────────────────────────────────────────

  it("renders a neutral placeholder (not the login link) while session is loading (#1025 / FE-L2)", () => {
    mockUseSession.mockReturnValue({ session: null, loading: true, invalidate: vi.fn() });
    render(<NavbarClient />);
    expect(screen.getByTestId("navbar-auth-placeholder")).toBeDefined();
    expect(screen.queryByText("login")).toBeNull();
    expect(screen.queryByTestId("user-menu")).toBeNull();
  });

  it("swaps the placeholder for the login link once loading resolves with no session", () => {
    mockUseSession.mockReturnValue({ session: null, loading: false, invalidate: vi.fn() });
    render(<NavbarClient />);
    expect(screen.queryByTestId("navbar-auth-placeholder")).toBeNull();
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

  // ─── Nav links locale awareness ───────────────────────────────────────
  // NavbarClient uses t('landing.navLinks') from the active LanguageProvider
  // locale — NOT the server-passed prop — so locale switches update nav labels.
  // The prop is a presence signal only ("show center nav on this page").

  it("shows nav links from the active locale (Spanish LanguageProvider)", async () => {
    const { es } = await import("@/lib/i18n/dictionaries/es");
    const anyLinks = [{ label: "ignored", href: "#features" }];
    render(
      <LanguageProvider initialLocale="es" dictionary={es}>
        <NavbarClient navLinks={anyLinks} />
      </LanguageProvider>
    );
    // Spanish LanguageProvider → labels should come from the Spanish dictionary
    expect(screen.getByTestId("nav-link-#features").textContent).toBe("Funciones");
  });

  it("shows nav links from the active locale (English LanguageProvider)", async () => {
    const { en } = await import("@/lib/i18n/dictionaries/en");
    const anyLinks = [{ label: "ignored", href: "#features" }];
    render(
      <LanguageProvider initialLocale="en" dictionary={en}>
        <NavbarClient navLinks={anyLinks} />
      </LanguageProvider>
    );
    // English LanguageProvider → labels should come from the English dictionary
    expect(screen.getByTestId("nav-link-#features").textContent).toBe("Features");
  });

  it("does not show nav links when navLinks prop is omitted", () => {
    render(<NavbarClient />);
    expect(screen.queryByTestId("nav-link-#features")).toBeNull();
  });
});
