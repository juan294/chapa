// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import * as fs from "node:fs";
import * as path from "node:path";

// ---------- Module mocks ----------

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
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
  mockRefresh.mockClear();
  clearPlatformStatusCache();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------- Source-code static assertions ----------

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "UserMenu.tsx"),
  "utf-8",
);

describe("UserMenu — admin link", () => {
  it("accepts isAdmin prop", () => {
    expect(SOURCE).toContain("isAdmin");
  });

  it("renders Admin Panel link conditionally on isAdmin", () => {
    expect(SOURCE).toContain("{isAdmin && (");
    expect(SOURCE).toContain('href="/admin"');
    expect(SOURCE).toContain("Admin Panel");
  });

  it("Admin Panel section has role=menuitem and aria-hidden icon", () => {
    const start = SOURCE.indexOf("{isAdmin && (");
    const end = SOURCE.indexOf("Admin Panel") + 20;
    const section = SOURCE.slice(start, end);
    expect(section).toContain('role="menuitem"');
    expect(section).toContain('aria-hidden="true"');
  });
});

describe("UserMenu — Bitbucket integration", () => {
  it("fetches Bitbucket status on mount (server decides if enabled)", () => {
    expect(SOURCE).toContain("/api/auth/bitbucket/status");
    expect(SOURCE).toContain("useEffect");
  });

  it("renders Link Bitbucket item when status is loaded", () => {
    expect(SOURCE).toContain("bbStatus");
    expect(SOURCE).toContain("Link Bitbucket");
    expect(SOURCE).toContain('href="/api/auth/bitbucket/connect"');
  });

  it("renders Bitbucket linked state with remoteLogin and Unlink button", () => {
    expect(SOURCE).toContain("bbStatus.remoteLogin");
    expect(SOURCE).toContain("Unlink");
    expect(SOURCE).toContain("/api/auth/bitbucket/disconnect");
    // Confirmation dialog state exists
    expect(SOURCE).toContain("showUnlinkConfirm");
    // ConfirmDialog component is imported
    expect(SOURCE).toContain("ConfirmDialog");
  });

  it("uses inline Bitbucket SVG logo (no icon library)", () => {
    // The Bitbucket logo path is distinctive
    expect(SOURCE).toContain("M.778 1.211");
    expect(SOURCE).toContain('aria-hidden="true"');
  });

  it("Bitbucket section appears after Creator Studio and before Admin Panel", () => {
    const studioIdx = SOURCE.indexOf("Creator Studio");
    const bitbucketIdx = SOURCE.indexOf("Link Bitbucket");
    const adminIdx = SOURCE.indexOf("Admin Panel");
    expect(studioIdx).toBeLessThan(bitbucketIdx);
    expect(bitbucketIdx).toBeLessThan(adminIdx);
  });

  it("Bitbucket unlink opens confirmation dialog instead of directly unlinking", () => {
    expect(SOURCE).toContain("setShowUnlinkConfirm(true)");
    expect(SOURCE).toContain("open={showUnlinkConfirm}");
  });

  it("Unlink action uses hover:text-terminal-red (not permanent red)", () => {
    expect(SOURCE).toContain("hover:text-terminal-red");
    // Should NOT have permanent text-terminal-red on the Unlink button
    expect(SOURCE).not.toContain("text-xs text-terminal-red hover:underline");
  });

  it("ConfirmDialog has correct props for unlink", () => {
    expect(SOURCE).toContain('title="Unlink Bitbucket?"');
    expect(SOURCE).toContain('confirmLabel="Unlink"');
    expect(SOURCE).toContain('variant="destructive"');
  });
});

