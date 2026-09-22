import { readScoringRenderSelection } from "@/lib/scoring-render-selection";
import { readObservedScoringHistory } from "@/lib/history/observed-history";
import type { DimensionScores } from "@chapa/shared";
import type { AgentClass } from "@/lib/analytics/agent-ua";
import { scheduleServerEvent } from "@/lib/analytics/schedule-server-event";
import { getCachedCraftScore } from "@/lib/cache/craft-cache";
import { getCachedLatestSnapshot } from "@/lib/cache/snapshot-cache";
import { getSnapshots } from "@/lib/history/history";
import { redactSnapshotForVisitor } from "@/lib/history/public-snapshot";
import { computeTrend } from "@/lib/history/trend";
import { getServerT } from "@/lib/i18n/server";
import type { LanguageContextValue } from "@/lib/i18n";
import { materializeDisplayProfile } from "@/lib/profile/materialize-profile";
import { redactImpactForVisitor } from "@/lib/profile/public-profile";
import { publicScoreProjection, comparePublicScores } from "@/lib/profile/public-score-projection";
import type { ScoreViewModel } from "@/lib/profile/score-view-model";
import { isValidHandle } from "@/lib/validation";
import { getVerificationRecord, getReceiptVerificationV7 } from "@/lib/verification/store";
import { toPublicVerificationRecord } from "@/lib/verification/types";
import { VERIFICATION_CODE_PATTERN, parseVerificationTokenV7 } from "@/lib/verification/constants";
import {
  COMPARE_PROFILES_SERVER_INPUT_SCHEMA,
  EXPLAIN_DIMENSION_SERVER_INPUT_SCHEMA,
  FIND_PROFILE_INPUT_SCHEMA,
  PRODUCTION_BASE_URL,
  PUBLIC_PROFILE_SIGN_IN_NOTE,
  SITE_CAPABILITIES,
  VERIFICATION_EXPLANATION,
  RECEIPT_VERIFICATION_EXPLANATION,
  VERIFY_BADGE_SERVER_INPUT_SCHEMA,
} from "./catalog";
import { invalidInput, WEBMCP_INVALID_INPUT_PREFIX } from "./errors";
import {
  WEBMCP_EMPTY_INPUT_SCHEMA,
  WEBMCP_READ_ONLY_ANNOTATIONS,
  WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
  createExplainDimensionTool,
  isWebMcpRecord,
  sanitizeFreeTextForAgent,
  type WebMcpToolAnnotations,
} from "./shared-tools";

export interface ServerMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: WebMcpToolAnnotations & {
    readOnlyHint: true;
    destructiveHint: false;
    openWorldHint: false;
  };
  execute(inputs: unknown): Promise<string>;
}

const MCP_READ_ONLY_ANNOTATIONS = {
  ...WEBMCP_READ_ONLY_ANNOTATIONS,
  destructiveHint: false,
  openWorldHint: false,
} as const;

const MCP_READ_ONLY_UNTRUSTED_ANNOTATIONS = {
  ...WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
  destructiveHint: false,
  openWorldHint: false,
} as const;

const HEADLINE_NOTE = "Current scores and dimensions come from one selected policy and receipt context; legacy snapshot fields are explicitly nested.";

function readString(inputs: unknown, key: string): string {
  if (!isWebMcpRecord(inputs) || typeof inputs[key] !== "string") return "";
  return inputs[key].trim();
}

function readHandle(inputs: unknown, key = "handle"): string {
  const handle = readString(inputs, key);
  return isValidHandle(handle) ? handle : "";
}

function validateInputKeys(
  tool: string,
  inputs: unknown,
  allowedKeys: readonly string[],
): string | null {
  if (!isWebMcpRecord(inputs)) {
    return invalidInput(tool, "input must be an object");
  }
  const unexpectedKey = Object.keys(inputs).find(
    (key) => !allowedKeys.includes(key),
  );
  return unexpectedKey
    ? invalidInput(tool, `unexpected field ${unexpectedKey}`)
    : null;
}

function missingProfile(handle: string): string {
  return `No public Chapa impact profile exists for @${handle}. Its owner must sign in to Chapa before public profile tools can use this handle.`;
}

function unavailable(tool: string): string {
  return `${tool} is unavailable right now. Please try again later.`;
}

