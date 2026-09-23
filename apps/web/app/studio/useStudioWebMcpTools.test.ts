// @vitest-environment jsdom

import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BADGE_CONFIG,
  type BadgeConfig,
  type CraftResult,
  type StatsData,
} from "@chapa/shared";
import type { CommandResult } from "@/components/terminal/command-registry";
import { DEMO_STATS } from "@/lib/render/demoData";
import { WEBMCP_INVALID_INPUT_PREFIX } from "@/lib/webmcp/use-model-context-tools";
import { OBSERVED_SIMULATE_SCORE_INPUT_SCHEMA } from "@/lib/webmcp/catalog";
import type { ScoreViewModel } from "@/lib/profile/score-view-model";
import { makeScoring } from "@/lib/test-helpers/fixtures";
import { scoringConsistencyFixture } from "@/lib/profile/__fixtures__/scoring-consistency";
import type { StudioCommandAction } from "./useStudioCommands";
import { useStudioWebMcpTools } from "./useStudioWebMcpTools";

vi.mock("@/lib/env", () => ({
  getBaseUrl: () => "https://chapa.test",
}));

const TOOL_NAMES = [
  "list_style_options",
  "apply_badge_style",
  "apply_preset",
  "preview_badge",
  "reset_badge_config",
  "save_badge_config",
  "simulate_score",
  "suggest_improvements",
  "explain_dimension",
] as const;

const READ_ONLY_TOOLS = [
  "list_style_options",
  "preview_badge",
  "simulate_score",
  "suggest_improvements",
  "explain_dimension",
];

const craftResult: CraftResult = {
  tool: "claude-code",
  dimensions: {
    proficiency: 91,
    effectiveness: 72,
    sophistication: 83,
  },
  craftScore: 82,
  tier: "Expert",
  reportPeriod: { start: "2026-08-01", end: "2026-08-27" },
  computedAt: "2026-08-27T00:00:00.000Z",
};

function line(text: string) {
  return { id: `line-${text}`, type: "success" as const, text };
}

function makeRunCommand() {
  return vi.fn(
    (input: string): CommandResult<StudioCommandAction> => {
      if (input === "/set background aurora") {
        return {
          lines: [line("background → aurora")],
          action: { type: "set", category: "background", value: "aurora" },
        };
      }
      if (input === "/set palette ice") {
        return {
          lines: [line("colorPalette → ice")],
          action: { type: "set", category: "colorPalette", value: "ice" },
        };
      }
      if (input === "/preset premium") {
        return {
          lines: [line("Applied preset: Premium")],
          action: { type: "preset", name: "premium" },
        };
      }
      if (input === "/reset") {
        return {
          lines: [line("Configuration reset to defaults.")],
          action: { type: "reset" },
        };
      }
      return { lines: [line(`Rejected: ${input}`)] };
    },
  );
}

function setup(overrides?: {
  scoring?: ScoreViewModel;
  stats?: StatsData;
  config?: BadgeConfig;
  craftResult?: CraftResult | null;
  saveStatus?: "dirty" | "saving" | "saved" | "error";
  enabled?: boolean;
}) {
  const runCommand = makeRunCommand();
  const proposeSave = vi.fn();
  const config = overrides?.config ?? { ...DEFAULT_BADGE_CONFIG };
  const scoring = overrides?.scoring ?? makeScoring();
  const { result } = renderHook(() =>
    useStudioWebMcpTools({
      config,
      stats: overrides?.stats ?? { ...DEMO_STATS, heatmapData: [] },
      scoring,
      craftResult: overrides?.craftResult ?? null,
      handle: "dev user",
      enabled: overrides?.enabled ?? true,
      saveStatus: overrides?.saveStatus ?? "dirty",
      runCommand,
      proposeSave,
    }),
  );
  const getTool = (name: (typeof TOOL_NAMES)[number]) => {
    const tool = result.current.find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`Missing tool: ${name}`);
    return tool;
  };
  return { tools: result.current, getTool, runCommand, proposeSave, config, scoring };
}

