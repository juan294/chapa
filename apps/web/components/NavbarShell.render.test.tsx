// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NavbarShell } from "./NavbarShell";

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
    isAdmin?: boolean;
  }) => (
    <div data-testid="user-menu" data-is-admin={String(isAdmin)}>
      {login}
    </div>
  ),
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
  NavLink: ({ href, label }: { href: string; label: string; className?: string }) => (
    <a href={href} data-testid={`nav-link-${href}`}>{label}</a>
  ),
}));

const t = (key: string) => {
  const map: Record<string, string> = {
    "aria.mainNavigation": "Main navigation",
    "common.login": "login",
  };
  return map[key] ?? key;
};

afterEach(cleanup);

describe("NavbarShell render", () => {
  describe("branding", () => {
    it("renders the Chapa logo text linking to home", () => {
      render(<NavbarShell session={null} isAdmin={false} t={t} />);
      const logoLink = screen.getByText("Chapa", { exact: false }).closest("a");
      expect(logoLink).not.toBeNull();
      expect(logoLink?.getAttribute("href")).toBe("/");
    });

    it("shows a blinking cursor after the logo", () => {
      const { container } = render(<NavbarShell session={null} isAdmin={false} t={t} />);
      expect(container.querySelector(".animate-cursor-blink")).not.toBeNull();
    });
  });

  describe("navigation links", () => {
    const navLinks = [
      { label: "Studio", href: "/studio" },
      { label: "About", href: "/about" },
    ];

    it("renders nothing for nav links when navLinks is empty/absent", () => {
      render(<NavbarShell session={null} isAdmin={false} t={t} />);
      expect(screen.queryByTestId("mobile-nav")).toBeNull();
    });

    it("renders each nav link with href and label when navLinks is non-empty", () => {
      render(<NavbarShell navLinks={navLinks} session={null} isAdmin={false} t={t} />);
      const studioLink = screen.getByTestId("nav-link-/studio");
      expect(studioLink.textContent).toBe("Studio");
      const aboutLink = screen.getByTestId("nav-link-/about");
      expect(aboutLink.textContent).toBe("About");
    });

    it("renders MobileNav with the same links when navLinks is non-empty", () => {
      render(<NavbarShell navLinks={navLinks} session={null} isAdmin={false} t={t} />);
      expect(screen.getByTestId("mobile-link-/studio").textContent).toBe("Studio");
      expect(screen.getByTestId("mobile-link-/about").textContent).toBe("About");
    });

    // #1167 / UX-H1 — text-terminal-dim on bg measures 2.29:1 (dark) /
    // 2.54:1 (light), below the 4.5:1 AA floor, across 46 sites including
    // nav labels. text-text-secondary measures 6.15:1 / 4.83:1.
    // terminal-dim stays reserved for genuinely decorative glyphs ($, >, |).
    it("desktop nav-link labels use text-text-secondary, not text-terminal-dim (#1167 / UX-H1)", () => {
      render(<NavbarShell navLinks={navLinks} session={null} isAdmin={false} t={t} />);
      const studioLink = screen.getByTestId("nav-link-/studio");
      const wrapper = studioLink.parentElement;
      expect(wrapper?.className).toContain("text-text-secondary");
      expect(wrapper?.className).not.toContain("text-terminal-dim");
    });
  });

  describe("authentication slot", () => {
    it("shows a login link when session is null and not loading", () => {
      render(<NavbarShell session={null} isAdmin={false} t={t} />);
      const link = screen.getByText("login").closest("a");
      expect(link?.getAttribute("href")).toBe("/api/auth/login");
    });

    it("renders UserMenu with session and isAdmin props when session exists", () => {
      render(
        <NavbarShell
          session={{ login: "octocat", name: "The Octocat", avatar_url: "https://x/y.png" }}
          isAdmin
          t={t}
        />,
      );
      const userMenu = screen.getByTestId("user-menu");
      expect(userMenu.textContent).toBe("octocat");
      expect(userMenu.getAttribute("data-is-admin")).toBe("true");
    });

    it("renders a decorative placeholder instead of login/UserMenu while loading", () => {
      render(<NavbarShell session={null} isAdmin={false} loading t={t} />);
      const placeholder = screen.getByTestId("navbar-auth-placeholder");
      expect(placeholder.getAttribute("aria-hidden")).toBe("true");
      expect(screen.queryByText("login")).toBeNull();
      expect(screen.queryByTestId("user-menu")).toBeNull();
    });

    it("defaults loading to false when the prop is omitted", () => {
      render(<NavbarShell session={null} isAdmin={false} t={t} />);
      expect(screen.queryByTestId("navbar-auth-placeholder")).toBeNull();
    });
  });

  describe("chrome", () => {
    it("renders ThemeToggle and LanguageSwitcher", () => {
      render(<NavbarShell session={null} isAdmin={false} t={t} />);
      expect(screen.getByTestId("theme-toggle")).not.toBeNull();
      expect(screen.getByTestId("language-switcher")).not.toBeNull();
    });
  });

  describe("accessibility", () => {
    it("uses a <nav> element with an aria-label from the translation function", () => {
      render(<NavbarShell session={null} isAdmin={false} t={t} />);
      expect(screen.getByRole("navigation", { name: "Main navigation" })).not.toBeNull();
    });
  });

  describe("design system compliance", () => {
    it("uses fixed positioning, dark glass background, and stroke border on <nav>", () => {
      render(<NavbarShell session={null} isAdmin={false} t={t} />);
      const nav = screen.getByRole("navigation");
      expect(nav.className).toContain("fixed top-0");
      expect(nav.className).toContain("bg-bg/80");
      expect(nav.className).toContain("backdrop-blur-xl");
      expect(nav.className).toContain("border-stroke");
    });

    it("constrains inner content to max-w-7xl", () => {
      const { container } = render(<NavbarShell session={null} isAdmin={false} t={t} />);
      expect(container.querySelector(".max-w-7xl")).not.toBeNull();
    });

    it("logo cursor uses amber-dark (not amber) for WCAG AA contrast (#1043)", () => {
      const { container } = render(<NavbarShell session={null} isAdmin={false} t={t} />);
      const cursor = container.querySelector(".animate-cursor-blink");
      expect(cursor?.className).toContain("text-amber-dark");
      expect(cursor?.className).not.toBe("text-amber animate-cursor-blink");
    });

    it("login link has a 44px touch target and amber/50 prefix slash", () => {
      // #1214 raised the target from padding-derived to an explicit 44px
      // minimum, matching every other interactive control in the bar.
      render(<NavbarShell session={null} isAdmin={false} t={t} />);
      const link = screen.getByText("login").closest("a");
      expect(link?.className).toContain("min-h-[44px]");
      const prefix = link?.querySelector("span");
      expect(prefix?.className).toContain("text-amber/50");
    });

    it("right controls container uses a tighter gap on mobile (gap-1 sm:gap-2, #240)", () => {
      render(<NavbarShell session={null} isAdmin={false} t={t} />);
      const themeToggle = screen.getByTestId("theme-toggle");
      const controls = themeToggle.parentElement;
      expect(controls?.className).toContain("gap-1 sm:gap-2");
    });
  });
});