async function loadPublicProfile(handle: string) {
  const snapshot = await getCachedLatestSnapshot(handle);
  if (!snapshot) return null;

  let displayScore: number | null = null;
  let displayTier: string | null = null;
  let scoring: ScoreViewModel | null = null;
  let craftResult = null;
  let materializedAvailable = false;
  try {
    const materialized = await materializeDisplayProfile(handle, {
      readOnly: true,
    });
    if (materialized) {
      materializedAvailable = true;
      scoring = materialized.scoring;
      const projection = publicScoreProjection(scoring);
      displayScore = projection.displayScore; displayTier = projection.tier;
      if (snapshot.craft == null) {
        craftResult = materialized.craftResult;
      }
    }
  } catch {
    // Match /api/profile: the snapshot remains useful if fresh materialization fails.
  }
  if (snapshot.craft == null && !materializedAvailable) {
    try {
      craftResult = await getCachedCraftScore(handle);
    } catch {
      // The persisted snapshot remains useful if the optional craft cache fails.
    }
  }
  const craftScore = snapshot.craft ?? craftResult?.craftScore;

  const dimensions: DimensionScores = {
    delivery: snapshot.delivery,
    quality: snapshot.quality,
    consistency: snapshot.consistency,
    breadth: snapshot.breadth,
    ...(craftScore != null && { craft: craftScore }),
  };

  const legacy = {
    handle,
    dimensions,
    compositeScore: snapshot.compositeScore,
    adjustedComposite: snapshot.adjustedComposite,
    archetype: snapshot.archetype,
    tier: snapshot.tier,
    craft: craftResult
      ? {
          tool: sanitizeFreeTextForAgent(craftResult.tool),
          tier: craftResult.tier,
          score: craftResult.craftScore,
        }
      : null,
    snapshotDate: snapshot.date,
    computedAt: snapshot.capturedAt,
    displayScore,
    displayTier,
    scoring,
  };
  if (!scoring) return { handle, scoring: null, displayScore: null, exactScore: null, displayTier: null,
    dimensions: {}, exactDimensions: {}, tier: null, archetype: null, craft: null,
    policyVersion: null, identity: null, window: null, compositeScore: null, adjustedComposite: null, freshness: "unavailable", legacy };
  const projection = publicScoreProjection(scoring, craftScore);
  return { handle, ...projection, displayTier: projection.tier, compositeScore: projection.displayScore,
    adjustedComposite: projection.displayScore, legacy };
}

export async function executeServerMcpTool(
  tool: ServerMcpTool,
  inputs: unknown,
  agentClass: AgentClass,
): Promise<string> {
  const start = performance.now();
  try {
    const text = await tool.execute(inputs);
    scheduleServerEvent("mcp_tool_called", {
      tool: tool.name,
      outcome: text.startsWith(WEBMCP_INVALID_INPUT_PREFIX)
        ? "invalid_input"
        : "ok",
      durationMs: Math.round(performance.now() - start),
      agentClass,
    });
    return text;
  } catch {
    scheduleServerEvent("mcp_tool_called", {
      tool: tool.name,
      outcome: "error",
      durationMs: Math.round(performance.now() - start),
      agentClass,
    });
    return unavailable(tool.name);
  }
}

const getSiteCapabilities: ServerMcpTool = {
  name: "get_site_capabilities",
  description: "Describe Chapa and list its agent-facing tools and entry points.",
  inputSchema: WEBMCP_EMPTY_INPUT_SCHEMA,
  annotations: MCP_READ_ONLY_ANNOTATIONS,
  execute: async (inputs) => {
    const validationError = validateInputKeys("get_site_capabilities", inputs, []);
    if (validationError) return validationError;
    return JSON.stringify({
      ...SITE_CAPABILITIES,
      transport: {
        endpoint: `${PRODUCTION_BASE_URL}/api/mcp`,
        protocol: "Streamable HTTP",
        note: "This is Chapa's stateless remote MCP transport for non-browser clients.",
      },
    });
  },
};

const findProfile: ServerMcpTool = {
  name: "find_profile",
  description: "Resolve a GitHub handle to its Chapa profile and badge URLs.",
  inputSchema: FIND_PROFILE_INPUT_SCHEMA,
  annotations: MCP_READ_ONLY_ANNOTATIONS,
  execute: async (inputs) => {
    const validationError = validateInputKeys("find_profile", inputs, ["handle"]);
    if (validationError) return validationError;
    const handle = readHandle(inputs);
    if (!handle) {
      return invalidInput("find_profile", "handle must be a public GitHub handle");
    }
    const encodedHandle = encodeURIComponent(handle);
    return JSON.stringify({
      handle,
      sharePageUrl: `${PRODUCTION_BASE_URL}/u/${encodedHandle}`,
      badgeSvgUrl: `${PRODUCTION_BASE_URL}/u/${encodedHandle}/badge.svg`,
      notes: [
        PUBLIC_PROFILE_SIGN_IN_NOTE,
        "The remote endpoint exposes the public read-only profile tools without browser page state.",
      ],
    });
  },
};

