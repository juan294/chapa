// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ClientImpactV6Result } from "@chapa/shared";
import { DEMO_IMPACT, DEMO_STATS } from "@/lib/render/demoData";
import type { WebMcpTool } from "@/lib/webmcp/use-model-context-tools";
import { SharePageWebMcpTools } from "./SharePageWebMcpTools";

const mocks = vi.hoisted(() => ({
  useModelContextTools: vi.fn(),
  useClientFeatureFlags: vi.fn(),
  createExplainDimensionTool: vi.fn(),
}));

vi.mock("@/lib/webmcp/use-model-context-tools", () => ({
  useModelContextTools: (...args: unknown[]) =>
    mocks.useModelContextTools(...args),
}));

vi.mock("@/components/ClientFeatureFlagsProvider", () => ({
  useClientFeatureFlags: () => mocks.useClientFeatureFlags(),
}));

vi.mock("@/lib/webmcp/shared-tools", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/webmcp/shared-tools")>();
  return {
    ...actual,
    createExplainDimensionTool: (
      ...args: Parameters<typeof actual.createExplainDimensionTool>
    ) => {
      mocks.createExplainDimensionTool(...args);
      return actual.createExplainDimensionTool(...args);
    },
  };
});

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const impact: ClientImpactV6Result = {
  handle: DEMO_IMPACT.handle,
  profileType: DEMO_IMPACT.profileType,
  dimensions: DEMO_IMPACT.dimensions,
  archetype: DEMO_IMPACT.archetype,
  compositeScore: DEMO_IMPACT.compositeScore,
  adjustedComposite: DEMO_IMPACT.adjustedComposite,
  tier: DEMO_IMPACT.tier,
  computedAt: DEMO_IMPACT.computedAt,
};
const verification = { hash: "abc12345", date: "2026-08-27" };

function renderHost(
  overrides: Partial<React.ComponentProps<typeof SharePageWebMcpTools>> = {},
) {
  render(
    <SharePageWebMcpTools
      handle="developer"
      impact={impact}
      stats={DEMO_STATS}
      verification={verification}
      trend={null}
      diff={null}
      craftResult={null}
      {...overrides}
    />,
  );

  const [tools, enabled] = mocks.useModelContextTools.mock.calls.at(-1) as [
    WebMcpTool[],
    boolean,
  ];
  return {
    tools,
    enabled,
    getTool(name: string) {
      const tool = tools.find((candidate) => candidate.name === name);
      if (!tool) throw new Error(`Missing tool ${name}`);
      return tool;
    },
  };
}

async function execute(
  tool: WebMcpTool,
  inputs: Record<string, unknown> = {},
) {
  const controller = new AbortController();
  return {
    output: await tool.execute(inputs, { signal: controller.signal }),
    signal: controller.signal,
  };
}