describe("UserMenu — Codeberg integration", () => {
  it("fetches Codeberg status on mount (server decides if enabled)", () => {
    expect(SOURCE).toContain("/api/auth/codeberg/status");
    expect(SOURCE).toContain("useEffect");
  });

  it("renders Link Codeberg item when status is loaded", () => {
    expect(SOURCE).toContain("cbStatus");
    expect(SOURCE).toContain("Link Codeberg");
    expect(SOURCE).toContain('href="/api/auth/codeberg/connect"');
  });

  it("renders Codeberg linked state with remoteLogin and Unlink button", () => {
    expect(SOURCE).toContain("cbStatus.remoteLogin");
    expect(SOURCE).toContain("/api/auth/codeberg/disconnect");
    expect(SOURCE).toContain("showCbUnlinkConfirm");
  });

  it("uses inline Codeberg SVG logo (no icon library)", () => {
    // The Codeberg mountain logo path is distinctive
    expect(SOURCE).toContain("M11.955.49");
    expect(SOURCE).toContain("CodebergIcon");
  });

  it("Codeberg section appears after Bitbucket and before Admin Panel", () => {
    const bitbucketIdx = SOURCE.indexOf("Link Bitbucket");
    const codebergIdx = SOURCE.indexOf("Link Codeberg");
    const adminIdx = SOURCE.indexOf("Admin Panel");
    expect(bitbucketIdx).toBeLessThan(codebergIdx);
    expect(codebergIdx).toBeLessThan(adminIdx);
  });

  it("Codeberg unlink opens confirmation dialog instead of directly unlinking", () => {
    expect(SOURCE).toContain("setShowCbUnlinkConfirm(true)");
    expect(SOURCE).toContain("open={showCbUnlinkConfirm}");
  });

  it("ConfirmDialog has correct props for Codeberg unlink", () => {
    expect(SOURCE).toContain('title="Unlink Codeberg?"');
    expect(SOURCE).toContain('confirmLabel="Unlink"');
    expect(SOURCE).toContain("handleUnlinkCodeberg");
    expect(SOURCE).toContain("cbUnlinkLoading");
  });

  it("Codeberg unlink handler calls disconnect endpoint", () => {
    expect(SOURCE).toContain("/api/auth/codeberg/disconnect");
    expect(SOURCE).toContain("setCbStatus");
    expect(SOURCE).toContain("setCbUnlinkLoading");
  });
});

describe("UserMenu — #520 aria-label on dropdown menu", () => {
  it("dropdown menu has aria-label 'User menu options'", () => {
    expect(SOURCE).toContain('aria-label="User menu options"');
  });
});

describe("UserMenu — #521 distinguishing aria-labels on Unlink buttons", () => {
  it("Bitbucket Unlink button has aria-label 'Unlink Bitbucket account'", () => {
    expect(SOURCE).toContain('aria-label="Unlink Bitbucket account"');
  });

  it("Codeberg Unlink button has aria-label 'Unlink Codeberg account'", () => {
    expect(SOURCE).toContain('aria-label="Unlink Codeberg account"');
  });
});

describe("UserMenu — linked platform profile links", () => {
  it("renders Bitbucket username as a clickable link to bitbucket.org profile", () => {
    expect(SOURCE).toContain("https://bitbucket.org/");
    // The link should include the remoteLogin in the href
    expect(SOURCE).toContain("bbStatus.remoteLogin");
    // Extract the Bitbucket linked state block
    const bbLinkedStart = SOURCE.indexOf("bbStatus.linked ?");
    const bbLinkedEnd = SOURCE.indexOf("Link Bitbucket");
    const bbBlock = SOURCE.slice(bbLinkedStart, bbLinkedEnd);
    expect(bbBlock).toContain("<a");
    expect(bbBlock).toContain("bitbucket.org/");
  });

  it("renders Codeberg username as a clickable link to codeberg.org profile", () => {
    expect(SOURCE).toContain("https://codeberg.org/");
    // The link should include the remoteLogin in the href
    expect(SOURCE).toContain("cbStatus.remoteLogin");
    // Extract the Codeberg linked state block
    const cbLinkedStart = SOURCE.indexOf("cbStatus.linked ?");
    const cbLinkedEnd = SOURCE.indexOf("Link Codeberg");
    const cbBlock = SOURCE.slice(cbLinkedStart, cbLinkedEnd);
    expect(cbBlock).toContain("<a");
    expect(cbBlock).toContain("codeberg.org/");
  });

  it("profile links open in new tab", () => {
    expect(SOURCE).toContain('target="_blank"');
    expect(SOURCE).toContain('rel="noopener noreferrer"');
  });
});

