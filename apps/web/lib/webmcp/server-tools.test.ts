import { beforeEach, describe, expect, it, vi } from "vitest";
import { scoringConsistencyFixture } from "@/lib/profile/__fixtures__/scoring-consistency";
import { publicScoreProjection } from "@/lib/profile/public-score-projection";
import { SITE_TOOL_MAP } from "./site-tool-map";

const mocks = vi.hoisted(() => ({
  readPublicObservedScore: vi.fn(),
  readScoringStatus: vi.fn(),
  readObservedScoringHistory: vi.fn(),
  materializeDisplayProfile: vi.fn(),
  getReceiptVerificationV7: vi.fn(),
  scheduleServerEvent: vi.fn(),
}));

vi.mock("@/lib/profile/post-write-score", () => ({
  readPublicObservedScore: mocks.readPublicObservedScore,
}));

vi.mock("@/lib/collection/read-scoring-status", () => ({
  readScoringStatus: mocks.readScoringStatus,
}));

vi.mock("@/lib/history/observed-history", () => ({
  readObservedScoringHistory: mocks.readObservedScoringHistory,
}));

vi.mock("@/lib/profile/materialize-profile", () => ({
  materializeDisplayProfile: mocks.materializeDisplayProfile,
}));

vi.mock("@/lib/verification/store", () => ({
  getReceiptVerificationV7: mocks.getReceiptVerificationV7,
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

/** Mirrors readPublicObservedScore's own "current" projection wrapping. */
function currentResult(projection: ReturnType<typeof publicScoreProjection>) {
  return {
    status: "current" as const,
    projection: {
      ...projection,
      compositeScore: projection.displayScore,
      adjustedComposite: projection.displayScore,
      displayAdjustedComposite: projection.displayScore,
      displayTier: projection.tier,
    },
  };
}

describe("remote MCP server tools", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const fixture = await scoringConsistencyFixture({ craft: 57 });
    const projection = publicScoreProjection(fixture.model);
    mocks.readPublicObservedScore.mockResolvedValue(currentResult(projection));
    mocks.readScoringStatus.mockResolvedValue({ kind: "unregistered" });
    mocks.readObservedScoringHistory.mockResolvedValue({ status: "missing" });
    mocks.materializeDisplayProfile.mockResolvedValue({ scoring: fixture.model });
    mocks.getReceiptVerificationV7.mockResolvedValue(null);
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
    mocks.readObservedScoringHistory.mockResolvedValue({
      status: "found",
      history: { observations: [], trend: [], comparisons: [] },
    });
    mocks.getReceiptVerificationV7.mockResolvedValue({
      version: "v7",
      status: "current",
      revisionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      issuanceRecorded: true,
      signatureAuthenticated: true,
    });

    const results = await Promise.all([
      tool("get_impact_profile").execute({ handle: "octocat" }),
      tool("get_impact_history").execute({ handle: "octocat" }),
      tool("verify_badge").execute({ hash: `v7.cccccccc-cccc-4ccc-8ccc-cccccccccccc.${"a".repeat(64)}` }),
      tool("explain_verification").execute({}),
      tool("explain_dimension").execute({ handle: "octocat", dimension: "delivery" }),
      tool("compare_profiles").execute({ handle: "octocat", other_handle: "hubot" }),
      tool("get_embed_snippet").execute({ handle: "octocat" }),
    ]);

    const profile = parseResult(results[0]!);
    expect(profile).toEqual(expect.objectContaining({
      handle: "octocat",
      policyVersion: "v7.2",
      dimensions: expect.any(Object),
    }));

    expect(parseResult(results[1]!)).toEqual(expect.objectContaining({
      handle: "octocat",
      policyVersion: "v7.2",
      snapshots: [],
    }));
    expect(parseResult(results[2]!)).toEqual(expect.objectContaining({
      version: "v7",
      status: "current",
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

  it("returns scoringStatus instead of a profile when there is no drawable current receipt", async () => {
    mocks.readPublicObservedScore.mockResolvedValue({ status: "missing" });
    mocks.readScoringStatus.mockResolvedValue({ kind: "collecting", percent: 40, sources: [], hasPriorReceipt: false });

    const profile = parseResult(
      await tool("get_impact_profile").execute({ handle: "collecting-owner" }),
    );
    expect(profile).toEqual({ handle: "collecting-owner", scoringStatus: { kind: "collecting", percent: 40, sources: [], hasPriorReceipt: false } });

    // Give the current-status branch first priority: `handle` (octocat)
    // is scored, `other_handle` (collecting-owner) is not.
    const fixture = await scoringConsistencyFixture({ craft: 57 });
    const scoredResult = currentResult(publicScoreProjection(fixture.model));
    mocks.readPublicObservedScore.mockImplementation(async (handle: string) =>
      handle === "octocat" ? scoredResult : { status: "missing" },
    );

    const comparison = parseResult(
      await tool("compare_profiles").execute({ handle: "octocat", other_handle: "collecting-owner" }),
    );
    expect(comparison).toEqual({ handle: "collecting-owner", scoringStatus: { kind: "collecting", percent: 40, sources: [], hasPriorReceipt: false } });
  });

  it("reports unregistered handles distinctly from an unavailable authority read", async () => {
    mocks.readPublicObservedScore.mockResolvedValue({ status: "missing" });
    mocks.readScoringStatus.mockResolvedValue({ kind: "unregistered" });

    const profile = parseResult(
      await tool("get_impact_profile").execute({ handle: "never-signed-up" }),
    );
    expect(profile).toEqual({ handle: "never-signed-up", scoringStatus: { kind: "unregistered" } });
  });

  it("fails closed (never a stale receipt) when the current-receipt authority is unavailable", async () => {
    mocks.readPublicObservedScore.mockResolvedValue({ status: "unavailable" });

    await expect(
      tool("get_impact_profile").execute({ handle: "octocat" }),
    ).resolves.toBe("get_impact_profile is unavailable right now. Please try again later.");
    expect(mocks.readScoringStatus).not.toHaveBeenCalled();
  });

  it("fails closed when the scoring status authority read itself fails", async () => {
    mocks.readPublicObservedScore.mockResolvedValue({ status: "missing" });
    mocks.readScoringStatus.mockResolvedValue(null);

    await expect(
      tool("get_impact_profile").execute({ handle: "octocat" }),
    ).resolves.toBe("get_impact_profile is unavailable right now. Please try again later.");
  });

  describe("verify_badge (#1335 phase 5 — retired v6 codes)", () => {
    it.each(["a".repeat(8), "a".repeat(16), "a".repeat(32)])(
      "returns retired_v6_code for a well-formed legacy hash %s",
      async (hash) => {
        const result = parseResult(await tool("verify_badge").execute({ hash }));
        expect(result).toEqual({
          status: "retired_v6_code",
          message: expect.stringMatching(/retired v6 verification code/i),
        });
        expect(mocks.getReceiptVerificationV7).not.toHaveBeenCalled();
      },
    );

    it("rejects a malformed hash as invalid input, not a retired code", async () => {
      await expect(tool("verify_badge").execute({ hash: "not-a-hash" })).resolves.toMatch(
        /^Invalid input for verify_badge:/,
      );
    });

    it("looks up v7 revocation through the current authority", async () => {
      const token = `v7.11111111-1111-4111-8111-111111111111.${"a".repeat(64)}`;
      mocks.getReceiptVerificationV7.mockResolvedValue({ version: "v7", status: "revoked", signatureAuthenticated: false });
      const result = parseResult(await tool("verify_badge").execute({ hash: token }));
      expect(result).toEqual({ version: "v7", status: "revoked", signatureAuthenticated: false });
      expect(mocks.getReceiptVerificationV7).toHaveBeenCalledWith(token);
    });
  });

  describe("explain_dimension (v7.2 only)", () => {
    it("explains a current v7.2 dimension using the receipt's own view model", async () => {
      const fixture = await scoringConsistencyFixture({ craft: 57 });
      mocks.materializeDisplayProfile.mockResolvedValue({ scoring: fixture.model });

      const explanation = parseResult(
        await tool("explain_dimension").execute({ handle: "alice", dimension: "craft" }),
      );
      expect(explanation).toMatchObject({ policyVersion: "v7.2", score: 57 });
    });

    it("reports a missing profile when there is no v7.2 receipt to explain", async () => {
      mocks.materializeDisplayProfile.mockResolvedValue(null);

      await expect(
        tool("explain_dimension").execute({ handle: "missing-user", dimension: "delivery" }),
      ).resolves.toBe(
        "No public Chapa impact profile exists for @missing-user. Its owner must sign in to Chapa before public profile tools can use this handle.",
      );
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

describe("remote history policy agreement", () => {
  it("reads durable current daily observations and keeps exact and displayed values separate", async () => {
    const fixture = await scoringConsistencyFixture({ craft: 0, boundary: true });
    const composite = fixture.model.composite;
    if (composite.kind !== "point") throw new Error("fixture must be a point composite");
    mocks.readObservedScoringHistory.mockResolvedValue({
      status: "found",
      history: {
        observations: [{
          policyVersion: "v7.2",
          identity: fixture.model.identity,
          window: fixture.model.window,
          composite: { exact: composite.value, display: composite.display },
          dimensions: {},
          tier: fixture.model.tier,
          archetype: fixture.model.archetype,
          craft: { exact: 0, display: 0, reportPeriod: { startInclusive: "2026-09-01T00:00:00.000Z", endExclusive: "2026-09-08T00:00:00.000Z" } },
        }],
        trend: [{ policyVersion: "v7.2", referenceDate: fixture.model.window!.referenceDate, receiptRevisionId: fixture.model.identity!.revisionId, rawPoint: composite.value, unroundedValue: 61.25, previousAnchorRevisionId: null }],
        comparisons: [],
      },
    });
    const response = parseResult(await tool("get_impact_history").execute({ handle: "alice" }));
    expect(response.policyVersion).toBe("v7.2");
    expect((response.snapshots as Array<{ composite: { display: number } }>)[0]!.composite.display).toBe(69.99);
    expect((response.snapshots as Array<{ craft: { display: number } }>)[0]!.craft.display).toBe(0);
    expect((response.trend as Array<{ unroundedValue: number }>)[0]!.unroundedValue).toBe(61.25);
    expect(JSON.stringify(response)).not.toContain("confidence");
  });

  it("fails closed on unavailable policy authority instead of returning old history", async () => {
    mocks.readObservedScoringHistory.mockResolvedValue({ status: "unavailable" });
    await expect(
      tool("get_impact_history").execute({ handle: "alice" }),
    ).resolves.toBe("get_impact_history is unavailable right now. Please try again later.");
  });

  it("reports an unscored handle distinctly from an unavailable authority", async () => {
    mocks.readObservedScoringHistory.mockResolvedValue({ status: "missing" });
    await expect(
      tool("get_impact_history").execute({ handle: "never-scored" }),
    ).resolves.toBe(
      "No public Chapa impact profile exists for @never-scored. Its owner must sign in to Chapa before public profile tools can use this handle.",
    );
  });
});
