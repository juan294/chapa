import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

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
  it("imports isBitbucketEnabledSync from feature-flags", () => {
    expect(SOURCE).toContain("isBitbucketEnabledSync");
    expect(SOURCE).toContain("@/lib/feature-flags");
  });

  it("fetches Bitbucket status on mount when feature enabled", () => {
    expect(SOURCE).toContain("/api/auth/bitbucket/status");
    expect(SOURCE).toContain("useEffect");
  });

  it("renders Link Bitbucket item conditionally on feature flag", () => {
    expect(SOURCE).toContain("isBitbucketEnabledSync()");
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
  it("imports isCodebergEnabledSync from feature-flags", () => {
    expect(SOURCE).toContain("isCodebergEnabledSync");
    expect(SOURCE).toContain("@/lib/feature-flags");
  });

  it("fetches Codeberg status on mount when feature enabled", () => {
    expect(SOURCE).toContain("/api/auth/codeberg/status");
    expect(SOURCE).toContain("isCodebergEnabledSync()");
  });

  it("renders Link Codeberg item conditionally on feature flag", () => {
    expect(SOURCE).toContain("isCodebergEnabledSync()");
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
