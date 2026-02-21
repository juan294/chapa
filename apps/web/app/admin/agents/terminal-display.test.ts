import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "terminal-display.tsx"),
  "utf-8",
);

describe("TerminalDisplay", () => {
  describe("exports", () => {
    it("exports a named TerminalDisplay component", () => {
      expect(SOURCE).toContain("export function TerminalDisplay");
    });

    it("is a client component", () => {
      expect(SOURCE).toContain('"use client"');
    });
  });

  describe("props interface", () => {
    it("accepts agentKey string", () => {
      expect(SOURCE).toContain("agentKey: string");
    });

    it("accepts onClose callback", () => {
      expect(SOURCE).toContain("onClose: () => void");
    });
  });

  describe("LogLine interface", () => {
    it("defines timestamp field", () => {
      expect(SOURCE).toContain("timestamp: string");
    });

    it("defines text field", () => {
      expect(SOURCE).toContain("text: string");
    });

    it("defines stream field with stdout/stderr", () => {
      expect(SOURCE).toContain('stream: "stdout" | "stderr"');
    });
  });

  describe("state management", () => {
    it("tracks log lines array", () => {
      expect(SOURCE).toContain("useState<LogLine[]>([])");
    });

    it("tracks running status", () => {
      expect(SOURCE).toContain('useState<string>("running")');
    });

    it("tracks startedAt time", () => {
      expect(SOURCE).toContain("useState<string | null>(null)");
    });

    it("tracks elapsed time string", () => {
      expect(SOURCE).toContain('useState("0s")');
    });
  });

  describe("polling", () => {
    it("polls the agent run endpoint", () => {
      expect(SOURCE).toContain("/api/admin/agents/run");
    });

    it("passes agentKey as query parameter", () => {
      expect(SOURCE).toContain("agentKey=${agentKey}");
    });

    it("passes since offset for incremental log fetching", () => {
      expect(SOURCE).toContain("since=${offsetRef.current}");
    });

    it("polls on a 2-second interval", () => {
      expect(SOURCE).toContain("setInterval(poll, 2000)");
    });

    it("sets status to failed on 404 response", () => {
      expect(SOURCE).toContain("res.status === 404");
      expect(SOURCE).toContain('setStatus("failed")');
    });

    it("stops polling when run is completed, failed, or stopped", () => {
      expect(SOURCE).toContain('"completed"');
      expect(SOURCE).toContain('"failed"');
      expect(SOURCE).toContain('"stopped"');
      expect(SOURCE).toContain("stopPolling");
    });

    it("cleans up interval on unmount", () => {
      expect(SOURCE).toContain("clearInterval");
      expect(SOURCE).toContain("clearTimeout");
    });

    it("appends new lines to existing lines", () => {
      expect(SOURCE).toContain("setLines((prev) => [...prev, ...data.lines]");
    });

    it("updates totalLines offset for next poll", () => {
      expect(SOURCE).toContain("offsetRef.current = data.totalLines");
    });
  });

  describe("auto-scroll", () => {
    it("scrolls to bottom when new lines arrive", () => {
      expect(SOURCE).toContain("scrollRef.current");
      expect(SOURCE).toContain("scrollTop");
      expect(SOURCE).toContain("scrollHeight");
    });

    it("uses useRef for scroll container", () => {
      expect(SOURCE).toContain("useRef<HTMLDivElement>(null)");
    });
  });

  describe("elapsed timer", () => {
    it("calculates elapsed time from startedAt", () => {
      expect(SOURCE).toContain("Date.now() - new Date(startedAt).getTime()");
    });

    it("formats seconds when under a minute", () => {
      expect(SOURCE).toContain("`${s}s`");
    });

    it("formats minutes and seconds when over a minute", () => {
      expect(SOURCE).toContain("Math.floor(s / 60)");
      expect(SOURCE).toContain("s % 60");
    });

    it("updates every second", () => {
      expect(SOURCE).toContain("setInterval(update, 1000)");
    });
  });

  describe("header", () => {
    it("shows terminal dots", () => {
      expect(SOURCE).toContain("bg-terminal-red/60");
      expect(SOURCE).toContain("bg-terminal-yellow/60");
      expect(SOURCE).toContain("bg-terminal-green/60");
    });

    it("displays agentKey", () => {
      expect(SOURCE).toContain("{agentKey}");
    });

    it("displays status", () => {
      expect(SOURCE).toContain("{status}");
    });

    it("displays elapsed time", () => {
      expect(SOURCE).toContain("{elapsed}");
    });

    it("has status color mapping", () => {
      expect(SOURCE).toContain('"text-amber"');
      expect(SOURCE).toContain('"text-terminal-green"');
      expect(SOURCE).toContain('"text-terminal-red"');
    });
  });

  describe("action buttons", () => {
    it("has a Copy button", () => {
      expect(SOURCE).toContain("Copy");
    });

    it("Copy button writes to clipboard", () => {
      expect(SOURCE).toContain("navigator.clipboard.writeText");
    });

    it("has accessible label for Copy button", () => {
      expect(SOURCE).toContain('aria-label="Copy logs"');
    });

    it("has a Close button", () => {
      expect(SOURCE).toContain("Close");
      expect(SOURCE).toContain("onClose");
    });

    it("has accessible label for Close button", () => {
      expect(SOURCE).toContain('aria-label="Close terminal"');
    });
  });

  describe("log area", () => {
    it("shows waiting message when no lines exist", () => {
      expect(SOURCE).toContain("Waiting for output...");
    });

    it("uses pulse animation for waiting message", () => {
      expect(SOURCE).toContain("animate-pulse");
    });

    it("renders timestamps for each log line", () => {
      expect(SOURCE).toContain("toLocaleTimeString()");
    });

    it("colors stderr lines in terminal-red", () => {
      expect(SOURCE).toContain('"stderr"');
      expect(SOURCE).toContain("text-terminal-red");
    });

    it("colors stdout lines in text-primary", () => {
      expect(SOURCE).toContain("text-text-primary");
    });

    it("has max height with scroll overflow", () => {
      expect(SOURCE).toContain("max-h-80 overflow-y-auto");
    });
  });

  describe("styling", () => {
    it("uses card styling for container", () => {
      expect(SOURCE).toContain("rounded-xl border border-stroke bg-card");
    });

    it("uses monospace font for log content", () => {
      expect(SOURCE).toContain("font-heading");
    });
  });
});
