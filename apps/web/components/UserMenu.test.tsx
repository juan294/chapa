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
