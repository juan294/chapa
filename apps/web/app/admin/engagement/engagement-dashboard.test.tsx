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
});
