// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { SharedContextEntry } from "../agents-types";

vi.mock("@/lib/utils/escape", () => ({
  escapeHtml: (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/'/g, "&#39;")
      .replace(/"/g, "&quot;"),
}));

import { CrossAgentInsights } from "./cross-agent-insights";

afterEach(cleanup);

// ---------- Fixtures ----------

const coverageEntry: SharedContextEntry = {
  agent: "coverage",
  timestamp: "2026-03-16T02:00:00Z",
  content: "## Report\n- Coverage is at **80%**\n- Check `vitest` config",
};

const securityEntry: SharedContextEntry = {
  agent: "security",
  timestamp: "2026-03-15T09:00:00Z",
  content: "No vulnerabilities found.",
};

const olderCoverageEntry: SharedContextEntry = {
  agent: "coverage",
  timestamp: "2026-03-15T02:00:00Z",
  content: "Old coverage report",
};

// ---------- Tests ----------

describe("CrossAgentInsights render", () => {
  describe("empty state", () => {
    it("shows empty message when no entries", () => {
      render(<CrossAgentInsights entries={[]} />);
      expect(screen.getByText(/No shared context available yet/)).toBeDefined();
    });

    it("suggests running an agent", () => {
      render(<CrossAgentInsights entries={[]} />);
      expect(screen.getByText(/Run an agent to generate insights/)).toBeDefined();
    });

    it("shows terminal-style prefix", () => {
      render(<CrossAgentInsights entries={[]} />);
      expect(screen.getByText(/agents\/insights/)).toBeDefined();
    });
  });

  describe("with entries", () => {
    it("renders agent pills for each unique agent", () => {
      render(<CrossAgentInsights entries={[coverageEntry, securityEntry]} />);

      // Agent pills should be clickable buttons
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBe(2);
      expect(buttons[0]?.textContent).toBe("coverage");
      expect(buttons[1]?.textContent).toBe("security");
    });

    it("selects first agent by default", () => {
      render(<CrossAgentInsights entries={[coverageEntry, securityEntry]} />);

      // First agent (coverage) should be selected — has amber bg
      const buttons = screen.getAllByRole("button");
      expect(buttons[0]?.className).toContain("bg-amber");
    });

    it("shows content of selected agent entry", () => {
      render(<CrossAgentInsights entries={[coverageEntry]} />);

      // The rendered markdown content should be visible
      expect(screen.getByText("Report")).toBeDefined();
    });

    it("shows timestamp of selected entry", () => {
      render(<CrossAgentInsights entries={[coverageEntry]} />);
      expect(screen.getByText(/Updated:/)).toBeDefined();
    });

    it("clicking another agent pill switches content", () => {
      render(<CrossAgentInsights entries={[coverageEntry, securityEntry]} />);

      // Click on security pill
      const buttons = screen.getAllByRole("button");
      const securityBtn = buttons.find((b) => b.textContent === "security");
      fireEvent.click(securityBtn!);

      // Security content should now be shown
      expect(screen.getByText(/No vulnerabilities found/)).toBeDefined();
    });

    it("deduplicates agents — picks most recent entry per agent", () => {
      render(
        <CrossAgentInsights entries={[olderCoverageEntry, coverageEntry]} />,
      );

      // Only one coverage pill should appear
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBe(1);
      expect(buttons[0]?.textContent).toBe("coverage");

      // The newer entry content should be shown
      expect(screen.getByText("Report")).toBeDefined();
    });

    it("replaces underscores with spaces in agent labels", () => {
      const entry: SharedContextEntry = {
        agent: "cost_analyst",
        timestamp: "2026-03-16T03:00:00Z",
        content: "Cost analysis complete.",
      };
      render(<CrossAgentInsights entries={[entry]} />);

      const button = screen.getByRole("button");
      expect(button.textContent).toBe("cost analyst");
    });

    it("renders markdown with bold text", () => {
      render(<CrossAgentInsights entries={[coverageEntry]} />);
      const container = screen.getByText("Report").closest("div");
      expect(container?.parentElement?.innerHTML).toContain("<strong");
      expect(container?.parentElement?.innerHTML).toContain("80%");
    });

    it("renders markdown with inline code", () => {
      render(<CrossAgentInsights entries={[coverageEntry]} />);
      const container = screen.getByText("Report").closest("div");
      expect(container?.parentElement?.innerHTML).toContain("<code");
      expect(container?.parentElement?.innerHTML).toContain("vitest");
    });
  });

  describe("agent pill styling", () => {
    it("selected pill has bg-amber text-white", () => {
      render(<CrossAgentInsights entries={[coverageEntry, securityEntry]} />);
      const buttons = screen.getAllByRole("button");
      expect(buttons[0]?.className).toContain("bg-amber");
      expect(buttons[0]?.className).toContain("text-white");
    });

    it("unselected pill has stroke background", () => {
      render(<CrossAgentInsights entries={[coverageEntry, securityEntry]} />);
      const buttons = screen.getAllByRole("button");
      expect(buttons[1]?.className).toContain("bg-stroke");
    });
  });
});
