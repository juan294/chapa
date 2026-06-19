// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { EngagementDashboard } from "./engagement-dashboard";

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EngagementDashboard", () => {
  it("shows loading spinner on mount", () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    render(<EngagementDashboard />);

    expect(screen.getByText(/loading engagement/i)).toBeDefined();
  });

  it("shows error when fetch fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Server error" }),
    });

    render(<EngagementDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Server error/)).toBeDefined();
    });
  });

  it("renders score notifications toggle when loaded", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          flags: [
            {
              key: "score_notifications",
              enabled: false,
              description: "Send email notifications when user scores increase significantly",
            },
          ],
        }),
    });

    render(<EngagementDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Score Notifications")).toBeDefined();
    });

    const toggle = screen.getByRole("switch", {
      name: /toggle score notifications/i,
    });
    expect(toggle).toBeDefined();
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });

  it("shows enabled state correctly", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          flags: [
            {
              key: "score_notifications",
              enabled: true,
              description: "Send email notifications when user scores increase significantly",
            },
          ],
        }),
    });

    render(<EngagementDashboard />);

    await waitFor(() => {
      const toggle = screen.getByRole("switch", {
        name: /toggle score notifications/i,
      });
      expect(toggle.getAttribute("aria-checked")).toBe("true");
    });
  });

  it("calls PATCH to toggle feature flag", async () => {
    // Initial fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          flags: [
            {
              key: "score_notifications",
              enabled: false,
              description: "Send email notifications when user scores increase significantly",
            },
          ],
        }),
    });

    render(<EngagementDashboard />);

    await waitFor(() => {
      expect(screen.getByRole("switch")).toBeDefined();
    });

    // PATCH response
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) });
    // Refetch after toggle
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          flags: [
            {
              key: "score_notifications",
              enabled: true,
              description: "Send email notifications when user scores increase significantly",
            },
          ],
        }),
    });

    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/admin/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "score_notifications", enabled: true }),
      });
    });
  });

  it("retries fetch on error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Temporary failure" }),
    });

    render(<EngagementDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Temporary failure/)).toBeDefined();
    });

    // Retry succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          flags: [
            {
              key: "score_notifications",
              enabled: false,
              description: "Send email notifications when user scores increase significantly",
            },
          ],
        }),
    });

    fireEvent.click(screen.getByText("Retry"));

    await waitFor(() => {
      expect(screen.getByText("Score Notifications")).toBeDefined();
    });
  });

  // ─── Campaign fetch ─────────────────────────────────────────────────

  it("displays campaign template when campaigns fetch succeeds", async () => {
    // Flags fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          flags: [
            {
              key: "score_notifications",
              enabled: false,
              description: "Desc",
            },
          ],
        }),
    });
    // Campaigns fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          campaigns: [
            {
              id: "c1",
              type: "engagement",
              name: "Score Bump v1",
              subject: "Your score changed!",
              status: "draft",
            },
          ],
        }),
    });

    render(<EngagementDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Score Bump v1")).toBeDefined();
      expect(screen.getByText(/Your score changed!/)).toBeDefined();
    });
  });

  it("shows fallback message when no engagement campaign exists", async () => {
    // Flags fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ flags: [] }),
    });
    // Campaigns fetch returns empty
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ campaigns: [] }),
    });

    render(<EngagementDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText(/No engagement template created yet/),
      ).toBeDefined();
    });
  });

  it("handles campaign fetch error silently", async () => {
    // Flags fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ flags: [] }),
    });
    // Campaigns fetch fails
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    render(<EngagementDashboard />);

    // Should still render without crashing — error is silently caught
    // findByText awaits the async re-render after the rejected fetch settles
    expect(
      await screen.findByText(/No engagement template created yet/),
    ).toBeDefined();
  });

  it("handles campaign fetch non-ok response silently", async () => {
    // Flags fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ flags: [] }),
    });
    // Campaigns fetch returns non-ok
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({}),
    });

    render(<EngagementDashboard />);

    // findByText awaits the async re-render after the non-ok response settles
    expect(
      await screen.findByText(/No engagement template created yet/),
    ).toBeDefined();
  });

  // ─── handleToggle pending state ────────────────────────────────────

  it("disables toggle while pending", async () => {
    let resolvePatch: (value: { ok: boolean; json: () => Promise<unknown> }) => void;

    // Initial flags fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          flags: [
            {
              key: "score_notifications",
              enabled: false,
              description: "Desc",
            },
          ],
        }),
    });

    render(<EngagementDashboard />);

    await waitFor(() => {
      expect(screen.getByRole("switch")).toBeDefined();
    });

    // PATCH response — keep it pending
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePatch = resolve;
        }),
    );

    fireEvent.click(screen.getByRole("switch"));

    // Toggle should be disabled while pending
    await waitFor(() => {
      expect(screen.getByRole("switch").hasAttribute("disabled")).toBe(true);
    });

    // Resolve the patch
    resolvePatch!({ ok: true, json: () => Promise.resolve({ success: true }) });

    // After resolve, need to handle the refetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          flags: [
            {
              key: "score_notifications",
              enabled: true,
              description: "Desc",
            },
          ],
        }),
    });

    // Toggle should be re-enabled after pending resolves
    await waitFor(() => {
      expect(screen.getByRole("switch").hasAttribute("disabled")).toBe(false);
    });
  });

  it("re-enables toggle even when PATCH returns non-ok", async () => {
    // Initial flags fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          flags: [
            {
              key: "score_notifications",
              enabled: false,
              description: "Desc",
            },
          ],
        }),
    });

    render(<EngagementDashboard />);

    await waitFor(() => {
      expect(screen.getByRole("switch")).toBeDefined();
    });

    // PATCH returns non-ok — toggle should not re-fetch but pending should clear
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Forbidden" }),
    });

    fireEvent.click(screen.getByRole("switch"));

    // Toggle should eventually be re-enabled (pending cleared in finally block)
    await waitFor(() => {
      expect(screen.getByRole("switch").hasAttribute("disabled")).toBe(false);
    });
  });

  // ─── ToggleSwitch aria-checked ─────────────────────────────────────

  it("toggle has aria-checked=false when disabled", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          flags: [
            {
              key: "score_notifications",
              enabled: false,
              description: "Desc",
            },
          ],
        }),
    });

    render(<EngagementDashboard />);

    await waitFor(() => {
      const toggle = screen.getByRole("switch");
      expect(toggle.getAttribute("aria-checked")).toBe("false");
    });
  });

  it("toggle has aria-checked=true when enabled", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          flags: [
            {
              key: "score_notifications",
              enabled: true,
              description: "Desc",
            },
          ],
        }),
    });

    render(<EngagementDashboard />);

    await waitFor(() => {
      const toggle = screen.getByRole("switch");
      expect(toggle.getAttribute("aria-checked")).toBe("true");
    });
  });

  // ─── Empty state ───────────────────────────────────────────────────

  it("shows 'No engagement flags configured' when flags array is empty", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ flags: [] }),
    });

    render(<EngagementDashboard />);

    await waitFor(() => {
      expect(screen.getByText("No engagement flags configured.")).toBeDefined();
    });
  });

  it("shows 'No engagement flags configured' when flags field is missing", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    render(<EngagementDashboard />);

    await waitFor(() => {
      expect(screen.getByText("No engagement flags configured.")).toBeDefined();
    });
  });

  // ─── Flag label/description fallback ───────────────────────────────

  it("uses flag key as label when no human-readable label is defined", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          flags: [
            {
              key: "custom_unknown_flag",
              enabled: false,
              description: "A custom flag description",
            },
          ],
        }),
    });

    render(<EngagementDashboard />);

    await waitFor(() => {
      // Should fall back to the raw key
      expect(screen.getByText("custom_unknown_flag")).toBeDefined();
      // Should fall back to the flag's own description
      expect(screen.getByText("A custom flag description")).toBeDefined();
    });
  });

  // ─── Error state with json parse failure ───────────────────────────

  it("shows HTTP status when error response body is not parseable", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: () => Promise.reject(new Error("Invalid JSON")),
    });

    render(<EngagementDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/HTTP 503/)).toBeDefined();
    });
  });

  // ─── Error state with fetch rejection ──────────────────────────────

  it("shows error message when fetch rejects with exception", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

    render(<EngagementDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Connection refused/)).toBeDefined();
    });
  });

  // ─── Toggle label accessibility ────────────────────────────────────

  it("toggle has accessible label based on flag key", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          flags: [
            {
              key: "score_notifications",
              enabled: false,
              description: "Desc",
            },
          ],
        }),
    });

    render(<EngagementDashboard />);

    await waitFor(() => {
      const toggle = screen.getByRole("switch", {
        name: /toggle score notifications/i,
      });
      expect(toggle).toBeDefined();
      expect(toggle.getAttribute("aria-label")).toBe("Toggle Score Notifications");
    });
  });

  // ─── Multiple flags rendering ──────────────────────────────────────

  it("renders multiple flags as separate rows", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          flags: [
            {
              key: "score_notifications",
              enabled: true,
              description: "Score notifications desc",
            },
            {
              key: "weekly_digest",
              enabled: false,
              description: "Weekly digest desc",
            },
          ],
        }),
    });

    render(<EngagementDashboard />);

    await waitFor(() => {
      const toggles = screen.getAllByRole("switch");
      expect(toggles).toHaveLength(2);
      // First toggle is enabled
      expect(toggles[0]!.getAttribute("aria-checked")).toBe("true");
      // Second toggle is disabled
      expect(toggles[1]!.getAttribute("aria-checked")).toBe("false");
    });
  });
});
