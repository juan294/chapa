import {
  DIMENSION_KEYS,
  type ClientImpactV6Result,
  type StatsData,
} from "@chapa/shared";
import {
  CURRENT_VERIFICATION_HASH_HEX_LENGTH,
  VERIFICATION_RECORD_TTL_DAYS,
} from "@/lib/verification/constants";
import { sanitizeFreeTextForAgent } from "./shared-tools";
import { SITE_TOOL_MAP } from "./site-tool-map";

export const PRODUCTION_BASE_URL = "https://chapa.thecreativetoken.com";

export const FIND_PROFILE_INPUT_SCHEMA = {
  type: "object",
  properties: {
    handle: { type: "string" },
  },
  required: ["handle"],
  additionalProperties: false,
};

export const COMPARE_PROFILES_INPUT_SCHEMA = {
  type: "object",
  properties: {
    other_handle: { type: "string" },
  },
  required: ["other_handle"],
  additionalProperties: false,
};

export const SITE_CAPABILITIES = {
  whatIsChapa:
    "Chapa turns developer activity into a live, verifiable Impact Profile and embeddable badge that summarizes delivery, quality, consistency, breadth, and optional craft.",
  toolMap: SITE_TOOL_MAP,
  entryPoints: {
    demoStudio: `${PRODUCTION_BASE_URL}/studio?demo=1`,
    profile: `${PRODUCTION_BASE_URL}/u/<handle>`,
    scoringMethodology: `${PRODUCTION_BASE_URL}/about/scoring`,
    llmsTxt: `${PRODUCTION_BASE_URL}/llms.txt`,
  },
  boundaries: [
    "Login uses GitHub OAuth and only a human can complete it.",
    "Configuration saves are proposed by agents and confirmed by a human on-page.",
    "Tools register per page; navigate to a route to use its tools.",
  ],
};

export function publicStats(stats: StatsData) {
  return {
    // Projection for the WebMCP tool boundary only -- bounded and neutralised
    // before crossing into a visitor's agent context. The SVG and share-page
    // HTML render paths consume `stats.displayName` directly and are
    // untouched by this projection (#1171 / SE-M2).
    displayName: sanitizeFreeTextForAgent(stats.displayName),
    commitsTotal: stats.commitsTotal,
    activeDays: stats.activeDays,
    prsMergedCount: stats.prsMergedCount,
    reviewsSubmittedCount: stats.reviewsSubmittedCount,
    issuesClosedCount: stats.issuesClosedCount,
    reposContributed: stats.reposContributed,
    totalStars: stats.totalStars,
    totalForks: stats.totalForks,
    totalWatchers: stats.totalWatchers,
  };
}

export function compareDimensions(
  current: ClientImpactV6Result["dimensions"],
  other: Record<string, unknown>,
): Partial<Record<(typeof DIMENSION_KEYS)[number], number>> {
  const differences: Partial<Record<(typeof DIMENSION_KEYS)[number], number>> = {};
  for (const key of DIMENSION_KEYS) {
    const currentScore = current[key];
    const otherScore = other[key];
    if (typeof currentScore === "number" && typeof otherScore === "number") {
      differences[key] = otherScore - currentScore;
    }
  }
  return differences;
}

// Source: the public `about.verification.*` copy and lib/verification/hmac.ts.
// Keep the guarantees and limits aligned with that user-facing explanation.
export const VERIFICATION_EXPLANATION = {
  algorithm: "HMAC-SHA256",
  howItWorks:
    `Current Chapa badges use a deterministic payload from the badge profile fields, sign it with a server-held secret key, and use the first ${CURRENT_VERIFICATION_HASH_HEX_LENGTH} hexadecimal characters (128 bits) as the verification code.`,
  proves: [
    "Only Chapa can issue the hash for the original signed payload because only the Chapa server knows the signing secret.",
    "Changing any field in that original payload would produce a different hash.",
    "The stored verification record exposes a subset of the original values for manual comparison and binds them to a specific date.",
  ],
  doesNotProve: [
    "This lookup does not recompute the HMAC from an SVG, and the stored record does not expose every signed payload field for manual comparison.",
    "It does not independently prove that the underlying platform data is accurate; Chapa trusts its platform data sources.",
    "It does not prevent someone from editing an SVG file; it makes changes to signed fields detectable.",
    `It is not a blockchain or permanent public ledger; verification records expire after ${VERIFICATION_RECORD_TTL_DAYS} days.`,
  ],
} as const;

export function verificationCodeFormat(hash: string): string {
  return hash.length === CURRENT_VERIFICATION_HASH_HEX_LENGTH
    ? `Current ${CURRENT_VERIFICATION_HASH_HEX_LENGTH}-character verification code.`
    : `Verified legacy ${hash.length}-character verification code.`;
}
