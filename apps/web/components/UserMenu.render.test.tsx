// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import { UserMenu, clearPlatformStatusCache } from "./UserMenu";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const mockRefresh = vi.fn();

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

vi.mock("@/lib/insights/parser", () => ({
  parseInsightsHtml: vi.fn(() => ({ sessions: [] })),
}));

vi.mock("./ConfirmDialog", () => ({
  ConfirmDialog: ({
    open,
    title,
    onConfirm,
    onCancel,
    loading,
  }: {
    open: boolean;
    title: string;
    onConfirm: () => void;
    onCancel: () => void;
    loading: boolean;
  }) =>
    open ? (
      <div data-testid="confirm-dialog" data-title={title} data-loading={String(loading)}>
        <button data-testid="confirm-btn" onClick={onConfirm}>
          Confirm
        </button>
        <button data-testid="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}));

vi.mock("./Toast", () => ({
  Toast: ({
    message,
    type,
    detail,
  }: {
    message: string;
    type: string;
    detail?: string;
    duration?: number;
    onDismiss?: () => void;
  }) => (
    <div data-testid="toast" data-type={type}>
      {message}
      {detail && <span data-testid="toast-detail">{detail}</span>}
    </div>
  ),
}));

beforeEach(() => {
  dropdownOpen = false;
  setIsOpenMock.mockClear();
  mockRefresh.mockClear();
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
  afterEach(() => {
    clearPlatformStatusCache();
  });

  it("every <button> in the component has type='button' or type='submit'", async () => {
    dropdownOpen = true;

    // Enable conditional sections so every button renders
    const featureFlags = await import("@/lib/feature-flags-sync");
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(true);

    clearPlatformStatusCache();
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/bitbucket/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "bb-user" })),
        );
      }
      if (urlStr.includes("/api/auth/codeberg/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "cb-user" })),
        );
      }
      return Promise.resolve(new Response("{}"));
    });

    render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Unlink Bitbucket account")).toBeDefined();
      expect(screen.getByLabelText("Unlink Codeberg account")).toBeDefined();
    });

    const buttons = screen.getAllByRole("button");
    for (const button of buttons) {
      const typeAttr = button.getAttribute("type");
      expect(
        typeAttr === "button" || typeAttr === "submit",
        `<button> "${button.textContent?.trim()}" is missing an explicit type attribute (got ${typeAttr})`,
      ).toBe(true);
    }

    // Reset feature flag mocks to prevent leaking into subsequent tests
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(false);
  });
});

// ─── Platform status caching ──────────────────────────────────────────