const getImpactProfile: ServerMcpTool = {
  name: "get_impact_profile",
  description:
    "Return the latest public impact profile for a GitHub handle. displayScore and displayTier are the headline the badge draws (displayScore is null for an evidence range); legacy contains the stored trend snapshot; top-level values use the selected policy.",
  inputSchema: FIND_PROFILE_INPUT_SCHEMA,
  annotations: MCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
  execute: async (inputs) => {
    const validationError = validateInputKeys("get_impact_profile", inputs, ["handle"]);
    if (validationError) return validationError;
    const handle = readHandle(inputs);
    if (!handle) {
      return invalidInput("get_impact_profile", "handle must be a public GitHub handle");
    }
    const profile = await loadPublicProfile(handle);
    return profile ? JSON.stringify(profile) : missingProfile(handle);
  },
};

const getImpactHistory: ServerMcpTool = {
  name: "get_impact_history",
  description: "Return public impact snapshots and trend for a GitHub handle.",
  inputSchema: FIND_PROFILE_INPUT_SCHEMA,
  annotations: MCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
  execute: async (inputs) => {
    const validationError = validateInputKeys("get_impact_history", inputs, ["handle"]);
    if (validationError) return validationError;
    const handle = readHandle(inputs);
    if (!handle) {
      return invalidInput("get_impact_history", "handle must be a public GitHub handle");
    }
    const selection = await readScoringRenderSelection();
    if (!selection.cacheable) return JSON.stringify({ handle, status: "unavailable", reason: "policy_unavailable" });
    if (selection.enabled) {
      const result = await readObservedScoringHistory(handle);
      if (result.status === "unavailable") return JSON.stringify({ handle, policyVersion: "v7.2", status: "unavailable", reason: "history_unavailable" });
      if (result.status === "found") return JSON.stringify({ handle, policyVersion: "v7.2", snapshots: result.history.observations, trend: result.history.trend, comparisons: result.history.comparisons });
    }
    const snapshots = await getSnapshots(handle);
    const publicSnapshots = snapshots.map(redactSnapshotForVisitor);
    return JSON.stringify({
      handle,
      policyVersion: "v6",
      snapshots: publicSnapshots,
      trend: computeTrend(snapshots),
    });
  },
};

const verifyBadge: ServerMcpTool = {
  name: "verify_badge",
  description: "Look up the public verification record for a Chapa badge hash.",
  inputSchema: VERIFY_BADGE_SERVER_INPUT_SCHEMA,
  annotations: MCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
  execute: async (inputs) => {
    const validationError = validateInputKeys("verify_badge", inputs, ["hash"]);
    if (validationError) return validationError;
    const hash = readString(inputs, "hash");
    if (!VERIFICATION_CODE_PATTERN.test(hash)) {
      return invalidInput(
        "verify_badge",
        "hash must be a complete v7 receipt token or an 8, 16, or 32 character lowercase legacy code",
      );
    }
    if (parseVerificationTokenV7(hash)) {
      try {
        const receipt = await getReceiptVerificationV7(hash);
        return JSON.stringify(receipt ?? { version: "v7", status: "not_found" });
      } catch { return JSON.stringify({ error: "Verification is unavailable. Retry later; no verification success is claimed." }); }
    }
    const record = await getVerificationRecord(hash);
    if (!record) return `No verification record was found for hash ${hash}.`;
    const publicRecord = toPublicVerificationRecord(record);
    return JSON.stringify({
      version: "v6",
      status: "legacy_record",
      hash,
      record: {
        ...publicRecord,
        displayName: sanitizeFreeTextForAgent(publicRecord.displayName),
      },
      verifyUrl: `${PRODUCTION_BASE_URL}/verify/${hash}`,
      badgeUrl: `${PRODUCTION_BASE_URL}/u/${encodeURIComponent(record.handle)}/badge.svg`,
    });
  },
};

const explainVerification: ServerMcpTool = {
  name: "explain_verification",
  description: "Explain Chapa badge verification guarantees and limits.",
  inputSchema: WEBMCP_EMPTY_INPUT_SCHEMA,
  annotations: MCP_READ_ONLY_ANNOTATIONS,
  execute: async (inputs) => {
    const validationError = validateInputKeys("explain_verification", inputs, []);
    return validationError ?? JSON.stringify({ algorithm: "HMAC-SHA256", v7: RECEIPT_VERIFICATION_EXPLANATION, legacy: VERIFICATION_EXPLANATION });
  },
};