describe("UserMenu — page refresh after unlink", () => {
  it("imports useRouter from next/navigation", () => {
    expect(SOURCE).toContain("useRouter");
    expect(SOURCE).toContain("next/navigation");
  });

  it("calls router.refresh() after successful Bitbucket unlink", () => {
    // Extract the handleUnlinkBitbucket function body
    const fnStart = SOURCE.indexOf("async function handleUnlinkBitbucket");
    const fnEnd = SOURCE.indexOf("async function handleUnlinkCodeberg");
    const fnBody = SOURCE.slice(fnStart, fnEnd);
    expect(fnBody).toContain("router.refresh()");
  });

  it("calls router.refresh() after successful Codeberg unlink", () => {
    // Extract the handleUnlinkCodeberg function body
    const fnStart = SOURCE.indexOf("async function handleUnlinkCodeberg");
    const fnEnd = SOURCE.indexOf("const fallbackLetter");
    const fnBody = SOURCE.slice(fnStart, fnEnd);
    expect(fnBody).toContain("router.refresh()");
  });
});

describe("UserMenu — platform status cache", () => {
  it("declares a module-level platformStatusCache object outside the component", () => {
    // Cache must be outside the component function so it persists across mounts
    const componentStart = SOURCE.indexOf("export function UserMenu");
    const beforeComponent = SOURCE.slice(0, componentStart);
    expect(beforeComponent).toContain("platformStatusCache");
  });

  it("cache has fetched, bitbucket, and codeberg fields", () => {
    expect(SOURCE).toContain("fetched");
    // The cache type should track platform statuses
    expect(SOURCE).toMatch(/platformStatusCache\b/);
  });

  it("useEffect checks cache before fetching", () => {
    // The effect body should check if already fetched
    const effectStart = SOURCE.indexOf("useEffect(");
    const effectEnd = SOURCE.indexOf("}, [])");
    const effectBody = SOURCE.slice(effectStart, effectEnd);
    expect(effectBody).toContain("platformStatusCache.fetched");
  });

  it("unlink handlers invalidate the cache", () => {
    // Both unlink handlers should call clearPlatformStatusCache
    const bbUnlinkStart = SOURCE.indexOf("async function handleUnlinkBitbucket");
    const bbUnlinkEnd = SOURCE.indexOf("async function handleUnlinkCodeberg");
    const bbBody = SOURCE.slice(bbUnlinkStart, bbUnlinkEnd);
    expect(bbBody).toContain("clearPlatformStatusCache()");

    const cbUnlinkStart = SOURCE.indexOf("async function handleUnlinkCodeberg");
    const cbUnlinkEnd = SOURCE.indexOf("const fallbackLetter");
    const cbBody = SOURCE.slice(cbUnlinkStart, cbUnlinkEnd);
    expect(cbBody).toContain("clearPlatformStatusCache()");
  });

  it("exports a clearPlatformStatusCache function for external invalidation", () => {
    expect(SOURCE).toContain("export function clearPlatformStatusCache");
  });
});

// ---------------------------------------------------------------------------
// Upload flow with Toast + recalculate
// ---------------------------------------------------------------------------

