// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { NavbarClient } from "./NavbarClient";

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

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, "fetch");
});

afterEach(() => {
  cleanup();
  fetchSpy.mockRestore();
});

describe("NavbarClient", () => {
  // ─── Basic rendering ──────────────────────────────────────────────────

  it("renders nav with aria-label 'Main navigation'", () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ user: null })),
    );
    render(<NavbarClient />);
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeDefined();
  });

  it("renders Chapa logo linking to home", () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ user: null })),
    );
    render(<NavbarClient />);
    expect(screen.getByText("Chapa")).toBeDefined();
    const link = screen.getByText("Chapa").closest("a");
    expect(link?.getAttribute("href")).toBe("/");
  });

  it("renders ThemeToggle", () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ user: null })),
    );
    render(<NavbarClient />);
    expect(screen.getByTestId("theme-toggle")).toBeDefined();
  });

  // ─── Logged-out state ─────────────────────────────────────────────────

  it("renders login link initially before fetch resolves", () => {
    // Never resolve the fetch
    fetchSpy.mockReturnValue(new Promise(() => {}));
    render(<NavbarClient />);
    const loginLink = screen.getByText("login");
    expect(loginLink.closest("a")?.getAttribute("href")).toBe(
      "/api/auth/login",
    );
  });

  it("keeps login link when fetch returns no user", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ user: null })),
    );
    render(<NavbarClient />);

    // Wait for fetch to complete
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/api/auth/session");
    });

    expect(screen.getByText("login")).toBeDefined();
    expect(screen.queryByTestId("user-menu")).toBeNull();
  });

  // ─── Logged-in state ──────────────────────────────────────────────────

  it("shows UserMenu after successful session fetch", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            login: "testuser",
            name: "Test User",
            avatar_url: "https://example.com/avatar.png",
            isAdmin: false,
          },
        }),
      ),
    );
    render(<NavbarClient />);

    await waitFor(() => {
      expect(screen.getByTestId("user-menu")).toBeDefined();
    });

    expect(screen.getByTestId("user-menu").textContent).toBe("testuser");
    expect(screen.queryByText("login")).toBeNull();
  });

  // ─── Fetch failure ────────────────────────────────────────────────────

  it("stays on login link when fetch fails", async () => {
    fetchSpy.mockRejectedValue(new Error("Network error"));
    render(<NavbarClient />);

    // Give it time to process the rejection
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/api/auth/session");
    });

    // Small delay to ensure the catch handler runs
    await new Promise((r) => setTimeout(r, 50));

    expect(screen.getByText("login")).toBeDefined();
    expect(screen.queryByTestId("user-menu")).toBeNull();
  });
});