async function execute(
  tool: ReturnType<ReturnType<typeof setup>["getTool"]>,
  inputs: Record<string, unknown> = {},
): Promise<string> {
  return tool.execute(inputs, { signal: new AbortController().signal });
}

function readCommandConfig(result: string): BadgeConfig {
  const snapshot = result.split("\n").at(-1);
  if (!snapshot) throw new Error("Command result has no config snapshot");
  return (JSON.parse(snapshot) as { config: BadgeConfig }).config;
}

describe("useStudioWebMcpTools", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns a memoized catalog with the nine planned names and annotations", () => {
    const options = {
      config: { ...DEFAULT_BADGE_CONFIG },
      stats: DEMO_STATS,
      scoring: makeScoring(),
      handle: "developer",
      enabled: true,
      saveStatus: "saved" as const,
      runCommand: makeRunCommand(),
      proposeSave: vi.fn(),
    };
    const { result, rerender } = renderHook(() => useStudioWebMcpTools(options));
    const first = result.current;

    expect(first.map((tool) => tool.name)).toEqual(TOOL_NAMES);
    for (const tool of first) {
      expect(tool.annotations).toEqual(
        READ_ONLY_TOOLS.includes(tool.name)
          ? { readOnlyHint: true }
          : undefined,
      );
    }

    rerender();
    expect(result.current).toBe(first);
  });

  it("applies Ice through the palette alias without saving or mutating the saved config", async () => {
    const { getTool, runCommand, proposeSave, config } = setup({
      config: { ...DEFAULT_BADGE_CONFIG, colorPalette: "jade" },
    });
    const response = await execute(getTool("apply_badge_style"), { category: "palette", value: "ice" });
    expect(runCommand).toHaveBeenCalledWith("/set palette ice");
    expect(readCommandConfig(response).colorPalette).toBe("ice");
    expect(config.colorPalette).toBe("jade");
    expect(proposeSave).not.toHaveBeenCalled();
  });

  it("does not build the catalog while the WebMCP kill-switch is off", () => {
    const { tools } = setup({ enabled: false });

    expect(tools).toEqual([]);
  });

  it("publishes the exact planned input schemas", () => {
    const { getTool } = setup();
    const emptySchema = {
      type: "object",
      properties: {},
      additionalProperties: false,
    };

    for (const name of [
      "list_style_options",
      "preview_badge",
      "reset_badge_config",
      "save_badge_config",
      "suggest_improvements",
    ] as const) {
      expect(getTool(name).inputSchema).toEqual(emptySchema);
    }
    expect(getTool("apply_badge_style").inputSchema).toEqual({
      type: "object",
      properties: {
        category: { type: "string" },
        value: { type: "string" },
      },
      required: ["category", "value"],
      additionalProperties: false,
    });
    expect(getTool("apply_badge_style").description).toContain(
      "Get valid categories and values from list_style_options first.",
    );
    expect(getTool("apply_preset").inputSchema).toEqual({
      type: "object",
      properties: {
        name: {
          type: "string",
          enum: ["minimal", "premium", "holographic", "maximum"],
        },
      },
      required: ["name"],
      additionalProperties: false,
    });
    // #1335 — v7.2 is the one scoring policy; simulate_score always uses the
    // evidence-count/dimension-scenario schema, never the retired
    // direct-dimension-override v6 shape.
    expect(getTool("simulate_score").inputSchema).toEqual(OBSERVED_SIMULATE_SCORE_INPUT_SCHEMA);
    expect(getTool("explain_dimension").inputSchema).toEqual({
      type: "object",
      properties: {
        dimension: {
          type: "string",
          enum: ["delivery", "quality", "consistency", "breadth", "craft"],
        },
      },
      required: ["dimension"],
      additionalProperties: false,
    });
  });

  it("serializes translated style metadata, aliases, presets, and current config", async () => {
    const { getTool, config } = setup();

    const payload = JSON.parse(await execute(getTool("list_style_options"))) as {
      categories: Array<{
        key: string;
        alias: string;
        label: string;
        options: Array<{ value: string; label: string; description: string }>;
      }>;
      presets: Array<{ name: string; label: string; config: BadgeConfig }>;
      currentConfig: BadgeConfig;
    };

    expect(payload.categories).toHaveLength(7);
    expect(payload.categories.find((category) => category.key === "colorPalette")?.options).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: "ice", label: "Ice Terminal" })]),
    );
    expect(payload.categories[0]).toMatchObject({
      key: "background",
      alias: "bg",
      label: "Background",
    });
    expect(payload.categories[0]!.options[1]).toEqual({
      value: "aurora",
      label: "Aurora Glow",
      description: "Animated color waves",
    });
    expect(payload.presets.map((preset) => preset.name)).toEqual([
      "minimal",
      "premium",
      "holographic",
      "maximum",
    ]);
    expect(payload.currentConfig).toEqual(config);
  });

  it("runs style, preset, and reset commands and returns derived post-action config", async () => {
    const customConfig: BadgeConfig = {
      ...DEFAULT_BADGE_CONFIG,
      border: "none",
    };
    const { getTool, runCommand } = setup({ config: customConfig });

    const styleResult = await execute(getTool("apply_badge_style"), {
      category: "background",
      value: "aurora",
    });
    expect(runCommand).toHaveBeenNthCalledWith(1, "/set background aurora");
    expect(styleResult).toContain("background → aurora");
    expect(readCommandConfig(styleResult)).toEqual({
      ...customConfig,
      background: "aurora",
    });

    const presetResult = await execute(getTool("apply_preset"), { name: "premium" });
    expect(runCommand).toHaveBeenNthCalledWith(2, "/preset premium");
    expect(readCommandConfig(presetResult)).toMatchObject({
      background: "aurora",
      cardStyle: "smoke",
      scoreEffect: "gold-leaf",
    });

    const resetResult = await execute(getTool("reset_badge_config"));
    expect(runCommand).toHaveBeenNthCalledWith(3, "/reset");
    expect(readCommandConfig(resetResult)).toEqual(DEFAULT_BADGE_CONFIG);
  });

  it("validates command inputs before constructing terminal commands", async () => {
    const { getTool, runCommand } = setup();

    await expect(
      execute(getTool("apply_badge_style"), { category: 42, value: "aurora" }),
    ).resolves.toContain("Invalid input");
    await expect(
      execute(getTool("apply_preset"), { name: "unknown" }),
    ).resolves.toContain("Invalid input");
    await expect(
      execute(getTool("apply_badge_style"), {
        category: "background",
        value: "aurora /save",
      }),
    ).resolves.toContain("Invalid input");
    const recoveryResult = await execute(getTool("apply_badge_style"), {
      category: "two words",
      value: "x",
    });
    expect(recoveryResult).toContain(WEBMCP_INVALID_INPUT_PREFIX);
    expect(recoveryResult).toContain("call list_style_options");
    expect(runCommand).not.toHaveBeenCalled();
  });

  it("previews the current config, badge URL, and save status", async () => {
    const { getTool, config } = setup({ saveStatus: "saving" });

    const payload = JSON.parse(await execute(getTool("preview_badge")));

    expect(payload).toEqual({
      config,
      badgeSvgUrl: "https://chapa.test/u/dev%20user/badge.svg",
      saveStatus: "saving",
    });
  });

  it.each([
    ["saved", "No unsaved changes. The current configuration is already saved."],
    [
      "saving",
      "A save is already in progress. Wait for it to finish, then check preview_badge for the save status.",
    ],
  ] as const)(
    "does not propose a save while the status is %s",
    async (saveStatus, message) => {
      const { getTool, proposeSave } = setup({ saveStatus });

      await expect(execute(getTool("save_badge_config"))).resolves.toBe(message);
      expect(proposeSave).not.toHaveBeenCalled();
    },
  );

  it.each(["dirty", "error"] as const)(
    "only proposes saves from the %s state and never runs a command or fetch",
    async (saveStatus) => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
      const { getTool, runCommand, proposeSave } = setup({ saveStatus });

      await expect(execute(getTool("save_badge_config"))).resolves.toBe(
        "Save proposed — the user must confirm on-page.",
      );
      expect(proposeSave).toHaveBeenCalledOnce();
      expect(runCommand).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it.each([
    [90, "Elite"],
    [75, "High"],
    [40, "Solid"],
    [10, "Emerging"],
  ] as const)("simulates a dimension scenario and applies the current v7.2 tier boundary %i", async (score, tier) => {
    // makeScoring()'s default composite is a 65-point baseline.
    const { getTool } = setup();

    const payload = JSON.parse(
      await execute(getTool("simulate_score"), {
        dimensions: { delivery: score, quality: score, consistency: score, breadth: score },
      }),
    );

    expect(payload).toMatchObject({
      hypothetical: true,
      policyVersion: "v7.2",
      scope: "dimension_scenario",
      displayScore: score,
      tier,
      deltaVsCurrent: score - 65,
    });
  });

  it("safely rejects invalid simulate_score scenarios", async () => {
    const { getTool } = setup();

    for (const inputs of [
      { dimensions: { delivery: 101 } },
      { dimensions: { delivery: Number.NaN } },
      { dimensions: { unknown: 50 } },
    ]) {
      await expect(
        execute(getTool("simulate_score"), inputs),
      ).resolves.toContain("Invalid input");
    }
  });

  it("serializes grounded improvement suggestions for the current v7.2 profile", async () => {
    const { getTool } = setup();

    const insights = JSON.parse(await execute(getTool("suggest_improvements")));

    expect(insights).toMatchObject({
      policyVersion: "v7.2",
      suggestions: expect.arrayContaining([expect.stringContaining("evidence")]),
    });
  });

  it("explains valid dimensions using the current v7.2 model", async () => {
    const { getTool } = setup();

    const explanation = JSON.parse(
      await execute(getTool("explain_dimension"), { dimension: "delivery" }),
    );

    expect(explanation).toMatchObject({
      policyVersion: "v7.2",
      dimension: "delivery",
      weight: 0.25,
    });

    await expect(
      execute(getTool("explain_dimension"), { dimension: "unknown" }),
    ).resolves.toContain("Invalid input");
  });

  it("explains craft as not yet reported when no report exists", async () => {
    const { getTool } = setup({ craftResult });

    const explanation = JSON.parse(
      await execute(getTool("explain_dimension"), { dimension: "craft" }),
    );

    expect(explanation).toMatchObject({ policyVersion: "v7.2", craft: { status: "no_report" } });
  });
});

it("Studio tools simulate and explain the selected receipt without legacy proficiency", async () => {
  const f = await scoringConsistencyFixture({ craft: 57 });
  const { getTool } = setup({ scoring: f.model, stats: f.stats });
  const simulation = JSON.parse(await execute(getTool("simulate_score"), { dimensions: { craft: 0 } }));
  expect(simulation).toMatchObject({ hypothetical: true, policyVersion: "v7.2", displayScore: 46, baselineRevision: f.model.identity!.revisionId });
  expect(JSON.parse(await execute(getTool("simulate_score"), { counts: {} }))).toMatchObject({ scope: "evidence_counts", displayScore: 46 });
  const explanation = JSON.parse(await execute(getTool("explain_dimension"), { dimension: "craft" }));
  expect(explanation).toMatchObject({ policyVersion: "v7.2", score: 57, craft: { status: "scored" } });
  expect(JSON.stringify(explanation)).not.toMatch(/proficiency|sophistication|Expert/);
  expect(await execute(getTool("suggest_improvements"))).not.toMatch(/points to|Master|Expert/);
});