describe("UserMenu — insights upload with Toast", () => {
  it("imports Toast component", () => {
    expect(SOURCE).toContain('import { Toast } from "./Toast"');
  });

  it("renders Toast component conditionally on toast state", () => {
    expect(SOURCE).toContain("{toast && (");
    expect(SOURCE).toContain("<Toast");
  });

  it("Toast receives message, detail, type, duration, and onDismiss props", () => {
    expect(SOURCE).toContain("message={toast.message}");
    expect(SOURCE).toContain("detail={toast.detail}");
    expect(SOURCE).toContain("type={toast.type}");
    expect(SOURCE).toContain("onDismiss={");
  });

  it("loading toast has duration=0 (persistent until state changes)", () => {
    expect(SOURCE).toContain('toast.type === "loading" ? 0');
  });

  it("calls /api/recalculate after successful upload", () => {
    expect(SOURCE).toContain('"/api/recalculate"');
    expect(SOURCE).toContain('method: "POST"');
  });

  it("shows craft score and tier in success toast", () => {
    const fnStart = SOURCE.indexOf("async function handleInsightsFile");
    const fnEnd = SOURCE.indexOf("setTimeout(() => window.location.reload()");
    const fnBody = SOURCE.slice(fnStart, fnEnd);
    expect(fnBody).toContain("craftScore");
    expect(fnBody).toContain("craftTier");
  });

  it("reloads page after showing success toast", () => {
    expect(SOURCE).toContain("window.location.reload()");
  });

  it("does NOT use insightsStatus state (replaced by toast state)", () => {
    expect(SOURCE).not.toContain("insightsStatus");
    expect(SOURCE).not.toContain("setInsightsStatus");
  });

  it("menu label always shows 'Import Claude Code Insights' (no inline status)", () => {
    expect(SOURCE).not.toContain('"Processing…"');
    expect(SOURCE).not.toContain('"Uploaded!"');
  });

  it("shows error toast for oversized files", () => {
    const fnStart = SOURCE.indexOf("async function handleInsightsFile");
    const fnEnd = SOURCE.indexOf("setOpen(false)", SOURCE.indexOf("async function handleInsightsFile"));
    const fnBody = SOURCE.slice(fnStart, fnEnd);
    expect(fnBody).toContain("File too large");
  });

  it("shows error toast when upload fails", () => {
    expect(SOURCE).toContain("Import failed");
  });

  it("handles recalculate failure gracefully (still shows upload success)", () => {
    expect(SOURCE).toContain("Score will update on next badge view");
  });
});

describe("UserMenu — semantic HTML (#578)", () => {
  it("does not use <label> as a menu item", () => {
    // <label role="menuitem"> is a semantic HTML anti-pattern — use <button> instead
    expect(SOURCE).not.toMatch(/<label\s[^>]*role="menuitem"/);
  });

  it("insights import trigger is a <button> with role=menuitem", () => {
    // The Import Claude Code Insights item should be a button
    const insightsStart = SOURCE.indexOf("Import Claude Code Insights");
    const blockStart = SOURCE.lastIndexOf("<button", insightsStart);
    const block = SOURCE.slice(blockStart, insightsStart);
    expect(block).toContain('role="menuitem"');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Runtime tests (render + behavior)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — Bitbucket disconnect handler (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();

    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(true);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(false);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/bitbucket/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "bb-user" })),
        );
      }
      if (urlStr.includes("/api/auth/bitbucket/disconnect")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      }
      return Promise.resolve(new Response("{}"));
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("calls /api/auth/bitbucket/disconnect with POST when unlink is confirmed", async () => {
    render(<UserMenu {...baseProps} />);

    // Wait for status fetch to resolve and show the linked state
    await waitFor(() => {
      expect(screen.getByLabelText("Unlink Bitbucket account")).toBeDefined();
    });

    // Click Unlink to open confirm dialog
    fireEvent.click(screen.getByLabelText("Unlink Bitbucket account"));

    // Confirm dialog should appear
    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog")).toBeDefined();
      expect(screen.getByTestId("confirm-dialog").getAttribute("data-title")).toBe("Unlink Bitbucket?");
    });

    // Click confirm to trigger disconnect
    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-btn"));
    });

    // Verify the disconnect endpoint was called
    expect(fetchSpy).toHaveBeenCalledWith("/api/auth/bitbucket/disconnect", { method: "POST" });
  });
});