const explainDimension: ServerMcpTool = {
  name: "explain_dimension",
  description: "Explain one impact dimension for a public profile.",
  inputSchema: EXPLAIN_DIMENSION_SERVER_INPUT_SCHEMA,
  annotations: MCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
  execute: async (inputs) => {
    const validationError = validateInputKeys("explain_dimension", inputs, [
      "handle",
      "dimension",
    ]);
    if (validationError) return validationError;
    const handle = readHandle(inputs);
    const dimension = readString(inputs, "dimension");
    if (!handle) {
      return invalidInput("explain_dimension", "handle must be a public GitHub handle");
    }
    const dimensionKey = EXPLAIN_DIMENSION_SERVER_INPUT_SCHEMA.properties.dimension.enum
      .find((key) => key === dimension);
    if (!dimensionKey) {
      return invalidInput("explain_dimension", "dimension must be a known dimension");
    }
    const materialized = await materializeDisplayProfile(handle, { readOnly: true });
    if (!materialized) return missingProfile(handle);
    const browserTwin = createExplainDimensionTool({
      impact: redactImpactForVisitor(materialized.displayImpact),
      scoring: materialized.scoring,
      stats: materialized.stats,
      craftResult: materialized.craftResult,
      t: getServerT("en") as LanguageContextValue["t"],
      annotations: WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
    });
    return browserTwin.execute(
      { dimension: dimensionKey },
      { signal: new AbortController().signal },
    );
  },
};

const compareProfiles: ServerMcpTool = {
  name: "compare_profiles",
  description: "Compare two public Chapa impact profiles by the headline each badge draws.",
  inputSchema: COMPARE_PROFILES_SERVER_INPUT_SCHEMA,
  annotations: MCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
  execute: async (inputs) => {
    const validationError = validateInputKeys("compare_profiles", inputs, [
      "handle",
      "other_handle",
    ]);
    if (validationError) return validationError;
    const handle = readHandle(inputs);
    const otherHandle = readHandle(inputs, "other_handle");
    if (!handle) {
      return invalidInput("compare_profiles", "handle must be a public GitHub handle");
    }
    if (!otherHandle) {
      return invalidInput("compare_profiles", "other_handle must be a public GitHub handle");
    }
    const [current, other] = await Promise.all([
      loadPublicProfile(handle),
      loadPublicProfile(otherHandle),
    ]);
    if (!current) return missingProfile(handle);
    if (!other) return missingProfile(otherHandle);
    if (!current.scoring || !other.scoring) return JSON.stringify({ current: { handle, score: current.displayScore, tier: current.displayTier, scoring: current.scoring }, other: { handle: otherHandle, score: other.displayScore, tier: other.displayTier, scoring: other.scoring }, status: "not_comparable", reason: "unavailable", differences: null });
    const comparison = comparePublicScores(publicScoreProjection(current.scoring, current.dimensions.craft), publicScoreProjection(other.scoring, other.dimensions.craft));
    return JSON.stringify({ ...comparison,
      current: { handle, ...comparison.current, score: comparison.current.displayScore },
      other: { handle: otherHandle, ...comparison.other, score: comparison.other.displayScore }, note: HEADLINE_NOTE });
  },
};

const getEmbedSnippet: ServerMcpTool = {
  name: "get_embed_snippet",
  description: "Return ready-to-paste Markdown and HTML for a live Chapa badge.",
  inputSchema: FIND_PROFILE_INPUT_SCHEMA,
  annotations: MCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
  execute: async (inputs) => {
    const validationError = validateInputKeys("get_embed_snippet", inputs, ["handle"]);
    if (validationError) return validationError;
    const handle = readHandle(inputs);
    if (!handle) {
      return invalidInput("get_embed_snippet", "handle must be a public GitHub handle");
    }
    const encodedHandle = encodeURIComponent(handle);
    const badgeUrl = `${PRODUCTION_BASE_URL}/u/${encodedHandle}/badge.svg`;
    const altText = `Chapa Badge of ${handle}`;
    return JSON.stringify({
      handle,
      markdown: `![${altText}](${badgeUrl})`,
      html: `<img src="${badgeUrl}" alt="${altText}" width="600" height="315" />`,
      note: "The badge image is live; embed it once and it stays current.",
    });
  },
};

export const SERVER_MCP_TOOLS: readonly ServerMcpTool[] = [
  getSiteCapabilities,
  findProfile,
  getImpactProfile,
  getImpactHistory,
  verifyBadge,
  explainVerification,
  explainDimension,
  compareProfiles,
  getEmbedSnippet,
];
