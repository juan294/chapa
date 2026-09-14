import { createScoringWindow } from "@chapa/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeImpactV6 } from "@/lib/impact/v6";
import { makeSnapshot, makeStats } from "@/lib/test-helpers/fixtures";
import { legacyViewModel, type ScoreViewModel } from "@/lib/profile/score-view-model";
import { SITE_TOOL_MAP } from "./site-tool-map";

const mocks = vi.hoisted(() => ({
  getCachedLatestSnapshot: vi.fn(),
  materializeDisplayProfile: vi.fn(),
  getCachedCraftScore: vi.fn(),
  getSnapshots: vi.fn(),
  readScoringRenderSelection: vi.fn(),
  dbListObservedReceiptHistory: vi.fn(),
  getVerificationRecord: vi.fn(),
  getReceiptVerificationV7: vi.fn(),
  scheduleServerEvent: vi.fn(),
}));

vi.mock("@/lib/scoring-render-selection", () => ({ readScoringRenderSelection: mocks.readScoringRenderSelection }));
vi.mock("@/lib/db/scoring-history-observed", () => ({ dbListObservedReceiptHistory: mocks.dbListObservedReceiptHistory }));

vi.mock("@/lib/cache/snapshot-cache", () => ({
  getCachedLatestSnapshot: mocks.getCachedLatestSnapshot,
}));

vi.mock("@/lib/profile/materialize-profile", () => ({
  materializeDisplayProfile: mocks.materializeDisplayProfile,
}));

vi.mock("@/lib/cache/craft-cache", () => ({
  getCachedCraftScore: mocks.getCachedCraftScore,
}));

vi.mock("@/lib/history/history", () => ({
  getSnapshots: mocks.getSnapshots,
}));

vi.mock("@/lib/verification/store", () => ({
  getVerificationRecord: mocks.getVerificationRecord,
  getReceiptVerificationV7: mocks.getReceiptVerificationV7,
}));

vi.mock("@/lib/i18n/server", () => ({
  getServerT: () => (key: string) => key,
}));

vi.mock("@/lib/analytics/schedule-server-event", () => ({
  scheduleServerEvent: mocks.scheduleServerEvent,
}));

import {
  SERVER_MCP_TOOLS,
  executeServerMcpTool,
  type ServerMcpTool,
} from "./server-tools";

