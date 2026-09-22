import {
  DIMENSION_KEYS,
  type StatsData,
} from "@chapa/shared";
import {
  CURRENT_VERIFICATION_HASH_HEX_LENGTH,
  VERIFICATION_CODE_PATTERN,
  parseVerificationTokenV7,
  VERIFICATION_RECORD_TTL_DAYS,
} from "@/lib/verification/constants";
import {
  EXPLAIN_DIMENSION_INPUT_SCHEMA,
  sanitizeFreeTextForAgent,
} from "./shared-tools";
import { SITE_TOOL_MAP } from "./site-tool-map";

export const PRODUCTION_BASE_URL = "https://chapa.thecreativetoken.com";

export const PUBLIC_PROFILE_SIGN_IN_NOTE =
  "Share and badge URLs can render public GitHub activity, but public profile tools require the handle's owner to have signed in to Chapa.";

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

export const COMPARE_PROFILES_SERVER_INPUT_SCHEMA = {
  type: "object",
  properties: {
    ...FIND_PROFILE_INPUT_SCHEMA.properties,
    ...COMPARE_PROFILES_INPUT_SCHEMA.properties,
  },
  required: [
    ...FIND_PROFILE_INPUT_SCHEMA.required,
    ...COMPARE_PROFILES_INPUT_SCHEMA.required,
  ],
  additionalProperties: false,
};

export const EXPLAIN_DIMENSION_SERVER_INPUT_SCHEMA = {
  type: "object",
  properties: {
    ...FIND_PROFILE_INPUT_SCHEMA.properties,
    ...EXPLAIN_DIMENSION_INPUT_SCHEMA.properties,
  },
  required: [
    ...FIND_PROFILE_INPUT_SCHEMA.required,
    ...EXPLAIN_DIMENSION_INPUT_SCHEMA.required,
  ],
  additionalProperties: false,
};

export const VERIFY_BADGE_SERVER_INPUT_SCHEMA = {
  type: "object",
  properties: {
    hash: { type: "string", pattern: VERIFICATION_CODE_PATTERN.source },
  },
  required: ["hash"],
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

// Source: the public `about.verification.*` copy and lib/verification/hmac.ts.
// Keep the guarantees and limits aligned with that user-facing explanation.
export const VERIFICATION_EXPLANATION = {
  algorithm: "HMAC-SHA256",
  howItWorks:
    `Legacy Chapa badges used a deterministic payload from the badge profile fields, sign it with a server-held secret key, and use the first ${CURRENT_VERIFICATION_HASH_HEX_LENGTH} hexadecimal characters (128 bits) as the verification code.`,
  proves: [
    "Only Chapa can issue the hash for the original signed payload because only the Chapa server knows the signing secret.",
    "Changing any field in that original payload would produce a different hash.",
    "The stored verification record exposes a subset of the original values for manual comparison and binds them to a specific date.",
  ],
  doesNotProve: [
    "This lookup does not recompute the HMAC from an SVG, and the stored record does not expose every signed payload field for manual comparison.",
    "It does not independently prove that the underlying platform data is accurate; Chapa trusts its platform data sources.",
    "It does not prevent someone from editing an SVG file; an unchanged original link still returns the original record.",
    `Legacy verification records expire after ${VERIFICATION_RECORD_TTL_DAYS} days; complete historical signed inputs are unavailable for v7 replay.`,
  ],
} as const;

export const RECEIPT_VERIFICATION_EXPLANATION = {
  algorithm: "HMAC-SHA256",
  howItWorks: "V7 signs the complete canonical receipt with a server-held secret key. Its token contains the immutable revision UUID and full 256-bit HMAC.",
  proves: ["Recorded issuance, authentication with the available key, and arithmetic replay are separate states.", "An authenticated signature binds the original canonical receipt, including optional Craft and the scoring reference."],
  doesNotProve: ["This lookup does not inspect an SVG or authenticate the identity displayed in an edited badge.", "A signature does not independently prove source evidence, software quality or causal impact.", "A revoked revision has no retrievable receipt; its tombstone does not authenticate a supplied signature.", "Withdrawal removes public access, but independent prior downloads cannot be recalled."],
} as const;

export function verificationCodeFormat(hash: string): string {
  return parseVerificationTokenV7(hash)
    ? "V7 receipt revision and full 256-bit HMAC."
    : `Legacy ${hash.length}-character verification code; lookup does not replay the complete signed payload.`;
}

const COUNT_BOUND_SCHEMA = {
  type: "object", properties: { lower: { type: "number", minimum: 0 }, upper: { type: "number", minimum: 0 } },
  required: ["lower", "upper"], additionalProperties: false,
};
/** An agent can construct a valid scenario from the registered schema alone. */
export const OBSERVED_SIMULATE_SCORE_INPUT_SCHEMA = {
  type: "object", properties: {
    dimensions: { type: "object", properties: Object.fromEntries(DIMENSION_KEYS.map(key => [key, { type: "number", minimum: 0, maximum: 100 }])), additionalProperties: false },
    counts: { type: "object", properties: {
      deliveryUnits: COUNT_BOUND_SCHEMA, activeIsoWeeks: COUNT_BOUND_SCHEMA,
      eligibleProjects: COUNT_BOUND_SCHEMA, eligibleCategories: COUNT_BOUND_SCHEMA,
      quality: { type: "object", properties: Object.fromEntries(["rationale", "verification", "review_or_correction", "outcome_followup"].map(key => [key, COUNT_BOUND_SCHEMA])), additionalProperties: false },
    }, additionalProperties: false },
  }, oneOf: [{ required: ["dimensions"] }, { required: ["counts"] }], additionalProperties: false,
};