describe("UserMenu — Codeberg disconnect handler (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();

    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(true);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/codeberg/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "cb-user" })),
        );
      }
      if (urlStr.includes("/api/auth/codeberg/disconnect")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      }
      return Promise.resolve(new Response("{}"));
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("calls /api/auth/codeberg/disconnect with POST when unlink is confirmed", async () => {
    render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Unlink Codeberg account")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Unlink Codeberg account"));

    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog")).toBeDefined();
      expect(screen.getByTestId("confirm-dialog").getAttribute("data-title")).toBe("Unlink Codeberg?");
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-btn"));
    });

    expect(fetchSpy).toHaveBeenCalledWith("/api/auth/codeberg/disconnect", { method: "POST" });
  });
});

describe("UserMenu — status fetch on mount (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    clearPlatformStatusCache();

    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(true);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(true);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/bitbucket/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: false, remoteLogin: null })),
        );
      }
      if (urlStr.includes("/api/auth/codeberg/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: false, remoteLogin: null })),
        );
      }
      return Promise.resolve(new Response("{}"));
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("fetches both platform statuses on mount when flags are enabled", async () => {
    render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/api/auth/bitbucket/status");
      expect(fetchSpy).toHaveBeenCalledWith("/api/auth/codeberg/status");
    });
  });
});

describe("UserMenu — status fetch error handling (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    clearPlatformStatusCache();

    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(true);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(true);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      return Promise.reject(new Error("Network error"));
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("does not crash when status fetch rejects", async () => {
    // Should render without throwing
    render(<UserMenu {...baseProps} />);

    // Wait for effects to settle
    await new Promise((r) => setTimeout(r, 50));

    // Component should still be rendered
    expect(screen.getByLabelText("User menu")).toBeDefined();
  });
});

describe("UserMenu — cache invalidation after unlink (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();

    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(true);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(false);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/bitbucket/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "bb-user" })),
        );
      }
      if (urlStr.includes("/api/auth/bitbucket/disconnect")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      }
      return Promise.resolve(new Response("{}"));
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("updates platform status to unlinked after disconnect", async () => {
    render(<UserMenu {...baseProps} />);

    // Wait for linked state
    await waitFor(() => {
      expect(screen.getByLabelText("Unlink Bitbucket account")).toBeDefined();
    });

    // Click Unlink
    fireEvent.click(screen.getByLabelText("Unlink Bitbucket account"));

    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog")).toBeDefined();
    });

    // Confirm disconnect
    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-btn"));
    });

    // After disconnect, the Unlink button should disappear (status reset to unlinked)
    await waitFor(() => {
      expect(screen.queryByLabelText("Unlink Bitbucket account")).toBeNull();
    });

    // router.refresh() should have been called
    expect(mockRefresh).toHaveBeenCalled();
  });
});

describe("UserMenu — loading state during unlink (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let resolveDisconnect: (value: Response) => void;

  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();

    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(true);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(false);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/bitbucket/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "bb-user" })),
        );
      }
      if (urlStr.includes("/api/auth/bitbucket/disconnect")) {
        // Return a promise that we control — keeps the loading state active
        return new Promise<Response>((resolve) => {
          resolveDisconnect = resolve;
        });
      }
      return Promise.resolve(new Response("{}"));
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("shows loading state on confirm dialog while disconnect is in progress", async () => {
    render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Unlink Bitbucket account")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Unlink Bitbucket account"));

    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog")).toBeDefined();
    });

    // Initially loading is false
    expect(screen.getByTestId("confirm-dialog").getAttribute("data-loading")).toBe("false");

    // Click confirm — this triggers the disconnect which is pending
    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-btn"));
    });

    // Now loading should be true (disconnect promise hasn't resolved)
    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog").getAttribute("data-loading")).toBe("true");
    });

    // Resolve the disconnect to clean up
    await act(async () => {
      resolveDisconnect(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Codeberg disconnect callback: loading, success, failure (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — Codeberg disconnect callback details (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();

    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(true);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/codeberg/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "cb-user" })),
        );
      }
      if (urlStr.includes("/api/auth/codeberg/disconnect")) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      }
      return Promise.resolve(new Response("{}"));
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("updates Codeberg status to unlinked and calls router.refresh after disconnect", async () => {
    render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Unlink Codeberg account")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Unlink Codeberg account"));

    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog")).toBeDefined();
      expect(screen.getByTestId("confirm-dialog").getAttribute("data-title")).toBe("Unlink Codeberg?");
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-btn"));
    });

    // After disconnect, Unlink button should be gone (status reset)
    await waitFor(() => {
      expect(screen.queryByLabelText("Unlink Codeberg account")).toBeNull();
    });

    // router.refresh() should have been called
    expect(mockRefresh).toHaveBeenCalled();
  });
});

