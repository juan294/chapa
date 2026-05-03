// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  redirect: vi.fn(),
  getOptionalServerSessionFromHeaders: vi.fn(),
  isAdminHandle: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/auth/session", () => ({
  getOptionalServerSessionFromHeaders:
    mocks.getOptionalServerSessionFromHeaders,
}));

vi.mock("@/lib/auth/admin", () => ({
  isAdminHandle: mocks.isAdminHandle,
}));

vi.mock("@/components/Navbar", () => ({
  Navbar: () => <nav data-testid="navbar" />,
}));

vi.mock("@/components/GlobalCommandBarLazy", () => ({
  GlobalCommandBarLazy: ({ isAdmin }: { isAdmin?: boolean }) => (
    <div data-testid="command-bar" data-admin={String(isAdmin)} />
  ),
}));

vi.mock("./AdminDashboardClient", () => ({
  AdminDashboardClient: () => <section data-testid="admin-dashboard" />,
}));

beforeEach(() => {
  mocks.headers.mockResolvedValue(new Headers());
  mocks.redirect.mockImplementation((url: string) => {
    throw new Error(`redirect:${url}`);
  });
  mocks.getOptionalServerSessionFromHeaders.mockReset();
  mocks.isAdminHandle.mockReset();
});

describe("AdminPage render", () => {
  it("redirects visitors without a session", async () => {
    mocks.getOptionalServerSessionFromHeaders.mockReturnValue(null);
    const { default: AdminPage } = await import("./page");

    await expect(AdminPage()).rejects.toThrow("redirect:/");
    expect(mocks.isAdminHandle).not.toHaveBeenCalled();
  });

  it("redirects signed-in non-admin users", async () => {
    mocks.getOptionalServerSessionFromHeaders.mockReturnValue({
      login: "not-admin",
    });
    mocks.isAdminHandle.mockReturnValue(false);
    const { default: AdminPage } = await import("./page");

    await expect(AdminPage()).rejects.toThrow("redirect:/");
    expect(mocks.isAdminHandle).toHaveBeenCalledWith("not-admin");
  });

  it("renders the admin shell for admin users", async () => {
    mocks.getOptionalServerSessionFromHeaders.mockReturnValue({
      login: "admin",
    });
    mocks.isAdminHandle.mockReturnValue(true);
    const { default: AdminPage } = await import("./page");

    render(await AdminPage());

    expect(screen.getByTestId("navbar")).toBeTruthy();
    expect(screen.getByTestId("admin-dashboard")).toBeTruthy();
    expect(screen.getByText("Admin Dashboard")).toBeTruthy();
    expect(screen.getByTestId("command-bar").getAttribute("data-admin")).toBe(
      "true",
    );
  });
});
