// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { TerminalDisplay } from "./terminal-display";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("TerminalDisplay", () => {
  it("renders header with agent key", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: "running", lines: [], totalLines: 0 }),
      }),
    );
    render(<TerminalDisplay agentKey="test-agent" onClose={vi.fn()} />);
    expect(screen.getByText("test-agent")).toBeDefined();
    vi.unstubAllGlobals();
  });

  it("shows running status by default", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: "running", lines: [], totalLines: 0 }),
      }),
    );
    render(<TerminalDisplay agentKey="test-agent" onClose={vi.fn()} />);
    expect(screen.getByText("running")).toBeDefined();
    vi.unstubAllGlobals();
  });

  it("shows waiting message when no lines", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: "running", lines: [], totalLines: 0 }),
      }),
    );
    render(<TerminalDisplay agentKey="test-agent" onClose={vi.fn()} />);
    expect(screen.getByText("Waiting for output...")).toBeDefined();
    vi.unstubAllGlobals();
  });

  it("has Close button that calls onClose", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: "running", lines: [], totalLines: 0 }),
      }),
    );
    const onClose = vi.fn();
    render(<TerminalDisplay agentKey="test-agent" onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close terminal"));
    expect(onClose).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("has Copy button", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: "running", lines: [], totalLines: 0 }),
      }),
    );
    render(<TerminalDisplay agentKey="test-agent" onClose={vi.fn()} />);
    expect(screen.getByLabelText("Copy logs")).toBeDefined();
    vi.unstubAllGlobals();
  });

  it("renders log lines after poll", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          status: "running",
          startedAt: new Date().toISOString(),
          lines: [
            { timestamp: new Date().toISOString(), text: "Hello world", stream: "stdout" },
          ],
          totalLines: 1,
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(<TerminalDisplay agentKey="test-agent" onClose={vi.fn()} />);

    // Let the initial poll (setTimeout 0) fire
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(screen.getByText("Hello world")).toBeDefined();
    vi.unstubAllGlobals();
  });

  it("stops polling on 404", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    vi.stubGlobal("fetch", mockFetch);

    render(<TerminalDisplay agentKey="test-agent" onClose={vi.fn()} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(screen.getByText("failed")).toBeDefined();
    vi.unstubAllGlobals();
  });

  it("renders terminal dots in header", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: "running", lines: [], totalLines: 0 }),
      }),
    );
    const { container } = render(
      <TerminalDisplay agentKey="test-agent" onClose={vi.fn()} />,
    );
    expect(container.querySelectorAll(".rounded-full").length).toBe(3);
    vi.unstubAllGlobals();
  });

  describe("status color classes", () => {
    it("shows text-terminal-green for completed status", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              status: "completed",
              startedAt: new Date().toISOString(),
              lines: [],
              totalLines: 0,
            }),
        }),
      );

      render(<TerminalDisplay agentKey="test-agent" onClose={vi.fn()} />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      const statusEl = screen.getByText("completed");
      expect(statusEl.className).toContain("text-terminal-green");
      vi.unstubAllGlobals();
    });

    it("shows text-terminal-red for failed status", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              status: "failed",
              startedAt: new Date().toISOString(),
              lines: [],
              totalLines: 0,
            }),
        }),
      );

      render(<TerminalDisplay agentKey="test-agent" onClose={vi.fn()} />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      const statusEl = screen.getByText("failed");
      expect(statusEl.className).toContain("text-terminal-red");
      vi.unstubAllGlobals();
    });
  });

  describe("stream type rendering", () => {
    it("renders stderr lines with text-terminal-red class", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              status: "running",
              startedAt: new Date().toISOString(),
              lines: [
                { timestamp: new Date().toISOString(), text: "Error occurred", stream: "stderr" },
              ],
              totalLines: 1,
            }),
        }),
      );

      render(<TerminalDisplay agentKey="test-agent" onClose={vi.fn()} />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      const errorLine = screen.getByText("Error occurred");
      expect(errorLine.className).toContain("text-terminal-red");
      vi.unstubAllGlobals();
    });
  });

  describe("elapsed time formatting", () => {
    it("shows seconds format when under 60s", async () => {
      // Set startedAt to 30 seconds ago
      const startedAt = new Date(Date.now() - 30_000).toISOString();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              status: "running",
              startedAt,
              lines: [],
              totalLines: 0,
            }),
        }),
      );

      render(<TerminalDisplay agentKey="test-agent" onClose={vi.fn()} />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      // Should show "30s" format
      expect(screen.getByText("30s")).toBeDefined();
      vi.unstubAllGlobals();
    });

    it("shows minutes and seconds format when over 60s", async () => {
      // Set startedAt to 90 seconds ago
      const startedAt = new Date(Date.now() - 90_000).toISOString();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              status: "running",
              startedAt,
              lines: [],
              totalLines: 0,
            }),
        }),
      );

      render(<TerminalDisplay agentKey="test-agent" onClose={vi.fn()} />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      // Should show "1m 30s" format
      expect(screen.getByText("1m 30s")).toBeDefined();
      vi.unstubAllGlobals();
    });
  });

  describe("non-ok fetch response (not 404)", () => {
    it("keeps polling on 500 error without crashing", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      vi.stubGlobal("fetch", mockFetch);

      render(<TerminalDisplay agentKey="test-agent" onClose={vi.fn()} />);

      // First poll
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      // Status should remain "running" (the default) — non-404 errors are silently ignored
      expect(screen.getByText("running")).toBeDefined();

      // Advance to next poll interval — should still poll
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      // Fetch should have been called at least twice (initial + interval)
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
      vi.unstubAllGlobals();
    });
  });

  describe("empty lines response", () => {
    it("shows waiting message when lines array is empty", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              status: "running",
              startedAt: new Date().toISOString(),
              lines: [],
              totalLines: 0,
            }),
        }),
      );

      render(<TerminalDisplay agentKey="test-agent" onClose={vi.fn()} />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      expect(screen.getByText("Waiting for output...")).toBeDefined();
      vi.unstubAllGlobals();
    });
  });
});
