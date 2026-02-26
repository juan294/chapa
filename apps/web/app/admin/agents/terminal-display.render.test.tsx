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
});
