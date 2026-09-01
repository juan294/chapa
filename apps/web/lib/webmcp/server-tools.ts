import type { DimensionScores } from "@chapa/shared";
import { getCachedLatestSnapshot } from "@/lib/cache/snapshot-cache";
import { dbGetToolInsights } from "@/lib/db/tool-insights";
import { getSnapshots } from "@/lib/history/history";
import { computeTrend } from "@/lib/history/trend";
import { getServerT } from "@/lib/i18n/server";
import type { LanguageContextValue } from "@/lib/i18n";
import { materializeDisplayProfile } from "@/lib/profile/materialize-profile";
import { redactImpactForVisitor } from "@/lib/profile/public-profile";
import { isValidHandle } from "@/lib/validation";
import { getVerificationRecord } from "@/lib/verification/store";
import { toPublicVerificationRecord } from "@/lib/verification/types";
import {
  COMPARE_PROFILES_SERVER_INPUT_SCHEMA,
  EXPLAIN_DIMENSION_SERVER_INPUT_SCHEMA,
  FIND_PROFILE_INPUT_SCHEMA,
  HASH_PATTERN,
  PRODUCTION_BASE_URL,
  SITE_CAPABILITIES,
  VERIFICATION_EXPLANATION,
  VERIFY_BADGE_SERVER_INPUT_SCHEMA,
  compareDimensions,
} from "./catalog";
import { invalidInput } from "./errors";
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
  annotations: WebMcpToolAnnotations & { readOnlyHint: true };
  execute(inputs: unknown): Promise<string>;
}

interface PublicProfilePayload {
  handle: string;
  dimensions: DimensionScores;
  compositeScore: number;
  adjustedComposite: number;
  archetype: string;
  tier: string;
  craft: {
    tool: string | undefined;
    tier: string;
    score: number;
  } | null;
  snapshotDate: string;
  computedAt: string;
  displayScore: number | null;
  displayTier: string | null;
}

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
  return `No public impact profile was found for @${handle}. Ask the user to open ${PRODUCTION_BASE_URL}/u/${encodeURIComponent(handle)} once, then retry.`;
}

function unavailable(tool: string): string {
  return `${tool} is unavailable right now. Please try again later.`;
}

async function loadPublicProfile(handle: string): Promise<PublicProfilePayload | null> {
  const snapshot = await getCachedLatestSnapshot(handle);
  if (!snapshot) return null;

  const craftResult = snapshot.craft == null
    ? await dbGetToolInsights(handle)
    : null;
  const craftScore = snapshot.craft ?? craftResult?.craftScore;

  let displayScore: number | null = null;
  let displayTier: string | null = null;
  try {
    const materialized = await materializeDisplayProfile(handle, {
      readOnly: true,
    });
    if (materialized) {
      displayScore = materialized.displayImpact.adjustedComposite;
      displayTier = materialized.displayImpact.tier;
    }
  } catch {
    // Match /api/profile: the snapshot remains useful if fresh materialization fails.
  }

  const dimensions: DimensionScores = {
    delivery: snapshot.delivery,
    quality: snapshot.quality,
    consistency: snapshot.consistency,
    breadth: snapshot.breadth,
    ...(craftScore != null && { craft: craftScore }),
  };

  return {
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
  };
}

async function executeSafely(
  tool: string,
  operation: () => string | Promise<string>,
): Promise<string> {
  try {
    return await operation();
  } catch {
    return unavailable(tool);
  }
}

const getSiteCapabilities: ServerMcpTool = {
  name: "get_site_capabilities",
  description: "Describe Chapa and list its agent-facing tools and entry points.",
  inputSchema: WEBMCP_EMPTY_INPUT_SCHEMA,
  annotations: WEBMCP_READ_ONLY_ANNOTATIONS,
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
  annotations: WEBMCP_READ_ONLY_ANNOTATIONS,
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
        "The profile is generated on first visit if it does not exist yet.",
        "The remote endpoint exposes the public read-only profile tools without browser page state.",
      ],
    });
  },
};

const getImpactProfile: ServerMcpTool = {
  name: "get_impact_profile",
  description: "Return the latest public impact profile for a GitHub handle.",
  inputSchema: FIND_PROFILE_INPUT_SCHEMA,
  annotations: WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
  execute: async (inputs) => {
    const validationError = validateInputKeys("get_impact_profile", inputs, ["handle"]);
    if (validationError) return validationError;
    const handle = readHandle(inputs);
    if (!handle) {
      return invalidInput("get_impact_profile", "handle must be a public GitHub handle");
    }
    return executeSafely("get_impact_profile", async () => {
      const profile = await loadPublicProfile(handle);
      return profile ? JSON.stringify(profile) : missingProfile(handle);
    });
  },
};

