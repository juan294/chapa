import { describe, expect, it } from "vitest";
import { DEMO_IMPACT, DEMO_STATS } from "@/lib/render/demoData";
import { en } from "@/lib/i18n/dictionaries/en";
import { resolveTranslation } from "@/lib/i18n/resolve";
import type { LanguageContextValue } from "@/lib/i18n";
import { createExplainDimensionTool } from "./shared-tools";

const t: LanguageContextValue["t"] = (key) =>
  resolveTranslation(key, en) as ReturnType<LanguageContextValue["t"]>;

describe("shared WebMCP tools", () => {
  it("builds a read-only dimension tool from public-safe props", async () => {
    const tool = createExplainDimensionTool({
      impact: DEMO_IMPACT,
      stats: DEMO_STATS,
      craftResult: null,
      t,
    });

    expect(tool.name).toBe("explain_dimension");
    expect(tool.annotations).toEqual({ readOnlyHint: true });
    expect(tool.inputSchema).toEqual({
      type: "object",
      properties: {
        dimension: { type: "string", enum: ["delivery", "quality", "consistency", "breadth", "craft"] },
      },
      required: ["dimension"],
      additionalProperties: false,
    });

    const result = JSON.parse(
      await tool.execute(
        { dimension: "delivery" },
        { signal: new AbortController().signal },
      ),
    );
    expect(result).toMatchObject({
      dimension: "delivery",
      score: DEMO_IMPACT.dimensions.delivery,
      tip: expect.any(String),
      formula: expect.any(String),
    });
    expect(result.subMetrics).toHaveLength(3);
  });

  it("returns friendly validation text for an unknown dimension", async () => {
    const tool = createExplainDimensionTool({
      impact: DEMO_IMPACT,
      stats: DEMO_STATS,
      t,
    });

    await expect(
      Promise.resolve(tool.execute(
        { dimension: "velocity" },
        { signal: new AbortController().signal },
      )),
    ).resolves.toBe(
      "Invalid input for explain_dimension: dimension must be a known dimension.",
    );
  });
});
