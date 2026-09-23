import { SCORING_POLICY } from "@chapa/shared";
import type { ScoringRenderSelection } from "@/lib/scoring-render-selection";
import { readPublicObservedScore } from "@/lib/profile/post-write-score";
import { readScoringStatus } from "@/lib/collection/read-scoring-status";
import { readObservedScoringHistory } from "@/lib/history/observed-history";
import type { AgentClass } from "@/lib/analytics/agent-ua";
import { scheduleServerEvent } from "@/lib/analytics/schedule-server-event";
import { materializeDisplayProfile } from "@/lib/profile/materialize-profile";
import type { PublicScoreProjection } from "@/lib/profile/public-score-projection";
import { comparePublicScores } from "@/lib/profile/public-score-projection";
import type { ScoringStatus } from "@/lib/collection/scoring-status";
import { isValidHandle } from "@/lib/validation";
import { getReceiptVerificationV7 } from "@/lib/verification/store";
import { VERIFICATION_HASH_PATTERN, parseVerificationTokenV7 } from "@/lib/verification/constants";
import {
  COMPARE_PROFILES_SERVER_INPUT_SCHEMA,
  EXPLAIN_DIMENSION_SERVER_INPUT_SCHEMA,
  FIND_PROFILE_INPUT_SCHEMA,
  PRODUCTION_BASE_URL,
  PUBLIC_PROFILE_SIGN_IN_NOTE,
  SITE_CAPABILITIES,
  RECEIPT_VERIFICATION_EXPLANATION,
  VERIFY_BADGE_SERVER_INPUT_SCHEMA,
} from "./catalog";
import { invalidInput, WEBMCP_INVALID_INPUT_PREFIX } from "./errors";
import {
  WEBMCP_EMPTY_INPUT_SCHEMA,
  WEBMCP_READ_ONLY_ANNOTATIONS,
  WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
  explainObservedDimension,
  isWebMcpRecord,
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

const HEADLINE_NOTE = "Current scores and dimensions come from the current v7.2 receipt.";

/**
 * #1335 phase 5 — the `scoring_v7_rendering` selector is retired; v7.2 is
 * the only rendered policy. `readPublicObservedScore` still takes the
 * `ScoringRenderSelection` shape, so this constant stands in for the old
 * dynamic DB-backed read.
 */
const CONSTANT_SELECTION: ScoringRenderSelection = {
  enabled: true,
  machinePolicy: SCORING_POLICY,
  cacheable: true,
  capturedAt: Date.now(),
};

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

type LoadedProfile =
  | { readonly status: "current"; readonly projection: PublicScoreProjection }
  | { readonly status: "status"; readonly scoringStatus: ScoringStatus }
  | { readonly status: "unavailable" };

/** The current v7.2 receipt, or the owner-visible scoring status when there
 * is no drawable current receipt yet (#1335 phase 5 — reads the receipt
 * directly rather than a live materialize; there is no legacy fallback). */
async function loadPublicProfile(handle: string): Promise<LoadedProfile> {
  const current = await readPublicObservedScore(handle, CONSTANT_SELECTION);
  if (current.status === "unavailable") return { status: "unavailable" };
  if (current.status === "current") return { status: "current", projection: current.projection };
  const scoringStatus = await readScoringStatus(handle);
  if (scoringStatus === null) return { status: "unavailable" };
  return { status: "status", scoringStatus };
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
    "Return the current v7.2 receipt for a GitHub handle: displayScore and displayTier are the headline the badge draws. When there is no drawable current receipt yet, returns scoringStatus instead (collecting, action needed, unregistered, or ready-and-updating).",
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
    if (profile.status === "unavailable") return unavailable("get_impact_profile");
    if (profile.status === "status") return JSON.stringify({ handle, scoringStatus: profile.scoringStatus });
    return JSON.stringify({ handle, ...profile.projection });
  },
};

const getImpactHistory: ServerMcpTool = {
  name: "get_impact_history",
  description: "Return the current v7.2 observed history (daily winners and trend) for a GitHub handle.",
  inputSchema: FIND_PROFILE_INPUT_SCHEMA,
  annotations: MCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
  execute: async (inputs) => {
    const validationError = validateInputKeys("get_impact_history", inputs, ["handle"]);
    if (validationError) return validationError;
    const handle = readHandle(inputs);
    if (!handle) {
      return invalidInput("get_impact_history", "handle must be a public GitHub handle");
    }
    const result = await readObservedScoringHistory(handle);
    if (result.status === "unavailable") return unavailable("get_impact_history");
    if (result.status !== "found") return missingProfile(handle);
    const { history } = result;
    return JSON.stringify({
      handle,
      policyVersion: "v7.2",
      snapshots: history.observations,
      trend: history.trend,
      comparisons: history.comparisons,
    });
  },
};

const verifyBadge: ServerMcpTool = {
  name: "verify_badge",
  description: "Look up the public verification result for a Chapa badge hash.",
  inputSchema: VERIFY_BADGE_SERVER_INPUT_SCHEMA,
  annotations: MCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
  execute: async (inputs) => {
    const validationError = validateInputKeys("verify_badge", inputs, ["hash"]);
    if (validationError) return validationError;
    const hash = readString(inputs, "hash");
    if (parseVerificationTokenV7(hash)) {
      try {
        const receipt = await getReceiptVerificationV7(hash);
        return JSON.stringify(receipt ?? { version: "v7", status: "not_found" });
      } catch { return JSON.stringify({ error: "Verification is unavailable. Retry later; no verification success is claimed." }); }
    }
    // #1335 phase 5 — `verification_records` is retired. A well-formed
    // legacy hex code is terminal (a retired v6 code), not a lookup miss.
    if (VERIFICATION_HASH_PATTERN.test(hash)) {
      return JSON.stringify({
        status: "retired_v6_code",
        message: "This is a retired v6 verification code. Current badges use v7.2 receipt codes.",
      });
    }
    return invalidInput(
      "verify_badge",
      "hash must be a complete v7 receipt token or an 8, 16, or 32 character lowercase legacy code",
    );
  },
};

const explainVerification: ServerMcpTool = {
  name: "explain_verification",
  description: "Explain Chapa badge verification guarantees and limits.",
  inputSchema: WEBMCP_EMPTY_INPUT_SCHEMA,
  annotations: MCP_READ_ONLY_ANNOTATIONS,
  execute: async (inputs) => {
    const validationError = validateInputKeys("explain_verification", inputs, []);
    return validationError ?? JSON.stringify(RECEIPT_VERIFICATION_EXPLANATION);
  },
};

const explainDimension: ServerMcpTool = {
  name: "explain_dimension",
  description: "Explain one impact dimension for a public profile's current v7.2 receipt.",
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
    if (!materialized?.scoring || materialized.scoring.policyVersion !== "v7.2") {
      return missingProfile(handle);
    }
    return JSON.stringify(explainObservedDimension(materialized.scoring, dimensionKey));
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
    if (current.status === "unavailable") return unavailable("compare_profiles");
    if (other.status === "unavailable") return unavailable("compare_profiles");
    if (current.status === "status") return JSON.stringify({ handle, scoringStatus: current.scoringStatus });
    if (other.status === "status") return JSON.stringify({ handle: otherHandle, scoringStatus: other.scoringStatus });
    const comparison = comparePublicScores(current.projection, other.projection);
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
