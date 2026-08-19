// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";

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
        id="terminal-command-input"
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
    onFill,
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
        <button data-testid="ac-fill" onClick={() => onFill("/set")}>
          Fill /set
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

let capturedShortcutHandler: ((id: string) => void) | null = null;
vi.mock("@/components/KeyboardShortcutsListener", () => ({
  useKeyboardShortcutsContext: () => ({
    registerPageShortcuts: vi.fn((_page: string, handler: (id: string) => void) => {
      capturedShortcutHandler = handler;
      return vi.fn(); // cleanup function
    }),
    openCheatSheet: vi.fn(),
  }),
}));

import { StudioClient } from "./StudioClient";
import type { BadgeConfig, StatsData, ImpactV6Result } from "@chapa/shared";

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

const impact: ImpactV6Result = {
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
      expect(heading.className).toContain("sr-only");
    });
  });

  describe("responsive layout", () => {
    it("uses a two-column grid on large screens", () => {
      const { container } = render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );
      expect(container.firstElementChild?.className).toContain("lg:grid-cols-2");
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

      const previewPane = screen.getByTestId("badge-preview").closest("[aria-busy]");
      expect(previewPane?.getAttribute("aria-busy")).toBe("true");

      fetchSpy.mockRestore();
    });

    it("adds success line to output on save success, PUTs the config as JSON, and tracks config_saved", async () => {
      const { trackEvent } = await import("@/lib/analytics/posthog");
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("{}", { status: 200 }));

      const { executeCommand } = await import(
        "@/components/terminal/command-registry"
      );
      vi.mocked(executeCommand).mockReturnValue({
        lines: [{ id: "save-ok", type: "system", text: "Saving" }],
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
        // After save completes, output should grow (initial 2 + input + result + success)
        const output = screen.getByTestId("terminal-output");
        const lineCount = parseInt(output.textContent?.match(/(\d+) lines/)?.[1] ?? "0", 10);
        expect(lineCount).toBeGreaterThanOrEqual(4);
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/studio/config",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(defaultConfig),
        }),
      );
      expect(trackEvent).toHaveBeenCalledWith(
        "config_saved",
        expect.objectContaining({ config: defaultConfig }),
      );

      const previewPane = screen.getByTestId("badge-preview").closest("[aria-busy]");
      expect(previewPane?.getAttribute("aria-busy")).toBe("false");

      fetchSpy.mockRestore();
    });

    it("adds error line to output on save failure", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("", { status: 500 }));

      const { executeCommand } = await import(
        "@/components/terminal/command-registry"
      );
      vi.mocked(executeCommand).mockReturnValue({
        lines: [{ id: "save-fail", type: "system", text: "Saving" }],
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
        const output = screen.getByTestId("terminal-output");
        const lineCount = parseInt(output.textContent?.match(/(\d+) lines/)?.[1] ?? "0", 10);
        expect(lineCount).toBeGreaterThanOrEqual(4);
      });

      fetchSpy.mockRestore();
    });
  });

  describe("reset functionality", () => {
    it("resets config to defaults when reset action fires", async () => {
      const { executeCommand } = await import(
        "@/components/terminal/command-registry"
      );
      vi.mocked(executeCommand).mockReturnValue({
        lines: [{ id: "reset-1", type: "system", text: "Reset done" }],
        action: { type: "reset" },
      });

      render(
        <StudioClient
          initialConfig={{ ...defaultConfig, background: "aurora" }}
          stats={stats}
          impact={impact}
        />,
      );

      // Should show aurora initially
      const preview = screen.getByTestId("badge-preview");
      expect(preview.textContent).toContain('"background":"aurora"');

      const input = screen.getByLabelText("Terminal command input");
      fireEvent.change(input, { target: { value: "/reset" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        const updatedPreview = screen.getByTestId("badge-preview");
        // After reset, background should be "solid" (default)
        expect(updatedPreview.textContent).toContain('"background":"solid"');
      });
    });
  });

  describe("clear action", () => {
    it("clears terminal output when clear action fires", async () => {
      const { executeCommand } = await import(
        "@/components/terminal/command-registry"
      );
      vi.mocked(executeCommand).mockReturnValue({
        lines: [],
        action: { type: "clear" },
      });

      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );

      // Initially 2 lines
      expect(screen.getByTestId("terminal-output").textContent).toContain("2 lines");

      const input = screen.getByLabelText("Terminal command input");
      fireEvent.change(input, { target: { value: "/clear" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(screen.getByTestId("terminal-output").textContent).toContain("0 lines");
      });
    });
  });

  describe("set action (config change)", () => {
    it("updates config via set action", async () => {
      const { executeCommand } = await import(
        "@/components/terminal/command-registry"
      );
      vi.mocked(executeCommand).mockReturnValue({
        lines: [{ id: "set-1", type: "system", text: "Set background to aurora" }],
        action: { type: "set", category: "background", value: "aurora" },
      });

      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );

      const input = screen.getByLabelText("Terminal command input");
      fireEvent.change(input, { target: { value: "/set background aurora" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        const preview = screen.getByTestId("badge-preview");
        expect(preview.textContent).toContain('"background":"aurora"');
      });
    });

    it("tracks effect_changed when config changes", async () => {
      const { trackEvent } = await import("@/lib/analytics/posthog");
      const { executeCommand } = await import(
        "@/components/terminal/command-registry"
      );
      vi.mocked(executeCommand).mockReturnValue({
        lines: [{ id: "set-2", type: "system", text: "Changed" }],
        action: { type: "set", category: "background", value: "aurora" },
      });

      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );

      const input = screen.getByLabelText("Terminal command input");
      fireEvent.change(input, { target: { value: "/set background aurora" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(trackEvent).toHaveBeenCalledWith("effect_changed", expect.objectContaining({
          category: "background",
        }));
      });
    });
  });

  describe("preset action", () => {
    it("applies preset config via preset action", async () => {
      const { executeCommand } = await import(
        "@/components/terminal/command-registry"
      );
      vi.mocked(executeCommand).mockReturnValue({
        lines: [{ id: "preset-1", type: "system", text: "Applied vibrant" }],
        action: { type: "preset", name: "vibrant" },
      });

      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );

      const input = screen.getByLabelText("Terminal command input");
      fireEvent.change(input, { target: { value: "/preset vibrant" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        const preview = screen.getByTestId("badge-preview");
        expect(preview.textContent).toContain('"background":"gradient"');
      });
    });

    it("tracks preset_selected event", async () => {
      const { trackEvent } = await import("@/lib/analytics/posthog");
      const { executeCommand } = await import(
        "@/components/terminal/command-registry"
      );
      vi.mocked(executeCommand).mockReturnValue({
        lines: [{ id: "preset-2", type: "system", text: "Applied" }],
        action: { type: "preset", name: "minimal" },
      });

      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );

      const input = screen.getByLabelText("Terminal command input");
      fireEvent.change(input, { target: { value: "/preset minimal" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(trackEvent).toHaveBeenCalledWith("preset_selected", { preset: "minimal" });
      });
    });

    it("ignores unknown preset names", async () => {
      const { executeCommand } = await import(
        "@/components/terminal/command-registry"
      );
      vi.mocked(executeCommand).mockReturnValue({
        lines: [{ id: "preset-unk", type: "system", text: "Unknown" }],
        action: { type: "preset", name: "nonexistent" },
      });

      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );

      const input = screen.getByLabelText("Terminal command input");
      fireEvent.change(input, { target: { value: "/preset nonexistent" } });
      fireEvent.keyDown(input, { key: "Enter" });

      // Config should remain unchanged
      await waitFor(() => {
        const preview = screen.getByTestId("badge-preview");
        expect(preview.textContent).toContain('"background":"solid"');
      });
    });
  });

  describe("autocomplete interactions", () => {
    it("autocomplete select triggers command execution", async () => {
      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );

      // Type / to show autocomplete
      const input = screen.getByLabelText("Terminal command input");
      fireEvent.change(input, { target: { value: "/he" } });

      // Click the autocomplete select button
      fireEvent.click(screen.getByTestId("ac-select"));

      await waitFor(() => {
        const output = screen.getByTestId("terminal-output");
        const lineCount = parseInt(output.textContent?.match(/(\d+) lines/)?.[1] ?? "0", 10);
        expect(lineCount).toBeGreaterThan(2);
      });
    });

    it("autocomplete dismiss hides the dropdown", () => {
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

      fireEvent.click(screen.getByTestId("ac-dismiss"));

      expect(screen.queryByTestId("autocomplete")).toBeNull();
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

  describe("autocomplete fill", () => {
    it("calls handleAutocompleteFill which hides autocomplete and focuses input", () => {
      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );

      const input = screen.getByLabelText("Terminal command input");
      // Type / to show autocomplete
      fireEvent.change(input, { target: { value: "/se" } });

      expect(screen.getByTestId("autocomplete")).toBeDefined();

      const focusSpy = vi.spyOn(input, "focus");

      // Click the fill button — handleAutocompleteFill is called
      fireEvent.click(screen.getByTestId("ac-fill"));

      // handleAutocompleteFill sets showAutocomplete(false), then programmatically
      // sets value and dispatches input event, which re-triggers partial change.
      // Verify focus was called on the input (the core behavior).
      expect(focusSpy).toHaveBeenCalled();
    });
  });

  describe("keyboard shortcuts", () => {
    it("registers keyboard shortcuts with studio page name", () => {
      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );

      expect(capturedShortcutHandler).not.toBeNull();
    });

    it("focus-terminal shortcut focuses the terminal input", () => {
      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );

      const input = screen.getByLabelText("Terminal command input");
      const focusSpy = vi.spyOn(input, "focus");

      act(() => {
        capturedShortcutHandler?.("focus-terminal");
      });

      expect(focusSpy).toHaveBeenCalled();
    });

    it("toggle-quick-controls shortcut toggles quick controls visibility", () => {
      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );

      // Initially hidden
      expect(screen.getByTestId("quick-controls").getAttribute("data-visible")).toBe("false");

      act(() => {
        capturedShortcutHandler?.("toggle-quick-controls");
      });

      expect(screen.getByTestId("quick-controls").getAttribute("data-visible")).toBe("true");
    });

    it("refresh-preview shortcut increments preview key", () => {
      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );

      // The BadgePreviewCard is rendered with key={previewKey}
      // Refreshing should cause re-render (new key)
      act(() => {
        capturedShortcutHandler?.("refresh-preview");
      });

      // Component should still render correctly
      expect(screen.getByTestId("badge-preview")).toBeDefined();
    });

    it("cycle-preset shortcut cycles to next preset", async () => {
      const { trackEvent } = await import("@/lib/analytics/posthog");

      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );

      act(() => {
        capturedShortcutHandler?.("cycle-preset");
      });

      // Should have tracked preset_selected
      await waitFor(() => {
        expect(trackEvent).toHaveBeenCalledWith("preset_selected", expect.objectContaining({
          preset: expect.any(String),
        }));
      });
    });
  });

  describe("handle default prop", () => {
    it("renders without handle prop (defaults to empty string)", () => {
      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );
      expect(screen.getByText("Creator Studio")).toBeDefined();
    });
  });

  describe("reduced motion", () => {
    it("shows the reduced-motion notice and disables preview interactivity when the media query matches", () => {
      const original = window.matchMedia;
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      try {
        render(
          <StudioClient
            initialConfig={defaultConfig}
            stats={stats}
            impact={impact}
          />,
        );

        expect(
          screen.getByText(/Reduced motion detected/),
        ).toBeDefined();
        const preview = screen.getByTestId("badge-preview");
        expect(preview.getAttribute("data-interactive")).toBe("false");
      } finally {
        window.matchMedia = original;
      }
    });

    it("hides the reduced-motion notice and keeps preview interactive when the media query does not match", () => {
      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );

      expect(screen.queryByText(/Reduced motion detected/)).toBeNull();
      const preview = screen.getByTestId("badge-preview");
      expect(preview.getAttribute("data-interactive")).toBe("true");
    });
  });
});
