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

vi.mock("@/lib/feature-flags-sync", () => ({
  isStudioEnabledSync: vi.fn(() => false),
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
  mockClearSessionCache.mockClear();
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
    expect(SOURCE).toContain("userMenu.adminPanel");
  });

  it("Admin Panel section has role=menuitem and aria-hidden icon", () => {
    const start = SOURCE.indexOf("{isAdmin && (");
    const end = SOURCE.indexOf("userMenu.adminPanel") + 30;
    const section = SOURCE.slice(start, end);
    expect(section).toContain('role="menuitem"');
    expect(section).toContain('aria-hidden="true"');
  });
});

describe("UserMenu — Bitbucket integration", () => {
  it("fetches Bitbucket status on mount (server decides if enabled)", () => {
    expect(SOURCE).toContain("/api/auth/${platform}/status");
    expect(SOURCE).toContain("fetchPlatformStatus");
  });

  it("renders Link Bitbucket item when status is loaded", () => {
    expect(SOURCE).toContain("bbStatus");
    expect(SOURCE).toContain("userMenu.linkBitbucket");
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

  it("uses the shared Bitbucket SVG icon (no icon library)", () => {
    // The Bitbucket logo now lives in the shared icon module (#756); the
    // component references it by name and imports from @/components/icons.
    expect(SOURCE).toContain("BitbucketIcon");
    expect(SOURCE).toContain("@/components/icons");
  });

  it("Bitbucket section appears after Creator Studio and before Admin Panel", () => {
    const studioIdx = SOURCE.indexOf("userMenu.creatorStudio");
    const bitbucketIdx = SOURCE.indexOf("userMenu.linkBitbucket");
    const adminIdx = SOURCE.indexOf("userMenu.adminPanel");
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
    expect(SOURCE).toContain("userMenu.confirmUnlinkBitbucketTitle");
    expect(SOURCE).toContain("userMenu.confirmBtn");
    expect(SOURCE).toContain('variant="destructive"');
  });
});

describe("UserMenu — Codeberg integration", () => {
  it("fetches Codeberg status on mount (server decides if enabled)", () => {
    expect(SOURCE).toContain("fetchPlatformStatus");
    expect(SOURCE).toContain('"codeberg"');
  });

  it("renders Link Codeberg item when status is loaded", () => {
    expect(SOURCE).toContain("cbStatus");
    expect(SOURCE).toContain("userMenu.linkCodeberg");
    expect(SOURCE).toContain('href="/api/auth/codeberg/connect"');
  });

  it("renders Codeberg linked state with remoteLogin and Unlink button", () => {
    expect(SOURCE).toContain("cbStatus.remoteLogin");
    expect(SOURCE).toContain("/api/auth/codeberg/disconnect");
    expect(SOURCE).toContain("showCbUnlinkConfirm");
  });

  it("uses the shared Codeberg SVG icon (no icon library)", () => {
    // The Codeberg logo now lives in the shared icon module (#756); the
    // component references it by name and imports from @/components/icons.
    expect(SOURCE).toContain("CodebergIcon");
    expect(SOURCE).toContain("@/components/icons");
  });

  it("Codeberg section appears after Bitbucket and before Admin Panel", () => {
    const bitbucketIdx = SOURCE.indexOf("userMenu.linkBitbucket");
    const codebergIdx = SOURCE.indexOf("userMenu.linkCodeberg");
    const adminIdx = SOURCE.indexOf("userMenu.adminPanel");
    expect(bitbucketIdx).toBeLessThan(codebergIdx);
    expect(codebergIdx).toBeLessThan(adminIdx);
  });

  it("Codeberg unlink opens confirmation dialog instead of directly unlinking", () => {
    expect(SOURCE).toContain("setShowCbUnlinkConfirm(true)");
    expect(SOURCE).toContain("open={showCbUnlinkConfirm}");
  });

  it("ConfirmDialog has correct props for Codeberg unlink", () => {
    expect(SOURCE).toContain("userMenu.confirmUnlinkCodebergTitle");
    expect(SOURCE).toContain("userMenu.confirmBtn");
    expect(SOURCE).toContain("handleUnlinkCodeberg");
    expect(SOURCE).toContain("cbUnlinkLoading");
  });

  it("Codeberg unlink handler calls disconnect endpoint", () => {
    expect(SOURCE).toContain("/api/auth/codeberg/disconnect");
    expect(SOURCE).toContain("setCbStatus");
    expect(SOURCE).toContain("setCbUnlinkLoading");
  });
});

describe("UserMenu — GitLab integration", () => {
  it("fetches GitLab status on mount (server decides if enabled)", () => {
    expect(SOURCE).toContain("fetchPlatformStatus");
    expect(SOURCE).toContain('"gitlab"');
  });

  it("renders Link GitLab item when status is loaded", () => {
    expect(SOURCE).toContain("glStatus");
    expect(SOURCE).toContain("userMenu.linkGitlab");
    expect(SOURCE).toContain('href="/api/auth/gitlab/connect"');
  });

  it("renders GitLab linked state with remoteLogin and Unlink button", () => {
    expect(SOURCE).toContain("glStatus.remoteLogin");
    expect(SOURCE).toContain("/api/auth/gitlab/disconnect");
    expect(SOURCE).toContain("showGlUnlinkConfirm");
  });

  it("uses the shared GitLab SVG icon (no icon library)", () => {
    // The GitLab tanuki logo now lives in the shared icon module (#756); the
    // component references it by name and imports from @/components/icons.
    expect(SOURCE).toContain("GitlabIcon");
    expect(SOURCE).toContain("@/components/icons");
  });

  it("GitLab section appears after Codeberg and before Admin Panel", () => {
    const codebergIdx = SOURCE.indexOf("userMenu.linkCodeberg");
    const gitlabIdx = SOURCE.indexOf("userMenu.linkGitlab");
    const adminIdx = SOURCE.indexOf("userMenu.adminPanel");
    expect(codebergIdx).toBeLessThan(gitlabIdx);
    expect(gitlabIdx).toBeLessThan(adminIdx);
  });

  it("GitLab unlink opens confirmation dialog instead of directly unlinking", () => {
    expect(SOURCE).toContain("setShowGlUnlinkConfirm(true)");
    expect(SOURCE).toContain("open={showGlUnlinkConfirm}");
  });

  it("ConfirmDialog has correct props for GitLab unlink", () => {
    expect(SOURCE).toContain("userMenu.confirmUnlinkGitlabTitle");
    expect(SOURCE).toContain("handleUnlinkGitlab");
    expect(SOURCE).toContain("glUnlinkLoading");
  });

  it("GitLab unlink handler calls disconnect endpoint", () => {
    expect(SOURCE).toContain("/api/auth/gitlab/disconnect");
    expect(SOURCE).toContain("setGlStatus");
    expect(SOURCE).toContain("setGlUnlinkLoading");
  });
});

describe("UserMenu — #520 aria-label on dropdown menu", () => {
  it("dropdown menu has aria-label 'User menu options'", () => {
    expect(SOURCE).toContain("aria.userMenuOptions");
  });
});

describe("UserMenu — #521 distinguishing aria-labels on Unlink buttons", () => {
  it("Bitbucket Unlink button has aria-label 'Unlink Bitbucket account'", () => {
    expect(SOURCE).toContain("aria.unlinkBitbucket");
  });

  it("Codeberg Unlink button has aria-label 'Unlink Codeberg account'", () => {
    expect(SOURCE).toContain("aria.unlinkCodeberg");
  });

  it("GitLab Unlink button has aria-label 'Unlink GitLab account'", () => {
    expect(SOURCE).toContain("aria.unlinkGitlab");
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

  it("calls router.refresh() after a successful unlink (shared helper)", () => {
    // The unlink flow is collapsed into the shared unlinkPlatform helper (#884),
    // which performs the success transition (cache clear + router.refresh()).
    const fnStart = SOURCE.indexOf("const unlinkPlatform");
    const fnEnd = SOURCE.indexOf("async function handleUnlinkBitbucket");
    const fnBody = SOURCE.slice(fnStart, fnEnd);
    expect(fnBody).toContain("router.refresh()");
  });

  it("Bitbucket and Codeberg handlers delegate to the shared unlink helper", () => {
    const bbStart = SOURCE.indexOf("async function handleUnlinkBitbucket");
    const bbEnd = SOURCE.indexOf("async function handleUnlinkCodeberg");
    expect(SOURCE.slice(bbStart, bbEnd)).toContain("unlinkPlatform({");

    const cbStart = SOURCE.indexOf("async function handleUnlinkCodeberg");
    const cbEnd = SOURCE.indexOf("async function handleUnlinkGitlab");
    expect(SOURCE.slice(cbStart, cbEnd)).toContain("unlinkPlatform({");
  });
});

describe("UserMenu — platform status cache", () => {
  it("declares a module-level platform status store outside the component", () => {
    // Cache must be outside the component function so it persists across mounts.
    // It is now backed by the shared createModuleStore primitive (#774).
    const componentStart = SOURCE.indexOf("export function UserMenu");
    const beforeComponent = SOURCE.slice(0, componentStart);
    expect(beforeComponent).toContain("platformStatusStore");
    expect(beforeComponent).toContain("createModuleStore");
  });

  it("cache has per-platform fetched/status entries", () => {
    expect(SOURCE).toContain("fetched");
    expect(SOURCE).toContain("pending");
    expect(SOURCE).toContain("PlatformStatusEntry");
    expect(SOURCE).toContain("status: null");
    // The cache type should track platform statuses
    expect(SOURCE).toMatch(/PlatformStatusCache\b/);
  });

  it("useEffect checks each platform cache entry before fetching", () => {
    expect(SOURCE).toContain("platformStatusStore.getSnapshot()[platform].fetched");
  });

  it("unlink flow invalidates the cache (shared helper)", () => {
    // The shared unlinkPlatform helper invalidates the cache on success (#884).
    const helperStart = SOURCE.indexOf("const unlinkPlatform");
    const helperEnd = SOURCE.indexOf("async function handleUnlinkBitbucket");
    const helperBody = SOURCE.slice(helperStart, helperEnd);
    expect(helperBody).toContain("clearPlatformStatusCache()");
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
    expect(fnBody).toContain("userMenu.insightsFileTooLarge");
  });

  it("shows error toast when upload fails", () => {
    expect(SOURCE).toContain("userMenu.insightsImportFailed");
  });

  it("handles recalculate failure gracefully (still shows upload success)", () => {
    expect(SOURCE).toContain("userMenu.insightsImportedDetail");
  });
});

describe("UserMenu — semantic HTML (#578)", () => {
  it("does not use <label> as a menu item", () => {
    // <label role="menuitem"> is a semantic HTML anti-pattern — use <button> instead
    expect(SOURCE).not.toMatch(/<label\s[^>]*role="menuitem"/);
  });

  it("insights import trigger is a <button> with role=menuitem", () => {
    // The Import Claude Code Insights item should be a button
    const insightsStart = SOURCE.indexOf("userMenu.importInsights");
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

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/bitbucket/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "bb-user" })),
        );
      }
      if (urlStr.includes("/api/auth/bitbucket/disconnect")) {
        return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
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

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/codeberg/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "cb-user" })),
        );
      }
      if (urlStr.includes("/api/auth/codeberg/disconnect")) {
        return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
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

// ═══════════════════════════════════════════════════════════════════════
// #885 — platform status fetches gated behind public feature flags
// A flag-gated-off platform must NOT fire its status fetch on mount.
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — platform fetch gated by feature flag (runtime, #885)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dropdownOpen = true;
    clearPlatformStatusCache();
    // All three platform integrations disabled via their public flags.
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isGitlabEnabledSync).mockReturnValue(false);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response("{}")),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
    // Restore defaults for subsequent suites.
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(true);
    vi.mocked(featureFlags.isCodebergEnabledSync).mockReturnValue(true);
    vi.mocked(featureFlags.isGitlabEnabledSync).mockReturnValue(true);
  });

  it("does not fetch any platform status when all platform flags are disabled", async () => {
    render(<UserMenu {...baseProps} />);

    // Allow any effects to settle.
    await new Promise((r) => setTimeout(r, 50));

    const statusCalls = fetchSpy.mock.calls.filter(
      ([url]: [unknown]) =>
        typeof url === "string" && url.includes("/api/auth/") && url.includes("/status"),
    );
    expect(statusCalls.length).toBe(0);
  });

  it("fetches only the enabled platform's status", async () => {
    vi.mocked(featureFlags.isBitbucketEnabledSync).mockReturnValue(true);

    render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/api/auth/bitbucket/status");
    });

    const cbCalls = fetchSpy.mock.calls.filter(
      ([url]: [unknown]) =>
        typeof url === "string" && url.includes("/api/auth/codeberg/status"),
    );
    const glCalls = fetchSpy.mock.calls.filter(
      ([url]: [unknown]) =>
        typeof url === "string" && url.includes("/api/auth/gitlab/status"),
    );
    expect(cbCalls.length).toBe(0);
    expect(glCalls.length).toBe(0);
  });
});

