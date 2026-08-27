// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import { useState } from "react";
import { LanguageContext, type LanguageContextValue } from "@/lib/i18n";
import { en } from "@/lib/i18n/dictionaries/en";
import { es } from "@/lib/i18n/dictionaries/es";
import { resolveTranslation } from "@/lib/i18n/resolve";

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

const previewLifecycle = vi.hoisted(() => ({ nextInstanceId: 0 }));

interface StudioWebMcpOptionsCapture {
  craftResult?: unknown;
  runCommand: (input: string) => unknown;
  proposeSave: () => void;
}

const studioWebMcpMocks = vi.hoisted(() => ({
  options: null as StudioWebMcpOptionsCapture | null,
  useModelContextTools: vi.fn(),
}));

vi.mock("./useStudioWebMcpTools", () => ({
  useStudioWebMcpTools: (options: StudioWebMcpOptionsCapture) => {
    studioWebMcpMocks.options = options;
    return [];
  },
}));

vi.mock("@/lib/webmcp/use-model-context-tools", () => ({
  useModelContextTools: studioWebMcpMocks.useModelContextTools,
}));

vi.mock("@/components/ClientFeatureFlagsProvider", () => ({
  useClientFeatureFlags: () => ({ webmcpEnabled: true }),
}));

vi.mock("./BadgePreviewCard", () => ({
  BadgePreviewCard: ({
    config,
    interactive,
    verification,
  }: {
    config: Record<string, unknown>;
    interactive: boolean;
    verification?: { hash: string; date: string } | null;
  }) => {
    const [instanceId] = useState(() => ++previewLifecycle.nextInstanceId);
    return (
      <div
        data-testid="badge-preview"
        data-instance-id={instanceId}
        data-interactive={String(interactive)}
        data-verification={verification ? `${verification.hash}:${verification.date}` : "none"}
      >
        {JSON.stringify(config)}
      </div>
    );
  },
}));

