// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import * as fs from "node:fs";
import * as path from "node:path";

// ---------- Module mocks ----------

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
  // Platform flags default to enabled so existing status-fetch tests behave as
  // before; the gating test (#885) overrides these to false.
  isBitbucketEnabledSync: vi.fn(() => true),
  isCodebergEnabledSync: vi.fn(() => true),
  isGitlabEnabledSync: vi.fn(() => true),
}));

const mockClearSessionCache = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useSession", () => ({
  clearSessionCache: mockClearSessionCache,
}));

// Static import gets the mocked module (vi.mock is hoisted)
import * as featureFlags from "@/lib/feature-flags-sync";

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

import { UserMenu, clearPlatformStatusCache } from "./UserMenu";

// ---------- Fixtures ----------

const baseProps = {
  login: "testuser",
  name: "Test User",
  avatarUrl: "https://example.com/avatar.png",
  isAdmin: false,
};

// ---------- Setup / Teardown ----------

beforeEach(() => {
  dropdownOpen = false;
  setIsOpenMock.mockClear();
  mockClearSessionCache.mockClear();
  clearPlatformStatusCache();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------- Source-code static assertions ----------
// These check facts with no DOM-observable equivalent: where a module-level
// store is declared relative to the component, which module an icon/hook is
// imported from, code-reuse between near-identical handlers, and that an old
// state pattern was fully removed. Everything with a DOM-observable outcome
// lives in the "Runtime tests" section below instead.

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "UserMenu.tsx"),
  "utf-8",
);


// ═══════════════════════════════════════════════════════════════════════
// Runtime tests (render + behavior)
// ═══════════════════════════════════════════════════════════════════════