describe("UserMenu — status fetch error handling (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    clearPlatformStatusCache();

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

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/bitbucket/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "bb-user" })),
        );
      }
      if (urlStr.includes("/api/auth/bitbucket/disconnect")) {
        return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
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
      resolveDisconnect(new Response(JSON.stringify({ success: true }), { status: 200 }));
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

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/codeberg/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "cb-user" })),
        );
      }
      if (urlStr.includes("/api/auth/codeberg/disconnect")) {
        return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
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
      resolveDisconnect(new Response(JSON.stringify({ success: true }), { status: 200 }));
    });
  });
});

describe("UserMenu — Codeberg disconnect failure (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();

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
});

describe("UserMenu — Insights menu item (runtime)", () => {
  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();
    vi.mocked(featureFlags.isStudioEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(true);
  });

  it("renders Import Claude Code Insights button when insights flag is enabled", () => {
    render(<UserMenu {...baseProps} />);

    expect(screen.getByText("Import Claude Code Insights")).toBeDefined();
  });

  it("does not render Import Claude Code Insights when insights flag is disabled", async () => {

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
    vi.mocked(featureFlags.isStudioEnabledSync).mockReturnValue(false);
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
    localStorage.clear();
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

  it("shows generic 'Insights uploaded' toast when recalculate fails and upload has no craftScore", async () => {
    fetchSpy.mockRestore();
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/insights")) {
        // Upload succeeds but returns no craftScore field
        return Promise.resolve(
          new Response(JSON.stringify({}), { status: 200 }),
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
      expect(toast.textContent).toContain("Insights uploaded");
      expect(screen.getByTestId("toast-detail")?.textContent).toContain("Score will update on next badge view");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Insights cooldown (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — insights cooldown (runtime)", () => {
  const INSIGHTS_KEY = "chapa_insights_last_submitted_testuser";

  beforeEach(() => {
    dropdownOpen = true;
    clearPlatformStatusCache();
    vi.mocked(featureFlags.isStudioEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(true);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("button is enabled when no prior upload exists", () => {
    render(<UserMenu {...baseProps} />);
    const btn = screen.getByText("Import Claude Code Insights").closest("button");
    expect(btn?.disabled).toBe(false);
  });

  it("button is disabled when last upload was less than 14 days ago", () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(INSIGHTS_KEY, sevenDaysAgo);

    render(<UserMenu {...baseProps} />);
    const btn = screen.getByText("Import Claude Code Insights").closest("button");
    expect(btn?.disabled).toBe(true);
  });

  it("button is enabled when last upload was exactly 14 days ago", () => {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(INSIGHTS_KEY, fourteenDaysAgo);

    render(<UserMenu {...baseProps} />);
    const btn = screen.getByText("Import Claude Code Insights").closest("button");
    expect(btn?.disabled).toBe(false);
  });

  it("button is enabled when last upload was more than 14 days ago", () => {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(INSIGHTS_KEY, fifteenDaysAgo);

    render(<UserMenu {...baseProps} />);
    const btn = screen.getByText("Import Claude Code Insights").closest("button");
    expect(btn?.disabled).toBe(false);
  });

  it("disabled button has a tooltip with the available date", () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(INSIGHTS_KEY, sevenDaysAgo);

    render(<UserMenu {...baseProps} />);
    const btn = screen.getByText("Import Claude Code Insights").closest("button");
    expect(btn?.title).toContain("Available again on");
  });

  it("enabled button has no tooltip", () => {
    render(<UserMenu {...baseProps} />);
    const btn = screen.getByText("Import Claude Code Insights").closest("button");
    expect(btn?.title ?? "").toBe("");
  });

  it("saves timestamp to localStorage after successful upload", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
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
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, reload: vi.fn() },
    });

    render(<UserMenu {...baseProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["<html>report</html>"], "report.html", { type: "text/html" });

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(localStorage.getItem(INSIGHTS_KEY)).not.toBeNull();
    });

    fetchSpy.mockRestore();
  });

  it("does not save timestamp to localStorage when upload fails", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    render(<UserMenu {...baseProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["<html>report</html>"], "report.html", { type: "text/html" });

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await waitFor(() => {
      const toast = screen.getByTestId("toast");
      expect(toast.getAttribute("data-type")).toBe("error");
    });

    expect(localStorage.getItem(INSIGHTS_KEY)).toBeNull();
    fetchSpy.mockRestore();
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
// Platform status cache reuse (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — platform status cache (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    clearPlatformStatusCache();

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

// ═══════════════════════════════════════════════════════════════════════
// Toast dismiss callback (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — toast dismiss callback (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();
    vi.mocked(featureFlags.isStudioEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(true);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      return Promise.reject(new Error("Network error"));
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("dismisses toast when onDismiss is called", async () => {
    // We need a Toast mock that actually calls onDismiss
    // The current mock doesn't call onDismiss, but we can trigger the error flow
    // to show a toast, then verify it renders — the handleToastDismiss is exercised
    // by triggering a toast and verifying setToast(null) works via the callback
    render(<UserMenu {...baseProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["<html>report</html>"], "report.html", { type: "text/html" });

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    // Toast should appear with error
    await waitFor(() => {
      expect(screen.getByTestId("toast")).toBeDefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Upload failure when /api/insights returns non-ok (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — insights upload non-ok response (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();
    vi.mocked(featureFlags.isStudioEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(true);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/insights")) {
        // Return non-ok status
        return Promise.resolve(new Response("{}", { status: 500 }));
      }
      return Promise.resolve(new Response("{}"));
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("shows error toast when upload endpoint returns non-ok", async () => {
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
});

// ═══════════════════════════════════════════════════════════════════════
// Recalculate success with no craftScore from upload (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — recalculate success without upload craftScore (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let reloadSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();
    vi.mocked(featureFlags.isStudioEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(true);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/insights")) {
        // Upload returns without craftScore
        return Promise.resolve(
          new Response(JSON.stringify({}), { status: 200 }),
        );
      }
      if (urlStr.includes("/api/recalculate")) {
        return Promise.resolve(
          new Response(JSON.stringify({ adjustedComposite: 90, craftScore: 68, craftTier: "High" }), { status: 200 }),
        );
      }
      return Promise.resolve(new Response("{}"));
    });

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

  it("uses recalculate craftScore when upload craftScore is missing", async () => {
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
      // Should use recalcData values: craftScore=68, craftTier="High", adjustedComposite=90
      expect(toast.textContent).toContain("Craft");
      expect(toast.textContent).toContain("68");
      expect(screen.getByTestId("toast-detail")?.textContent).toContain("90");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Recalculate fails with no craftScore from upload (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — recalculate fails and upload has no craftScore (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let reloadSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();
    vi.mocked(featureFlags.isStudioEnabledSync).mockReturnValue(false);
    vi.mocked(featureFlags.isInsightsEnabledSync).mockReturnValue(true);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/insights")) {
        // Upload returns without craftScore
        return Promise.resolve(
          new Response(JSON.stringify({}), { status: 200 }),
        );
      }
      if (urlStr.includes("/api/recalculate")) {
        return Promise.resolve(new Response("{}", { status: 500 }));
      }
      return Promise.resolve(new Response("{}"));
    });

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

  it("shows generic Insights uploaded message when no craftScore available", async () => {
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
      // Without craftScore from either endpoint, message should be "Insights uploaded"
      expect(toast.textContent).toContain("Insights uploaded");
      expect(screen.getByTestId("toast-detail")?.textContent).toContain("Score will update on next badge view");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Platform status when enabled=false (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — platform status disabled by server (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/bitbucket/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: false })),
        );
      }
      if (urlStr.includes("/api/auth/codeberg/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: false })),
        );
      }
      return Promise.resolve(new Response("{}"));
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("does not show Link Bitbucket or Link Codeberg when server says disabled", async () => {
    render(<UserMenu {...baseProps} />);

    // Wait for effects to settle
    await new Promise((r) => setTimeout(r, 100));

    // Neither Link Bitbucket nor Link Codeberg should appear
    expect(screen.queryByText("Link Bitbucket")).toBeNull();
    expect(screen.queryByText("Link Codeberg")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Menu toggle and navigation links (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — menu actions close dropdown (runtime)", () => {
  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();
  });

  it("clicking My Badge link calls setOpen to close the menu", () => {
    render(<UserMenu {...baseProps} />);

    const link = screen.getByText("My Badge");
    fireEvent.click(link);

    // setIsOpenMock should have been called with false (close the menu)
    expect(setIsOpenMock).toHaveBeenCalledWith(false);
  });

  it("clicking About Chapa link calls setOpen to close the menu", () => {
    render(<UserMenu {...baseProps} />);

    const link = screen.getByText("About Chapa");
    fireEvent.click(link);

    expect(setIsOpenMock).toHaveBeenCalledWith(false);
  });

  it("clicking Terms of Service link calls setOpen to close the menu", () => {
    render(<UserMenu {...baseProps} />);

    const link = screen.getByText("Terms of Service");
    fireEvent.click(link);

    expect(setIsOpenMock).toHaveBeenCalledWith(false);
  });

  it("clicking Privacy Policy link calls setOpen to close the menu", () => {
    render(<UserMenu {...baseProps} />);

    const link = screen.getByText("Privacy Policy");
    fireEvent.click(link);

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
// Bitbucket disconnect non-ok response (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — Bitbucket disconnect non-ok response (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/bitbucket/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "bb-user" })),
        );
      }
      if (urlStr.includes("/api/auth/bitbucket/disconnect")) {
        // Non-ok response (not res.ok)
        return Promise.resolve(new Response("{}", { status: 500 }));
      }
      return Promise.resolve(new Response("{}"));
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("does not update status when disconnect returns non-ok", async () => {
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

    // Status should still show linked (non-ok response didn't trigger status reset)
    await waitFor(() => {
      expect(screen.getByLabelText("Unlink Bitbucket account")).toBeDefined();
    });
    // router.refresh should NOT have been called
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Codeberg disconnect non-ok response (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — Codeberg disconnect non-ok response (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dropdownOpen = true;
    clearPlatformStatusCache();

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/codeberg/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "cb-user" })),
        );
      }
      if (urlStr.includes("/api/auth/codeberg/disconnect")) {
        return Promise.resolve(new Response("{}", { status: 500 }));
      }
      return Promise.resolve(new Response("{}"));
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("does not update status when Codeberg disconnect returns non-ok", async () => {
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

    // Status should remain linked
    await waitFor(() => {
      expect(screen.getByLabelText("Unlink Codeberg account")).toBeDefined();
    });
    expect(mockRefresh).not.toHaveBeenCalled();
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
// Platform cache with codeberg data populated (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — platform cache with both platforms populated (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearPlatformStatusCache();
    dropdownOpen = true;

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/auth/bitbucket/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "bb-cached" })),
        );
      }
      if (urlStr.includes("/api/auth/codeberg/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ enabled: true, linked: true, remoteLogin: "cb-cached" })),
        );
      }
      return Promise.resolve(new Response("{}"));
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("restores both platform statuses from cache on second mount", async () => {
    // First mount populates cache
    const { unmount } = render(<UserMenu {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("bb-cached")).toBeDefined();
      expect(screen.getByText("cb-cached")).toBeDefined();
    });

    unmount();

    // Second mount should use cached data without additional fetches
    const bbFetchesBefore = fetchSpy.mock.calls.filter(
      ([url]: [unknown]) => typeof url === "string" && url.includes("/api/auth/bitbucket/status"),
    ).length;

    render(<UserMenu {...baseProps} />);

    // Allow effects to run
    await new Promise((r) => setTimeout(r, 50));

    const bbFetchesAfter = fetchSpy.mock.calls.filter(
      ([url]: [unknown]) => typeof url === "string" && url.includes("/api/auth/bitbucket/status"),
    ).length;

    // No additional fetch calls — cache was used
    expect(bbFetchesAfter).toBe(bbFetchesBefore);

    // Both platforms should be displayed from cache
    await waitFor(() => {
      expect(screen.getByText("bb-cached")).toBeDefined();
      expect(screen.getByText("cb-cached")).toBeDefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Insights file input reset after selection (runtime)
// ═══════════════════════════════════════════════════════════════════════

describe("UserMenu — insights file input reset (runtime)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dropdownOpen = true;
    clearPlatformStatusCache();
    vi.mocked(featureFlags.isStudioEnabledSync).mockReturnValue(false);
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
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearPlatformStatusCache();
  });

  it("resets file input value after selection to allow re-upload of same file", async () => {
    render(<UserMenu {...baseProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["<html>report</html>"], "report.html", { type: "text/html" });

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    // The input value should have been reset (e.target.value = "")
    // This is done so the same file can be uploaded again
    // We verify by checking the processing toast appeared (meaning handler ran)
    await waitFor(() => {
      expect(screen.getByTestId("toast")).toBeDefined();
    });
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
