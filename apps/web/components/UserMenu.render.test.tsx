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
}));

vi.mock("@/hooks/useDropdownMenu", () => {
  let isOpen = false;
  return {
    useDropdownMenu: () => ({
      isOpen,
      setIsOpen: vi.fn((updater: boolean | ((prev: boolean) => boolean)) => {
        if (typeof updater === "function") {
          isOpen = updater(isOpen);
        } else {
          isOpen = updater;
        }
      }),
    }),
  };
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
