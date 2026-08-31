// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { UserMenu } from "./UserMenu";

vi.mock("next/image", () => ({
  default: ({ src, alt, onError, ...props }: { src: string; alt: string; onError?: () => void; width: number; height: number; className?: string }) =>
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-testid="avatar" onError={onError} {...props} />,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}));

vi.mock("@/lib/feature-flags-sync", () => ({
  isStudioEnabledSync: vi.fn(() => false),
  isWebmcpEnabledSync: vi.fn(() => false),
  isInsightsEnabledSync: vi.fn(() => false),
  isBitbucketEnabledSync: vi.fn(() => true),
  isCodebergEnabledSync: vi.fn(() => true),
  isGitlabEnabledSync: vi.fn(() => true),
}));

let dropdownOpen = false;
const setIsOpenMock = vi.fn((updater: boolean | ((prev: boolean) => boolean)) => {
  if (typeof updater === "function") {
    dropdownOpen = updater(dropdownOpen);
  } else {
    dropdownOpen = updater;
  }
});

vi.mock("@/hooks/useDropdownMenu", () => ({
  useDropdownMenu: () => ({
    get isOpen() {
      return dropdownOpen;
    },
    setIsOpen: setIsOpenMock,
  }),
}));

beforeEach(() => {
  dropdownOpen = false;
  setIsOpenMock.mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const baseProps = {
  login: "testuser",
  name: "Test User",
  avatarUrl: "https://example.com/avatar.png",
  isAdmin: false,
};

// ─── Basic rendering ──────────────────────────────────────────────────

describe("UserMenu", () => {
  it("renders the trigger button with login", () => {
    render(<UserMenu {...baseProps} />);
    expect(screen.getByLabelText("User menu")).toBeDefined();
    expect(screen.getByText("testuser")).toBeDefined();
  });

  it("renders avatar image", () => {
    render(<UserMenu {...baseProps} />);
    const img = screen.getByAltText("testuser's avatar");
    expect(img).toBeDefined();
  });

  it("shows fallback letter when image errors", () => {
    render(<UserMenu {...baseProps} />);
    const img = screen.getByAltText("testuser's avatar");
    fireEvent.error(img);
    expect(screen.getByText("T")).toBeDefined();
  });

  it("renders chevron icon", () => {
    render(<UserMenu {...baseProps} />);
    const button = screen.getByLabelText("User menu");
    expect(button.querySelector("svg")).not.toBeNull();
  });
});

// ─── Button type safety ──────────────────────────────────────────────

describe("UserMenu — all buttons have explicit type attribute", () => {
  afterEach(async () => {
    // The flags module is mocked, so vi.restoreAllMocks() does not reset a
    // mockReturnValue set here — leaving Studio on would leak into the
    // "hidden when the flag is off" test below.
    const featureFlags = await import("@/lib/feature-flags-sync");
    vi.mocked(featureFlags.isStudioEnabledSync).mockReturnValue(false);
  });

  it("every <button> in the component has type='button' or type='submit'", async () => {
    dropdownOpen = true;

    // Enable Creator Studio so every conditional item renders.
    const featureFlags = await import("@/lib/feature-flags-sync");
    vi.mocked(featureFlags.isStudioEnabledSync).mockReturnValue(true);

    render(<UserMenu {...baseProps} isAdmin={true} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      const typeAttr = button.getAttribute("type");
      expect(
        typeAttr === "button" || typeAttr === "submit",
        `<button> "${button.textContent?.trim()}" is missing an explicit type attribute (got ${typeAttr})`,
      ).toBe(true);
    }
  });
});

// ─── Dropdown interactions ────────────────────────────────────────────

describe("UserMenu — dropdown interactions", () => {
  it("dropdown menu has role=menu when open", () => {
    dropdownOpen = true;
    render(<UserMenu {...baseProps} />);
    expect(screen.getByRole("menu")).toBeDefined();
  });

  it("dropdown menu has aria-label", () => {
    dropdownOpen = true;
    render(<UserMenu {...baseProps} />);
    expect(
      screen.getByRole("menu").getAttribute("aria-label"),
    ).toBe("User menu options");
  });

  it("shows user name in dropdown header", () => {
    dropdownOpen = true;
    render(<UserMenu {...baseProps} />);
    expect(screen.getByText("Test User")).toBeDefined();
    expect(screen.getByText("@testuser")).toBeDefined();
  });

  it("shows login when name is null", () => {
    dropdownOpen = true;
    render(<UserMenu {...baseProps} name={null} />);
    const menuHeader = screen.getByRole("menu");
    expect(menuHeader.textContent).toContain("testuser");
  });

  it("renders fallback letter in dropdown header when image errors", () => {
    dropdownOpen = true;
    render(<UserMenu {...baseProps} />);
    const imgs = screen.getAllByAltText("testuser's avatar");
    for (const img of imgs) {
      fireEvent.error(img);
    }
    const letters = screen.getAllByText("T");
    expect(letters.length).toBeGreaterThanOrEqual(2);
  });

  it("trigger button has aria-expanded matching open state", () => {
    dropdownOpen = true;
    render(<UserMenu {...baseProps} />);
    const button = screen.getByLabelText("User menu");
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });

  it("trigger button has aria-haspopup", () => {
    render(<UserMenu {...baseProps} />);
    const button = screen.getByLabelText("User menu");
    expect(button.getAttribute("aria-haspopup")).toBe("true");
  });
});

// ─── Menu items ───────────────────────────────────────────────────────

describe("UserMenu — menu items", () => {
  beforeEach(() => {
    dropdownOpen = true;
  });

  it("renders My Badge link pointing to /u/login", () => {
    render(<UserMenu {...baseProps} />);
    const link = screen.getByText("My Badge").closest("a");
    expect(link?.getAttribute("href")).toBe("/u/testuser");
  });

  it("renders Settings link pointing to /settings", () => {
    render(<UserMenu {...baseProps} />);
    const link = screen.getByText("Settings").closest("a");
    expect(link?.getAttribute("href")).toBe("/settings");
  });

  it("renders Sign out button", () => {
    render(<UserMenu {...baseProps} />);
    expect(screen.getByText("Sign out")).toBeDefined();
  });

  it("Sign out form posts to /api/auth/logout", () => {
    render(<UserMenu {...baseProps} />);
    const signOutBtn = screen.getByText("Sign out");
    const form = signOutBtn.closest("form");
    expect(form?.getAttribute("action")).toBe("/api/auth/logout");
    expect(form?.getAttribute("method")).toBe("POST");
  });

  it("hides Admin Panel when isAdmin is false", () => {
    render(<UserMenu {...baseProps} isAdmin={false} />);
    expect(screen.queryByText("Admin Panel")).toBeNull();
  });

  it("shows Admin Panel when isAdmin is true", () => {
    render(<UserMenu {...baseProps} isAdmin={true} />);
    expect(screen.getByText("Admin Panel")).toBeDefined();
    const link = screen.getByText("Admin Panel").closest("a");
    expect(link?.getAttribute("href")).toBe("/admin");
  });
});

// ─── Creator Studio conditional rendering ─────────────────────────────

describe("UserMenu — Creator Studio conditional rendering", () => {
  beforeEach(() => {
    dropdownOpen = true;
  });

  it("hides Creator Studio when feature flag is off", () => {
    render(<UserMenu {...baseProps} />);
    expect(screen.queryByText("Creator Studio")).toBeNull();
  });

  it("shows Creator Studio when feature flag is on", async () => {
    const featureFlags = await import("@/lib/feature-flags-sync");
    vi.mocked(featureFlags.isStudioEnabledSync).mockReturnValue(true);

    render(<UserMenu {...baseProps} />);
    expect(screen.getByText("Creator Studio")).toBeDefined();
    const link = screen.getByText("Creator Studio").closest("a");
    expect(link?.getAttribute("href")).toBe("/studio");
  });
});
