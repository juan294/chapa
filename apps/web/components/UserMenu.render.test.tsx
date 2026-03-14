// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { UserMenu, clearPlatformStatusCache } from "./UserMenu";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, onError, ...props }: { src: string; alt: string; onError?: () => void; width: number; height: number; className?: string }) =>
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-testid="avatar" onError={onError} {...props} />,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}));

vi.mock("@/lib/feature-flags", () => ({
  isStudioEnabledSync: vi.fn(() => false),
  isBitbucketEnabledSync: vi.fn(() => false),
  isCodebergEnabledSync: vi.fn(() => false),
  isInsightsEnabledSync: vi.fn(() => false),
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

describe("UserMenu — platform status caching", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    // Reset the module-level cache before each test
    clearPlatformStatusCache();

    const featureFlags = await import("@/lib/feature-flags");
    // Enable both platform flags
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(true);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(true);

    // Mock fetch to return linked status
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/bitbucket/status")) {
        return Promise.resolve(new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "bb-user" })));
      }
      if (urlStr.includes("/api/auth/codeberg/status")) {
        return Promise.resolve(new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "cb-user" })));
      }
      return Promise.resolve(new Response("{}"));
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("fetches platform status on first mount", async () => {
    render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/api/auth/bitbucket/status");
      expect(fetchSpy).toHaveBeenCalledWith("/api/auth/codeberg/status");
    });
  });

  it("does NOT re-fetch on second mount (uses cache)", async () => {
    // First mount — should fetch
    const { unmount } = render(<UserMenu {...baseProps} />);
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2); // bitbucket + codeberg
    });

    // Unmount
    unmount();
    fetchSpy.mockClear();

    // Second mount — should use cache, no new fetches
    render(<UserMenu {...baseProps} />);

    // Give it a tick to run useEffect
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("re-fetches after cache is cleared (e.g. after unlink)", async () => {
    // First mount — fetches
    const { unmount } = render(<UserMenu {...baseProps} />);
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    unmount();
    fetchSpy.mockClear();

    // Clear cache (simulates what unlink does)
    clearPlatformStatusCache();

    // Third mount — should fetch again
    render(<UserMenu {...baseProps} />);
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});

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
    // The header uses `name || login`, so login should be used
    const menuHeader = screen.getByRole("menu");
    expect(menuHeader.textContent).toContain("testuser");
  });

  it("renders fallback letter in dropdown header when image errors", () => {
    dropdownOpen = true;
    render(<UserMenu {...baseProps} />);
    // Both the trigger and dropdown header show avatar
    const imgs = screen.getAllByAltText("testuser's avatar");
    for (const img of imgs) {
      fireEvent.error(img);
    }
    // Fallback letter "T" should appear (at least twice — trigger + header)
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

describe("UserMenu — menu items", () => {
  beforeEach(() => {
    dropdownOpen = true;
  });

  it("renders Your Badge link pointing to /u/login", () => {
    render(<UserMenu {...baseProps} />);
    const link = screen.getByText("Your Badge").closest("a");
    expect(link?.getAttribute("href")).toBe("/u/testuser");
  });

  it("renders About Chapa link", () => {
    render(<UserMenu {...baseProps} />);
    const link = screen.getByText("About Chapa").closest("a");
    expect(link?.getAttribute("href")).toBe("/about");
  });

  it("renders Terms of Service link", () => {
    render(<UserMenu {...baseProps} />);
    const link = screen.getByText("Terms of Service").closest("a");
    expect(link?.getAttribute("href")).toBe("/terms");
  });

  it("renders Privacy Policy link", () => {
    render(<UserMenu {...baseProps} />);
    const link = screen.getByText("Privacy Policy").closest("a");
    expect(link?.getAttribute("href")).toBe("/privacy");
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

describe("UserMenu — Creator Studio conditional rendering", () => {
  beforeEach(() => {
    dropdownOpen = true;
  });

  it("hides Creator Studio when feature flag is off", () => {
    render(<UserMenu {...baseProps} />);
    expect(screen.queryByText("Creator Studio")).toBeNull();
  });

  it("shows Creator Studio when feature flag is on", async () => {
    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isStudioEnabledSync).mockReturnValue(true);

    render(<UserMenu {...baseProps} />);
    expect(screen.getByText("Creator Studio")).toBeDefined();
    const link = screen.getByText("Creator Studio").closest("a");
    expect(link?.getAttribute("href")).toBe("/studio");
  });
});

describe("UserMenu — insights import", () => {
  beforeEach(() => {
    dropdownOpen = true;
  });

  it("hides insights import when feature flag is off", () => {
    render(<UserMenu {...baseProps} />);
    expect(screen.queryByText("Import Claude Code Insights")).toBeNull();
  });

  it("shows insights import when feature flag is on", async () => {
    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(true);

    render(<UserMenu {...baseProps} />);
    expect(screen.getByText("Import Claude Code Insights")).toBeDefined();
  });

  it("insights label has a hidden file input", async () => {
    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(true);

    render(<UserMenu {...baseProps} />);
    const fileInput = screen.getByLabelText("Select Claude Code insights HTML report");
    expect(fileInput).toBeDefined();
    expect(fileInput.getAttribute("type")).toBe("file");
    expect(fileInput.getAttribute("accept")).toBe(".html");
  });
});

describe("UserMenu — Bitbucket link/unlink in dropdown", () => {
  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();
    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(true);
  });

  afterEach(() => {
    clearPlatformStatusCache();
  });

  it("shows 'Link Bitbucket' when not linked", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/bitbucket/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: false, remoteLogin: null })),
        );
      }
      return Promise.resolve(new Response("{}"));
    });

    render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("Link Bitbucket")).toBeDefined();
    });
  });

  it("shows Bitbucket username and Unlink when linked", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/bitbucket/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "bb-user" })),
        );
      }
      return Promise.resolve(new Response("{}"));
    });

    render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("bb-user")).toBeDefined();
      expect(screen.getByLabelText("Unlink Bitbucket account")).toBeDefined();
    });
  });
});

describe("UserMenu — Codeberg link/unlink in dropdown", () => {
  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();
    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(true);
  });

  afterEach(() => {
    clearPlatformStatusCache();
  });

  it("shows 'Link Codeberg' when not linked", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/codeberg/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: false, remoteLogin: null })),
        );
      }
      return Promise.resolve(new Response("{}"));
    });

    render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("Link Codeberg")).toBeDefined();
    });
  });

  it("shows Codeberg username and Unlink when linked", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/codeberg/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "cb-user" })),
        );
      }
      return Promise.resolve(new Response("{}"));
    });

    render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("cb-user")).toBeDefined();
      expect(screen.getByLabelText("Unlink Codeberg account")).toBeDefined();
    });
  });
});