function respondWith(body: unknown, status = 200) {
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
  mocks.useClientFeatureFlags.mockReturnValue({ webmcpEnabled: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SharePageWebMcpTools", () => {
  it("registers exactly five read-only tools behind the WebMCP flag", () => {
    const { tools, enabled } = renderHost();

    expect(enabled).toBe(true);
    expect(tools.map((tool) => tool.name)).toEqual([
      "get_impact_profile",
      "get_impact_history",
      "verify_badge",
      "explain_dimension",
      "compare_profiles",
    ]);
    expect(tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(
      true,
    );
    expect(mocks.createExplainDimensionTool).toHaveBeenCalledOnce();
  });

  it("passes the disabled feature flag to registration", () => {
    mocks.useClientFeatureFlags.mockReturnValue({ webmcpEnabled: false });

    const { enabled } = renderHost();

    expect(enabled).toBe(false);
    expect(mocks.useModelContextTools).toHaveBeenCalledWith([], false);
  });

  it("returns the redacted on-page profile and freshness without fetching", async () => {
    const trend = { direction: "improving", avgDelta: 2 } as never;
    const diff = { adjustedComposite: 3 } as never;
    const { getTool } = renderHost({ trend, diff });

    const { output } = await execute(getTool("get_impact_profile"));
    const result = JSON.parse(output);

    expect(result).toMatchObject({
      handle: "developer",
      impact: {
        adjustedComposite: DEMO_IMPACT.adjustedComposite,
        dimensions: DEMO_IMPACT.dimensions,
      },
      stats: {
        commitsTotal: DEMO_STATS.commitsTotal,
        prsMergedCount: DEMO_STATS.prsMergedCount,
      },
      verification,
      trend,
      diff,
      freshness: {
        source: "current page render",
        statsFetchedAt: DEMO_STATS.fetchedAt,
        impactComputedAt: DEMO_IMPACT.computedAt,
      },
    });
    expect(result.impact).not.toHaveProperty("confidence");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches impact history from the exact public endpoint with cancellation", async () => {
    respondWith({ handle: "developer", snapshots: [], trend: null });
    const { getTool } = renderHost();

    const { output, signal } = await execute(getTool("get_impact_history"));

    expect(JSON.parse(output)).toEqual({
      handle: "developer",
      snapshots: [],
      trend: null,
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/history/developer?include=snapshots,trend",
      { signal },
    );
  });

  it.each([
    [404, "No impact history was found for @developer."],
    [429, "Impact history is temporarily rate limited. Please try again later."],
  ])("returns a friendly history response for HTTP %i", async (status, message) => {
    respondWith({ error: "request failed" }, status);
    const { getTool } = renderHost();

    await expect(execute(getTool("get_impact_history"))).resolves.toMatchObject({
      output: message,
    });
  });

  it("does not fetch when the page has no verification record", async () => {
    const { getTool } = renderHost({ verification: null });

    await expect(execute(getTool("verify_badge"))).resolves.toMatchObject({
      output: "This profile has no verification record yet.",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns the live verification status, record, and verify URL", async () => {
    const record = { handle: "developer", adjustedComposite: 82 };
    respondWith({
      status: "verified",
      data: record,
      verifyUrl: "https://chapa.test/verify/abc12345",
    });
    const { getTool } = renderHost();

    const { output, signal } = await execute(getTool("verify_badge"));

    expect(JSON.parse(output)).toEqual({
      status: "verified",
      record,
      verifyUrl: "https://chapa.test/verify/abc12345",
    });
    expect(fetch).toHaveBeenCalledWith("/api/verify/abc12345", { signal });
  });

  it("validates compare input before fetching", async () => {
    const { getTool } = renderHost();

    await expect(
      execute(getTool("compare_profiles"), { other_handle: "bad/handle" }),
    ).resolves.toMatchObject({
      output: expect.stringContaining("Invalid input for compare_profiles"),
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("compares the page profile with a public profile using numeric deltas", async () => {
    respondWith({
      handle: "other-user",
      dimensions: {
        delivery: 90,
        quality: 70,
        consistency: 85,
        breadth: 60,
        craft: 80,
      },
      adjustedComposite: 70,
      displayScore: 79,
      tier: "High",
      displayTier: "High",
    });
    const { getTool } = renderHost();

    const { output, signal } = await execute(getTool("compare_profiles"), {
      other_handle: "other-user",
    });
    const result = JSON.parse(output);

    expect(result).toMatchObject({
      current: {
        handle: "developer",
        score: DEMO_IMPACT.adjustedComposite,
        dimensions: DEMO_IMPACT.dimensions,
      },
      other: {
        handle: "other-user",
        score: 79,
      },
      differences: {
        score: 79 - DEMO_IMPACT.adjustedComposite,
        dimensions: {
          delivery: 90 - DEMO_IMPACT.dimensions.delivery,
          quality: 70 - DEMO_IMPACT.dimensions.quality,
          consistency: 85 - DEMO_IMPACT.dimensions.consistency,
          breadth: 60 - DEMO_IMPACT.dimensions.breadth,
          craft: 80 - DEMO_IMPACT.dimensions.craft!,
        },
      },
    });
    expect(fetch).toHaveBeenCalledWith("/api/profile/other-user", { signal });
  });

  it.each([
    [404, "No public impact profile was found for @other-user."],
    [429, "Profile comparison is temporarily rate limited. Please try again later."],
  ])("returns a friendly compare response for HTTP %i", async (status, message) => {
    respondWith({ error: "request failed" }, status);
    const { getTool } = renderHost();

    await expect(
      execute(getTool("compare_profiles"), { other_handle: "other-user" }),
    ).resolves.toMatchObject({ output: message });
  });
});