vi.mock("./QuickControls", () => ({
  QuickControls: ({
    onCommand,
    visible,
    onToggle,
    saveDisabled,
    agentSaveProposal,
  }: {
    onCommand: (cmd: string) => void;
    visible: boolean;
    onToggle: () => void;
    saveDisabled?: boolean;
    agentSaveProposal?: {
      onConfirm: () => void;
      onDismiss: () => void;
    };
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
      <button
        data-testid="qc-save"
        disabled={saveDisabled}
        onClick={() => onCommand("/save")}
      >
        /save
      </button>
      {agentSaveProposal && (
        <div>
          <span>An agent wants to save this preview configuration.</span>
          <button data-testid="agent-save-confirm" onClick={agentSaveProposal.onConfirm}>
            Confirm save
          </button>
          <button data-testid="agent-save-dismiss" onClick={agentSaveProposal.onDismiss}>
            Dismiss
          </button>
        </div>
      )}
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
  TerminalOutput: ({ lines }: { lines: Array<{ id: string; text: string }> }) => (
    <div data-testid="terminal-output" role="log">
      {lines.length} lines
      {lines.map((line) => (
        <span key={line.id}>{line.text}</span>
      ))}
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

import { parseRetryAfterSeconds, StudioClient } from "./StudioClient";
import type {
  BadgeConfig,
  CraftResult,
  StatsData,
  ImpactV6Result,
} from "@chapa/shared";

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

const craftResult: CraftResult = {
  tool: "claude-code",
  dimensions: { proficiency: 91, effectiveness: 72, sophistication: 83 },
  craftScore: 82,
  tier: "Expert",
  reportPeriod: { start: "2026-08-01", end: "2026-08-27" },
  computedAt: "2026-08-27T00:00:00.000Z",
};

function languageValue(
  locale: "en" | "es",
): LanguageContextValue {
  const dictionary = locale === "es" ? es : en;
  return {
    locale,
    setLocale: async () => {},
    t: (key) =>
      resolveTranslation(key, dictionary) as ReturnType<
        LanguageContextValue["t"]
      >,
  };
}

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

    it("forwards materialized Craft data to the Studio WebMCP tools", () => {
      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
          craftResult={craftResult}
        />,
      );

      expect(studioWebMcpMocks.options?.craftResult).toBe(craftResult);
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
    it("shows a persistent demo marker only in demo mode", () => {
      const { rerender } = render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
          demo
        />,
      );

      expect(screen.getByTestId("studio-demo-marker").textContent).toBe("DEMO");

      rerender(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );

      expect(screen.queryByTestId("studio-demo-marker")).toBeNull();
    });

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

    it("forwards verification to BadgePreviewCard", () => {
      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
          verification={{ hash: "abc123", date: "2026-08-26" }}
        />,
      );

      expect(screen.getByTestId("badge-preview").getAttribute("data-verification")).toBe(
        "abc123:2026-08-26",
      );
    });

    it("updates ordinary configuration without remounting the preview", async () => {
      const { executeCommand } = await import(
        "@/components/terminal/command-registry"
      );
      vi.mocked(executeCommand).mockReturnValue({
        lines: [{ id: "set-background", type: "success", text: "Changed" }],
        action: { type: "set", category: "background", value: "aurora" },
      });

      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );
      const initialInstanceId = screen
        .getByTestId("badge-preview")
        .getAttribute("data-instance-id");

      fireEvent.click(screen.getByTestId("qc-command"));

      const preview = screen.getByTestId("badge-preview");
      expect(preview.textContent).toContain('"background":"aurora"');
      expect(preview.getAttribute("data-instance-id")).toBe(initialInstanceId);
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

    it("preserves config and terminal history when the locale changes", async () => {
      const { executeCommand } = await import(
        "@/components/terminal/command-registry"
      );
      vi.mocked(executeCommand).mockReturnValue({
        lines: [{ id: "locale-set", type: "system", text: "Changed" }],
        action: { type: "set", category: "background", value: "aurora" },
      });

      const { rerender } = render(
        <LanguageContext.Provider value={languageValue("es")}>
          <StudioClient initialConfig={defaultConfig} stats={stats} impact={impact} />
        </LanguageContext.Provider>,
      );
      expect(screen.getByTestId("terminal-output").textContent).toContain(
        "Creator Studio — personaliza la vista previa de tu Chapa",
      );
      const input = screen.getByLabelText("Terminal command input");
      fireEvent.change(input, { target: { value: "/set bg aurora" } });
      fireEvent.keyDown(input, { key: "Enter" });

      rerender(
        <LanguageContext.Provider value={languageValue("en")}>
          <StudioClient initialConfig={defaultConfig} stats={stats} impact={impact} />
        </LanguageContext.Provider>,
      );

      const output = screen.getByTestId("terminal-output");
      expect(screen.getByTestId("badge-preview").textContent).toContain(
        '"background":"aurora"',
      );
      expect(output.textContent).toContain("4 lines");
      expect(output.textContent).toContain(
        "Creator Studio — customize your badge preview",
      );
      expect(output.textContent).toContain(
        "Type /help for commands or use Quick Controls.",
      );
      expect(output.textContent).not.toContain(
        "Creator Studio — personaliza la vista previa de tu Chapa",
      );
      expect(screen.getByText("Unsaved preview changes")).toBeDefined();
    });
  });

  describe("terminal input interactions", () => {
    it("returns the same command result that it renders for WebMCP callers", async () => {
      const { executeCommand } = await import(
        "@/components/terminal/command-registry"
      );
      const commandResult = {
        lines: [{ id: "agent-command", type: "success" as const, text: "Applied" }],
      };
      vi.mocked(executeCommand).mockReturnValue(commandResult);

      render(
        <StudioClient initialConfig={defaultConfig} stats={stats} impact={impact} />,
      );

      let returned: unknown;
      act(() => {
        returned = studioWebMcpMocks.options?.runCommand("/status");
      });

      expect(returned).toBe(commandResult);
      expect(screen.getByTestId("terminal-output").textContent).toContain(
        "Applied",
      );
      expect(studioWebMcpMocks.useModelContextTools).toHaveBeenCalledWith(
        [],
        true,
      );
    });

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
    it("keeps a confirmed agent save local in demo mode", async () => {
      const { trackEvent } = await import("@/lib/analytics/posthog");
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
          demo
        />,
      );

      act(() => studioWebMcpMocks.options?.proposeSave());
      expect(fetchSpy).not.toHaveBeenCalled();

      fireEvent.click(screen.getByTestId("agent-save-confirm"));

      expect(
        await screen.findByText("(demo) configuration not persisted"),
      ).toBeDefined();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(screen.queryByTestId("agent-save-confirm")).toBeNull();
      expect(trackEvent).toHaveBeenCalledWith("config_saved", {
        config: defaultConfig,
        demo: true,
      });
    });

    it("arms an on-page gate and does not save until the user confirms", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("{}", { status: 200 }));
      render(
        <StudioClient initialConfig={defaultConfig} stats={stats} impact={impact} />,
      );

      act(() => studioWebMcpMocks.options?.proposeSave());

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(screen.getByTestId("quick-controls").getAttribute("data-visible")).toBe(
        "true",
      );
      expect(
        screen.getByText("Agent proposed saving — confirm below."),
      ).toBeDefined();
      expect(
        screen.getByText("An agent wants to save this preview configuration."),
      ).toBeDefined();

      fireEvent.click(screen.getByTestId("agent-save-confirm"));

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          "/api/studio/config",
          expect.objectContaining({ method: "PUT" }),
        );
      });
      expect(screen.queryByTestId("agent-save-confirm")).toBeNull();
    });

    it("dismisses an agent save proposal without persisting", () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      render(
        <StudioClient initialConfig={defaultConfig} stats={stats} impact={impact} />,
      );

      act(() => studioWebMcpMocks.options?.proposeSave());
      fireEvent.click(screen.getByTestId("agent-save-dismiss"));

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(screen.queryByTestId("agent-save-dismiss")).toBeNull();
      expect(
        screen.getByText("Agent save proposal dismissed."),
      ).toBeDefined();
    });

    it("parses numeric and HTTP-date Retry-After values", () => {
      const now = Date.parse("2026-08-26T10:00:00Z");
      expect(parseRetryAfterSeconds("90", now)).toBe(90);
      expect(
        parseRetryAfterSeconds("Wed, 26 Aug 2026 10:01:30 GMT", now),
      ).toBe(90);
      expect(parseRetryAfterSeconds("not-a-delay", now)).toBeNull();
    });

    it("moves from saved to dirty when the config changes", async () => {
      const { executeCommand } = await import(
        "@/components/terminal/command-registry"
      );
      vi.mocked(executeCommand).mockReturnValue({
        lines: [{ id: "dirty-1", type: "system", text: "Changed" }],
        action: { type: "set", category: "background", value: "aurora" },
      });

      render(
        <StudioClient initialConfig={defaultConfig} stats={stats} impact={impact} />,
      );
      expect(screen.getByText("Preview saved")).toBeDefined();

      const input = screen.getByLabelText("Terminal command input");
      fireEvent.change(input, { target: { value: "/set bg aurora" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(await screen.findByText("Unsaved preview changes")).toBeDefined();
    });

    it("does not mark an unchanged value dirty", async () => {
      const { executeCommand } = await import(
        "@/components/terminal/command-registry"
      );
      vi.mocked(executeCommand).mockReturnValue({
        lines: [{ id: "same-1", type: "system", text: "Unchanged" }],
        action: { type: "set", category: "background", value: "solid" },
      });

      render(
        <StudioClient initialConfig={defaultConfig} stats={stats} impact={impact} />,
      );
      const input = screen.getByLabelText("Terminal command input");
      fireEvent.change(input, { target: { value: "/set bg solid" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(screen.getByText("Preview saved")).toBeDefined();
      expect(screen.queryByText("Unsaved preview changes")).toBeNull();
    });

    it("shows saving indicator during save", async () => {
      let resolveSave!: (response: Response) => void;
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
        () => new Promise<Response>((resolve) => { resolveSave = resolve; }),
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
        expect(screen.getAllByText("Saving...")).toHaveLength(2);
      });

      const previewPane = screen.getByTestId("badge-preview").closest("[aria-busy]");
      expect(previewPane?.getAttribute("aria-busy")).toBe("true");

      resolveSave(new Response("{}", { status: 200 }));
      await waitFor(() => {
        expect(previewPane?.getAttribute("aria-busy")).toBe("false");
      });
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

    it("reports a rejected transport and keeps the config unsaved", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
      const { executeCommand } = await import(
        "@/components/terminal/command-registry"
      );
      vi.mocked(executeCommand).mockReturnValue({
        lines: [{ id: "save-network", type: "system", text: "Saving" }],
        action: { type: "save" },
      });

      render(
        <StudioClient initialConfig={defaultConfig} stats={stats} impact={impact} />,
      );
      fireEvent.click(screen.getByTestId("qc-save"));

      expect(
        await screen.findAllByText(
          "Could not reach the server. Your changes are still unsaved. Try again.",
        ),
      ).toHaveLength(2);
      expect(
        screen.getByTestId("badge-preview").textContent,
      ).toContain('"background":"solid"');
    });

    it("maps status and Retry-After into recoverable feedback", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("", {
          status: 429,
          headers: { "Retry-After": "90" },
        }),
      );
      const { executeCommand } = await import(
        "@/components/terminal/command-registry"
      );
      vi.mocked(executeCommand).mockReturnValue({
        lines: [{ id: "save-rate", type: "system", text: "Saving" }],
        action: { type: "save" },
      });

      render(
        <StudioClient initialConfig={defaultConfig} stats={stats} impact={impact} />,
      );
      fireEvent.click(screen.getByTestId("qc-save"));

      expect(
        await screen.findAllByText(
          "Too many save attempts. Your changes are still unsaved. Try again in 90 seconds.",
        ),
      ).toHaveLength(2);
    });

    it.each([
      [400, "This configuration is invalid. Change an option or reset it, then try again."],
      [401, "Your session expired. Sign in again, then try again."],
      [404, "Creator Studio is unavailable. Your changes are still unsaved."],
      [503, "Storage is temporarily unavailable. Your changes are still unsaved."],
      [500, "Could not save (server status 500). Your changes are still unsaved. Try again."],
    ])("maps a %i response to status-specific feedback", async (status, message) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("", { status }),
      );
      const { executeCommand } = await import(
        "@/components/terminal/command-registry"
      );
      vi.mocked(executeCommand).mockReturnValue({
        lines: [{ id: `save-${status}`, type: "system", text: "Saving" }],
        action: { type: "save" },
      });

      render(
        <StudioClient initialConfig={defaultConfig} stats={stats} impact={impact} />,
      );
      fireEvent.click(screen.getByTestId("qc-save"));

      expect((await screen.findByRole("alert")).textContent).toBe(message);
    });

    it("prevents overlapping saves from the button", async () => {
      let resolveSave!: (response: Response) => void;
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
        () => new Promise<Response>((resolve) => { resolveSave = resolve; }),
      );
      const { executeCommand } = await import(
        "@/components/terminal/command-registry"
      );
      vi.mocked(executeCommand).mockReturnValue({
        lines: [{ id: "save-single", type: "system", text: "Saving" }],
        action: { type: "save" },
      });

      render(
        <StudioClient initialConfig={defaultConfig} stats={stats} impact={impact} />,
      );
      const save = screen.getByTestId("qc-save");
      fireEvent.click(save);
      fireEvent.click(save);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(save.hasAttribute("disabled")).toBe(true);
      resolveSave(new Response("{}", { status: 200 }));
      await screen.findByText(
        "Preview configuration saved. Your public badge and share page are unchanged.",
      );
    });

    it("prevents overlapping saves from repeated /save commands", async () => {
      let resolveSave!: (response: Response) => void;
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
        () => new Promise<Response>((resolve) => { resolveSave = resolve; }),
      );
      const { executeCommand } = await import(
        "@/components/terminal/command-registry"
      );
      let line = 0;
      vi.mocked(executeCommand).mockImplementation(() => ({
        lines: [{ id: `save-command-${++line}`, type: "system", text: "Saving" }],
        action: { type: "save" },
      }));

      render(
        <StudioClient initialConfig={defaultConfig} stats={stats} impact={impact} />,
      );
      const input = screen.getByLabelText("Terminal command input");
      fireEvent.change(input, { target: { value: "/save" } });
      fireEvent.keyDown(input, { key: "Enter" });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText("A save is already in progress.")).toBeDefined();
      resolveSave(new Response("{}", { status: 200 }));
      await screen.findByText(
        "Preview configuration saved. Your public badge and share page are unchanged.",
      );
    });

    it("does not mark newer edits saved when an older request finishes", async () => {
      let resolveSave!: (response: Response) => void;
      vi.spyOn(globalThis, "fetch").mockImplementation(
        () => new Promise<Response>((resolve) => { resolveSave = resolve; }),
      );
      const { executeCommand } = await import(
        "@/components/terminal/command-registry"
      );
      vi.mocked(executeCommand).mockReturnValue({
        lines: [{ id: "save-old", type: "system", text: "Saving" }],
        action: { type: "save" },
      });

      render(
        <StudioClient initialConfig={defaultConfig} stats={stats} impact={impact} />,
      );
      fireEvent.click(screen.getByTestId("qc-save"));

      vi.mocked(executeCommand).mockReturnValue({
        lines: [{ id: "set-new", type: "system", text: "Changed" }],
        action: { type: "set", category: "background", value: "aurora" },
      });
      const input = screen.getByLabelText("Terminal command input");
      fireEvent.change(input, { target: { value: "/set bg aurora" } });
      fireEvent.keyDown(input, { key: "Enter" });

      resolveSave(new Response("{}", { status: 200 }));
      expect(await screen.findByText("Unsaved preview changes")).toBeDefined();
      expect(screen.getByTestId("badge-preview").textContent).toContain(
        '"background":"aurora"',
      );
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

    it("marks demo telemetry without changing normal event properties", async () => {
      const { trackEvent } = await import("@/lib/analytics/posthog");
      const { executeCommand } = await import(
        "@/components/terminal/command-registry"
      );
      vi.mocked(executeCommand).mockReturnValue({
        lines: [{ id: "demo-change", type: "system", text: "Changed" }],
        action: { type: "set", category: "background", value: "aurora" },
      });

      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
          demo
        />,
      );
      expect(trackEvent).toHaveBeenCalledWith("studio_opened", { demo: true });

      fireEvent.click(screen.getByTestId("qc-command"));

      expect(trackEvent).toHaveBeenCalledWith("effect_changed", {
        category: "background",
        from: "solid",
        to: "aurora",
        demo: true,
      });
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

    it("refresh-preview shortcut explicitly remounts the preview", () => {
      render(
        <StudioClient
          initialConfig={defaultConfig}
          stats={stats}
          impact={impact}
        />,
      );

      const initialInstanceId = screen
        .getByTestId("badge-preview")
        .getAttribute("data-instance-id");

      act(() => {
        capturedShortcutHandler?.("refresh-preview");
      });

      expect(
        screen.getByTestId("badge-preview").getAttribute("data-instance-id"),
      ).not.toBe(initialInstanceId);
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