describe("UserMenu — platform status caching", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    clearPlatformStatusCache();

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
    const { unmount } = render(<UserMenu {...baseProps} />);
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    unmount();
    fetchSpy.mockClear();

    render(<UserMenu {...baseProps} />);

    await new Promise((r) => setTimeout(r, 50));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("re-fetches after cache is cleared (e.g. after unlink)", async () => {
    const { unmount } = render(<UserMenu {...baseProps} />);
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    unmount();
    fetchSpy.mockClear();

    clearPlatformStatusCache();

    render(<UserMenu {...baseProps} />);
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
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

// ─── Insights import ──────────────────────────────────────────────────

describe("UserMenu — insights import", () => {
  beforeEach(() => {
    dropdownOpen = true;
  });

  it("hides insights import when feature flag is off", () => {
    render(<UserMenu {...baseProps} />);
    expect(screen.queryByText("Import Claude Code Insights")).toBeNull();
  });

  it("shows insights import when feature flag is on", async () => {
    const featureFlags = await import("@/lib/feature-flags-sync");
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(true);

    render(<UserMenu {...baseProps} />);
    expect(screen.getByText("Import Claude Code Insights")).toBeDefined();
  });

  it("insights label has a hidden file input", async () => {
    const featureFlags = await import("@/lib/feature-flags-sync");
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(true);

    render(<UserMenu {...baseProps} />);
    const fileInput = screen.getByLabelText("Select Claude Code insights HTML report");
    expect(fileInput).toBeDefined();
    expect(fileInput.getAttribute("type")).toBe("file");
    expect(fileInput.getAttribute("accept")).toBe(".html");
  });

  it("insights button triggers file input on click", async () => {
    const featureFlags = await import("@/lib/feature-flags-sync");
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(true);

    render(<UserMenu {...baseProps} />);
    const button = screen.getByText("Import Claude Code Insights").closest("button");
    expect(button).toBeDefined();
    // Buttons are natively focusable — no tabindex needed
    expect(button?.getAttribute("role")).toBe("menuitem");
  });

  it("shows error toast for oversized files (>10MB)", async () => {
    const featureFlags = await import("@/lib/feature-flags-sync");
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(true);

    render(<UserMenu {...baseProps} />);
    const fileInput = screen.getByLabelText("Select Claude Code insights HTML report");

    // Create a file with mocked size exceeding 10MB (no need to allocate real bytes)
    const largeFile = new File(["x"], "report.html", { type: "text/html" });
    Object.defineProperty(largeFile, "size", { value: 11 * 1024 * 1024 });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [largeFile] } });
    });

    await waitFor(() => {
      const toast = screen.getByTestId("toast");
      expect(toast.textContent).toContain("File too large");
      expect(toast.getAttribute("data-type")).toBe("error");
    });
  });

  it("shows loading toast during processing", async () => {
    const featureFlags = await import("@/lib/feature-flags-sync");
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(true);

    // Delay the fetch to keep it in loading state
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise(() => {}), // Never resolves — keeps loading
    );

    render(<UserMenu {...baseProps} />);
    const fileInput = screen.getByLabelText("Select Claude Code insights HTML report");

    const file = new File(["<html></html>"], "report.html", {
      type: "text/html",
    });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => {
      const toast = screen.getByTestId("toast");
      expect(toast.getAttribute("data-type")).toBe("loading");
    });
  });

  it("shows error toast when upload fails", async () => {
    const featureFlags = await import("@/lib/feature-flags-sync");
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(true);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("", { status: 500 }),
    );

    render(<UserMenu {...baseProps} />);
    const fileInput = screen.getByLabelText("Select Claude Code insights HTML report");

    const file = new File(["<html></html>"], "report.html", {
      type: "text/html",
    });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => {
      const toast = screen.getByTestId("toast");
      expect(toast.textContent).toContain("Import failed");
      expect(toast.getAttribute("data-type")).toBe("error");
    });
  });

  it("shows success toast with craft score after successful upload + recalculate", async () => {
    const featureFlags = await import("@/lib/feature-flags-sync");
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(true);

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    // First call: upload
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ craftScore: { craftScore: 72, tier: "Solid" } }), { status: 200 }),
    );
    // Second call: recalculate
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ adjustedComposite: 68, craftScore: 72, craftTier: "Solid" }), { status: 200 }),
    );

    // Prevent page reload
    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: reloadSpy },
      writable: true,
    });

    render(<UserMenu {...baseProps} />);
    const fileInput = screen.getByLabelText("Select Claude Code insights HTML report");

    const file = new File(["<html></html>"], "report.html", {
      type: "text/html",
    });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => {
      const toast = screen.getByTestId("toast");
      expect(toast.getAttribute("data-type")).toBe("success");
      expect(toast.textContent).toContain("Craft");
    });
  });

  it("shows success with fallback when recalculate fails", async () => {
    const featureFlags = await import("@/lib/feature-flags-sync");
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(true);

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    // Upload succeeds
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ craftScore: { craftScore: 55, tier: "Emerging" } }), { status: 200 }),
    );
    // Recalculate fails
    fetchSpy.mockResolvedValueOnce(
      new Response("", { status: 500 }),
    );

    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: vi.fn() },
      writable: true,
    });

    render(<UserMenu {...baseProps} />);
    const fileInput = screen.getByLabelText("Select Claude Code insights HTML report");

    const file = new File(["<html></html>"], "report.html", {
      type: "text/html",
    });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => {
      const toast = screen.getByTestId("toast");
      expect(toast.getAttribute("data-type")).toBe("success");
      expect(toast.textContent).toContain("Score will update on next badge view");
    });
  });

  it("does nothing when no file is selected", async () => {
    const featureFlags = await import("@/lib/feature-flags-sync");
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(true);

    render(<UserMenu {...baseProps} />);
    const fileInput = screen.getByLabelText("Select Claude Code insights HTML report");

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [] } });
    });

    // No toast should appear
    expect(screen.queryByTestId("toast")).toBeNull();
  });
});

// ─── Bitbucket link/unlink in dropdown ────────────────────────────────