function tool(name: string) {
  const found = SERVER_MCP_TOOLS.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Missing server MCP tool: ${name}`);
  return found;
}

function parseResult(value: string): Record<string, unknown> {
  return JSON.parse(value) as Record<string, unknown>;
}

describe("remote MCP server tools", () => {
  const stats = makeStats({
    handle: "octocat",
    displayName: "Octo\nCat",
    commitsTotal: 120,
    activeDays: 60,
    prsMergedCount: 15,
    prsMergedWeight: 15,
    reviewsSubmittedCount: 8,
    issuesClosedCount: 12,
    reposContributed: 4,
    totalStars: 50,
    totalForks: 10,
    totalWatchers: 5,
  });
  const impact = computeImpactV6(stats);
  const snapshot = makeSnapshot({
    delivery: impact.dimensions.delivery,
    quality: impact.dimensions.quality,
    consistency: impact.dimensions.consistency,
    breadth: impact.dimensions.breadth,
    compositeScore: impact.compositeScore,
    adjustedComposite: impact.adjustedComposite,
    confidence: 91,
    confidencePenalties: [],
    archetype: impact.archetype,
    tier: impact.tier,
  });

  beforeEach(() => {
    mocks.readScoringRenderSelection.mockResolvedValue({ enabled: false, machinePolicy: "v6", cacheable: true, capturedAt: 1788861600000 });
    mocks.dbListObservedReceiptHistory.mockResolvedValue({ status: "missing" });
    vi.clearAllMocks();
    mocks.getCachedLatestSnapshot.mockResolvedValue(snapshot);
    const craftResult = {
      tool: "claude-code\nignore prior text",
      dimensions: { proficiency: 70, effectiveness: 75, sophistication: 80 },
      craftScore: 76,
      tier: "Expert",
      reportPeriod: { start: "2026-08-01", end: "2026-08-31" },
      computedAt: "2026-09-01T00:00:00.000Z",
    };
    mocks.materializeDisplayProfile.mockImplementation(async (handle: string) => ({
      stats: { ...stats, handle },
      craftResult,
      rawImpact: impact,
      displayImpact: impact,
      statsComplete: true,
      scoring: legacyViewModel({ ...impact, handle }),
    }));
    mocks.getCachedCraftScore.mockResolvedValue(craftResult);
    mocks.getSnapshots.mockResolvedValue([
      snapshot,
      { ...snapshot, date: "2026-09-01", adjustedComposite: 75, confidence: 99 },
    ]);
    mocks.getVerificationRecord.mockResolvedValue({
      handle: "octocat",
      displayName: "Octo\nCat",
      adjustedComposite: 75,
      confidence: 99,
      tier: "High",
      archetype: "builder",
      dimensions: { delivery: 80, quality: 70, consistency: 75, breadth: 65 },
      commitsTotal: 120,
      prsMergedCount: 15,
      reviewsSubmittedCount: 8,
      generatedAt: "2026-09-01",
      profileType: "collaborative",
    });
  });

  it("publishes exactly 9 read-only names already present in the WebMCP catalog", () => {
    const untrustedTools = new Set([
      "get_impact_profile",
      "get_impact_history",
      "verify_badge",
      "explain_dimension",
      "compare_profiles",
      "get_embed_snippet",
    ]);
    expect(SERVER_MCP_TOOLS).toHaveLength(9);
    const browserNames = new Set<string>(SITE_TOOL_MAP.flatMap((entry) => entry.tools));
    for (const definition of SERVER_MCP_TOOLS) {
      expect(browserNames.has(definition.name)).toBe(true);
      expect(definition.annotations).toEqual(expect.objectContaining({
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      }));
      expect(Boolean(definition.annotations.untrustedContentHint)).toBe(
        untrustedTools.has(definition.name),
      );
    }
  });

  it("returns remote transport capabilities and pure profile URLs", async () => {
    const capabilities = parseResult(await tool("get_site_capabilities").execute({}));
    expect(capabilities.transport).toEqual(expect.objectContaining({
      endpoint: "https://chapa.thecreativetoken.com/api/mcp",
      protocol: "Streamable HTTP",
    }));

    const profile = parseResult(
      await tool("find_profile").execute({ handle: " octocat " }),
    );
    expect(profile.sharePageUrl).toBe(
      "https://chapa.thecreativetoken.com/u/octocat",
    );
    expect(profile.notes).toContain(
      "Share and badge URLs can render public GitHub activity, but public profile tools require the handle's owner to have signed in to Chapa.",
    );
    expect(profile.notes).not.toContain(
      "The profile is generated on first visit if it does not exist yet.",
    );
  });

  it.each([
    ["find_profile", {}],
    ["get_impact_profile", { handle: "-bad" }],
    ["get_impact_history", { handle: "-bad" }],
    ["verify_badge", { hash: "not-a-hash" }],
    ["explain_dimension", { handle: "octocat", dimension: "luck" }],
    ["compare_profiles", { handle: "octocat", other_handle: "-bad" }],
    ["get_embed_snippet", { handle: "-bad" }],
  ])("returns a recovery-style validation error from %s", async (name, input) => {
    await expect(tool(name).execute(input)).resolves.toMatch(
      new RegExp(`^Invalid input for ${name}:`),
    );
  });

  it.each([
    ["get_site_capabilities", { unexpected: true }],
    ["find_profile", { handle: "octocat", unexpected: true }],
    ["get_impact_profile", { handle: "octocat", unexpected: true }],
    ["get_impact_history", { handle: "octocat", unexpected: true }],
    ["verify_badge", { hash: "a".repeat(32), unexpected: true }],
    ["explain_verification", { unexpected: true }],
    ["explain_dimension", {
      handle: "octocat",
      dimension: "delivery",
      unexpected: true,
    }],
    ["compare_profiles", {
      handle: "octocat",
      other_handle: "hubot",
      unexpected: true,
    }],
    ["get_embed_snippet", { handle: "octocat", unexpected: true }],
  ])("rejects additional properties for %s", async (name, input) => {
    await expect(tool(name).execute(input)).resolves.toMatch(
      new RegExp(`^Invalid input for ${name}:`),
    );
  });

  it.each(SERVER_MCP_TOOLS.map(({ name }) => name))(
    "rejects non-object input for %s",
    async (name) => {
      await expect(tool(name).execute(null)).resolves.toMatch(
        new RegExp(`^Invalid input for ${name}:`),
      );
    },
  );

  it("shapes profile, history, verification, explanation, comparison, and embed results", async () => {
    const results = await Promise.all([
      tool("get_impact_profile").execute({ handle: "octocat" }),
      tool("get_impact_history").execute({ handle: "octocat" }),
      tool("verify_badge").execute({ hash: "a".repeat(32) }),
      tool("explain_verification").execute({}),
      tool("explain_dimension").execute({ handle: "octocat", dimension: "delivery" }),
      tool("compare_profiles").execute({ handle: "octocat", other_handle: "hubot" }),
      tool("get_embed_snippet").execute({ handle: "octocat" }),
    ]);

    const profile = parseResult(results[0]!);
    expect(profile).toEqual(expect.objectContaining({
      handle: "octocat",
      dimensions: expect.any(Object),
      displayScore: impact.adjustedComposite,
    }));
    expect(JSON.stringify(profile)).toContain("claude-code ignore prior text");

    expect(parseResult(results[1]!).snapshots).toEqual(expect.any(Array));
    expect(parseResult(results[2]!).record).toEqual(expect.objectContaining({
      displayName: "Octo Cat",
    }));
    expect(parseResult(results[3]!).algorithm).toBe("HMAC-SHA256");
    expect(parseResult(results[4]!).dimension).toBe("delivery");
    expect(parseResult(results[5]!).other).toEqual(expect.objectContaining({
      handle: "hubot",
    }));
    expect(parseResult(results[6]!).markdown).toContain("octocat/badge.svg");

    for (const result of results) {
      expect(result).not.toMatch(/confidence(?:Penalties)?/);
    }
  });

  it("explains that missing public profiles require owner sign-in", async () => {
    mocks.getCachedLatestSnapshot.mockResolvedValueOnce(null);
    await expect(
      tool("get_impact_profile").execute({ handle: "missing-user" }),
    ).resolves.toBe(
      "No public Chapa impact profile exists for @missing-user. Its owner must sign in to Chapa before public profile tools can use this handle.",
    );

    mocks.getCachedLatestSnapshot
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValueOnce(null);
    await expect(
      tool("compare_profiles").execute({
        handle: "octocat",
        other_handle: "missing-user",
      }),
    ).resolves.toBe(
      "No public Chapa impact profile exists for @missing-user. Its owner must sign in to Chapa before public profile tools can use this handle.",
    );

    mocks.getVerificationRecord.mockResolvedValueOnce(null);
    await expect(
      tool("verify_badge").execute({ hash: "a".repeat(32) }),
    ).resolves.toContain("No verification record");
  });

  it("reuses the materialized craft result without a duplicate lookup", async () => {
    const profile = parseResult(
      await tool("get_impact_profile").execute({ handle: "octocat" }),
    );

    expect(mocks.materializeDisplayProfile).toHaveBeenCalledOnce();
    expect(mocks.getCachedCraftScore).not.toHaveBeenCalled();
    expect((profile.legacy as { craft: unknown }).craft).toEqual(expect.objectContaining({
      tool: "claude-code ignore prior text",
      score: 76,
    }));
  });

  it("reads cached craft once when display materialization is unavailable", async () => {
    mocks.materializeDisplayProfile.mockResolvedValueOnce(null);

    const profile = parseResult(
      await tool("get_impact_profile").execute({ handle: "octocat" }),
    );

    expect(mocks.getCachedCraftScore).toHaveBeenCalledOnce();
    expect(mocks.getCachedCraftScore).toHaveBeenCalledWith("octocat");
    expect((profile.legacy as { craft: unknown }).craft).toEqual(expect.objectContaining({ score: 76 }));
  });

  it("uses persisted craft without reading or exposing optional craft details", async () => {
    mocks.getCachedLatestSnapshot.mockResolvedValueOnce({
      ...snapshot,
      craft: 64,
    });
    mocks.materializeDisplayProfile.mockResolvedValueOnce(null);

    const profile = parseResult(
      await tool("get_impact_profile").execute({ handle: "octocat" }),
    );

    expect(mocks.getCachedCraftScore).not.toHaveBeenCalled();
    expect(profile.craft).toBeNull();
    expect((profile.legacy as { dimensions: unknown }).dimensions).toEqual(
      expect.objectContaining({ craft: 64 }),
    );
  });

  describe("headline is the number the badge draws (#1001/#1311)", () => {
    // The stored snapshot keeps the EMA-smoothed composite for the trend line;
    // the badge draws the resolved score model. In the observed LE-7-1 case the
    // snapshot said 79 while the badge printed 80.
    const smoothedSnapshot = {
      ...snapshot,
      compositeScore: 80,
      adjustedComposite: 79,
      tier: "High",
    };

    function pointModel(handle: string, composite: number, tier: string): ScoreViewModel {
      return {
        ...legacyViewModel({ ...impact, handle }),
        policyVersion: "v7",
        window: createScoringWindow("2026-09-08T10:00:00.000Z"),
        composite: { kind: "point", value: composite, display: composite },
        tier: tier as ScoreViewModel["tier"],
      };
    }

    function rangeModel(handle: string): ScoreViewModel {
      return {
        ...legacyViewModel({ ...impact, handle }),
        policyVersion: "v7",
        composite: {
          kind: "range",
          lower: 70,
          upper: 85,
          displayLower: 70,
          displayUpper: 85,
        },
        tier: "High",
      };
    }

    function materializedWith(scoring: ScoreViewModel) {
      return {
        stats: { ...stats, handle: scoring.handle },
        craftResult: null,
        rawImpact: impact,
        // The v6 aggregate agrees with the smoothed snapshot here, so a tool
        // reading either of them instead of the drawn model reports 79.
        displayImpact: { ...impact, adjustedComposite: 79, tier: "High" as const },
        statsComplete: true,
        scoring,
      };
    }

    beforeEach(() => {
      mocks.getCachedLatestSnapshot.mockResolvedValue(smoothedSnapshot);
      mocks.materializeDisplayProfile.mockImplementation(async (handle: string) =>
        materializedWith(
          handle === "hubot" ? pointModel(handle, 72, "High") : pointModel(handle, 80, "Elite"),
        ),
      );
    });

    it("get_impact_profile publishes the drawn point beside the smoothed snapshot fields", async () => {
      const profile = parseResult(
        await tool("get_impact_profile").execute({ handle: "octocat" }),
      );

      expect(profile.displayScore).toBe(80);
      expect(profile.displayTier).toBe("Elite");
      expect(profile.adjustedComposite).toBe(80);
      expect((profile.legacy as { adjustedComposite: number }).adjustedComposite).toBe(79);
      expect(profile.compositeScore).toBe(80);
      expect(profile.scoring).toEqual(expect.objectContaining({
        policyVersion: "v7",
        composite: expect.objectContaining({ kind: "point", display: 80 }),
      }));
    });

    it("compare_profiles scores both sides with the drawn point", async () => {
      const comparison = parseResult(
        await tool("compare_profiles").execute({
          handle: "octocat",
          other_handle: "hubot",
        }),
      );

      expect(comparison.current).toEqual(expect.objectContaining({
        handle: "octocat",
        score: 80,
        tier: "Elite",
      }));
      expect(comparison.other).toEqual(expect.objectContaining({
        handle: "hubot",
        score: 72,
        tier: "High",
      }));
      expect((comparison.differences as { score: number }).score).toBe(-8);
    });

    it("reports a null score with the tier when the badge draws an evidence range", async () => {
      mocks.materializeDisplayProfile.mockImplementation(async (handle: string) =>
        materializedWith(rangeModel(handle)),
      );

      const profile = parseResult(
        await tool("get_impact_profile").execute({ handle: "octocat" }),
      );
      expect(profile.displayScore).toBeNull();
      expect(profile.displayTier).toBe("High");
      expect(profile.scoring).toEqual(expect.objectContaining({
        composite: expect.objectContaining({ kind: "range", displayLower: 70, displayUpper: 85 }),
      }));

      const comparison = parseResult(
        await tool("compare_profiles").execute({
          handle: "octocat",
          other_handle: "hubot",
        }),
      );
      expect(comparison.current).toEqual(expect.objectContaining({
        score: null,
        tier: "High",
      }));
      expect(comparison.differences).toBeNull();
    });

    it("never substitutes the smoothed adjustedComposite when the live profile is unavailable", async () => {
      mocks.materializeDisplayProfile.mockResolvedValue(null);

      const profile = parseResult(
        await tool("get_impact_profile").execute({ handle: "octocat" }),
      );
      expect(profile.displayScore).toBeNull();
      expect(profile.scoring).toBeNull();

      const comparison = parseResult(
        await tool("compare_profiles").execute({
          handle: "octocat",
          other_handle: "hubot",
        }),
      );
      expect((comparison.current as { score: unknown }).score).toBeNull();
      expect((comparison.other as { score: unknown }).score).toBeNull();
      expect(comparison.differences).toBeNull();
      expect(JSON.stringify(comparison)).not.toContain("79");
    });
  });

  it("preserves the recovery string and emits error telemetry when a tool throws", async () => {
    const rejectingTool: ServerMcpTool = {
      name: "rejecting_tool",
      description: "Reject for the instrumentation test.",
      inputSchema: { type: "object" },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      execute: async () => {
        throw new Error("tool exploded");
      },
    };

    await expect(
      executeServerMcpTool(rejectingTool, {}, "anthropic"),
    ).resolves.toBe(
      "rejecting_tool is unavailable right now. Please try again later.",
    );
    expect(mocks.scheduleServerEvent).toHaveBeenCalledWith("mcp_tool_called", {
      tool: "rejecting_tool",
      outcome: "error",
      durationMs: expect.any(Number),
      agentClass: "anthropic",
    });
  });
});


it("looks up v7 revocation through the current consent gate without legacy projection", async () => {
  const token = `v7.11111111-1111-4111-8111-111111111111.${"a".repeat(64)}`;
  mocks.getReceiptVerificationV7.mockResolvedValue({ version: "v7", status: "revoked", signatureAuthenticated: false });
  const result = JSON.parse(await tool("verify_badge").execute({ hash: token }));
  expect(result).toEqual({ version: "v7", status: "revoked", signatureAuthenticated: false });
  expect(mocks.getReceiptVerificationV7).toHaveBeenCalledWith(token);
});

import { scoringConsistencyFixture } from "@/lib/profile/__fixtures__/scoring-consistency";
it("remote tools use canonical current dimensions and keep legacy values nested", async () => {
  const f = await scoringConsistencyFixture({ craft: 57 });
  mocks.getCachedLatestSnapshot.mockResolvedValue(makeSnapshot());
  mocks.materializeDisplayProfile.mockResolvedValue({ stats: f.stats, craftResult: null, rawImpact: f.impact, displayImpact: f.impact, statsComplete: true, scoring: f.model });
  const profile = JSON.parse(await tool("get_impact_profile").execute({ handle: "alice" }));
  expect(profile).toMatchObject({ policyVersion: "v7.2", displayScore: 46, dimensions: { craft: 57 }, archetype: null });
  expect(profile.adjustedComposite).toBe(46);
  const explanation = JSON.parse(await tool("explain_dimension").execute({ handle: "alice", dimension: "craft" }));
  expect(explanation).toMatchObject({ policyVersion: "v7.2", score: 57 });
});


describe("remote history policy agreement", () => {
  it("reads durable current daily observations and keeps exact, displayed and EMA values separate", async () => {
    const { scoringConsistencyFixture } = await import("@/lib/profile/__fixtures__/scoring-consistency");
    const { envelope, model } = await scoringConsistencyFixture({ craft: 0, boundary: true });
    mocks.readScoringRenderSelection.mockResolvedValue({ enabled: true, machinePolicy: "v7.2", cacheable: true, capturedAt: Date.parse("2026-09-08T10:00:00.000Z") });
    mocks.dbListObservedReceiptHistory.mockResolvedValue({ status: "found", entries: [{ envelope, trend: { policyVersion: "v7.2", referenceDate: model.window!.referenceDate, receiptRevisionId: model.identity!.revisionId, rawPoint: envelope.receipt.core.composite.exact, unroundedValue: 61.25, previousAnchorRevisionId: null } }] });
    const response = JSON.parse(await tool("get_impact_history").execute({ handle: "alice" }));
    expect(response.policyVersion).toBe("v7.2");
    expect(response.snapshots[0].composite.display).toBe(69.99);
    expect(response.snapshots[0].craft.display).toBe(0);
    expect(response.snapshots[0].identity).toEqual(model.identity);
    expect(response.trend[0].unroundedValue).toBe(61.25);
    expect(JSON.stringify(response)).not.toContain("confidence");
  });
  it("fails closed on unavailable policy authority instead of returning old history", async () => {
    mocks.readScoringRenderSelection.mockResolvedValue({ enabled: false, machinePolicy: "v6", cacheable: false, capturedAt: 1788861600000 });
    expect(JSON.parse(await tool("get_impact_history").execute({ handle: "alice" }))).toMatchObject({ status: "unavailable" });
  });
});