describe("UserMenu — Codeberg disconnect loading state (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let resolveDisconnect: (value: Response) => void;

  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();

    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(true);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/codeberg/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "cb-user" })),
        );
      }
      if (urlStr.includes("/api/auth/codeberg/disconnect")) {
        return new Promise<Response>((resolve) => {
          resolveDisconnect = resolve;
        });
      }
      return Promise.resolve(new Response("{}"));
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("shows loading on Codeberg confirm dialog while disconnect is pending", async () => {
    render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Unlink Codeberg account")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Unlink Codeberg account"));

    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog")).toBeDefined();
    });

    expect(screen.getByTestId("confirm-dialog").getAttribute("data-loading")).toBe("false");

    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-btn"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog").getAttribute("data-loading")).toBe("true");
    });

    // Resolve to clean up
    await act(async () => {
      resolveDisconnect(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
  });
});

describe("UserMenu — Codeberg disconnect failure (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();

    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(true);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
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
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("does not crash when Codeberg disconnect fails (graceful failure)", async () => {
    render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Unlink Codeberg account")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Unlink Codeberg account"));

    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog")).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-btn"));
    });

    // Component should still be rendered; loading should revert to false
    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog").getAttribute("data-loading")).toBe("false");
    });

    // Status should remain linked (not reset since disconnect failed)
    expect(screen.getByLabelText("Unlink Codeberg account")).toBeDefined();
  });
});

describe("UserMenu — Bitbucket disconnect failure (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();

    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(true);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(false);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
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
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("does not crash when Bitbucket disconnect fails (graceful failure)", async () => {
    render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Unlink Bitbucket account")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Unlink Bitbucket account"));

    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog")).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("confirm-btn"));
    });

    // Loading should revert to false after failure
    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog").getAttribute("data-loading")).toBe("false");
    });

    // Status should remain linked (disconnect failed)
    expect(screen.getByLabelText("Unlink Bitbucket account")).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Bitbucket/Codeberg "Link" state rendering (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — Bitbucket not-linked state (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();

    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(true);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(false);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/bitbucket/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: false, remoteLogin: null })),
        );
      }
      return Promise.resolve(new Response("{}"));
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("renders 'Link Bitbucket' link when Bitbucket is not linked", async () => {
    render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("Link Bitbucket")).toBeDefined();
    });

    const link = screen.getByText("Link Bitbucket").closest("a");
    expect(link?.getAttribute("href")).toBe("/api/auth/bitbucket/connect");
  });
});

describe("UserMenu — Codeberg not-linked state (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();

    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(true);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/codeberg/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: false, remoteLogin: null })),
        );
      }
      return Promise.resolve(new Response("{}"));
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("renders 'Link Codeberg' link when Codeberg is not linked", async () => {
    render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("Link Codeberg")).toBeDefined();
    });

    const link = screen.getByText("Link Codeberg").closest("a");
    expect(link?.getAttribute("href")).toBe("/api/auth/codeberg/connect");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Linked Bitbucket/Codeberg display (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — Bitbucket linked state display (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();

    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(true);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(false);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/bitbucket/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "bb-user" })),
        );
      }
      return Promise.resolve(new Response("{}"));
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("shows Bitbucket remoteLogin as clickable link to bitbucket.org profile", async () => {
    render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("bb-user")).toBeDefined();
    });

    const link = screen.getByText("bb-user").closest("a");
    expect(link?.getAttribute("href")).toBe("https://bitbucket.org/bb-user");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });
});

