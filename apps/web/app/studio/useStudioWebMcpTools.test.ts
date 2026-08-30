// @vitest-environment jsdom

import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BADGE_CONFIG,
  TIER_THRESHOLDS,
  type BadgeConfig,
  type CraftResult,
  type ImpactV6Result,
} from "@chapa/shared";
import type { CommandResult } from "@/components/terminal/command-registry";
import { DEMO_IMPACT, DEMO_STATS } from "@/lib/render/demoData";
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
  config?: BadgeConfig;
  impact?: ImpactV6Result;
  craftResult?: CraftResult | null;
  saveStatus?: "dirty" | "saving" | "saved" | "error";
  enabled?: boolean;
}) {
  const runCommand = makeRunCommand();
  const proposeSave = vi.fn();
  const config = overrides?.config ?? { ...DEFAULT_BADGE_CONFIG };
  const impact = overrides?.impact ?? DEMO_IMPACT;
  const { result } = renderHook(() =>
    useStudioWebMcpTools({
      config,
      stats: DEMO_STATS,
      impact,
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
  return { tools: result.current, getTool, runCommand, proposeSave, config };
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
      impact: DEMO_IMPACT,
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
    const scoreProperty = { type: "number", minimum: 0, maximum: 100 };
    expect(getTool("simulate_score").inputSchema).toEqual({
      type: "object",
      properties: {
        dimensions: {
          type: "object",
          properties: {
            delivery: scoreProperty,
            quality: scoreProperty,
            consistency: scoreProperty,
            breadth: scoreProperty,
            craft: scoreProperty,
          },
          additionalProperties: false,
        },
      },
      required: ["dimensions"],
      additionalProperties: false,
    });
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

    expect(payload.categories).toHaveLength(6);
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

  it("only proposes saves and never runs a command or fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { getTool, runCommand, proposeSave } = setup();

    await expect(execute(getTool("save_badge_config"))).resolves.toBe(
      "Save proposed — the user must confirm on-page.",
    );
    expect(proposeSave).toHaveBeenCalledOnce();
    expect(runCommand).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("simulates a fixed score from merged dimensions and current confidence", async () => {
    const { getTool } = setup();

    const payload = JSON.parse(
      await execute(getTool("simulate_score"), {
        dimensions: { delivery: 0 },
      }),
    );

    expect(payload).toEqual({
      composite: 58,
      adjusted: 57,
      tier: "Solid",
      deltaVsCurrent: -25,
    });
  });

  it.each([
    [TIER_THRESHOLDS.S, "Elite"],
    [TIER_THRESHOLDS.A, "High"],
    [TIER_THRESHOLDS.C, "Solid"],
    [TIER_THRESHOLDS.C - 1, "Emerging"],
  ] as const)("uses shared tier boundary %i for %s", async (score, tier) => {
    const impact: ImpactV6Result = {
      ...DEMO_IMPACT,
      confidence: 100,
      dimensions: {
        delivery: 0,
        quality: 0,
        consistency: 0,
        breadth: 0,
        craft: 0,
      },
      adjustedComposite: 0,
    };
    const { getTool } = setup({ impact });

    const payload = JSON.parse(
      await execute(getTool("simulate_score"), {
        dimensions: {
          delivery: score,
          quality: score,
          consistency: score,
          breadth: score,
          craft: score,
        },
      }),
    );

    expect(payload).toMatchObject({ composite: score, adjusted: score, tier });
  });

  it("uses solo dimension keys and safely rejects invalid score inputs", async () => {
    const soloImpact: ImpactV6Result = {
      ...DEMO_IMPACT,
      profileType: "solo",
      confidence: 100,
      dimensions: {
        delivery: 40,
        quality: 100,
        consistency: 40,
        breadth: 40,
      },
      adjustedComposite: 40,
    };
    const { getTool } = setup({ impact: soloImpact });

    const solo = JSON.parse(
      await execute(getTool("simulate_score"), {
        dimensions: { quality: 0 },
      }),
    );
    expect(solo.composite).toBe(40);

    for (const dimensions of [
      { delivery: 101 },
      { delivery: Number.NaN },
      { unknown: 50 },
    ]) {
      await expect(
        execute(getTool("simulate_score"), { dimensions }),
      ).resolves.toContain("Invalid input");
    }
  });

  it("serializes grounded improvement suggestions", async () => {
    const { getTool } = setup();

    const insights = JSON.parse(await execute(getTool("suggest_improvements")));

    expect(insights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "next-tier", type: "next-tier" }),
      ]),
    );
  });

  it("explains valid dimensions with translated copy and existing submetrics", async () => {
    const { getTool } = setup();

    const explanation = JSON.parse(
      await execute(getTool("explain_dimension"), { dimension: "delivery" }),
    );

    expect(explanation).toMatchObject({
      dimension: "delivery",
      score: DEMO_IMPACT.dimensions.delivery,
      tip: expect.stringContaining("Measures shipping output"),
      formula: expect.stringContaining("70% PR weight"),
    });
    expect(explanation.subMetrics.map((metric: { key: string }) => metric.key)).toEqual([
      "prWeight",
      "issues",
      "commits",
    ]);

    await expect(
      execute(getTool("explain_dimension"), { dimension: "unknown" }),
    ).resolves.toContain("Invalid input");
  });

  it("explains Craft with the materialized non-zero submetrics", async () => {
    const { getTool } = setup({ craftResult });

    const explanation = JSON.parse(
      await execute(getTool("explain_dimension"), { dimension: "craft" }),
    );

    expect(
      explanation.subMetrics.map(
        (metric: { normalizedValue: number }) => metric.normalizedValue,
      ),
    ).toEqual([0.91, 0.72, 0.83]);
    expect(explanation.subMetrics[0].rawLabel).toContain("91");
  });

  it("preserves a useful Craft explanation before Craft data exists", async () => {
    const impact: ImpactV6Result = {
      ...DEMO_IMPACT,
      dimensions: {
        delivery: 88,
        quality: 72,
        consistency: 80,
        breadth: 65,
      },
    };
    const { getTool } = setup({ impact, craftResult: null });

    const explanation = JSON.parse(
      await execute(getTool("explain_dimension"), { dimension: "craft" }),
    );

    expect(explanation.score).toBeNull();
    expect(
      explanation.subMetrics.map(
        (metric: { normalizedValue: number }) => metric.normalizedValue,
      ),
    ).toEqual([0, 0, 0]);
  });
});
