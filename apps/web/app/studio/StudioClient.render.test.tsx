// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

// ---------- Browser API mocks ----------

// jsdom doesn't implement matchMedia — StudioClient uses useSyncExternalStore
// with window.matchMedia for reduced motion detection
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ---------- Module mocks (before component import) ----------

vi.mock("@/lib/analytics/posthog", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("@/lib/effects/defaults", () => ({
  STUDIO_PRESETS: [
    {
      id: "minimal",
      label: "Minimal",
      config: {
        background: "solid",
        cardStyle: "flat",
        border: "solid-amber",
        scoreEffect: "standard",
        heatmapAnimation: "fade-in",
        interaction: "static",
        statsDisplay: "static",
        tierTreatment: "standard",
        celebration: "none",
      },
    },
    {
      id: "vibrant",
      label: "Vibrant",
      config: {
        background: "gradient",
        cardStyle: "glass",
        border: "glow",
        scoreEffect: "counter",
        heatmapAnimation: "wave",
        interaction: "tilt",
        statsDisplay: "counter",
        tierTreatment: "glow",
        celebration: "confetti",
      },
    },
  ],
}));

vi.mock("./BadgePreviewCard", () => ({
  BadgePreviewCard: ({
    config,
    interactive,
  }: {
    config: Record<string, unknown>;
    interactive: boolean;
  }) => (
    <div data-testid="badge-preview" data-interactive={String(interactive)}>
      {JSON.stringify(config)}
    </div>
  ),
}));

vi.mock("./QuickControls", () => ({
  QuickControls: ({
    onCommand,
    visible,
    onToggle,
  }: {
    onCommand: (cmd: string) => void;
    visible: boolean;
    onToggle: () => void;
  }) => (
    <div data-testid="quick-controls" data-visible={String(visible)}>
      <button data-testid="qc-toggle" onClick={onToggle}>
        Toggle
      </button>
      <button
        data-testid="qc-command"
        onClick={() => onCommand("/set background gradient")}
      >
        Run Command
      </button>
    </div>
  ),
}));

vi.mock("./useStudioCommands", () => ({
  useStudioCommands: () => [
    { name: "/help", description: "Show help" },
    { name: "/set", description: "Set a value" },
  ],
}));

vi.mock("@/components/terminal/TerminalOutput", () => ({
  TerminalOutput: ({ lines }: { lines: unknown[] }) => (
    <div data-testid="terminal-output" role="log">
      {lines.length} lines
    </div>
  ),
}));

vi.mock("@/components/terminal/TerminalInput", () => ({
  TerminalInput: ({
    onSubmit,
    onPartialChange,
    prompt,
  }: {
    onSubmit: (input: string) => void;
    onPartialChange: (val: string) => void;
    history: string[];
    prompt: string;
  }) => (
    <div data-testid="terminal-input">
      <input
        aria-label="Terminal command input"
        data-prompt={prompt}
        onChange={(e) => onPartialChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSubmit((e.target as HTMLInputElement).value);
          }
        }}
      />
    </div>
  ),
}));