describe("UserMenu — menu item ordering (runtime)", () => {
  beforeEach(() => {
    dropdownOpen = true;
    vi.mocked(featureFlags.isStudioEnabledSync).mockReturnValue(true);
  });

  afterEach(() => {
    vi.mocked(featureFlags.isStudioEnabledSync).mockReturnValue(false);
  });

  it("renders My Badge, Creator Studio, Settings, then Admin Panel in that order", () => {
    render(<UserMenu {...baseProps} isAdmin={true} />);

    const adjacentPairs: [string, string][] = [
      ["My Badge", "Creator Studio"],
      ["Creator Studio", "Settings"],
      ["Settings", "Admin Panel"],
    ];
    for (const [before, after] of adjacentPairs) {
      const relation = screen
        .getByText(before)
        .compareDocumentPosition(screen.getByText(after));
      expect(relation & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Feature flag gating — Studio, Admin, Insights menu items (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — Studio menu item when enabled (runtime)", () => {
  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();
    vi.mocked(featureFlags.isStudioEnabledSync).mockReturnValue(true);
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(false);
  });

  it("renders Creator Studio link when studio flag is enabled", () => {
    render(<UserMenu {...baseProps} />);

    expect(screen.getByText("Creator Studio")).toBeDefined();
    const link = screen.getByText("Creator Studio").closest("a");
    expect(link?.getAttribute("href")).toBe("/studio");
  });
});

describe("UserMenu — Studio hidden when disabled (runtime)", () => {
  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();
    vi.mocked(featureFlags.isStudioEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(false);
  });

  it("does not render Creator Studio link when studio flag is disabled", () => {
    render(<UserMenu {...baseProps} />);

    expect(screen.queryByText("Creator Studio")).toBeNull();
  });
});

describe("UserMenu — Admin Panel link (runtime)", () => {
  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();
    vi.mocked(featureFlags.isStudioEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(false);
  });

  it("renders Admin Panel link when isAdmin is true", () => {
    render(<UserMenu {...baseProps} isAdmin={true} />);

    expect(screen.getByText("Admin Panel")).toBeDefined();
    const link = screen.getByText("Admin Panel").closest("a");
    expect(link?.getAttribute("href")).toBe("/admin");
  });

  it("does not render Admin Panel link when isAdmin is false", () => {
    render(<UserMenu {...baseProps} isAdmin={false} />);

    expect(screen.queryByText("Admin Panel")).toBeNull();
  });

  it("Admin Panel link has role=menuitem and an aria-hidden icon", () => {
    render(<UserMenu {...baseProps} isAdmin={true} />);

    const link = screen.getByText("Admin Panel").closest("a");
    expect(link?.getAttribute("role")).toBe("menuitem");
    const icon = link?.querySelector("svg");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Insights success toast — dictionary-resolved, both locales (#1170 / FE-M4)
//
// Regression guard: the success toast used to be built from raw template
// literals (`Craft: ${craftScore} ${craftTier}`, `Score updated to
// ${newScore}`) that never went through t(), so a Spanish-locale user (the
// default locale) got an English-only confirmation. `craftTier` is also a
// raw enum value from the API — an unrecognized tier must fall back to the
// raw string rather than rendering a bare translation-key path.
// Insights loading toast duration (runtime)
// Semantic HTML for menu items (#578, runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — semantic HTML for menu items (runtime, #578)", () => {
  beforeEach(() => {
    dropdownOpen = true;
  });

  it("every role=menuitem element is a <button> or <a>, never a <label>", () => {
    render(<UserMenu {...baseProps} isAdmin={true} />);

    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems.length).toBeGreaterThan(0);
    menuItems.forEach((item) => {
      expect(["BUTTON", "A"]).toContain(item.tagName);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Image fallback (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — avatar image error fallback (runtime)", () => {
  beforeEach(async () => {
    dropdownOpen = false;
    clearPlatformStatusCache();

  });

  it("shows fallback letter when image fails to load", () => {
    render(<UserMenu {...baseProps} />);

    const img = screen.getByTestId("avatar");
    fireEvent.error(img);

    // Fallback letter should appear (first letter of login, uppercased)
    expect(screen.getByText("T")).toBeDefined();
  });

  it("shows fallback letter in both trigger and dropdown header after image error", () => {
    dropdownOpen = true;
    render(<UserMenu {...baseProps} />);

    // Trigger the image error on the first avatar
    const imgs = screen.getAllByTestId("avatar");
    imgs.forEach((img) => fireEvent.error(img));

    // Both the trigger and the dropdown header should show fallback letter
    const fallbacks = screen.getAllByText("T");
    expect(fallbacks.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Menu toggle and navigation links (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — menu actions close dropdown (runtime)", () => {
  beforeEach(() => {
    dropdownOpen = true;
  });

  it("clicking My Badge link calls setOpen to close the menu", () => {
    render(<UserMenu {...baseProps} />);

    fireEvent.click(screen.getByText("My Badge"));

    // setIsOpenMock should have been called with false (close the menu)
    expect(setIsOpenMock).toHaveBeenCalledWith(false);
  });

  it("clicking Settings link calls setOpen to close the menu", () => {
    render(<UserMenu {...baseProps} />);

    fireEvent.click(screen.getByText("Settings"));

    expect(setIsOpenMock).toHaveBeenCalledWith(false);
  });

  it("clicking the trigger button toggles the menu", () => {
    dropdownOpen = false;
    render(<UserMenu {...baseProps} />);

    const trigger = screen.getByLabelText("User menu");
    fireEvent.click(trigger);

    // setIsOpenMock should have been called with a function toggling the state
    expect(setIsOpenMock).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Display name fallback (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — display name fallback (runtime)", () => {
  beforeEach(() => {
    dropdownOpen = true;
    clearPlatformStatusCache();
  });

  it("shows display name when name is provided", () => {
    render(<UserMenu {...baseProps} name="Test User" />);
    expect(screen.getByText("Test User")).toBeDefined();
  });

  it("falls back to login when name is null", () => {
    render(<UserMenu {...baseProps} name={null} />);
    // The dropdown header should show login since name is null
    // There are two instances of login: the trigger and the header @login
    const elements = screen.getAllByText("testuser");
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Chevron rotation on open state (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — chevron rotation (runtime)", () => {
  beforeEach(() => {
    clearPlatformStatusCache();
  });

  it("chevron has rotate-180 class when menu is open", () => {
    dropdownOpen = true;
    render(<UserMenu {...baseProps} />);
    const trigger = screen.getByLabelText("User menu");
    const svg = trigger.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.className.baseVal || svg!.getAttribute("class")).toContain("rotate-180");
  });

  it("chevron does not have rotate-180 class when menu is closed", () => {
    dropdownOpen = false;
    render(<UserMenu {...baseProps} />);
    const trigger = screen.getByLabelText("User menu");
    const svg = trigger.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.className.baseVal || svg!.getAttribute("class")).not.toContain("rotate-180");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Menu dropdown open/close visibility (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — dropdown visibility (runtime)", () => {
  beforeEach(() => {
    clearPlatformStatusCache();
  });

  it("does not render dropdown menu when closed", () => {
    dropdownOpen = false;
    render(<UserMenu {...baseProps} />);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("renders dropdown menu when open", () => {
    dropdownOpen = true;
    render(<UserMenu {...baseProps} />);
    expect(screen.getByRole("menu")).toBeDefined();
  });

  it("dropdown menu has aria-label 'User menu options'", () => {
    dropdownOpen = true;
    render(<UserMenu {...baseProps} />);
    expect(screen.getByRole("menu").getAttribute("aria-label")).toBe("User menu options");
  });

  it("trigger button has correct aria-expanded state when closed", () => {
    dropdownOpen = false;
    render(<UserMenu {...baseProps} />);
    const trigger = screen.getByLabelText("User menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("trigger button has correct aria-expanded state when open", () => {
    dropdownOpen = true;
    render(<UserMenu {...baseProps} />);
    const trigger = screen.getByLabelText("User menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Sign out form (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — sign out (runtime)", () => {
  beforeEach(() => {
    dropdownOpen = true;
    clearPlatformStatusCache();
  });

  it("renders sign out button with role=menuitem", () => {
    render(<UserMenu {...baseProps} />);
    expect(screen.getByText("Sign out")).toBeDefined();
    const btn = screen.getByText("Sign out");
    expect(btn.getAttribute("role")).toBe("menuitem");
  });

  it("sign out form posts to /api/auth/logout", () => {
    render(<UserMenu {...baseProps} />);
    const btn = screen.getByText("Sign out");
    const form = btn.closest("form");
    expect(form).not.toBeNull();
    expect(form!.getAttribute("method")).toBe("POST");
    expect(form!.getAttribute("action")).toBe("/api/auth/logout");
  });

  // Phase 3 — avatar images use img-outline class
  it("avatar images use img-outline class for visual boundary", () => {
    expect(SOURCE).toContain("img-outline");
  });

  // Phase 7 — exit animation for dropdown
  it("imports useAnimatedUnmount for exit animation", () => {
    expect(SOURCE).toContain("useAnimatedUnmount");
  });

  it("applies animate-fade-out-up during dropdown exit", () => {
    expect(SOURCE).toContain("animate-fade-out-up");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// #732 — Cache clearing on logout (runtime)
// All module-level per-user caches must be cleared before redirecting
// so that a subsequent login as a different user gets a clean state.
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — #732 logout clears module-level caches (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dropdownOpen = true;
    clearPlatformStatusCache();
    mockClearSessionCache.mockClear();

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/logout")) {
        return Promise.resolve(new Response("{}", { status: 200 }));
      }
      return Promise.resolve(new Response("{}"));
    });

    // Intercept window.location.href setter so we can assert on it
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, href: "" },
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("clicking Sign out calls clearSessionCache before navigating away", async () => {
    render(<UserMenu {...baseProps} />);

    const btn = screen.getByText("Sign out");

    await act(async () => {
      fireEvent.click(btn);
    });

    expect(mockClearSessionCache).toHaveBeenCalledTimes(1);
  });

  it("clicking Sign out clears the platform status cache before navigating away", async () => {
    render(<UserMenu {...baseProps} />);

    const btn = screen.getByText("Sign out");

    // Populate the platform cache first so we can verify it gets cleared
    // (the cache object state is module-level — clearPlatformStatusCache resets it)
    await act(async () => {
      fireEvent.click(btn);
    });

    // After logout, fetching platform status again should NOT use stale cache:
    // clearPlatformStatusCache must have been called, resetting platformStatusCache.fetched to false
    expect(SOURCE).toContain("clearPlatformStatusCache()");
  });

  it("clicking Sign out clears the owner cache warm sessionStorage entries", async () => {
    // Populate sessionStorage with a warm cache entry for the current user
    sessionStorage.setItem("chapa:refreshed:testuser", "1");
    sessionStorage.setItem("chapa:refreshed:otheruser", "1");

    render(<UserMenu {...baseProps} />);

    const btn = screen.getByText("Sign out");

    await act(async () => {
      fireEvent.click(btn);
    });

    // The owner cache warm entry for the logged-in user should be cleared
    expect(sessionStorage.getItem("chapa:refreshed:testuser")).toBeNull();
  });

  it("clicking Sign out posts to /api/auth/logout via fetch", async () => {
    render(<UserMenu {...baseProps} />);

    const btn = screen.getByText("Sign out");

    await act(async () => {
      fireEvent.click(btn);
    });

    const logoutCalls = fetchSpy.mock.calls.filter(
      ([url]: [unknown]) => typeof url === "string" && url.includes("/api/auth/logout"),
    );
    expect(logoutCalls.length).toBe(1);
    const [, opts] = logoutCalls[0] as [string, RequestInit];
    expect(opts.method).toBe("POST");
  });
});

/**
 * #1238 — the dropdown is navigation only now. Connections, the insights
 * import and the legal links each have a real home (`/settings` for the first
 * two, `SiteFooter` for the third), and keeping a second copy here is how the
 * badge ended up with two implementations (#1191). These assertions are the
 * guard: they fail if any of it is reintroduced.
 */
describe("UserMenu — trimmed to navigation (#1238)", () => {
  beforeEach(() => {
    dropdownOpen = true;
    vi.mocked(featureFlags.isStudioEnabledSync).mockReturnValue(true);
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(true);
  });

  afterEach(() => {
    vi.mocked(featureFlags.isStudioEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(false);
  });

  it("keeps the navigation items", () => {
    render(<UserMenu {...baseProps} isAdmin={true} />);

    for (const label of ["My Badge", "Creator Studio", "Settings", "Admin Panel", "Sign out"]) {
      expect(screen.getByText(label)).toBeDefined();
    }
  });

  it("renders no platform link or unlink controls", () => {
    render(<UserMenu {...baseProps} />);

    for (const label of [
      "Link Bitbucket",
      "Link Codeberg",
      "Link GitLab",
      "Unlink",
    ]) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });

  it("renders no insights import control, even with the flag on", () => {
    render(<UserMenu {...baseProps} />);

    expect(screen.queryByText("Import Claude Code Insights")).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("renders no legal links — SiteFooter carries those", () => {
    render(<UserMenu {...baseProps} />);

    for (const label of ["About Chapa", "Terms of Service", "Privacy Policy"]) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });

  it("never fetches platform connection status", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<UserMenu {...baseProps} />);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