describe("UserMenu — Bitbucket link/unlink in dropdown", () => {
  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();
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

  it("Link Bitbucket points to connect endpoint", async () => {
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
      const link = screen.getByText("Link Bitbucket").closest("a");
      expect(link?.getAttribute("href")).toBe("/api/auth/bitbucket/connect");
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

  it("linked Bitbucket user links to bitbucket.org profile", async () => {
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
      const link = screen.getByText("bb-user").closest("a");
      expect(link?.getAttribute("href")).toBe("https://bitbucket.org/bb-user");
      expect(link?.getAttribute("target")).toBe("_blank");
    });
  });

  it("clicking Unlink opens confirmation dialog", async () => {
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
      expect(screen.getByLabelText("Unlink Bitbucket account")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Unlink Bitbucket account"));

    const dialog = screen.getByTestId("confirm-dialog");
    expect(dialog.getAttribute("data-title")).toBe("Unlink Bitbucket?");
  });

  it("confirming unlink calls disconnect and refreshes router", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/bitbucket/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "bb-user" })),
        );
      }
      if (urlStr.includes("/api/auth/bitbucket/disconnect")) {
        return Promise.resolve(new Response("{}", { status: 200 }));
      }
      return Promise.resolve(new Response("{}"));
    });

    render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Unlink Bitbucket account")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Unlink Bitbucket account"));

    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-btn"));
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/api/auth/bitbucket/disconnect", { method: "POST" });
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("handles disconnect fetch failure gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/bitbucket/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "bb-user" })),
        );
      }
      if (urlStr.includes("/api/auth/bitbucket/disconnect")) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve(new Response("{}"));
    });

    render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Unlink Bitbucket account")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Unlink Bitbucket account"));

    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-btn"));
    });

    // Should not crash, the linked user is still shown after error
    // (unlink loading finishes even on failure)
    await waitFor(() => {
      expect(screen.getByText("bb-user")).toBeDefined();
    });
  });

  it("cancelling unlink dialog does not disconnect", async () => {
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
      expect(screen.getByLabelText("Unlink Bitbucket account")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Unlink Bitbucket account"));
    fireEvent.click(screen.getByTestId("cancel-btn"));

    // Dialog should be gone, user still linked
    expect(screen.queryByTestId("confirm-dialog")).toBeNull();
    expect(screen.getByText("bb-user")).toBeDefined();
  });

  it("does not render Bitbucket when status fetch returns enabled=false", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/bitbucket/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: false })),
        );
      }
      return Promise.resolve(new Response("{}"));
    });

    render(<UserMenu {...baseProps} />);

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("Link Bitbucket")).toBeNull();
  });
});

// ─── Codeberg link/unlink in dropdown ─────────────────────────────────

describe("UserMenu — Codeberg link/unlink in dropdown", () => {
  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();
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

  it("Link Codeberg points to connect endpoint", async () => {
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
      const link = screen.getByText("Link Codeberg").closest("a");
      expect(link?.getAttribute("href")).toBe("/api/auth/codeberg/connect");
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

  it("linked Codeberg user links to codeberg.org profile", async () => {
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
      const link = screen.getByText("cb-user").closest("a");
      expect(link?.getAttribute("href")).toBe("https://codeberg.org/cb-user");
      expect(link?.getAttribute("target")).toBe("_blank");
    });
  });

  it("clicking Unlink opens confirmation dialog for Codeberg", async () => {
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
      expect(screen.getByLabelText("Unlink Codeberg account")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Unlink Codeberg account"));

    const dialog = screen.getByTestId("confirm-dialog");
    expect(dialog.getAttribute("data-title")).toBe("Unlink Codeberg?");
  });

  it("confirming Codeberg unlink calls disconnect and refreshes router", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/codeberg/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "cb-user" })),
        );
      }
      if (urlStr.includes("/api/auth/codeberg/disconnect")) {
        return Promise.resolve(new Response("{}", { status: 200 }));
      }
      return Promise.resolve(new Response("{}"));
    });

    render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Unlink Codeberg account")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Unlink Codeberg account"));

    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-btn"));
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/api/auth/codeberg/disconnect", { method: "POST" });
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("handles Codeberg disconnect fetch failure gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/codeberg/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "cb-user" })),
        );
      }
      if (urlStr.includes("/api/auth/codeberg/disconnect")) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve(new Response("{}"));
    });

    render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Unlink Codeberg account")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Unlink Codeberg account"));

    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-btn"));
    });

    await waitFor(() => {
      expect(screen.getByText("cb-user")).toBeDefined();
    });
  });

  it("status fetch failure is handled gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/codeberg/status")) {
        return Promise.reject(new Error("fetch failed"));
      }
      return Promise.resolve(new Response("{}"));
    });

    // Should not crash
    render(<UserMenu {...baseProps} />);

    await new Promise((r) => setTimeout(r, 50));
    // No Codeberg UI should appear since fetch failed
    expect(screen.queryByText("Link Codeberg")).toBeNull();
  });
});