vi.mock("@/components/terminal/AutocompleteDropdown", () => ({
  AutocompleteDropdown: ({
    visible,
    onSelect,
    onDismiss,
  }: {
    visible: boolean;
    onSelect: (cmd: string) => void;
    onFill: (cmd: string) => void;
    onDismiss: () => void;
    partial: string;
    commands: unknown[];
  }) =>
    visible ? (
      <div data-testid="autocomplete" role="listbox">
        <button data-testid="ac-select" onClick={() => onSelect("/help")}>
          /help
        </button>
        <button data-testid="ac-dismiss" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/terminal/command-registry", () => {
  let lineId = 0;
  return {
    executeCommand: vi.fn(() => ({
      lines: [{ id: `mock-${++lineId}`, type: "system", text: "executed" }],
      action: null,
    })),
    makeLine: (type: string, text: string) => ({
      id: `mock-${++lineId}`,
      type,
      text,
    }),
  };
});

vi.mock("@/components/KeyboardShortcutsListener", () => ({
  useKeyboardShortcutsContext: () => ({
    registerPageShortcuts: vi.fn(() => vi.fn()),
    openCheatSheet: vi.fn(),
  }),
}));

import { StudioClient } from "./StudioClient";
import type { BadgeConfig, StatsData, ImpactV4Result } from "@chapa/shared";

// ---------- Test fixtures ----------

const defaultConfig: BadgeConfig = {
  background: "solid",
  cardStyle: "flat",
  border: "solid-amber",
  scoreEffect: "standard",
  heatmapAnimation: "fade-in",
  interaction: "static",
  statsDisplay: "static",
  tierTreatment: "standard",
  celebration: "none",
};

const stats: StatsData = {
  handle: "testuser",
  commitsTotal: 100,
  activeDays: 50,
  prsMergedCount: 10,
  prsMergedWeight: 20,
  reviewsSubmittedCount: 5,
  issuesClosedCount: 3,
  linesAdded: 5000,
  linesDeleted: 2000,
  reposContributed: 4,
  topRepoShare: 0.5,
  maxCommitsIn10Min: 3,
  totalStars: 10,
  totalForks: 2,
  totalWatchers: 5,
  heatmapData: [],
  fetchedAt: new Date().toISOString(),
};

const impact: ImpactV4Result = {
  handle: "testuser",
  profileType: "solo",
  dimensions: {
    delivery: 60,
    quality: 70,
    consistency: 80,
    breadth: 50,
  },
  archetype: "Builder",
  compositeScore: 65,
  confidence: 85,
  confidencePenalties: [],
  adjustedComposite: 65,
  tier: "Solid",
  computedAt: new Date().toISOString(),
};

// ---------- Tests ----------

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("StudioClient render", () => {
  describe("smoke test", () => {
    it("renders without crashing", () => {
      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
          handle="testuser"
        />,
      );
      expect(screen.getByText("Creator Studio")).toBeDefined();
    });

    it("renders sr-only h1 heading", () => {
      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );
      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading.textContent).toBe("Creator Studio");
    });
  });

  describe("preview pane", () => {
    it("renders BadgePreviewCard with config", () => {
      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );
      const preview = screen.getByTestId("badge-preview");
      expect(preview).toBeDefined();
      expect(preview.textContent).toContain('"background":"solid"');
    });

    it("renders BadgePreviewCard with interactive=true by default", () => {
      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );
      const preview = screen.getByTestId("badge-preview");
      expect(preview.getAttribute("data-interactive")).toBe("true");
    });
  });

  describe("terminal pane", () => {
    it("renders TerminalOutput with initial lines", () => {
      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );
      const output = screen.getByTestId("terminal-output");
      expect(output).toBeDefined();
      expect(output.textContent).toContain("2 lines");
    });

    it("renders TerminalInput with studio prompt", () => {
      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );
      const input = screen.getByLabelText("Terminal command input");
      expect(input).toBeDefined();
    });

    it("renders QuickControls", () => {
      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );
      const qc = screen.getByTestId("quick-controls");
      expect(qc).toBeDefined();
    });
  });

  describe("terminal input interactions", () => {
    it("shows autocomplete when typing / prefix", () => {
      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );
      const input = screen.getByLabelText("Terminal command input");

      fireEvent.change(input, { target: { value: "/he" } });
      expect(screen.getByTestId("autocomplete")).toBeDefined();
    });

    it("hides autocomplete when input is empty", () => {
      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );
      const input = screen.getByLabelText("Terminal command input");

      // Type / to show autocomplete
      fireEvent.change(input, { target: { value: "/h" } });
      expect(screen.getByTestId("autocomplete")).toBeDefined();

      // Clear input
      fireEvent.change(input, { target: { value: "" } });
      expect(screen.queryByTestId("autocomplete")).toBeNull();
    });

    it("submits command on Enter and adds to output", async () => {
      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );
      const input = screen.getByLabelText("Terminal command input");

      fireEvent.change(input, { target: { value: "/help" } });
      fireEvent.keyDown(input, { key: "Enter" });

      // Output lines should increase (2 initial + input line + result line)
      await waitFor(() => {
        const output = screen.getByTestId("terminal-output");
        expect(output.textContent).toContain("4 lines");
      });
    });
  });

  describe("quick controls", () => {
    it("quick controls are hidden by default", () => {
      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );
      const qc = screen.getByTestId("quick-controls");
      expect(qc.getAttribute("data-visible")).toBe("false");
    });

    it("clicking toggle shows/hides quick controls", () => {
      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );
      const toggle = screen.getByTestId("qc-toggle");
      fireEvent.click(toggle);

      const qc = screen.getByTestId("quick-controls");
      expect(qc.getAttribute("data-visible")).toBe("true");
    });

    it("quick command triggers handleSubmit", async () => {
      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );
      const cmdBtn = screen.getByTestId("qc-command");
      fireEvent.click(cmdBtn);

      // Should add lines to output
      await waitFor(() => {
        const output = screen.getByTestId("terminal-output");
        expect(output.textContent).toContain("4 lines");
      });
    });
  });

  describe("save functionality", () => {
    it("shows saving indicator during save", async () => {
      // Mock fetch to delay response
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(() => resolve(new Response("{}", { status: 200 })), 100),
            ),
        );

      const { executeCommand } = await import(
        "@/components/terminal/command-registry"
      );
      vi.mocked(executeCommand).mockReturnValue({
        lines: [{ id: "save-1", type: "system", text: "Saving..." }],
        action: { type: "save" },
      });

      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );

      const input = screen.getByLabelText("Terminal command input");
      fireEvent.change(input, { target: { value: "/save" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(screen.getByText("Saving...")).toBeDefined();
      });

      fetchSpy.mockRestore();
    });
  });

  describe("analytics", () => {
    it("tracks studio_opened on mount", async () => {
      const { trackEvent } = await import("@/lib/analytics/posthog");

      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
          handle="testuser"
        />,
      );

      expect(trackEvent).toHaveBeenCalledWith("studio_opened");
    });
  });
});