describe("UserMenu — Codeberg linked state display (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();

    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(true);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/codeberg/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "cb-user" })),
        );
      }
      return Promise.resolve(new Response("{}"));
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("shows Codeberg remoteLogin as clickable link to codeberg.org profile", async () => {
    render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("cb-user")).toBeDefined();
    });

    const link = screen.getByText("cb-user").closest("a");
    expect(link?.getAttribute("href")).toBe("https://codeberg.org/cb-user");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Cancel unlink confirm dialog (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — cancel Bitbucket unlink confirm (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();

    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(true);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(false);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/bitbucket/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "bb-user" })),
        );
      }
      return Promise.resolve(new Response("{}"));
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("cancelling the confirm dialog dismisses it without disconnecting", async () => {
    render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Unlink Bitbucket account")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Unlink Bitbucket account"));

    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog")).toBeDefined();
    });

    // Cancel the dialog
    fireEvent.click(screen.getByTestId("cancel-btn"));

    // Dialog should be dismissed
    await waitFor(() => {
      expect(screen.queryByTestId("confirm-dialog")).toBeNull();
    });

    // Unlink button should still be visible (no disconnect happened)
    expect(screen.getByLabelText("Unlink Bitbucket account")).toBeDefined();
    // Disconnect endpoint should NOT have been called
    const disconnectCalls = fetchSpy.mock.calls.filter(
      ([url]: [unknown]) => typeof url === "string" && url.includes("/api/auth/bitbucket/disconnect"),
    );
    expect(disconnectCalls.length).toBe(0);
  });
});

describe("UserMenu — cancel Codeberg unlink confirm (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();

    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(true);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/codeberg/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "cb-user" })),
        );
      }
      return Promise.resolve(new Response("{}"));
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("cancelling the Codeberg confirm dialog dismisses it without disconnecting", async () => {
    render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Unlink Codeberg account")).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText("Unlink Codeberg account"));

    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog")).toBeDefined();
    });

    fireEvent.click(screen.getByTestId("cancel-btn"));

    await waitFor(() => {
      expect(screen.queryByTestId("confirm-dialog")).toBeNull();
    });

    expect(screen.getByLabelText("Unlink Codeberg account")).toBeDefined();
    const disconnectCalls = fetchSpy.mock.calls.filter(
      ([url]: [unknown]) => typeof url === "string" && url.includes("/api/auth/codeberg/disconnect"),
    );
    expect(disconnectCalls.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Feature flag gating — Studio, Admin, Insights menu items (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — Studio menu item when enabled (runtime)", () => {
  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();

    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isStudioEnabledSync).mockReturnValue(true);
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(false);
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

    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isStudioEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(false);
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

    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isStudioEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(false);
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
});

