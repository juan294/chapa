// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  dismissToast: vi.fn(),
  refresh: vi.fn(),
  unlink: vi.fn(),
  connections: vi.fn(),
  insightsEnabled: vi.fn(),
  importFile: vi.fn(),
  pendingConfirmation: vi.fn(),
  confirmImport: vi.fn(),
  cancelImport: vi.fn(),
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
    toast: mocks.toast(),
    dismissToast: mocks.dismissToast,
    importFile: mocks.importFile,
    pendingConfirmation: mocks.pendingConfirmation(),
    confirmImport: mocks.confirmImport,
    cancelImport: mocks.cancelImport,
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
  mocks.toast.mockReturnValue(null);
  mocks.insightsEnabled.mockReturnValue(true);
  mocks.pendingConfirmation.mockReturnValue(null);
  mocks.connections.mockReturnValue([
    connection("bitbucket", { status: { linked: true, remoteLogin: "octo-bb" } }),
    connection("codeberg", { status: { linked: false, remoteLogin: null } }),
    connection("gitlab", { enabled: false }),
  ]);
});

it("keeps the same-period replacement confirmation inside the existing import section", () => {
  mocks.pendingConfirmation.mockReturnValue("replacement");
  renderSettings();
  const section = screen.getByTestId("settings-insights");
  expect(within(section).getByText(/explicitly corrects the existing report for the same period/)).toBeDefined();
  fireEvent.click(within(section).getByRole("button", { name: "Replace report" }));
  expect(mocks.confirmImport).toHaveBeenCalledOnce();
  expect(screen.queryByRole("alertdialog")).toBeNull();
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
      // Linking from settings must come back to settings, so a second platform
      // can be linked without navigating back (the OAuth round trip used to
      // land on the share page).
      row.querySelector('a[href="/api/auth/codeberg/connect?returnTo=/settings"]'),
    ).toBeTruthy();
  });

  it("hides a platform whose feature flag is off", () => {
    renderSettings();
    expect(screen.queryByTestId("settings-connection-gitlab")).toBeNull();
  });

  // #1332 — a connection whose refresh grant needs reconnecting must prompt
  // the owner to fix it, not silently keep failing forever.
  it("shows a reconnect prompt and CTA for a connection that needs reconnecting", () => {
    mocks.connections.mockReturnValue([
      connection("bitbucket", { status: { linked: true, remoteLogin: "octo-bb", needsReconnect: true } }),
    ]);
    renderSettings();

    const row = screen.getByTestId("settings-connection-bitbucket");
    expect(screen.getByTestId("settings-connection-bitbucket-needs-reconnect")).toBeTruthy();
    const reconnectLink = within(row).getByRole("link", { name: "Reconnect Bitbucket account" });
    expect(reconnectLink.getAttribute("href")).toBe("/api/auth/bitbucket/connect?returnTo=/settings");
    // Unlink must still be available — reconnecting is not the only way out.
    expect(within(row).getByRole("button", { name: "Unlink Bitbucket account" })).toBeTruthy();
  });

  it("shows no reconnect prompt for a normally connected platform", () => {
    renderSettings();
    const row = screen.getByTestId("settings-connection-bitbucket");
    expect(within(row).queryByRole("link", { name: "Reconnect Bitbucket account" })).toBeNull();
    expect(screen.queryByTestId("settings-connection-bitbucket-needs-reconnect")).toBeNull();
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

});


afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("#1292 insights notification lifecycle", () => {
  const props = {login: "octocat", name: "The Octocat", avatarUrl: null};

  it("keeps slow loading visible until completion and gives errors a fresh interval", async () => {
    vi.useFakeTimers();
    mocks.toast.mockReturnValue({id: 1, type: "loading", message: "Processing"});
    const view = render(<SettingsClient {...props} />);
    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(mocks.dismissToast).not.toHaveBeenCalled();
    expect(screen.getByRole("status").className).not.toContain("animate-toast-out");
    mocks.toast.mockReturnValue({id: 2, type: "loading", message: "Recalculating"});
    view.rerender(<SettingsClient {...props} />);
    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(mocks.dismissToast).not.toHaveBeenCalled();
    mocks.toast.mockReturnValue({id: 3, type: "error", message: "Import failed"});
    view.rerender(<SettingsClient {...props} />);
    await act(() => vi.advanceTimersByTimeAsync(3999));
    expect(screen.getByRole("alert").className).not.toContain("animate-toast-out");
    expect(mocks.dismissToast).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(301));
    expect(mocks.dismissToast).toHaveBeenCalledTimes(1);
  });

  it("restarts identical results and cleans up replaced or manually dismissed notification timers", async () => {
    vi.useFakeTimers();
    mocks.toast.mockReturnValue({id: 1, type: "error", message: "Import failed"});
    const view = render(<SettingsClient {...props} />);
    await act(() => vi.advanceTimersByTimeAsync(4100));
    expect(screen.getByRole("alert").className).toContain("animate-toast-out");
    mocks.toast.mockReturnValue({id: 2, type: "error", message: "Import failed"});
    view.rerender(<SettingsClient {...props} />);
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(screen.getByRole("alert").className).not.toContain("animate-toast-out");
    expect(mocks.dismissToast).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", {name: "Dismiss notification"}));
    expect(mocks.dismissToast).toHaveBeenCalledTimes(1);
    mocks.toast.mockReturnValue(null);
    view.rerender(<SettingsClient {...props} />);
    await act(() => vi.advanceTimersByTimeAsync(10000));
    expect(mocks.dismissToast).toHaveBeenCalledTimes(1);
  });

  it("keeps success visible for the real 2.5-second pre-reload interval", async () => {
    vi.useFakeTimers();
    mocks.toast.mockReturnValue({id: 1, type: "loading", message: "Processing"});
    const view = render(<SettingsClient {...props} />);
    await act(() => vi.advanceTimersByTimeAsync(6000));
    mocks.dismissToast.mockClear();
    mocks.toast.mockReturnValue({id: 2, type: "success", message: "Score updated"});
    view.rerender(<SettingsClient {...props} />);
    await act(() => vi.advanceTimersByTimeAsync(2500));
    expect(screen.getByRole("status").className).not.toContain("animate-toast-out");
    expect(mocks.dismissToast).not.toHaveBeenCalled();
    view.unmount();
    await act(() => vi.advanceTimersByTimeAsync(10000));
    expect(mocks.dismissToast).not.toHaveBeenCalled();
  });
});
