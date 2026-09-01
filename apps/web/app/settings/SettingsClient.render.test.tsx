// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  unlink: vi.fn(),
  connections: vi.fn(),
  insightsEnabled: vi.fn(),
  importFile: vi.fn(),
  cooldownActive: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/components/ClientFeatureFlagsProvider", () => ({
  useClientFeatureFlags: () => ({ insightsEnabled: mocks.insightsEnabled() }),
}));
vi.mock("@/lib/platform/use-platform-connections", () => ({
  usePlatformConnections: () => ({
    connections: mocks.connections(),
    unlink: mocks.unlink,
  }),
  clearPlatformStatusCache: vi.fn(),
}));
vi.mock("@/lib/insights/use-insights-import", () => ({
  useInsightsImport: () => ({
    toast: null,
    dismissToast: vi.fn(),
    cooldownActive: mocks.cooldownActive(),
    cooldownTooltip: mocks.cooldownActive() ? "Available again on Sep 13" : undefined,
    importFile: mocks.importFile,
  }),
}));
vi.mock("@/hooks/useSession", () => ({ clearSessionCache: vi.fn() }));
vi.mock("@/hooks/useOwnerCacheWarm", () => ({ clearCacheWarmState: vi.fn() }));

import { SettingsClient } from "./SettingsClient";

// jsdom does not implement <dialog> — polyfill showModal/close once, matching
// ConfirmDialog.test.tsx.
beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
    };
  }
});

function connection(platform: string, over: Record<string, unknown> = {}) {
  return { platform, enabled: true, status: null, unlinking: false, ...over };
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.insightsEnabled.mockReturnValue(true);
  mocks.cooldownActive.mockReturnValue(false);
  mocks.connections.mockReturnValue([
    connection("bitbucket", { status: { linked: true, remoteLogin: "octo-bb" } }),
    connection("codeberg", { status: { linked: false, remoteLogin: null } }),
    connection("gitlab", { enabled: false }),
  ]);
});

function renderSettings() {
  render(
    <SettingsClient login="octocat" name="The Octocat" avatarUrl={null} />,
  );
}

/**
 * #1223 — every account action used to live in a dropdown that closes when you
 * look away. These assert the page shows the same real state, and that a
 * flag-gated platform stays invisible.
 */
describe("SettingsClient", () => {
  it("shows the signed-in identity", () => {
    renderSettings();
    const identity = screen.getByTestId("settings-identity");
    expect(identity.textContent).toContain("The Octocat");
    expect(identity.textContent).toContain("@octocat");
  });

  it("shows a connected platform with its remote login", () => {
    renderSettings();
    const row = screen.getByTestId("settings-connection-bitbucket");
    expect(row.textContent).toContain("Bitbucket");
    expect(row.textContent).toContain("@octo-bb");
    expect(row.querySelector("a")?.getAttribute("href")).toContain("octo-bb");
  });

  it("offers a connect link for an unconnected platform", () => {
    renderSettings();
    const row = screen.getByTestId("settings-connection-codeberg");
    expect(
      row.querySelector('a[href="/api/auth/codeberg/connect"]'),
    ).toBeTruthy();
  });

  it("hides a platform whose feature flag is off", () => {
    renderSettings();
    expect(screen.queryByTestId("settings-connection-gitlab")).toBeNull();
  });

  it("says so when no platform is available at all", () => {
    mocks.connections.mockReturnValue([
      connection("bitbucket", { enabled: false }),
      connection("codeberg", { enabled: false }),
      connection("gitlab", { enabled: false }),
    ]);
    renderSettings();
    expect(screen.getByTestId("settings-no-connections")).toBeTruthy();
  });

  // Unlinking drops a platform's activity out of the impact score, so it stays
  // behind the same confirm dialog the menu used.
  // The row button is named after its platform (#1238); the dialog's confirm
  // button is the one that reads plain "Unlink".
  function openUnlinkDialog() {
    const row = screen.getByTestId("settings-connection-bitbucket");
    fireEvent.click(
      within(row).getByRole("button", { name: "Unlink Bitbucket account" }),
    );
    return screen.getByRole("alertdialog");
  }

  it("confirms before unlinking, then refreshes on success", async () => {
    mocks.unlink.mockResolvedValue(true);
    renderSettings();

    const dialog = openUnlinkDialog();
    expect(dialog.textContent).toContain("Unlink Bitbucket?");

    fireEvent.click(within(dialog).getByRole("button", { name: "Unlink" }));
    await waitFor(() => expect(mocks.unlink).toHaveBeenCalledWith("bitbucket"));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("surfaces a failed unlink instead of pretending it worked", async () => {
    mocks.unlink.mockResolvedValue(false);
    renderSettings();

    const dialog = openUnlinkDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Unlink" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Unlink failed"),
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("shows the insights import when the flag is on", () => {
    renderSettings();
    expect(screen.getByTestId("settings-insights")).toBeTruthy();
  });

  it("hides the insights import when the flag is off", () => {
    mocks.insightsEnabled.mockReturnValue(false);
    renderSettings();
    expect(screen.queryByTestId("settings-insights")).toBeNull();
  });

  // #1238 — the menu carried per-platform aria labels for these controls and
  // /settings did not, so the three unlink buttons all announced as plain
  // "Unlink" and the file input had no accessible name at all. The dictionary
  // keys already existed; only the call sites were missing.
  it("names each unlink button after its own platform", () => {
    mocks.connections.mockReturnValue([
      connection("bitbucket", { status: { linked: true, remoteLogin: "octo-bb" } }),
      connection("codeberg", { status: { linked: true, remoteLogin: "octo-cb" } }),
      connection("gitlab", { status: { linked: true, remoteLogin: "octo-gl" } }),
    ]);
    renderSettings();

    for (const name of [
      "Unlink Bitbucket account",
      "Unlink Codeberg account",
      "Unlink GitLab account",
    ]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
  });

  it("gives the insights file input an accessible name", () => {
    renderSettings();
    const input = screen
      .getByTestId("settings-insights")
      .querySelector('input[type="file"]');
    expect(input?.getAttribute("aria-label")).toBe(
      "Select Claude Code insights HTML report",
    );
  });

  it("disables the import during its cooldown and says when it returns", () => {
    mocks.cooldownActive.mockReturnValue(true);
    renderSettings();
    const button = screen.getByRole("button", {
      name: "Import Claude Code Insights",
    });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("settings-insights").textContent).toContain(
      "Available again on Sep 13",
    );
  });
});