const getImpactHistory: ServerMcpTool = {
  name: "get_impact_history",
  description: "Return public impact snapshots and trend for a GitHub handle.",
  inputSchema: FIND_PROFILE_INPUT_SCHEMA,
  annotations: WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
  execute: async (inputs) => {
    const validationError = validateInputKeys("get_impact_history", inputs, ["handle"]);
    if (validationError) return validationError;
    const handle = readHandle(inputs);
    if (!handle) {
      return invalidInput("get_impact_history", "handle must be a public GitHub handle");
    }
    return executeSafely("get_impact_history", async () => {
      const snapshots = await getSnapshots(handle);
      const publicSnapshots = snapshots.map((snapshot) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { confidence: _confidence, confidencePenalties: _penalties, ...publicSnapshot } = snapshot;
        return publicSnapshot;
      });
      return JSON.stringify({
        handle,
        snapshots: publicSnapshots,
        trend: computeTrend(snapshots),
      });
    });
  },
};

const verifyBadge: ServerMcpTool = {
  name: "verify_badge",
  description: "Look up the public verification record for a Chapa badge hash.",
  inputSchema: VERIFY_BADGE_SERVER_INPUT_SCHEMA,
  annotations: WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
  execute: async (inputs) => {
    const validationError = validateInputKeys("verify_badge", inputs, ["hash"]);
    if (validationError) return validationError;
    const hash = readString(inputs, "hash");
    if (!HASH_PATTERN.test(hash)) {
      return invalidInput(
        "verify_badge",
        "hash must be an 8, 16, or 32 character lowercase hexadecimal verification code",
      );
    }
    return executeSafely("verify_badge", async () => {
      const record = await getVerificationRecord(hash);
      if (!record) return `No verification record was found for hash ${hash}.`;
      const publicRecord = toPublicVerificationRecord(record);
      return JSON.stringify({
        status: "verified",
        hash,
        record: {
          ...publicRecord,
          displayName: sanitizeFreeTextForAgent(publicRecord.displayName),
        },
        verifyUrl: `${PRODUCTION_BASE_URL}/verify/${hash}`,
        badgeUrl: `${PRODUCTION_BASE_URL}/u/${encodeURIComponent(record.handle)}/badge.svg`,
      });
    });
  },
};

const explainVerification: ServerMcpTool = {
  name: "explain_verification",
  description: "Explain Chapa badge verification guarantees and limits.",
  inputSchema: WEBMCP_EMPTY_INPUT_SCHEMA,
  annotations: WEBMCP_READ_ONLY_ANNOTATIONS,
  execute: async (inputs) => {
    const validationError = validateInputKeys("explain_verification", inputs, []);
    return validationError ?? JSON.stringify(VERIFICATION_EXPLANATION);
  },
};

const explainDimension: ServerMcpTool = {
  name: "explain_dimension",
  description: "Explain one impact dimension for a public profile.",
  inputSchema: EXPLAIN_DIMENSION_SERVER_INPUT_SCHEMA,
  annotations: WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
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
    return executeSafely("explain_dimension", async () => {
      const materialized = await materializeDisplayProfile(handle, { readOnly: true });
      if (!materialized) return missingProfile(handle);
      const browserTwin = createExplainDimensionTool({
        impact: redactImpactForVisitor(materialized.displayImpact),
        stats: materialized.stats,
        craftResult: materialized.craftResult,
        t: getServerT("en") as LanguageContextValue["t"],
        annotations: WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
      });
      return browserTwin.execute(
        { dimension: dimensionKey },
        { signal: new AbortController().signal },
      );
    });
  },
};

const compareProfiles: ServerMcpTool = {
  name: "compare_profiles",
  description: "Compare two public Chapa impact profiles.",
  inputSchema: COMPARE_PROFILES_SERVER_INPUT_SCHEMA,
  annotations: WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
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
    return executeSafely("compare_profiles", async () => {
      const [current, other] = await Promise.all([
        loadPublicProfile(handle),
        loadPublicProfile(otherHandle),
      ]);
      if (!current) return missingProfile(handle);
      if (!other) return missingProfile(otherHandle);
      const currentScore = current.displayScore ?? current.adjustedComposite;
      const otherScore = other.displayScore ?? other.adjustedComposite;
      return JSON.stringify({
        current: {
          handle,
          score: currentScore,
          tier: current.displayTier ?? current.tier,
          dimensions: current.dimensions,
        },
        other: {
          handle: otherHandle,
          score: otherScore,
          tier: other.displayTier ?? other.tier,
          dimensions: other.dimensions,
        },
        differences: {
          score: otherScore - currentScore,
          dimensions: compareDimensions(
            current.dimensions,
            Object.fromEntries(Object.entries(other.dimensions)),
          ),
        },
      });
    });
  },
};

const getEmbedSnippet: ServerMcpTool = {
  name: "get_embed_snippet",
  description: "Return ready-to-paste Markdown and HTML for a live Chapa badge.",
  inputSchema: FIND_PROFILE_INPUT_SCHEMA,
  annotations: WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
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