describe("UserMenu — Insights menu item (runtime)", () => {
  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();

    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isStudioEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(true);
  });

  it("renders Import Claude Code Insights button when insights flag is enabled", () => {
    render(<UserMenu {...baseProps} />);

    expect(screen.getByText("Import Claude Code Insights")).toBeDefined();
  });

  it("does not render Import Claude Code Insights when insights flag is disabled", async () => {
    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(false);

    render(<UserMenu {...baseProps} />);

    expect(screen.queryByText("Import Claude Code Insights")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Insights upload flow (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — insights file upload flow (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let reloadSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();

    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isStudioEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(true);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/insights")) {
        return Promise.resolve(
          new Response(JSON.stringify({ craftScore: { craftScore: 72, tier: "High" } }), { status: 200 }),
        );
      }
      if (urlStr.includes("/api/recalculate")) {
        return Promise.resolve(
          new Response(JSON.stringify({ adjustedComposite: 85, craftScore: 72, craftTier: "High" }), { status: 200 }),
        );
      }
      return Promise.resolve(new Response("{}"));
    });

    // Mock window.location.reload
    reloadSpy = vi.fn() as unknown as ReturnType<typeof vi.spyOn>;
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, reload: reloadSpy },
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
    vi.useRealTimers();
  });

  it("shows error toast for oversized files", async () => {
    render(<UserMenu {...baseProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeDefined();

    // Create a file exceeding 10MB
    const bigFile = new File(["x".repeat(11 * 1024 * 1024)], "report.html", { type: "text/html" });

    await act(async () => {
      fireEvent.change(input, { target: { files: [bigFile] } });
    });

    await waitFor(() => {
      const toast = screen.getByTestId("toast");
      expect(toast.textContent).toContain("File too large");
      expect(toast.getAttribute("data-type")).toBe("error");
    });
  });

  it("shows processing toast and then success toast after upload", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<UserMenu {...baseProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeDefined();

    const file = new File(["<html>report</html>"], "report.html", { type: "text/html" });

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    // Eventually the success toast should appear
    await waitFor(() => {
      const toast = screen.getByTestId("toast");
      expect(toast.getAttribute("data-type")).toBe("success");
      expect(toast.textContent).toContain("Craft");
    });
  });

  it("shows error toast when upload fails", async () => {
    fetchSpy.mockRestore();
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      return Promise.reject(new Error("Network error"));
    });

    render(<UserMenu {...baseProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["<html>report</html>"], "report.html", { type: "text/html" });

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await waitFor(() => {
      const toast = screen.getByTestId("toast");
      expect(toast.textContent).toContain("Import failed");
      expect(toast.getAttribute("data-type")).toBe("error");
    });
  });

  it("does nothing when no file is selected", async () => {
    render(<UserMenu {...baseProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { files: [] } });
    });

    // No toast should appear
    expect(screen.queryByTestId("toast")).toBeNull();
  });

  it("shows fallback success toast when recalculate fails", async () => {
    fetchSpy.mockRestore();
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/insights")) {
        return Promise.resolve(
          new Response(JSON.stringify({ craftScore: { craftScore: 72, tier: "High" } }), { status: 200 }),
        );
      }
      if (urlStr.includes("/api/recalculate")) {
        return Promise.resolve(new Response("{}", { status: 500 }));
      }
      return Promise.resolve(new Response("{}"));
    });

    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<UserMenu {...baseProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["<html>report</html>"], "report.html", { type: "text/html" });

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await waitFor(() => {
      const toast = screen.getByTestId("toast");
      expect(toast.getAttribute("data-type")).toBe("success");
      expect(toast.textContent).toContain("Craft");
      expect(screen.getByTestId("toast-detail")?.textContent).toContain("Score will update on next badge view");
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

    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(false);
  });

  it("shows fallback letter when image fails to load", () => {
    render(<UserMenu {...baseProps} />);

    const img = screen.getByTestId("avatar");
    fireEvent.error(img);

    // Fallback letter should appear (first letter of login, uppercased)
    expect(screen.getByText("T")).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Platform status cache reuse (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — platform status cache (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    clearPlatformStatusCache();

    const featureFlags = await import("@/lib/feature-flags");
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(true);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(false);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/bitbucket/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: false, remoteLogin: null })),
        );
      }
      return Promise.resolve(new Response("{}"));
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("uses cached status on second mount instead of fetching again", async () => {
    dropdownOpen = true;

    // First mount — fetches status
    const { unmount } = render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/api/auth/bitbucket/status");
    });

    const fetchCountAfterFirst = fetchSpy.mock.calls.filter(
      ([url]: [unknown]) => typeof url === "string" && url.includes("/api/auth/bitbucket/status"),
    ).length;

    unmount();

    // Second mount — should use cache
    render(<UserMenu {...baseProps} />);

    // Wait for effects to run
    await new Promise((r) => setTimeout(r, 50));

    const fetchCountAfterSecond = fetchSpy.mock.calls.filter(
      ([url]: [unknown]) => typeof url === "string" && url.includes("/api/auth/bitbucket/status"),
    ).length;

    // No additional fetch — cache was used
    expect(fetchCountAfterSecond).toBe(fetchCountAfterFirst);
  });
});
